// Scan packaged Client bundles for a literal substring and print matching files
// with a small context window. Windows shells cannot traverse .asar paths, so the
// archive is read directly through the asar header.
import { readFileSync } from 'node:fs'

const asarPath = process.argv[2]
const needle = process.argv[3]
const maxHitsPerFile = Number(process.argv[4] ?? 6)

const fd = readFileSync(asarPath)
const headerSize = fd.readUInt32LE(12)
const header = JSON.parse(fd.subarray(16, 16 + headerSize).toString('utf8'))
const dataOffset = 8 + headerSize

function walk(node, prefix, out) {
  for (const [name, value] of Object.entries(node.files ?? {})) {
    const p = prefix ? `${prefix}/${name}` : name
    if (value.files) walk(value, p, out)
    else out.push({ path: p, size: value.size ?? 0, offset: value.offset })
  }
  return out
}

let total = 0
for (const entry of walk(header, '', [])) {
  if (!entry.path.endsWith('.js') || entry.size < 500) continue
  const start = dataOffset + Number(entry.offset)
  const buf = fd.subarray(start, start + entry.size)
  const text = buf.toString('utf8')
  let index = text.indexOf(needle)
  if (index < 0) continue
  let hits = 0
  const contexts = []
  while (index >= 0 && hits < maxHitsPerFile) {
    contexts.push(text.slice(Math.max(0, index - 220), index + 320).replace(/\n/g, ' '))
    hits += 1
    total += 1
    index = text.indexOf(needle, index + needle.length)
  }
  console.log(`\n### ${entry.path}`)
  for (const context of contexts) console.log(`  …${context}…`)
}
console.log(`\n-- ${total} hits`)
