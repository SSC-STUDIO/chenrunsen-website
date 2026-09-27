/** 量取两版 hero 布局数值对比 */
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function measure(browser, url) {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('site-intro-seen', '1')
  })
  await page.goto(url, { waitUntil: 'networkidle2' })
  await page
    .waitForFunction(
      () => document.documentElement.classList.contains('is-site-ready'),
      { timeout: 8000 }
    )
    .catch(() => {})
  await new Promise((r) => setTimeout(r, 1200))

  const data = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        top: Math.round(r.top + window.scrollY),
        height: Math.round(r.height),
      }
    }
    return {
      hero: pick('.s-hero'),
      waves: pick('.s-hero ink-ridges') || pick('.s-hero sen-waves'),
      content: pick('.s-hero .js-content'),
      title: pick('.s-hero .s__title'),
      head: pick('.site-head'),
    }
  })
  await page.close()
  return data
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
  })
  console.log('OLD (4322):', JSON.stringify(await measure(browser, 'http://localhost:4322/')))
  console.log('NEW (4321):', JSON.stringify(await measure(browser, 'http://localhost:4321/')))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
