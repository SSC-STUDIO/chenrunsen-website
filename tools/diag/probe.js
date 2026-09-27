/* 手动 IO 探针 + 祖先链隐藏状态检查 */
const puppeteer = require('puppeteer-core')

const url = process.argv[2] || 'http://localhost:4321/about'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: [
      '--no-proxy-server',
      '--ignore-certificate-errors',
      '--host-resolver-rules=MAP chenrunsen.cn 39.103.57.85',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 1400 })
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2000))

  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.querySelector('[data-reveal]')
        if (!el) return resolve({ error: 'no element' })

        // 祖先链检查
        const chain = []
        let n = el
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n)
          if (
            cs.display === 'none' ||
            cs.visibility !== 'visible' ||
            cs.contentVisibility === 'hidden' ||
            parseFloat(cs.opacity) === 0 ||
            cs.contain.includes('paint') ||
            cs.contain.includes('strict')
          ) {
            chain.push({
              node: n.tagName + '.' + (n.className || '').toString().slice(0, 50),
              display: cs.display,
              visibility: cs.visibility,
              opacity: cs.opacity,
              contentVisibility: cs.contentVisibility,
              contain: cs.contain,
              transform: cs.transform.slice(0, 60),
            })
          }
          n = n.parentElement
        }

        const r = el.getBoundingClientRect()
        const results = {
          rect: { top: r.top | 0, h: r.height | 0 },
          offsetParent: el.offsetParent ? el.offsetParent.tagName : null,
          checkVisibility: el.checkVisibility
            ? el.checkVisibility({
                checkOpacity: false,
                checkVisibilityCSS: true,
              })
            : 'n/a',
          hiddenAncestors: chain,
          manualIO: null,
        }

        const io = new IntersectionObserver(
          (entries) => {
            results.manualIO = entries.map((e) => ({
              isIntersecting: e.isIntersecting,
              ratio: e.intersectionRatio,
              rootBounds: e.rootBounds
                ? { w: e.rootBounds.width, h: e.rootBounds.height }
                : null,
            }))
            io.disconnect()
            resolve(results)
          },
          { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
        )
        io.observe(el)

        setTimeout(() => resolve({ ...results, manualIO: 'TIMEOUT' }), 3000)
      })
  )

  console.log(JSON.stringify(result, null, 2))
  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
