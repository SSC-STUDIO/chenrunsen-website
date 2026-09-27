/* 诊断 [data-reveal] 显影失效：打开页面，收集报错与元素状态 */
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

  const logs = []
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
  page.on('requestfailed', (r) =>
    logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`)
  )

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2500))

  const report = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'))
    const vh = window.innerHeight
    return {
      vh,
      scrollY: window.scrollY,
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      reveals: els.slice(0, 8).map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          tag: el.tagName + '.' + (el.className || '').toString().slice(0, 60),
          top: Math.round(r.top),
          h: Math.round(r.height),
          inViewport: r.top < vh && r.bottom > 0,
          opacity: cs.opacity,
          clipPath: cs.clipPath,
          display: cs.display,
          visibility: cs.visibility,
        }
      }),
    }
  })

  // 再滚动到第一个 data-reveal 处观察是否显影
  await page.evaluate(() => {
    const el = document.querySelector('[data-reveal]')
    if (el) el.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 2000))

  const after = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'))
    return els.slice(0, 8).map((el) => {
      const cs = getComputedStyle(el)
      return {
        cls: (el.className || '').toString().slice(0, 80),
        opacity: cs.opacity,
        top: Math.round(el.getBoundingClientRect().top),
      }
    })
  })

  console.log('=== LOGS ===')
  logs.forEach((l) => console.log(l))
  console.log('=== INITIAL ===')
  console.log(JSON.stringify(report, null, 2))
  console.log('=== AFTER SCROLL-INTO-VIEW ===')
  console.log(JSON.stringify(after, null, 2))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
