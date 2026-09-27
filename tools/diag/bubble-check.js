/* 气泡验证：Hero 与 SMyWay 各截两帧（间隔 4s），并做像素差统计 */
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4321'
const tag = process.argv[3] || 'dev'
const out = 'C:\\Users\\Administrator\\OneDrive\\Documents\\My-Program\\'

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
  await page.setViewport({ width: 1280, height: 900 })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 3500))

  const diffStat = async (selScroll) => {
    if (selScroll) {
      await page.evaluate((sel) => {
        const s = document.querySelector(sel)
        window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 100)
      }, selScroll)
      await new Promise((r) => setTimeout(r, 1200))
    }
    const shot = async () =>
      page.screenshot({ encoding: 'binary', type: 'png' })
    const a = await shot()
    await new Promise((r) => setTimeout(r, 4000))
    const b = await shot()
    return { a, b }
  }

  // Hero
  const hero = await diffStat(null)
  require('fs').writeFileSync(out + `bub-${tag}-hero-1.png`, hero.a)
  require('fs').writeFileSync(out + `bub-${tag}-hero-2.png`, hero.b)

  // SMyWay
  const myway = await diffStat('.s-my-way')
  require('fs').writeFileSync(out + `bub-${tag}-myway-1.png`, myway.a)
  require('fs').writeFileSync(out + `bub-${tag}-myway-2.png`, myway.b)

  // 像素差统计（在页面里用 canvas 比对）
  const stats = await page.evaluate(
    async (imgs) => {
      const load = (b64) =>
        new Promise((res) => {
          const i = new Image()
          i.onload = () => res(i)
          i.src = 'data:image/png;base64,' + b64
        })
      const results = {}
      for (const [name, [b1, b2]] of Object.entries(imgs)) {
        const [i1, i2] = await Promise.all([load(b1), load(b2)])
        const c1 = document.createElement('canvas')
        const c2 = document.createElement('canvas')
        c1.width = c2.width = i1.width
        c1.height = c2.height = i1.height
        const x1 = c1.getContext('2d')
        const x2 = c2.getContext('2d')
        x1.drawImage(i1, 0, 0)
        x2.drawImage(i2, 0, 0)
        const d1 = x1.getImageData(0, 0, c1.width, c1.height).data
        const d2 = x2.getImageData(0, 0, c2.width, c2.height).data
        let changed = 0
        for (let p = 0; p < d1.length; p += 4) {
          if (
            Math.abs(d1[p] - d2[p]) > 6 ||
            Math.abs(d1[p + 1] - d2[p + 1]) > 6 ||
            Math.abs(d1[p + 2] - d2[p + 2]) > 6
          )
            changed++
        }
        results[name] = ((changed / (d1.length / 4)) * 100).toFixed(2) + '%'
      }
      return results
    },
    {
      hero: [hero.a.toString('base64'), hero.b.toString('base64')],
      myway: [myway.a.toString('base64'), myway.b.toString('base64')],
    }
  )
  console.log('changed-pixel ratio (4s apart):', JSON.stringify(stats))

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
