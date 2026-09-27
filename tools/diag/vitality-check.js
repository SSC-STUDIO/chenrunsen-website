/* SMyWay 圆章区 + SCTA 两帧像素差 & console 检查 */
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4321'
const out = 'C:\\Users\\Administrator\\OneDrive\\Documents\\My-Program\\'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-proxy-server', '--ignore-certificate-errors'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 3500))

  const capture = async (sel, name, offset = -100) => {
    await page.evaluate(
      (s, o) => {
        const el = document.querySelector(s)
        window.scrollTo(0, el.getBoundingClientRect().top + scrollY + o)
      },
      sel,
      offset
    )
    await new Promise((r) => setTimeout(r, 1500))
    const a = await page.screenshot({ encoding: 'binary' })
    await new Promise((r) => setTimeout(r, 4000))
    const b = await page.screenshot({ encoding: 'binary' })
    require('fs').writeFileSync(out + `vit-${name}-1.png`, a)
    require('fs').writeFileSync(out + `vit-${name}-2.png`, b)
    return [a.toString('base64'), b.toString('base64')]
  }

  const imgs = {
    myway: await capture('.s-my-way .s__smiley', 'myway', -350),
    cta: await capture('.s-cta', 'cta', 300),
  }

  const stats = await page.evaluate(async (pairs) => {
    const load = (b64) =>
      new Promise((res) => {
        const i = new Image()
        i.onload = () => res(i)
        i.src = 'data:image/png;base64,' + b64
      })
    const results = {}
    for (const [name, [b1, b2]] of Object.entries(pairs)) {
      const [i1, i2] = await Promise.all([load(b1), load(b2)])
      const c = document.createElement('canvas')
      c.width = i1.width
      c.height = i1.height
      const x = c.getContext('2d', { willReadFrequently: true })
      x.drawImage(i1, 0, 0)
      const d1 = x.getImageData(0, 0, c.width, c.height).data
      x.clearRect(0, 0, c.width, c.height)
      x.drawImage(i2, 0, 0)
      const d2 = x.getImageData(0, 0, c.width, c.height).data
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
  }, imgs)

  console.log('changed-pixel ratio (4s apart):', JSON.stringify(stats))
  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
