/* 实测 SMyWay：滚动进度推进、catcher 文字 transform、物件点击行为 */
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4321'

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

  await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 3500))

  // 滚到 SMyWay 区块中部
  const sample = async () =>
    page.evaluate(() => {
      const s = document.querySelector('.s-my-way')
      if (!s) return null
      const txt = s.querySelector('.s__catcher__text--distorted')
      return {
        sectionTop: Math.round(s.getBoundingClientRect().top),
        scrollProgress: s.style.getPropertyValue('--scroll-progress'),
        distortion: s.style.getPropertyValue('--distortion'),
        catcherTransform: txt ? getComputedStyle(txt).transform.slice(0, 60) : null,
        thrown: (window.__site, document.querySelectorAll('.a-object:not(.is-waiting)').length),
      }
    })

  await page.evaluate(() => {
    const s = document.querySelector('.s-my-way')
    window.scrollTo(0, s.offsetTop - window.innerHeight * 0.5)
  })
  await new Promise((r) => setTimeout(r, 1500))
  console.log('pos1:', JSON.stringify(await sample()))

  await page.evaluate(() => window.scrollBy(0, 700))
  await new Promise((r) => setTimeout(r, 1500))
  console.log('pos2:', JSON.stringify(await sample()))

  await page.evaluate(() => window.scrollBy(0, 700))
  await new Promise((r) => setTimeout(r, 1500))
  console.log('pos3:', JSON.stringify(await sample()))

  // 等物件飞入，看看有哪些可点
  await new Promise((r) => setTimeout(r, 3000))
  const objects = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.a-object'))
      .filter((el) => !el.classList.contains('is-waiting'))
      .slice(0, 8)
      .map((el) => ({
        cls: el.className.replace('a-object ', ''),
        z: el.style.getPropertyValue('--z'),
        s: el.style.getPropertyValue('--s'),
      }))
  )
  console.log('active objects:', JSON.stringify(objects, null, 1))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
