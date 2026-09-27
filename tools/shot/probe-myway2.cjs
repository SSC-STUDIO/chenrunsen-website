/** 排除法定位 MyWay 黑色 V 形元素 */
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

  await page.evaluate(() => {
    const el = document.querySelector('.s-my-way')
    const y = Math.round(el.getBoundingClientRect().top + window.scrollY)
    if (window.lenis) window.lenis.scrollTo(y - 60, { immediate: true, force: true })
    window.scrollTo(0, y - 60)
  })
  await new Promise((r) => setTimeout(r, 1000))

  const sels = [
    null,
    '.s-my-way .js-objects',
    '.s-my-way .s__smiley',
    '.s-my-way .s__catcher',
    '.s-my-way .js-svg',
  ]
  for (let i = 0; i < sels.length; i++) {
    if (sels[i]) {
      await page.evaluate((sel) => {
        document
          .querySelectorAll(sel)
          .forEach((el) => (el.style.visibility = 'hidden'))
      }, sels[i])
    }
    await page.screenshot({
      path: `shots/probe2-${i}-${(sels[i] || 'all').replace(/[^a-z-]/g, '')}.png`,
    })
    if (sels[i]) {
      await page.evaluate((sel) => {
        document
          .querySelectorAll(sel)
          .forEach((el) => (el.style.visibility = ''))
      }, sels[i])
    }
  }

  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
