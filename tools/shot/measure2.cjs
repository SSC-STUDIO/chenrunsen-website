/** 探查新版 ink-ridges 高度反馈回路细节 */
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('site-intro-seen', '1')
  })
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))

  const info = await page.evaluate(() => {
    const el = document.querySelector('.s-hero ink-ridges')
    const canvas = el?.querySelector('canvas')
    const cs = canvas ? getComputedStyle(canvas) : null
    return {
      dpr: window.devicePixelRatio,
      elClient: el ? { w: el.clientWidth, h: el.clientHeight } : null,
      canvasAttr: canvas ? { w: canvas.width, h: canvas.height } : null,
      canvasCss: cs ? { w: cs.width, h: cs.height } : null,
      elComputedHeight: el ? getComputedStyle(el).height : null,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
