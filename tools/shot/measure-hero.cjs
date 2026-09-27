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
  await page
    .waitForFunction(
      () => document.documentElement.classList.contains('is-site-ready'),
      { timeout: 8000 }
    )
    .catch(() => {})
  await new Promise((r) => setTimeout(r, 800))

  const info = await page.evaluate(() => {
    const hero = document.querySelector('.s-hero')
    const content = document.querySelector('.s__content')
    const title = document.querySelector('.s__title')
    const waves = document.querySelector('ink-ridges')
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        width: Math.round(r.width),
        opacity: cs.opacity,
        overflow: cs.overflow,
        flex: cs.flex,
        flexShrink: cs.flexShrink,
        heightCss: cs.height,
        color: cs.color,
        vis: cs.visibility,
      }
    }
    return {
      vh: window.innerHeight,
      hero: box(hero),
      waves: box(waves),
      content: box(content),
      title: box(title),
      titleText: title && title.textContent.replace(/\s+/g, ' ').trim(),
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
