// Build the deploy payload: diff local dist against the server manifest,
// emit clean UTF-8 lists, and zip exactly the files that changed.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIST = process.argv[2]
const SERVER_TXT = process.argv[3]
const OUTDIR = process.argv[4]

// --- local manifest -------------------------------------------------------
const walk = (dir, base = '') => {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full, rel))
    else out.push([rel, fs.statSync(full).size, crypto.createHash('md5').update(fs.readFileSync(full)).digest('hex')])
  }
  return out
}
const localList = walk(DIST)
const local = new Map(localList.map(([p, , h]) => [p, h]))

// --- server manifest ------------------------------------------------------
// lines look like: <md5>  <path>
const server = new Map()
for (const line of fs.readFileSync(SERVER_TXT, 'utf8').split(/\r?\n/)) {
  const m = /^([0-9a-f]{32})\s+(.+)$/.exec(line.trim())
  if (m) server.set(m[2], m[1])
}

const upload = []
for (const [rel, size, hash] of localList) {
  if (server.get(rel) !== hash) upload.push(rel)
}
const remove = [...server.keys()].filter((p) => !local.has(p))

fs.writeFileSync(path.join(OUTDIR, 'upload.txt'), upload.join('\n') + '\n', 'utf8')
fs.writeFileSync(path.join(OUTDIR, 'delete.txt'), remove.join('\n') + '\n', 'utf8')

const bytes = upload.reduce((a, rel) => a + fs.statSync(path.join(DIST, rel)).size, 0)
console.log(`local=${localList.length} server=${server.size}`)
console.log(`upload=${upload.length} (${(bytes / 1048576).toFixed(1)} MB)  delete=${remove.length}`)
console.log('--- deletes ---')
remove.forEach((p) => console.log('  ' + p))
console.log('--- uploads that are not media ---')
upload.filter((p) => !p.startsWith('jay-town/media/')).forEach((p) => console.log('  ' + p))
