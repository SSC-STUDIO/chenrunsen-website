/** 探查 MyWay 巨大黑色 V 形是什么元素 */
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
  await new Promise((r) => setTimeout(r, 1000))

  const top = await page.evaluate(() => {
    const el = document.querySelector('.s-my-way')
    if (!el) return null
    const y = Math.round(el.getBoundingClientRect().top + window.scrollY)
    if (window.lenis) window.lenis.scrollTo(y - 60, { immediate: true, force: true })
    window.scrollTo(0, y - 60)
    return y
  })
  await new Promise((r) => setTimeout(r, 1200))

  // 截图确认 V 还在
  await page.screenshot({ path: 'shots/probe-myway.png' })

  const stack = await page.evaluate(() => {
    // V 形大约在视口 (555*1.40625, 300*1.40625) → 实际坐标 (780, 420)
    const pts = [
      [780, 300],
      [820, 260],
      [860, 420],
      [760, 500],
    ]
    return pts.map(([x, y]) =>
      document.elementsFromPoint(x, y).map((el) => {
        const r = el.getBoundingClientRect()
        return `${el.tagName}.${(typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').split(' ').slice(0, 3).join('.')} [${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}]`
      })
    )
  })
  console.log(JSON.stringify(stack, null, 2))

  const smiley = await page.evaluate(() => {
    const el = document.querySelector('.js-smiley')
    const svg = el?.querySelector('svg')
    if (!el || !svg) return null
    const er = el.getBoundingClientRect()
    const sr = svg.getBoundingClientRect()
    return {
      box: `${Math.round(er.width)}x${Math.round(er.height)}`,
      svg: `${Math.round(sr.width)}x${Math.round(sr.height)}`,
      svgCss: getComputedStyle(svg).width + ' ' + getComputedStyle(svg).height,
    }
  })
  console.log('smiley:', JSON.stringify(smiley))

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
