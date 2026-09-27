/**
 * Minimal static server for the built Astro output, so screenshot runs are
 * stable: the dev server's HMR reloads mid-measurement and its on-demand
 * transform makes the first frames slower than anything a user sees.
 *
 * Usage (from tools/shot):
 *   node serve-dist.cjs [--port=4399] [--root=../../site/dist]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const PORT = Number(flag('port', 4399))
const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', 'site', 'dist')))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  let target = path.join(ROOT, clean)
  if (!target.startsWith(ROOT)) return null
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const index = path.join(target, 'index.html')
    return fs.existsSync(index) ? index : null
  }
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target
  // /foo -> /foo/index.html, then /foo.html
  const asDir = path.join(ROOT, clean, 'index.html')
  if (fs.existsSync(asDir)) return asDir
  const asHtml = path.join(ROOT, `${clean}.html`)
  if (fs.existsSync(asHtml)) return asHtml
  return null
}

/**
 * 带 Range 的响应。
 *
 * `<video>` 要靠 206 才能 seek / 边下边播；只回 200 + 整个文件时，Chrome 会
 * 干脆不播（1 GB 的那个尤其明显）。这个服务器存在的意义就是让验收环境跟线上
 * 一致，所以这里必须跟 nginx 一样。
 */
function sendFile(req, res, file) {
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
  const size = fs.statSync(file).size
  const range = req.headers.range
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'no-store')
  /* 同源取视频做 `VideoTexture` 本来不需要 CORS，但只要有人给元素挂上
   * `crossOrigin`，浏览器就会改走 CORS 模式并在缺头发情况下让 `texImage2D`
   * 抛 SecurityError（屏幕变黑）。线上静态托管的行为不一定一样，这里把头发上，
   * 好让「本地验收通过 = 线上也通过」这句话站得住。 */
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (!range) {
    res.statusCode = 200
    res.setHeader('Content-Length', String(size))
    if (req.method === 'HEAD') return res.end()
    return fs.createReadStream(file).pipe(res)
  }

  const m = /bytes=(\d*)-(\d*)/.exec(range)
  let start = m && m[1] ? Number(m[1]) : 0
  let end = m && m[2] ? Number(m[2]) : size - 1
  if (Number.isNaN(start) || start < 0) start = 0
  if (Number.isNaN(end) || end >= size) end = size - 1
  if (start > end) {
    res.statusCode = 416
    res.setHeader('Content-Range', `bytes */${size}`)
    return res.end()
  }
  res.statusCode = 206
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  res.setHeader('Content-Length', String(end - start + 1))
  if (req.method === 'HEAD') return res.end()
  return fs.createReadStream(file, { start, end }).pipe(res)
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url || '/')
    if (!file) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('404')
      return
    }
    sendFile(req, res, file)
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}/`)
  })
