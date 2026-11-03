// Static checks for the Font Studio client bundle: locale key parity, literal
// translation keys used by the component tree, and CSS constant integrity.
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function sliceObject(name) {
  const start = source.indexOf(`const ${name} = {`)
  if (start < 0) throw new Error(`missing ${name}`)
  let index = source.indexOf('{', start)
  let depth = 0
  let end = index
  for (; end < source.length; end += 1) {
    const ch = source[end]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  return source.slice(index, end + 1)
}

const zh = new Function(`return (${sliceObject('zh')})`)()
const en = new Function(`return (${sliceObject('en')})`)()

const zhKeys = Object.keys(zh).sort()
const enKeys = Object.keys(en).sort()
const onlyZh = zhKeys.filter((key) => !(key in en))
const onlyEn = enKeys.filter((key) => !(key in zh))
console.log(`zh keys: ${zhKeys.length}, en keys: ${enKeys.length}`)
console.log(`only in zh: ${JSON.stringify(onlyZh)}`)
console.log(`only in en: ${JSON.stringify(onlyEn)}`)

// Every literal key the component tree asks for.
const literals = new Set()
for (const match of source.matchAll(/\bt\('([^']+)'\)/g)) literals.add(match[1])
const missing = [...literals].filter((key) => !(key in zh) || !(key in en)).sort()
console.log(`literal t() keys: ${literals.size}; missing: ${JSON.stringify(missing)}`)

// Dynamic families the tree composes.
const dynamic = [
  ...['text', 'code', 'terminal'].flatMap((role) => [
    `size.${role}.title`,
    `size.${role}.desc`,
    `size.${role}.increase`,
    `size.${role}.decrease`,
    `family.${role}.title`,
    `family.${role}.desc`,
  ]),
  ...['default', 'comfort', 'compact', 'soft', 'strong'].map((name) => `preset.${name}`),
  ...['auto', 'light', 'regular', 'medium', 'semibold'].map((name) => `style.weight.${name}`),
]
const missingDynamic = dynamic.filter((key) => !(key in zh) || !(key in en))
console.log(`dynamic keys: ${dynamic.length}; missing: ${JSON.stringify(missingDynamic)}`)

// CSS constant: balanced braces, no stray template interpolation.
const cssStart = source.indexOf('const STYLESHEET = `')
const cssBody = source.slice(cssStart + 'const STYLESHEET = `'.length, source.indexOf('\n`\n', cssStart))
const braces = [...cssBody].reduce((acc, ch) => acc + (ch === '{' ? 1 : ch === '}' ? -1 : 0), 0)
console.log(`css chars: ${cssBody.length}, brace balance: ${braces}`)
console.log(`css has interpolation: ${/\$\{/.test(cssBody)}`)
console.log(`css important rules: ${(cssBody.match(/!important/g) ?? []).length}`)
