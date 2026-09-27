/* 追踪 IntersectionObserver 生命周期：谁建的、谁断的、回调触发了没 */
const puppeteer = require('puppeteer-core')

const url = process.argv[2] || 'http://localhost:4321/about'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: [
      '--no-proxy-server',
      '--ignore-certificate-errors',
      '--host-resolver-rules=MAP chenrunsen.cn 39.103.57.85',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 1400 })

  await page.evaluateOnNewDocument(() => {
    window.__ioTrace = []
    const trace = window.__ioTrace
    let seq = 0
    const Orig = window.IntersectionObserver

    window.IntersectionObserver = class extends Orig {
      constructor(cb, opts) {
        const id = ++seq
        const stack = (new Error().stack || '').split('\n').slice(2, 5).join(' | ')
        super((entries, obs) => {
          trace.push({
            t: performance.now() | 0,
            id,
            ev: 'callback',
            entries: entries.map((e) => ({
              target:
                e.target.tagName +
                '.' +
                (e.target.className || '').toString().slice(0, 40),
              isIntersecting: e.isIntersecting,
            })),
          })
          return cb(entries, obs)
        }, opts)
        this.__id = id
        trace.push({ t: performance.now() | 0, id, ev: 'new', opts: JSON.stringify(opts || {}), stack })
      }
      observe(el) {
        trace.push({
          t: performance.now() | 0,
          id: this.__id,
          ev: 'observe',
          target:
            el.tagName + '.' + (el.className || '').toString().slice(0, 40),
        })
        return super.observe(el)
      }
      disconnect() {
        const stack = (new Error().stack || '').split('\n').slice(2, 5).join(' | ')
        trace.push({ t: performance.now() | 0, id: this.__id, ev: 'disconnect', stack })
        return super.disconnect()
      }
    }
  })

  const logs = []
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2500))

  const trace = await page.evaluate(() => window.__ioTrace)

  // 只输出与 data-reveal 相关的观察者(observe 过 FIGURE/DIV.p-prose/A.p-card)以及所有 new/disconnect
  logs.forEach((l) => console.log(l))
  const revealIds = new Set(
    trace
      .filter(
        (e) =>
          e.ev === 'observe' &&
          /p-about-photo|p-prose|p-card/.test(e.target || '')
      )
      .map((e) => e.id)
  )
  console.log('reveal-related observer ids:', [...revealIds])
  trace.forEach((e) => {
    if (e.ev === 'new' || e.ev === 'disconnect' || revealIds.has(e.id)) {
      console.log(JSON.stringify(e))
    }
  })

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
