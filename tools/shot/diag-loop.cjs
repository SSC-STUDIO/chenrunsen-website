/**
 * 渲染循环存活探针：帧计数会不会停？停了是哪一步抛的？
 * 用法：node diag-loop.cjs [--zone=1] [--ms=20000]
 */
const puppeteer = require('puppeteer-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:4399/jay-town/'
const ZONE = process.argv.find((a) => a.startsWith('--zone='))?.slice(7)
const MS = Number(process.argv.find((a) => a.startsWith('--ms='))?.slice(5) || 20000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: ['--window-size=720,450', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 720, height: 450 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  const logs = []
  page.on('pageerror', (e) => logs.push(`PAGEERROR ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`))
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`console.error ${m.text().slice(0, 300)}`) })

  await page.evaluateOnNewDocument(() => {
    /* 自己的计数器：不依赖 renderer.info（那东西在 render 里会被重置）。 */
    window.__rafCount = 0
    window.__lastFrameAt = 0
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => raf((ts) => {
      window.__rafCount++
      window.__lastFrameAt = performance.now()
      return cb(ts)
    })
    window.__errors = []
    window.addEventListener('error', (e) => window.__errors.push(`${e.message} @ ${e.filename}:${e.lineno}`))
    window.addEventListener('unhandledrejection', (e) => window.__errors.push(`rejection: ${e.reason}`))
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    (ms) => new Promise((res) => {
      const t0 = performance.now()
      const p = () => {
        const t = window.__jayTown
        if (t && (t.renderer.info.render.frame ?? 0) > 2) return res(true)
        if (performance.now() - t0 > ms) return res(false)
        setTimeout(p, 120)
      }
      p()
    }),
    60000,
  )
  console.log('scene ready')

  if (ZONE) {
    await page.evaluate((z) => document.querySelector(`.town-route__stop[data-zone="${z}"]`)?.click(), ZONE)
    console.log('clicked zone', ZONE)
  }

  /* 采样放在页面里自己跑完再一次性取回：CDP 的每次 evaluate 都要等主线程
   * 空一下，而这个场景在软件渲染下一帧就是几百毫秒，逐次求值本身就会超时。 */
  const samples = await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const t = window.__jayTown
        const out = []
        const start = performance.now()
        let prevRaf = window.__rafCount
        let prevInfo = t.renderer.info.render.frame
        const tick = () => {
          const now = performance.now()
          out.push({
            at: Math.round(now - start),
            raf: window.__rafCount - prevRaf,
            info: t.renderer.info.render.frame - prevInfo,
            sinceFrame: Math.round(now - window.__lastFrameAt),
            hidden: document.hidden,
            active: document.activeElement?.tagName,
            errors: window.__errors.slice(-2),
          })
          prevRaf = window.__rafCount
          prevInfo = t.renderer.info.render.frame
          if (now - start > ms) resolve(out)
          else setTimeout(tick, 2000)
        }
        setTimeout(tick, 2000)
      }),
    MS,
  )
  for (const s of samples) {
    console.log(`t=${s.at}ms raf+${s.raf} info+${s.info} last=${s.sinceFrame}ms hidden=${s.hidden} active=${s.active}`,
      s.errors.length ? JSON.stringify(s.errors) : '')
  }
  console.log('--- page errors ---')
  console.log(logs.slice(0, 10).join('\n') || '(none)')
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
