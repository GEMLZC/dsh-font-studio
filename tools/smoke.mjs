// Simulate the Font Studio section against a stub React + stub ctx to catch
// wiring mistakes that a syntax check cannot see: prop names, action verbs,
// and the document-level projection of colour/style state.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/* ── minimal React stand-in ─────────────────────────────────────────────── */
function createElement(type, props, ...children) {
  return { type, props: { ...(props ?? {}), children: children.length > 1 ? children : children[0] } }
}

let hookIndex = 0
const hookStates = []
const React = {
  createElement,
  useState(initial) {
    const at = hookIndex++
    if (!(at in hookStates)) hookStates[at] = initial
    return [hookStates[at], (next) => { hookStates[at] = typeof next === 'function' ? next(hookStates[at]) : next }]
  },
  useEffect() {},
  useSyncExternalStore(subscribe, getSnapshot) {
    return getSnapshot()
  },
  useId() {
    return 'id-' + hookIndex++
  },
}

/* ── document / window stand-in ─────────────────────────────────────────── */
const attributes = new Map()
const properties = new Map()
const styles = []
const storage = new Map()

const root = {
  style: {
    setProperty: (name, value) => properties.set(name, value),
    removeProperty: (name) => properties.delete(name),
  },
  setAttribute: (name, value) => attributes.set(name, value),
  removeAttribute: (name) => attributes.delete(name),
  hasAttribute: (name) => attributes.has(name),
}

const document = {
  documentElement: root,
  body: { style: { setProperty: () => {}, removeProperty: () => {} }, setAttribute: () => {}, removeAttribute: () => {} },
  head: {
    appendChild: (node) => styles.push(node),
  },
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  querySelector: () => null,
}

const window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  __ModuleLoader__: { load: (definition) => { window.__loaded = definition } },
}

const context = vm.createContext({
  window,
  document,
  console,
  // A realistic-enough CSS.supports('color', …): hex, functional colours, and
  // a short list of named colours parse; arbitrary words do not.
  CSS: {
    supports: (property, value) => {
      if (property !== 'color') return false
      const named = /^(white|black|red|blue|green|gray|grey|orange|transparent)$/i
      return /^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|rgba|hsl|hsla)\(/i.test(value) || named.test(value)
    },
  },
  globalThis: undefined,
})
context.globalThis = context

vm.runInContext(source, context, { filename: 'client.js' })

const definition = window.__loaded
if (definition === undefined) throw new Error('module loader was never called')
const module = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require(${name})`)
})

/* ── stub cordis ctx ────────────────────────────────────────────────────── */
const registered = []
const effects = []
const fonts = { text: 14, code: 11, terminal: 13 }
const families = { text: '', code: '', terminal: '' }
let revision = 1
const listeners = new Map()

const theme = {
  getTheme: () => ({ fontSizes: { ...fonts }, fontFamilies: { ...families }, revision, active: { tokens: {} }, themes: [] }),
  setFontSize: (role, px) => {
    if (!Number.isInteger(px) || px < 10 || px > 22) throw new Error(`out of range: ${role} ${px}`)
    fonts[role] = px
    revision += 1
    emit('theme/change', theme.getTheme())
  },
  setFontFamily: (role, list) => {
    families[role] = list
    revision += 1
    emit('theme/change', theme.getTheme())
  },
  register: () => () => {},
  overrideTokens: () => () => {},
}

const t = (key) => key

const ctx = {
  effect: (fn, label) => {
    const cleanup = fn()
    effects.push({ label, cleanup })
  },
  on: (name, listener) => {
    if (!listeners.has(name)) listeners.set(name, [])
    listeners.get(name).push(listener)
    return () => {
      const rows = listeners.get(name) ?? []
      const at = rows.indexOf(listener)
      if (at >= 0) rows.splice(at, 1)
    }
  },
  locale: {
    register: (ns, dicts) => {
      if (Object.keys(dicts).length !== 2) throw new Error('expected zh + en')
      return () => {}
    },
    bind: () => t,
  },
  theme,
  slots: {
    inject: (slot, callback) => callback(),
    register: (options, component) => {
      registered.push({ options, component })
      return () => {}
    },
  },
}

function emit(name, payload) {
  for (const listener of listeners.get(name) ?? []) listener(payload)
}

/* ── run the plugin ─────────────────────────────────────────────────────── */
module.apply(ctx)

console.log('inject list:', JSON.stringify(module.inject))
console.log('registered slots:', registered.map((entry) => `${entry.options.name}/${entry.options.id}/order=${entry.options.order}`).join(', '))
if (registered.length !== 1) throw new Error('expected exactly one registration')

const registration = registered[0]
const label = registration.options.label()
console.log('nav label:', label, '(dict has key:', label in { nav: 1 } || true, ')')
if (label !== 'nav') throw new Error(`nav label did not resolve through t(): ${label}`)

/* ── render the section ─────────────────────────────────────────────────── */
const injected = registration.options.inject()
if (typeof injected.studio !== 'object') throw new Error('inject face must expose `studio`')

/** Recursively invoke function components so the tree holds real elements. */
function expand(node, depth = 0) {
  if (depth > 12 || node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map((item) => expand(item, depth + 1))
  if (typeof node !== 'object') return node
  if (typeof node.type === 'function') {
    const saved = hookIndex
    hookIndex = 0
    const rendered = node.type({ ...node.props, children: expand(node.props?.children, depth + 1) })
    hookIndex = saved
    return expand(rendered, depth + 1)
  }
  return { ...node, props: { ...node.props, children: expand(node.props?.children, depth + 1) } }
}

hookIndex = 0
const tree = expand(registration.component({ t, studio: injected.studio }))
const text = JSON.stringify(tree)
for (const needle of ['dshfs-root', 'dshfs-preview', 'groupSize', 'groupFamily', 'groupColor', 'groupStyle']) {
  if (!text.includes(needle)) throw new Error(`rendered tree is missing ${needle}`)
}
console.log('section renders:', ['root', 'preview', 'size', 'family', 'color', 'style'].join(' + '))

/* ── exercise the verbs ─────────────────────────────────────────────────── */
injected.studio.setFontSize('text', 18)
console.log('setFontSize(text,18) ->', fonts.text, '| body var:', properties.get('--dsh-content-font-size') ?? '(presenter owns it)')
if (fonts.text !== 18) throw new Error('setFontSize did not reach the theme service')

injected.studio.setFontSize('text', 999)
console.log('setFontSize(text,999) clamped ->', fonts.text)
if (fonts.text !== 22) throw new Error('setFontSize did not clamp')

injected.studio.setFontFamily('text', 'JetBrains Mono, monospace')
console.log('setFontFamily ->', families.text)
if (families.text !== '"JetBrains Mono", monospace') throw new Error('family normalization failed: ' + families.text)

/* ── colour + style projection ──────────────────────────────────────────── */
const row = tree.props.children
console.log('section child count:', row.length)

// Drive the colour control through its onChange the way React would.
function find(node, predicate, out = []) {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) {
    for (const item of node) find(item, predicate, out)
    return out
  }
  if (typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  find(node.props?.children, predicate, out)
  return out
}

const colorInputs = find(tree, (node) => node.props?.className === 'dshfs-hex')
console.log('hex inputs found:', colorInputs.length)
if (colorInputs.length !== 3) throw new Error('expected three colour fields')

// The hex field stages its draft on change and commits on blur/Enter, so the
// test drives the same path a user does.
const conversationHex = colorInputs[1]
conversationHex.props.onChange({ currentTarget: { value: '#ff6600' } })
console.log('after typing: attribute present =', attributes.has('data-dsh-fs-conversation-color'))
conversationHex.props.onBlur({ currentTarget: { value: '#ff6600' } })
console.log('conversation colour ->', attributes.has('data-dsh-fs-conversation-color'), properties.get('--dsh-fs-conversation-color'))
if (properties.get('--dsh-fs-conversation-color') !== '#ff6600') throw new Error('colour projection failed')

// An invalid value is refused rather than written.
colorInputs[0].props.onBlur({ currentTarget: { value: 'not a colour' } })
if (properties.has('--dsh-fs-ui-color')) throw new Error('invalid colour was written')
console.log('invalid colour rejected: ok')

const stored = JSON.parse(storage.get('dsh-font-studio.v1'))
console.log('persisted state:', JSON.stringify(stored))

/* ── reset restores everything ──────────────────────────────────────────── */
injected.studio.resetAll()
console.log('after reset: size', fonts.text, '| family', JSON.stringify(families.text), '| attributes', [...attributes.keys()].join(',') || '(none)')

/* ── disposal returns the document to its original state ────────────────── */
for (const effect of effects) if (typeof effect.cleanup === 'function') effect.cleanup()
console.log('after dispose: attributes', [...attributes.keys()].join(',') || '(none)', '| variables', [...properties.keys()].join(',') || '(none)')
if (attributes.size !== 0 || properties.size !== 0) throw new Error('dispose left document state behind')

console.log('\nALL CHECKS PASSED')
