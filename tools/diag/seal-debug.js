/* InkSeal3D 调试：imprint 几何 + tilt 变量响应 */
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
  await page.evaluate(() => {
    const el = document.querySelector('.s-cta')
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 400)
  })
  await new Promise((r) => setTimeout(r, 1500))

  const geo = await page.evaluate(() => {
    const host = document.querySelector('.s__seal3d')
    const scene = host.querySelector('.scene')
    const imprint = host.querySelector('.js-imprint')
    const pivot = host.querySelector('.js-pivot')
    const cs = getComputedStyle(imprint)
    return {
      host: host.getBoundingClientRect().toJSON(),
      scene: { pos: getComputedStyle(scene).position, rect: scene.getBoundingClientRect().toJSON() },
      imprint: { rect: imprint.getBoundingClientRect().toJSON(), display: cs.display, left: cs.left, bottom: cs.bottom, transform: cs.transform },
      ryBefore: getComputedStyle(pivot).getPropertyValue('--ry'),
    }
  })
  console.log(JSON.stringify(geo, null, 1))

  // 真实鼠标移动到印章上再读 --ry
  const b = geo.host
  await page.mouse.move(b.x + b.width * 0.85, b.y + b.height * 0.2)
  await new Promise((r) => setTimeout(r, 300))
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.25)
  await new Promise((r) => setTimeout(r, 700))
  const after = await page.evaluate(() => {
    const pivot = document.querySelector('.s__seal3d .js-pivot')
    return {
      ry: pivot.style.getPropertyValue('--ry'),
      rx: pivot.style.getPropertyValue('--rx'),
    }
  })
  console.log('after mouse move:', JSON.stringify(after))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
