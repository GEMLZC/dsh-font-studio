/* dsh-font-studio — browser half.
 *
 * A single Settings page that owns every typography decision of the shell:
 *
 *   · 字号     text / code / terminal  → the Client theme service (persisted by the Host)
 *   · 字体族   text / code / terminal  → the Client theme service (persisted by the Host)
 *   · 字体颜色 界面 / 会话正文 / 代码   → `--dsw-alias-label-primary` and `--shiki-foreground`
 *                                        re-declared inside the host's own token scopes
 *   · 字体风格 预设 / 字重 / 斜体 / 字间距 / 行高 → scoped text rules
 *
 * Colours and style go through CSS custom properties on the token names the
 * shipped stylesheets already read, so nothing is repainted by hand and the
 * light/dark palettes keep working. Font size and family go through
 * `ctx.theme`, which is the Host-persisted preference the Appearance row also
 * writes — the two surfaces never disagree.
 *
 * Wrapped in an IIFE: every client bundle shares ONE lexical scope, so a
 * top-level `const STORAGE_KEY` would collide with another plugin's.
 */
;(function () {
  const PKG_ID = 'dsh-font-studio'
  const NS = 'fontStudio'
  const STORAGE_KEY = 'dsh-font-studio.v1'
  const SECTION_ID = 'font-studio'

  /** Colour + style keys this page persists itself (the Host stores size/family). */
  const DEFAULT_STATE = Object.freeze({
    uiColor: '',
    conversationColor: '',
    codeColor: '',
    weight: '',
    italic: false,
    leading: null,
    tracking: null,
    preset: 'default',
  })

  /** Font-role metadata; ranges and defaults mirror the Host theme service. */
  const ROLES = [
    { role: 'text', min: 10, max: 22, fallback: 14, variable: '--dsh-content-font-size' },
    { role: 'code', min: 10, max: 16, fallback: 11, variable: '--dsh-code-font-size' },
    { role: 'terminal', min: 10, max: 20, fallback: 13, variable: '--dsh-terminal-font-size' },
  ]

  /** Style presets; `null` means "leave the host value alone". */
  const PRESETS = {
    default: { weight: '', italic: false, leading: null, tracking: null },
    comfort: { weight: '400', italic: false, leading: 1.85, tracking: 0.01 },
    compact: { weight: '400', italic: false, leading: 1.5, tracking: 0 },
    soft: { weight: '300', italic: false, leading: 1.75, tracking: 0.005 },
    strong: { weight: '500', italic: false, leading: 1.7, tracking: 0.015 },
  }

  const WEIGHTS = [
    { value: '', key: 'style.weight.auto' },
    { value: '300', key: 'style.weight.light' },
    { value: '400', key: 'style.weight.regular' },
    { value: '500', key: 'style.weight.medium' },
    { value: '600', key: 'style.weight.semibold' },
  ]

  /** Family shortcuts offered under each family field. */
  const FAMILY_SUGGESTIONS = {
    text: [
      'PingFang SC',
      'Microsoft YaHei',
      'Source Han Sans SC',
      'Noto Sans SC',
      'HarmonyOS Sans SC',
      'Segoe UI',
      'Inter',
      'Georgia',
    ],
    code: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'SF Mono', 'Menlo'],
    terminal: ['Cascadia Mono', 'JetBrains Mono', 'Consolas', 'Menlo', 'monospace'],
  }

  /** CSS Fonts keywords that must stay unquoted when a list is normalized. */
  const GENERIC_FAMILIES = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
    'fangsong', '-apple-system', 'blinkmacsystemfont',
  ])

  /* ── stylesheet ─────────────────────────────────────────────────────────── */

  const STYLESHEET = `
.dshfs-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  padding: 4px 0 28px;
}
.dshfs-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 0 0 12px;
}
.dshfs-headText {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dshfs-title {
  font-size: 15px;
  line-height: 24px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}
.dshfs-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dshfs-reset {
  flex: none;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 0.5px solid var(--dsw-alias-border-l3);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dshfs-reset:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* ── live preview ──────────────────────────────────────────────────────── */
.dshfs-preview {
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-lg, 16px);
  background: var(--dsw-alias-bg-layer-2);
  padding: 14px 16px 16px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dshfs-previewLabel {
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
.dshfs-previewBody {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.dshfs-previewInline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.dshfs-previewCode {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-markdown-code-block);
  overflow-x: auto;
  white-space: pre;
}
.dshfs-previewNote {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── rows ──────────────────────────────────────────────────────────────── */
.dshfs-group {
  display: flex;
  flex-direction: column;
}
.dshfs-groupTitle {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  padding: 18px 0 2px;
}
.dshfs-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dshfs-group > .dshfs-row:last-child {
  border-bottom: 0;
}
.dshfs-rowText {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 8px;
}
.dshfs-rowTitle {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dshfs-rowDesc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dshfs-control {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* stepper */
.dshfs-stepper {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-module-platform);
}
.dshfs-stepBtn {
  width: 26px;
  height: 30px;
  border: 0;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dshfs-stepBtn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-1);
}
.dshfs-stepBtn:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: default;
}
.dshfs-stepValue {
  min-width: 34px;
  text-align: center;
  font-size: 14px;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dshfs-unit {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* text field */
.dshfs-field {
  box-sizing: border-box;
  width: 220px;
  max-width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.dshfs-field:focus-visible {
  border-color: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}
.dshfs-field::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dshfs-suggest {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 240px;
}
.dshfs-chip {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 22px;
  cursor: pointer;
  white-space: nowrap;
}
.dshfs-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dshfs-chip[aria-pressed='true'] {
  border-color: var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-state-business-tertiary);
}

/* colour control */
.dshfs-colorWrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dshfs-swatchWrap {
  position: relative;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: var(--dsw-radius-sm, 8px);
  border: 0.5px solid var(--dsw-alias-border-l3);
  overflow: hidden;
}
.dshfs-swatch {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.dshfs-swatchWrap[data-empty='true']::after {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 3px;
  pointer-events: none;
  background:
    linear-gradient(135deg, transparent 46%, var(--dsw-alias-label-tertiary) 46%, var(--dsw-alias-label-tertiary) 54%, transparent 54%);
}
.dshfs-hex {
  width: 106px;
  height: 30px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  outline: none;
}
.dshfs-hex:focus-visible {
  border-color: var(--dsw-alias-state-business-primary);
}
.dshfs-iconBtn {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dshfs-iconBtn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* switch */
.dshfs-switch {
  width: 38px;
  height: 22px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--dsw-alias-bg-module-platform);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: background var(--ds-transition-duration-fast, 0.1s) var(--ds-ease-in-out, ease);
}
.dshfs-switch[aria-checked='true'] {
  background: var(--dsw-alias-brand-primary);
}
.dshfs-knob {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--dsw-static-neutral-00, #fff);
  transition: transform var(--ds-transition-duration-fast, 0.1s) var(--ds-ease-in-out, ease);
}
.dshfs-switch[aria-checked='true'] .dshfs-knob {
  transform: translateX(16px);
}

/* slider */
.dshfs-sliderWrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: 220px;
  justify-content: flex-end;
}
.dshfs-range {
  flex: 1 1 auto;
  min-width: 90px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
}
.dshfs-rangeValue {
  flex: 0 0 auto;
  min-width: 52px;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

/* ── live typography of the conversation ───────────────────────────────── */
/* 界面文字颜色：覆盖 Host 在 body 上声明的正文色令牌。自定义属性的 !important 是必要的：
   第三方主题（如换肤插件）会把令牌写成 body 的行内样式，只有带 !important 的
   自定义属性声明才能压过它。 */
:root[data-dsh-fs-ui-color] body {
  --dsw-alias-label-primary: var(--dsh-fs-ui-color) !important;
}
/* 会话正文颜色：只在会话流节点内覆盖同一令牌。 */
:root[data-dsh-fs-conversation-color] [data-chat-flow-key] {
  --dsw-alias-label-primary: var(--dsh-fs-conversation-color) !important;
}
/* 代码颜色：shiki 根节点用内联 style 读取这个变量。 */
:root[data-dsh-fs-code-color] [data-chat-flow-key] {
  --shiki-foreground: var(--dsh-fs-code-color) !important;
}
:root[data-dsh-fs-weight] [data-chat-flow-key] {
  font-weight: var(--dsh-fs-weight);
}
:root[data-dsh-fs-italic] [data-chat-flow-key] {
  font-style: italic;
}
:root[data-dsh-fs-leading] [data-chat-flow-key] {
  line-height: var(--dsh-fs-leading);
}
:root[data-dsh-fs-tracking] [data-chat-flow-key] {
  letter-spacing: var(--dsh-fs-tracking);
}
/* Markdown re-declares the whole font shorthand on its container, so the text
   elements need the longhands spelled out once more. */
:root[data-dsh-fs-weight] [data-chat-flow-key] :is(p, li, td, th, blockquote, dd, dt) {
  font-weight: var(--dsh-fs-weight) !important;
}
:root[data-dsh-fs-italic] [data-chat-flow-key] :is(p, li, td, th, blockquote, dd, dt, h1, h2, h3, h4, h5, h6) {
  font-style: italic !important;
}
:root[data-dsh-fs-leading] [data-chat-flow-key] :is(p, li, td, th, blockquote, dd, dt, h1, h2, h3, h4, h5, h6) {
  line-height: var(--dsh-fs-leading) !important;
}
:root[data-dsh-fs-tracking] [data-chat-flow-key] :is(p, li, td, th, blockquote, dd, dt, h1, h2, h3, h4, h5, h6) {
  letter-spacing: var(--dsh-fs-tracking) !important;
}
`

  /* ── dictionaries ───────────────────────────────────────────────────────── */

  const zh = {
    nav: '字体工作室',
    title: '字体工作室',
    desc: '字号、字体族、文字颜色与字体风格；修改即时生效，字号与字体族和「外观」页共用同一份偏好。',
    reset: '恢复默认',
    preview: '实时预览',
    previewNote: '预览按当前设置渲染；颜色与风格同时作用于会话区的聊天记录。',
    previewSample:
      '把字体调成自己喜欢的样子：中文与 English 混排，数字 0123456789，以及标点（，。！？）；The quick brown fox jumps over the lazy dog.',
    previewUi: '界面文字颜色示例',
    previewCode: "const studio = { family: 'JetBrains Mono', size: 12 }",
    groupSize: '字号',
    groupFamily: '字体族',
    groupColor: '字体颜色',
    groupStyle: '字体风格',
    'size.text.title': '正文字号',
    'size.text.desc': '会话内容与输入框的字号',
    'size.code.title': '代码字号',
    'size.code.desc': '代码块、行内代码与工具输出',
    'size.terminal.title': '终端字号',
    'size.terminal.desc': '侧栏终端的字号',
    'size.text.increase': '增大正文字号',
    'size.text.decrease': '减小正文字号',
    'size.code.increase': '增大代码字号',
    'size.code.decrease': '减小代码字号',
    'size.terminal.increase': '增大终端字号',
    'size.terminal.decrease': '减小终端字号',
    unit: 'px',
    'family.text.title': '正文字体',
    'family.text.desc': '界面与会话正文；多个字体用逗号分隔，留空用默认',
    'family.code.title': '代码字体',
    'family.code.desc': '代码块、行内代码与工具输出，留空用默认',
    'family.terminal.title': '终端字体',
    'family.terminal.desc': '侧栏终端，留空用默认',
    familyPlaceholder: '默认字体',
    'color.ui': '界面文字颜色',
    'color.ui.desc': '全局正文色，影响侧栏、设置与会话',
    'color.conversation': '会话正文颜色',
    'color.conversation.desc': '只作用于聊天记录，界面其余部分不变',
    'color.code': '代码颜色',
    'color.code.desc': '代码块的基础前景色，语法高亮配色保持不变',
    colorAuto: '默认',
    colorClear: '清除颜色',
    colorInvalid: '无法识别的颜色值',
    'style.preset': '预设风格',
    'style.preset.desc': '一次套用字重、行高与字间距',
    'preset.default': '默认',
    'preset.comfort': '舒适阅读',
    'preset.compact': '紧凑',
    'preset.soft': '轻柔',
    'preset.strong': '强调',
    'style.weight': '字重',
    'style.weight.desc': '会话正文的字重，标题保持原有层级',
    'style.weight.auto': '默认',
    'style.weight.light': '细体 300',
    'style.weight.regular': '常规 400',
    'style.weight.medium': '中等 500',
    'style.weight.semibold': '半粗 600',
    'style.italic': '斜体',
    'style.italic.desc': '将会话正文设为斜体',
    'style.leading': '行高',
    'style.leading.desc': '会话正文的行高倍数，点右侧 × 回到默认',
    'style.tracking': '字间距',
    'style.tracking.desc': '会话正文的字间距（em），点右侧 × 回到默认',
    styleAuto: '默认',
  }

  const en = {
    nav: 'Font Studio',
    title: 'Font Studio',
    desc: 'Size, family, text colour and typographic style. Size and family share one preference with Appearance.',
    reset: 'Reset',
    preview: 'Live preview',
    previewNote: 'The preview renders with the current settings; colour and style also apply to the chat.',
    previewSample:
      'Set the type to your taste: 中文与 English mixed, digits 0123456789, and punctuation (,.!?); the quick brown fox jumps over the lazy dog.',
    previewUi: 'Interface text colour',
    previewCode: "const studio = { family: 'JetBrains Mono', size: 12 }",
    groupSize: 'Size',
    groupFamily: 'Family',
    groupColor: 'Colour',
    groupStyle: 'Style',
    'size.text.title': 'Body size',
    'size.text.desc': 'Conversation content and the composer',
    'size.code.title': 'Code size',
    'size.code.desc': 'Code blocks, inline code and tool output',
    'size.terminal.title': 'Terminal size',
    'size.terminal.desc': 'The sidebar terminal',
    'size.text.increase': 'Increase body size',
    'size.text.decrease': 'Decrease body size',
    'size.code.increase': 'Increase code size',
    'size.code.decrease': 'Decrease code size',
    'size.terminal.increase': 'Increase terminal size',
    'size.terminal.decrease': 'Decrease terminal size',
    unit: 'px',
    'family.text.title': 'Body font',
    'family.text.desc': 'Interface and conversation text. Comma separated; empty uses the default',
    'family.code.title': 'Code font',
    'family.code.desc': 'Code blocks, inline code and tool output. Empty uses the default',
    'family.terminal.title': 'Terminal font',
    'family.terminal.desc': 'The sidebar terminal. Empty uses the default',
    familyPlaceholder: 'Default',
    'color.ui': 'Interface colour',
    'color.ui.desc': 'Global primary text colour: sidebar, settings and conversation',
    'color.conversation': 'Conversation colour',
    'color.conversation.desc': 'Chat records only; the rest of the interface is untouched',
    'color.code': 'Code colour',
    'color.code.desc': 'Base foreground of code blocks; syntax colours are unchanged',
    colorAuto: 'Default',
    colorClear: 'Clear colour',
    colorInvalid: 'Unrecognised colour value',
    'style.preset': 'Preset',
    'style.preset.desc': 'Applies weight, line height and letter spacing together',
    'preset.default': 'Default',
    'preset.comfort': 'Comfort',
    'preset.compact': 'Compact',
    'preset.soft': 'Soft',
    'preset.strong': 'Emphasis',
    'style.weight': 'Weight',
    'style.weight.desc': 'Body weight in the conversation; headings keep their hierarchy',
    'style.weight.auto': 'Default',
    'style.weight.light': 'Light 300',
    'style.weight.regular': 'Regular 400',
    'style.weight.medium': 'Medium 500',
    'style.weight.semibold': 'Semibold 600',
    'style.italic': 'Italic',
    'style.italic.desc': 'Render conversation text in italics',
    'style.leading': 'Line height',
    'style.leading.desc': 'Line-height multiplier for conversation text; × restores the default',
    'style.tracking': 'Letter spacing',
    'style.tracking.desc': 'Letter spacing in em for conversation text; × restores the default',
    styleAuto: 'Default',
  }

  /* ── persisted colour/style state ───────────────────────────────────────── */

  let custom = { ...DEFAULT_STATE }
  const customWatchers = new Set()

  function readStored() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) return { ...DEFAULT_STATE }
      const parsed = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object') return { ...DEFAULT_STATE }
      return normalizeCustom(parsed)
    } catch {
      return { ...DEFAULT_STATE }
    }
  }

  function normalizeCustom(input) {
    const asColor = (value) => (typeof value === 'string' && /^[#a-zA-Z0-9(),.%\s/-]{0,64}$/.test(value) ? value.trim() : '')
    const asNumber = (value, min, max) => {
      const numeric = typeof value === 'number' ? value : Number.parseFloat(value)
      return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : null
    }
    return {
      uiColor: asColor(input.uiColor),
      conversationColor: asColor(input.conversationColor),
      codeColor: asColor(input.codeColor),
      weight: typeof input.weight === 'string' && /^[1-9]00$/.test(input.weight) ? input.weight : '',
      italic: input.italic === true,
      leading: asNumber(input.leading, 1.2, 2.4),
      tracking: asNumber(input.tracking, -0.02, 0.12),
      preset:
        typeof input.preset === 'string' && (input.preset === 'custom' || input.preset in PRESETS)
          ? input.preset
          : 'default',
    }
  }

  function writeStored(next) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* a blocked storage only costs persistence, never the live setting */
    }
  }

  const customSource = {
    subscribe(listener) {
      customWatchers.add(listener)
      return () => customWatchers.delete(listener)
    },
    getSnapshot() {
      return custom
    },
  }

  function setCustom(patch) {
    const next = normalizeCustom({ ...custom, ...patch })
    const same =
      next.uiColor === custom.uiColor &&
      next.conversationColor === custom.conversationColor &&
      next.codeColor === custom.codeColor &&
      next.weight === custom.weight &&
      next.italic === custom.italic &&
      next.leading === custom.leading &&
      next.tracking === custom.tracking &&
      next.preset === custom.preset
    if (same) return
    custom = next
    writeStored(next)
    paintCustom()
    for (const listener of customWatchers) listener()
  }

  /** Project the colour/style state onto the document as token scopes + variables. */
  function paintCustom() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const style = root.style
    const flags = [
      ['data-dsh-fs-ui-color', custom.uiColor, '--dsh-fs-ui-color'],
      ['data-dsh-fs-conversation-color', custom.conversationColor, '--dsh-fs-conversation-color'],
      ['data-dsh-fs-code-color', custom.codeColor, '--dsh-fs-code-color'],
      ['data-dsh-fs-weight', custom.weight, '--dsh-fs-weight'],
      ['data-dsh-fs-leading', custom.leading === null ? '' : `${custom.leading}`, '--dsh-fs-leading'],
      [
        'data-dsh-fs-tracking',
        custom.tracking === null ? '' : `${custom.tracking}em`,
        '--dsh-fs-tracking',
      ],
      ['data-dsh-fs-italic', custom.italic ? '1' : '', '--dsh-fs-italic'],
    ]
    for (const [attribute, value, variable] of flags) {
      if (value === '') {
        root.removeAttribute(attribute)
        style.removeProperty(variable)
      } else {
        root.setAttribute(attribute, '')
        style.setProperty(variable, value)
      }
    }
  }

  function clearCustom() {
    custom = { ...DEFAULT_STATE }
    writeStored(custom)
    paintCustom()
    for (const listener of customWatchers) listener()
  }

  /* ── theme (size + family) mirror ───────────────────────────────────────── */

  let theme = {
    fontSizes: { text: 14, code: 11, terminal: 13 },
    fontFamilies: { text: '', code: '', terminal: '' },
    revision: -1,
  }
  const themeWatchers = new Set()

  const themeSource = {
    subscribe(listener) {
      themeWatchers.add(listener)
      return () => themeWatchers.delete(listener)
    },
    getSnapshot() {
      return theme
    },
  }

  function publishTheme(snapshot) {
    if (snapshot === undefined || snapshot === null) return
    if (snapshot.revision === theme.revision) return
    theme = {
      fontSizes: { ...snapshot.fontSizes },
      fontFamilies: { ...snapshot.fontFamilies },
      revision: snapshot.revision,
    }
    for (const listener of themeWatchers) listener()
  }

  /* ── helpers ────────────────────────────────────────────────────────────── */

  /**
   * Normalize a comma-separated list into a CSS font-family value: quotes,
   * backslashes, angle brackets and control characters are dropped, and every
   * non-generic name is double quoted.
   */
  function normalizeFontFamily(value) {
    return String(value)
      .split(',')
      .map((name) => name.replace(/["'\\<>\u0000-\u001f\u007f]/gu, '').replace(/\s+/gu, ' ').trim())
      .filter((name) => name !== '')
      .map((name) => (GENERIC_FAMILIES.has(name.toLowerCase()) ? name : `"${name}"`))
      .join(', ')
  }

  /**
   * Accept a colour only when it is a plausibly-shaped CSS colour and the
   * browser agrees it parses. The shape check rejects the punctuation that
   * would let a value escape its declaration if it were ever interpolated, and
   * the browser check keeps named colours, rgb()/hsl() and #rrggbbaa working.
   */
  function isValidColor(value) {
    if (value === '') return true
    if (!/^[#a-zA-Z0-9(),.%\s/-]{1,64}$/.test(value)) return false
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return true
    return CSS.supports('color', value)
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  /* ── components ─────────────────────────────────────────────────────────── */

  let React = null
  let h = null

  function Stepper({ t, role, min, max, value, onChange }) {
    return h(
      'div',
      { className: 'dshfs-control' },
      h(
        'div',
        { className: 'dshfs-stepper' },
        h(
          'button',
          {
            type: 'button',
            className: 'dshfs-stepBtn',
            'aria-label': t(`${role}.decrease`),
            disabled: value <= min,
            onClick: () => onChange(clamp(value - 1, min, max)),
          },
          '−',
        ),
        h('span', { className: 'dshfs-stepValue' }, String(value)),
        h(
          'button',
          {
            type: 'button',
            className: 'dshfs-stepBtn',
            'aria-label': t(`${role}.increase`),
            disabled: value >= max,
            onClick: () => onChange(clamp(value + 1, min, max)),
          },
          '+',
        ),
      ),
      h('span', { className: 'dshfs-unit' }, t('unit')),
    )
  }

  function Row({ title, desc, children }) {
    return h(
      'div',
      { className: 'dshfs-row' },
      h(
        'div',
        { className: 'dshfs-rowText' },
        h('div', { className: 'dshfs-rowTitle' }, title),
        desc === undefined ? null : h('div', { className: 'dshfs-rowDesc' }, desc),
      ),
      h('div', { className: 'dshfs-control' }, children),
    )
  }

  /** A family text field plus quick-pick chips; commits on blur or Enter. */
  function FamilyField({ t, role, value, suggestions, onCommit }) {
    const [draft, setDraft] = React.useState(value)
    React.useEffect(() => {
      setDraft(value)
    }, [value])
    const commit = (raw) => {
      onCommit(normalizeFontFamily(raw))
    }
    return h(
      'div',
      { className: 'dshfs-control', style: { flexWrap: 'wrap', justifyContent: 'flex-end', gap: '6px' } },
      h('input', {
        className: 'dshfs-field',
        value: draft,
        placeholder: t('familyPlaceholder'),
        'aria-label': t(`family.${role}.title`),
        spellCheck: false,
        autoComplete: 'off',
        maxLength: 200,
        onChange: (event) => setDraft(event.currentTarget.value),
        onBlur: (event) => commit(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        },
      }),
      h(
        'div',
        { className: 'dshfs-suggest' },
        suggestions.map((name) =>
          h(
            'button',
            {
              type: 'button',
              className: 'dshfs-chip',
              key: name,
              onClick: () => {
                setDraft(name)
                commit(name)
              },
            },
            name,
          ),
        ),
      ),
    )
  }

  /** Colour swatch + hex field + clear button; an empty value means "default". */
  function ColorField({ t, value, onChange }) {
    const [draft, setDraft] = React.useState(value)
    const [invalid, setInvalid] = React.useState(false)
    React.useEffect(() => {
      setDraft(value)
      setInvalid(false)
    }, [value])
    const commit = (raw) => {
      const text = String(raw).trim()
      if (!isValidColor(text)) {
        setInvalid(true)
        return
      }
      setInvalid(false)
      onChange(text)
    }
    const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : /^#[0-9a-fA-F]{3}$/.test(value) ? expandHex(value) : '#888888'
    return h(
      'div',
      { className: 'dshfs-colorWrap' },
      h(
        'span',
        { className: 'dshfs-swatchWrap', 'data-empty': value === '' ? 'true' : undefined },
        h('input', {
          type: 'color',
          className: 'dshfs-swatch',
          value: swatch,
          'aria-label': t('colorAuto'),
          title: value === '' ? t('colorAuto') : value,
          onChange: (event) => {
            const next = event.currentTarget.value
            setDraft(next)
            commit(next)
          },
        }),
      ),
      h('input', {
        className: 'dshfs-hex',
        value: draft,
        placeholder: t('colorAuto'),
        'aria-invalid': invalid || undefined,
        spellCheck: false,
        autoComplete: 'off',
        maxLength: 64,
        onChange: (event) => setDraft(event.currentTarget.value),
        onBlur: (event) => commit(event.currentTarget.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        },
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'dshfs-iconBtn',
          'aria-label': t('colorClear'),
          title: t('colorClear'),
          disabled: value === '',
          onClick: () => {
            setDraft('')
            onChange('')
          },
        },
        '×',
      ),
      invalid ? h('span', { className: 'dshfs-rowDesc' }, t('colorInvalid')) : null,
    )
  }

  function Switch({ label, checked, onChange }) {
    return h(
      'button',
      {
        type: 'button',
        className: 'dshfs-switch',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': label,
        onClick: () => onChange(!checked),
      },
      h('span', { className: 'dshfs-knob' }),
    )
  }

  /** A slider over an optional number; `null` renders as the "default" state. */
  function SliderField({ t, value, min, max, step, fallback, format, onChange }) {
    const current = value === null ? fallback : value
    return h(
      'div',
      { className: 'dshfs-sliderWrap' },
      h('input', {
        className: 'dshfs-range',
        type: 'range',
        min,
        max,
        step,
        value: current,
        'aria-label': t('styleAuto'),
        onChange: (event) => onChange(Number.parseFloat(event.currentTarget.value)),
      }),
      h('span', { className: 'dshfs-rangeValue' }, value === null ? t('styleAuto') : format(value)),
      h(
        'button',
        {
          type: 'button',
          className: 'dshfs-iconBtn',
          'aria-label': t('styleAuto'),
          title: t('styleAuto'),
          disabled: value === null,
          onClick: () => onChange(null),
        },
        '×',
      ),
    )
  }

  function Preview({ t, state, sizes, families }) {
    const bodyStyle = {
      fontFamily: families.text === '' ? undefined : families.text,
      fontSize: `${sizes.text}px`,
      color: state.conversationColor === '' ? undefined : state.conversationColor,
      fontWeight: state.weight === '' ? undefined : state.weight,
      fontStyle: state.italic ? 'italic' : undefined,
      lineHeight: state.leading === null ? 1.7 : state.leading,
      letterSpacing: state.tracking === null ? undefined : `${state.tracking}em`,
    }
    const codeStyle = {
      fontFamily: families.code === '' ? undefined : families.code,
      fontSize: `${sizes.code}px`,
      color: state.codeColor === '' ? undefined : state.codeColor,
      lineHeight: 1.6,
    }
    const uiStyle = {
      fontFamily: families.text === '' ? undefined : families.text,
      color: state.uiColor === '' ? undefined : state.uiColor,
    }
    return h(
      'div',
      { className: 'dshfs-preview' },
      h('div', { className: 'dshfs-previewLabel' }, t('preview')),
      h(
        'div',
        { className: 'dshfs-previewBody' },
        h('div', { style: bodyStyle }, t('previewSample')),
        h('pre', { className: 'dshfs-previewCode', style: codeStyle }, t('previewCode')),
        h('div', { className: 'dshfs-previewInline', style: uiStyle }, t('previewUi')),
      ),
      h('div', { className: 'dshfs-previewNote' }, t('previewNote')),
    )
  }

  /**
   * One Settings page. `props.t` is the locale seat, `props.studio` carries the
   * verbs this plugin injected (size/family writes go through `ctx.theme`).
   */
  function FontStudioSection(props) {
    const t = props.t
    const studio = props.studio
    const state = React.useSyncExternalStore(customSource.subscribe, customSource.getSnapshot, customSource.getSnapshot)
    const snapshot = React.useSyncExternalStore(themeSource.subscribe, themeSource.getSnapshot, themeSource.getSnapshot)

    const setPreset = (name) => {
      const preset = PRESETS[name] ?? PRESETS.default
      setCustom({ ...preset, preset: name })
    }

    const markCustom = (patch) => {
      setCustom({ ...patch, preset: 'custom' })
    }

    return h(
      'div',
      { className: 'dshfs-root' },
      h(
        'div',
        { className: 'dshfs-head' },
        h(
          'div',
          { className: 'dshfs-headText' },
          h('div', { className: 'dshfs-title' }, t('title')),
          h('div', { className: 'dshfs-desc' }, t('desc')),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dshfs-reset',
            onClick: () => studio.resetAll(),
          },
          t('reset'),
        ),
      ),

      h(Preview, { t, state, sizes: snapshot.fontSizes, families: snapshot.fontFamilies }),

      h(
        'div',
        { className: 'dshfs-group' },
        h('div', { className: 'dshfs-groupTitle' }, t('groupSize')),
        ROLES.map(({ role, min, max }) =>
          h(
            Row,
            {
              key: `size-${role}`,
              title: t(`size.${role}.title`),
              desc: t(`size.${role}.desc`),
            },
            h(Stepper, {
              t,
              role: `size.${role}`,
              min,
              max,
              value: snapshot.fontSizes[role],
              onChange: (next) => studio.setFontSize(role, next),
            }),
          ),
        ),
      ),

      h(
        'div',
        { className: 'dshfs-group' },
        h('div', { className: 'dshfs-groupTitle' }, t('groupFamily')),
        ROLES.map(({ role }) =>
          h(
            Row,
            {
              key: `family-${role}`,
              title: t(`family.${role}.title`),
              desc: t(`family.${role}.desc`),
            },
            h(FamilyField, {
              t,
              role,
              value: snapshot.fontFamilies[role],
              suggestions: FAMILY_SUGGESTIONS[role],
              onCommit: (next) => studio.setFontFamily(role, next),
            }),
          ),
        ),
      ),

      h(
        'div',
        { className: 'dshfs-group' },
        h('div', { className: 'dshfs-groupTitle' }, t('groupColor')),
        h(
          Row,
          { title: t('color.ui'), desc: t('color.ui.desc') },
          h(ColorField, {
            t,
            value: state.uiColor,
            onChange: (next) => setCustom({ uiColor: next }),
          }),
        ),
        h(
          Row,
          { title: t('color.conversation'), desc: t('color.conversation.desc') },
          h(ColorField, {
            t,
            value: state.conversationColor,
            onChange: (next) => setCustom({ conversationColor: next }),
          }),
        ),
        h(
          Row,
          { title: t('color.code'), desc: t('color.code.desc') },
          h(ColorField, {
            t,
            value: state.codeColor,
            onChange: (next) => setCustom({ codeColor: next }),
          }),
        ),
      ),

      h(
        'div',
        { className: 'dshfs-group' },
        h('div', { className: 'dshfs-groupTitle' }, t('groupStyle')),
        h(
          Row,
          { title: t('style.preset'), desc: t('style.preset.desc') },
          h(
            'div',
            { className: 'dshfs-suggest' },
            Object.keys(PRESETS).map((name) =>
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshfs-chip',
                  key: name,
                  'aria-pressed': state.preset === name,
                  onClick: () => setPreset(name),
                },
                t(`preset.${name}`),
              ),
            ),
          ),
        ),
        h(
          Row,
          { title: t('style.weight'), desc: t('style.weight.desc') },
          h(
            'div',
            { className: 'dshfs-suggest' },
            WEIGHTS.map(({ value, key }) =>
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshfs-chip',
                  key: value === '' ? 'auto' : value,
                  'aria-pressed': state.weight === value,
                  onClick: () => markCustom({ weight: value }),
                },
                t(key),
              ),
            ),
          ),
        ),
        h(
          Row,
          { title: t('style.italic'), desc: t('style.italic.desc') },
          h(Switch, {
            label: t('style.italic'),
            checked: state.italic,
            onChange: (next) => markCustom({ italic: next }),
          }),
        ),
        h(
          Row,
          { title: t('style.leading'), desc: t('style.leading.desc') },
          h(SliderField, {
            t,
            value: state.leading,
            min: 1.2,
            max: 2.4,
            step: 0.05,
            fallback: 1.7,
            format: (value) => value.toFixed(2),
            onChange: (next) => markCustom({ leading: next }),
          }),
        ),
        h(
          Row,
          { title: t('style.tracking'), desc: t('style.tracking.desc') },
          h(SliderField, {
            t,
            value: state.tracking,
            min: -0.02,
            max: 0.12,
            step: 0.005,
            fallback: 0,
            format: (value) => `${value.toFixed(3)}em`,
            onChange: (next) => markCustom({ tracking: next }),
          }),
        ),
      ),
    )
  }

  function expandHex(value) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }

  /* ── plugin body ────────────────────────────────────────────────────────── */

  /** Hard services: the slot registry, the dictionaries, and the theme owner. */
  const inject = ['slots', 'locale', 'theme']

  function apply(ctx) {
    if (typeof document === 'undefined') return

    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'font-studio: dictionaries')
    const t = ctx.locale.bind(NS)

    ctx.effect(() => {
      const style = document.createElement('style')
      style.dataset.dshFontStudio = ''
      style.textContent = STYLESHEET
      ;(document.head ?? document.documentElement).appendChild(style)
      return () => style.remove()
    }, 'font-studio: stylesheet')

    // Restore the persisted colour/style state and keep it applied for the
    // whole plugin lifetime; the injected scope attributes leave the document
    // exactly as it was on dispose.
    ctx.effect(() => {
      custom = readStored()
      paintCustom()
      return () => {
        clearAppliedAttributes()
      }
    }, 'font-studio: persisted colour and style')

    publishTheme(ctx.theme.getTheme())
    // The listener rides the plugin fiber, so unloading the plugin stops the
    // mirror without touching the theme service itself.
    ctx.effect(() => ctx.on('theme/change', (snapshot) => publishTheme(snapshot)), 'font-studio: theme mirror')

    const writeTheme = () => {
      publishTheme(ctx.theme.getTheme())
    }

    const actions = {
      setFontSize(role, px) {
        const spec = ROLES.find((entry) => entry.role === role)
        if (spec === undefined) return
        const next = clamp(Math.round(px), spec.min, spec.max)
        try {
          ctx.theme.setFontSize(role, next)
        } catch (error) {
          console.warn('[font-studio] setFontSize rejected', role, next, error)
        }
        writeTheme()
      },
      setFontFamily(role, list) {
        const normalized = normalizeFontFamily(list)
        if (typeof ctx.theme.setFontFamily === 'function') {
          ctx.theme.setFontFamily(role, normalized)
          writeTheme()
          return
        }
        // Older theme runtimes only expose the read side; write the body
        // variable the shipped stylesheet already reads.
        const variable = `--dsh-font-family-${role}`
        if (normalized === '') document.body.style.removeProperty(variable)
        else document.body.style.setProperty(variable, normalized)
      },
      /** Restore every value this page owns: colour, style, size and family. */
      resetAll() {
        for (const { role, fallback } of ROLES) {
          try {
            ctx.theme.setFontSize(role, fallback)
          } catch (error) {
            console.warn('[font-studio] reset size failed', role, error)
          }
          if (typeof ctx.theme.setFontFamily === 'function') {
            try {
              ctx.theme.setFontFamily(role, '')
            } catch (error) {
              console.warn('[font-studio] reset family failed', role, error)
            }
          }
        }
        writeTheme()
        clearCustom()
      },
    }

    ctx.slots.inject('settings.section', () =>
      ctx.slots.register(
        {
          name: 'settings.section',
          id: SECTION_ID,
          order: 12,
          label: () => t('nav'),
          locale: NS,
          inject: () => ({ studio: actions }),
        },
        FontStudioSection,
      ),
    )
  }

  /** Remove every document-level effect of {@link paintCustom}. */
  function clearAppliedAttributes() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    for (const attribute of [
      'data-dsh-fs-ui-color',
      'data-dsh-fs-conversation-color',
      'data-dsh-fs-code-color',
      'data-dsh-fs-weight',
      'data-dsh-fs-leading',
      'data-dsh-fs-tracking',
      'data-dsh-fs-italic',
    ]) {
      root.removeAttribute(attribute)
    }
    for (const variable of [
      '--dsh-fs-ui-color',
      '--dsh-fs-conversation-color',
      '--dsh-fs-code-color',
      '--dsh-fs-weight',
      '--dsh-fs-leading',
      '--dsh-fs-tracking',
    ]) {
      root.style.removeProperty(variable)
    }
  }

  window.__ModuleLoader__.load({
    id: PKG_ID,
    factory(require) {
      try {
        React = require('react')
        h = React.createElement
      } catch {
        React = null
        h = null
      }
      return { apply, inject, PKG_ID, NS }
    },
  })
})()
