/**
 * 服务器并发诊断：一边跑页面（会加载 11 张缩略图 + 4 段视频），
 * 一边从这里直连同一个服务器要一段视频，看它还能不能答。
 */
const http = require('http')
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://127.0.0.1:4399'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function probe(pathname, headers = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const req = http.request(`${BASE}${pathname}`, { headers, timeout: 8000 }, (res) => {
      let bytes = 0
      res.on('data', (c) => { bytes += c.length })
      res.on('end', () => resolve({ pathname, status: res.statusCode, bytes, ms: Date.now() - t0 }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ pathname, status: 'TIMEOUT', ms: Date.now() - t0 }) })
    req.on('error', (e) => resolve({ pathname, status: `ERR ${e.code}`, ms: Date.now() - t0 }))
    req.end()
  })
}

;(async () => {
  console.log('idle probe:', JSON.stringify(await probe('/jay-town/media/cover-jay-2000.jpg')))

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
    args: ['--window-size=720,450', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 720, height: 450 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(`${BASE}/jay-town/`, { waitUntil: 'domcontentloaded' })

  for (let i = 0; i < 8; i++) {
    await sleep(1500)
    const r = await probe('/jay-town/media/school-1024.mp4', { Range: 'bytes=0-1023' })
    console.log(`during-load #${i}:`, JSON.stringify(r))
  }

  const inPage = await page.evaluate(async () => {
    const out = []
    for (const name of ['school-1024.mp4', 'class-0512.mp4']) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.src = `/jay-town/media/${name}`
      document.body.appendChild(v)
      v.load()
      const r = await new Promise((res) => {
        const done = (why) => res({ why, net: v.networkState, ready: v.readyState, dur: v.duration })
        v.addEventListener('loadedmetadata', () => done('loadedmetadata'), { once: true })
        v.addEventListener('error', () => done(`error ${v.error?.code}`), { once: true })
        setTimeout(() => done('timeout'), 8000)
      })
      out.push({ name, ...r })
    }
    return out
  })
  console.log('fresh elements:', JSON.stringify(inPage))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
