/* InkMountains dimensional：视差响应 + SPA 导航泄漏检查 */
const puppeteer = require('puppeteer-core')

const out = 'C:\\Users\\Administrator\\OneDrive\\Documents\\My-Program\\'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-proxy-server'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 3000))

  // 滚到 SCTA 山可见
  await page.evaluate(() => {
    const el = document.querySelector('.s-cta')
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 600)
  })
  await new Promise((r) => setTimeout(r, 1500))

  const count = await page.evaluate(
    () => document.querySelectorAll('ink-peaks').length
  )
  console.log('ink-peaks count:', count)

  // 指针移到左上，等 lerp 收敛
  await page.mouse.move(80, 100)
  await new Promise((r) => setTimeout(r, 1400))
  const left = await page.evaluate(() => {
    const el = document.querySelector('.s-cta ink-peaks')
    return {
      ry: el.style.getPropertyValue('--peak-ry'),
      rx: el.style.getPropertyValue('--peak-rx'),
    }
  })
  console.log('pointer left-top:', JSON.stringify(left))
  await page.screenshot({ path: out + 'peaks-left.png' })

  // 指针移到右下
  await page.mouse.move(1200, 820)
  await new Promise((r) => setTimeout(r, 1400))
  const right = await page.evaluate(() => {
    const el = document.querySelector('.s-cta ink-peaks')
    return {
      ry: el.style.getPropertyValue('--peak-ry'),
      rx: el.style.getPropertyValue('--peak-rx'),
    }
  })
  console.log('pointer right-bottom:', JSON.stringify(right))
  await page.screenshot({ path: out + 'peaks-right.png' })

  // ── SPA 导航泄漏检查：首页 → messages → 首页 ──
  await page.evaluate(() => {
    document.querySelector('a[href="/messages"], a[href="/messages/"]')?.click()
  })
  await new Promise((r) => setTimeout(r, 2500))
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(
      (x) => x.getAttribute('href') === '/'
    )
    a?.click()
  })
  await new Promise((r) => setTimeout(r, 2500))

  const after = await page.evaluate(() => ({
    url: location.pathname,
    peaks: document.querySelectorAll('ink-peaks').length,
    seals: document.querySelectorAll('ink-seal3d').length,
    sealLive: document
      .querySelector('.s__seal3d')
      ?.classList.contains('is-live'),
  }))
  console.log('after SPA round-trip:', JSON.stringify(after))

  // 回来后山的视差还能动吗
  await page.evaluate(() => {
    const el = document.querySelector('.s-cta')
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 600)
  })
  await new Promise((r) => setTimeout(r, 1200))
  await page.mouse.move(100, 150)
  await new Promise((r) => setTimeout(r, 1200))
  const revived = await page.evaluate(() => {
    const el = document.querySelector('.s-cta ink-peaks')
    return el ? el.style.getPropertyValue('--peak-ry') : 'MISSING'
  })
  console.log('parallax after nav:', revived)

  console.log('pageerrors:', errors.length ? errors : 'none')
  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
