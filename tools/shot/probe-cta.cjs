/** CTA 网格脉冲对比：两版各连拍 */
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function probe(browser, url, tag) {
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
  await new Promise((r) => setTimeout(r, 800))

  await page.evaluate(() => {
    const el = document.querySelector('.s-cta')
    const y = Math.round(el.getBoundingClientRect().top + window.scrollY)
    if (window.lenis) window.lenis.scrollTo(y - 40, { immediate: true, force: true })
    window.scrollTo(0, y - 40)
  })

  for (const t of [1000, 3000, 5000]) {
    await new Promise((r) => setTimeout(r, t === 1000 ? 1000 : 2000))
    await page.screenshot({ path: `shots/cta-${tag}-${t}.png` })
  }
  await page.close()
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
  })
  await probe(browser, 'http://localhost:4322/', 'old')
  await probe(browser, 'http://localhost:4321/', 'new')
  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
