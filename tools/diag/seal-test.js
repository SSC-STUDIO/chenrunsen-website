/* InkSeal3D锛氶潤鎭?鈫?tilt 鈫?閽ゅ嵃 涓夋€佹埅鍥?*/
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4321'
const out = 'C:\\Users\\Administrator\\OneDrive\\Documents\\My-Program\\'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-proxy-server', '--ignore-certificate-errors'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 3000))

  await page.evaluate(() => {
    const el = document.querySelector('.s-cta')
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 400)
  })
  await new Promise((r) => setTimeout(r, 2000))

  const box = await page.evaluate(() => {
    const r = document.querySelector('.s__seal3d').getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
  console.log('seal box:', JSON.stringify(box))

  const clip = {
    x: Math.max(0, box.x - 60),
    y: Math.max(0, box.y - 60),
    width: box.w + 120,
    height: box.h + 120,
  }

  await page.screenshot({ path: out + 'seal-rest.png' })

  // tilt锛氭寚閽堢Щ鍒板嵃绔犲彸涓?  await page.mouse.move(box.x + box.w * 0.8, box.y + box.h * 0.25)
  await new Promise((r) => setTimeout(r, 700))
  await page.screenshot({ path: out + 'seal-tilt.png' })

  // 閽ゅ嵃
  await page.mouse.click(box.x + box.w / 2, box.y + box.h * 0.3)
  await new Promise((r) => setTimeout(r, 520))
  await page.screenshot({ path: out + 'seal-press.png' })
  await new Promise((r) => setTimeout(r, 900))
  await page.mouse.move(box.x - 200, box.y + 400)
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: out + 'seal-stamped.png' })

  const state = await page.evaluate(() => ({
    live: document.querySelector('.s__seal3d').classList.contains('is-live'),
    stamped: document.querySelector('.s__seal3d').classList.contains('is-stamped'),
  }))
  console.log('state:', JSON.stringify(state))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})

