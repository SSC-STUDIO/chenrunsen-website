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
  await new Promise((r) => setTimeout(r, 600))

  const css = await page.evaluate(() => {
    const hero = document.querySelector('.s-hero')
    const content = document.querySelector('.s__content')
    const waves = document.querySelector('.s__waves')
    const dump = (el) => {
      const rules = []
      for (const sheet of document.styleSheets) {
        let list
        try {
          list = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of list) {
          if (!rule.selectorText || !el.matches(rule.selectorText)) continue
          if (
            /height|flex|overflow|min-height/.test(rule.cssText)
          ) {
            rules.push(rule.cssText.slice(0, 280))
          }
        }
      }
      return rules
    }
    return {
      hero: dump(hero),
      waves: dump(waves),
      content: dump(content),
    }
  })
  console.log(JSON.stringify(css, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
