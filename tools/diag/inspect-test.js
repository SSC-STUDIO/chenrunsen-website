/* 验证 SMyWay 三项：滚动行程推进 / 点击放大细看 / 泡泡画布 */
const puppeteer = require('puppeteer-core')

const base = process.argv[2] || 'http://localhost:4321'

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

  // ── 1. 滚动行程应随位置推进 ──
  const progressAt = async (ratio) => {
    await page.evaluate((k) => {
      const s = document.querySelector('.s-my-way')
      window.scrollTo(
        0,
        s.getBoundingClientRect().top + scrollY - innerHeight + (s.offsetHeight + innerHeight) * k
      )
    }, ratio)
    await new Promise((r) => setTimeout(r, 900))
    return page.evaluate(() =>
      Number(
        document.querySelector('.s-my-way').style.getPropertyValue('--scroll-progress')
      ).toFixed(3)
    )
  }
  console.log('scroll-progress @0.15 / 0.5 / 0.85:', await progressAt(0.15), await progressAt(0.5), await progressAt(0.85))

  // ── 3. 泡泡画布 ──
  const bubbles = await page.evaluate(() => {
    const c = document.querySelector('.s-my-way ink-bubbles canvas')
    return c ? `${c.width}x${c.height}` : null
  })
  console.log('myway bubbles canvas:', bubbles)

  // ── 2. 点击放大细看 ──
  await progressAt(0.4)
  await new Promise((r) => setTimeout(r, 2500)) // 等物件飞进屏内

  // 找一个可点的照片帧（在视口内且不 waiting）
  const target = await page.evaluate(() => {
    const frames = Array.from(
      document.querySelectorAll('.a-object--frame:not(.is-waiting):not(.is-vanishing)')
    )
    for (const el of frames) {
      const r = el.getBoundingClientRect()
      if (r.width > 60 && r.top > 0 && r.bottom < innerHeight && r.left > 0 && r.right < innerWidth) {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
    }
    return null
  })
  console.log('click target:', JSON.stringify(target))

  if (target) {
    await page.mouse.click(target.x, target.y)
    await new Promise((r) => setTimeout(r, 1600))

    const state = await page.evaluate(() => {
      const el = document.querySelector('.a-object.is-inspecting')
      if (!el) return { inspecting: false }
      const r = el.getBoundingClientRect()
      return {
        inspecting: true,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        z: el.style.getPropertyValue('--z'),
        rx: Number(el.style.getPropertyValue('--rx')).toFixed(1),
        centerOffX: Math.round(r.left + r.width / 2 - innerWidth / 2),
      }
    })
    console.log('after tap:', JSON.stringify(state))

    await page.screenshot({
      path: 'C:\\Users\\Administrator\\OneDrive\\Documents\\My-Program\\inspect-open.png',
    })

    // 点旁处 → 应墨点消散退场
    await page.mouse.click(80, 450)
    await new Promise((r) => setTimeout(r, 400))
    const after = await page.evaluate(() => ({
      inspecting: !!document.querySelector('.a-object.is-inspecting'),
      vanishing: !!document.querySelector('.a-object.is-vanishing'),
    }))
    console.log('after dismiss click:', JSON.stringify(after))
  }

  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
