// Minimal Electron asar reader: list / extract entries so the Host's packaged
// Client bundles can be inspected from a normal Node process (Windows shells
// cannot traverse an .asar path).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'

const asarPath = process.argv[2]
const mode = process.argv[3] ?? 'list'
const pattern = process.argv[4] ?? ''
const outRoot = process.argv[5] ?? ''

if (!asarPath) {
  console.error('usage: node asar-extract.mjs <app.asar> [list|extract] [regex] [outDir]')
  process.exit(2)
}

const fd = readFileSync(asarPath)
const headerSize = fd.readUInt32LE(12)
const headerJson = fd.subarray(16, 16 + headerSize).toString('utf8')
const header = JSON.parse(headerJson)
const dataOffset = 8 + headerSize

function walk(node, prefix, out) {
  for (const [name, value] of Object.entries(node.files ?? {})) {
    const p = prefix ? posix.join(prefix, name) : name
    if (value.files) walk(value, p, out)
    else out.push({ path: p, size: value.size ?? 0, offset: value.offset })
  }
  return out
}

const entries = walk(header, '', [])
const re = pattern ? new RegExp(pattern) : null
const matched = entries.filter((e) => (re ? re.test(e.path) : true))

if (mode === 'list') {
  for (const e of matched) console.log(`${e.size}\t${e.path}`)
  console.log(`-- ${matched.length} / ${entries.length} entries`)
} else {
  if (!outRoot) {
    console.error('extract needs an output dir')
    process.exit(2)
  }
  for (const e of matched) {
    const start = dataOffset + Number(e.offset)
    const target = join(outRoot, e.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, fd.subarray(start, start + e.size))
    console.log(`extracted ${e.path} (${e.size} bytes)`)
  }
}
