/* 验证兜底：1) 禁用 JS 内容可见  2) 模块脚本被拦截(崩溃模拟)时 3 秒后自动显影 */
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4321'

async function launch() {
  return puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: [
      '--no-proxy-server',
      '--ignore-certificate-errors',
      '--host-resolver-rules=MAP chenrunsen.cn 39.103.57.85',
    ],
  })
}

function summarize(list) {
  const visible = list.filter((x) => parseFloat(x.opacity) > 0.9).length
  return `${visible}/${list.length} visible — ` + JSON.stringify(list[0])
}

async function measure(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-reveal]'))
      .slice(0, 6)
      .map((el) => ({
        opacity: getComputedStyle(el).opacity,
        cls: (el.className || '').toString().slice(0, 50),
      }))
  )
}

;(async () => {
  const browser = await launch()

  // 场景 1：禁用 JS
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1400 })
    await page.setJavaScriptEnabled(false)
    await page.goto(`${base}/about`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    console.log('[no-js]', summarize(await measure(page)))
    await page.close()
  }

  // 场景 2：拦截所有模块脚本（模拟 bundle 崩溃/加载失败），head 内联 js 类仍在
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1400 })
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (req.resourceType() === 'script') return req.abort()
      req.continue()
    })
    await page.goto(`${base}/about`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    console.log('[script-blocked t=0.5s]', summarize(await measure(page)))
    await new Promise((r) => setTimeout(r, 4200))
    console.log('[script-blocked t=4.7s]', summarize(await measure(page)))
    await page.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
