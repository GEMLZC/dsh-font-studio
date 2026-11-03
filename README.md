# Font Studio · 字体工作室

A DeepSeek Harness settings plugin for typography. It keeps the client's existing font controls — size and family for text, code and terminal — and adds text colour, weight, italic, letter spacing and line height, with a live preview.

DeepSeek Harness 的字体设置插件。保留客户端原有的字号与字体族（正文 / 代码 / 终端三档），并补上文字颜色、字重、斜体、字间距与行高，带实时预览。

## What it adds · 功能

The page lives in **Settings → Font Studio** (left column, next to Appearance).

设置页位于**设置 → 字体工作室**（左栏，「外观」附近）。

| Group | Items | Notes |
| --- | --- | --- |
| Size · 字号 | Body / Code / Terminal | Stepper. Ranges match the client's own clamp: 10–22 / 10–16 / 10–20 px |
| Family · 字体族 | Body / Code / Terminal | Comma-separated list; empty means the built-in stack. Quick-pick chips for common fonts |
| Colour · 字体颜色 | Interface / Conversation / Code | Colour picker + hex field + clear |
| Style · 字体风格 | 5 presets + weight, italic, line height, letter spacing | Presets: Default, Comfort, Compact, Soft, Emphasis |
| Preview · 预览 | Live sample | Renders Chinese + Latin, code, and interface text with the current settings |

**Reset · 恢复默认** restores size, family, colour and style in one click.

## Install · 安装

```sh
dsh plugin add https://github.com/GEMLZC/dsh-font-studio
```

The package declares `dsh.bundle` and ships a `cordis.patch.yml`, so no build step runs at install time — the bundle is plain JavaScript.

包内声明了 `dsh.bundle` 并提供 `cordis.patch.yml`，安装时不执行任何构建脚本——打包体就是纯 JavaScript。

## How it works · 实现

- **Size and family** are written through the client theme service (`ctx.theme.setFontSize()` / `setFontFamily()`), the same Host-persisted preference the Appearance page writes. The two surfaces never disagree.
- **Colour** does not overwrite host styles. It re-declares `--dsw-alias-label-primary` (interface and conversation) and `--shiki-foreground` (code) inside a scoped selector: `:root[data-dsh-fs-*] body` for the interface, `[data-chat-flow-key]` for chat rows only.
- **Style** is applied through `data-dsh-fs-*` scope attributes plus `--dsh-fs-*` variables on chat rows. Unloading the plugin removes every attribute and variable it added.
- Colour and style persist in `localStorage['dsh-font-studio.v1']`; size and family are stored by the Host.

## Verification · 验证

The repository ships the checks used during development:

```sh
node --check client.js   # syntax
node tools/check.mjs     # zh/en dictionary key parity + every key the components use
node tools/smoke.mjs     # stubbed React + ctx: apply → register → render → write → reset → dispose
```

`tools/check.mjs` verifies both dictionaries have the same 63 keys, that the 35 literal and 28 composed keys the component tree requests all exist, and that the stylesheet constant is well formed. `tools/smoke.mjs` drives the real component tree with a stub React and a stub Cordis context, then asserts that font writes reach the theme service, that out-of-range sizes clamp, that an invalid colour is refused rather than written, and that disposing the plugin leaves the document with no leftover attributes or variables.

`tools/asar-extract.mjs` and `tools/asar-scan.mjs` read packages inside an Electron `app.asar` from plain Node. They were used to confirm the host contracts this plugin depends on; they are development tools and are not part of the published `files` list.

## Known limits · 已知限制

- The interface colour changes every element that reads the primary label token, so it affects the sidebar and settings too. Use **Conversation colour** to limit the change to chat records.
- Code colour changes the base foreground only; shiki syntax token colours keep the host palette so highlighting stays legible.
- The family field needs `theme.setFontFamily`. On a host that exposes only the read side, the plugin falls back to writing the `--dsh-font-family-<role>` body variable itself.

## Licence · 许可

[Apache-2.0](LICENSE)
