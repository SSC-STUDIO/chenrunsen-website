/* 生产验证：逐页检查 data-reveal 显影 / console 报错，并测 SPA 导航回首页 */
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4322'
const shot = process.argv[3] === 'shot'

const pages = [
  '/',
  '/about',
  '/contact',
  '/messages',
  '/honors',
  '/articles',
  '/benchmarks',
  '/class',
  '/projects',
  '/guestbook',
  '/sponsor',
  '/leaderboard',
]

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

  const errors = []
  page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()} :: [console] ${m.text()}`)
  })

  for (const p of pages) {
    await page.goto(base + p, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1800))

    const stat = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-reveal]'))
      const vh = window.innerHeight
      const inView = els.filter((el) => {
        const r = el.getBoundingClientRect()
        return r.top < vh * 0.94 && r.bottom > 0 && r.height > 0
      })
      const visible = inView.filter(
        (el) => parseFloat(getComputedStyle(el).opacity) > 0.9
      )
      // 页面主体文字量（排除 head/script）
      const textLen = (document.querySelector('main')?.innerText || document.body.innerText || '').length
      return {
        total: els.length,
        inView: inView.length,
        visible: visible.length,
        textLen,
      }
    })

    const ok = stat.inView === stat.visible
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${p.padEnd(14)} reveal(total ${stat.total}, in-view ${stat.inView}, visible ${stat.visible}) text ${stat.textLen}`
    )

    if (shot) {
      await page.screenshot({
        path: `C:\\Users\\Administrator\\OneDrive\\Documents\\My-Program\\verify-${p.replace(/\//g, '_') || 'home'}.png`,
      })
    }
  }

  // SPA 导航：/about 点击首页 logo 回首页，确认线场画布仍渲染
  await page.goto(base + '/about', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 800))
  await page.click('a[href="/"]')
  await new Promise((r) => setTimeout(r, 2500))

  const homeCheck = await page.evaluate(() => {
    const ridges = document.querySelector('ink-ridges canvas')
    const bubbles = document.querySelector('ink-bubbles canvas')
    return {
      url: location.pathname,
      ridgesCanvas: ridges ? `${ridges.width}x${ridges.height}` : null,
      bubblesCanvas: bubbles ? `${bubbles.width}x${bubbles.height}` : null,
    }
  })
  console.log('SPA back-to-home:', JSON.stringify(homeCheck))

  console.log('=== ERRORS ===')
  if (!errors.length) console.log('(none)')
  errors.forEach((e) => console.log(e))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
