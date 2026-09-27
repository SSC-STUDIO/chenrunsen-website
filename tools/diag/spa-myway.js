/* SPA 导航来回后 SMyWay 回归检查 */
const puppeteer = require('puppeteer-core')

;(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-proxy-server'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 3000))

  await page.evaluate(() => document.querySelector('a[href="/about"]')?.click())
  await new Promise((r) => setTimeout(r, 2000))
  await page.evaluate(() => document.querySelector('a[href="/"]')?.click())
  await new Promise((r) => setTimeout(r, 2500))

  await page.evaluate(() => {
    const s = document.querySelector('.s-my-way')
    window.scrollTo(
      0,
      s.getBoundingClientRect().top + scrollY - innerHeight + (s.offsetHeight + innerHeight) * 0.5
    )
  })
  await new Promise((r) => setTimeout(r, 1200))

  const r = await page.evaluate(() => ({
    url: location.pathname,
    progress: Number(
      document.querySelector('.s-my-way').style.getPropertyValue('--scroll-progress')
    ).toFixed(3),
    bubbles: !!document.querySelector('.s-my-way ink-bubbles canvas'),
    objects: document.querySelectorAll('.a-object:not(.is-waiting)').length,
  }))
  console.log(JSON.stringify(r))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
