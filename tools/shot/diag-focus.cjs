/**
 * 诊断：世界更新为什么会停（inputFocused / paused）。
 * 用法：node diag-focus.cjs
 */
const puppeteer = require('puppeteer-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:4399/jay-town/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: ['--window-size=720,450', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 720, height: 450 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    (ms) => new Promise((res) => {
      const t0 = performance.now()
      const p = () => {
        const t = window.__jayTown
        if (t && (t.renderer.info.render.frame ?? 0) > 2) return res(true)
        if (performance.now() - t0 > ms) return res(false)
        setTimeout(p, 120)
      }
      p()
    }),
    60000,
  )

  /* 站到唱片小巷（有教室那块屏的那一站）。 */
  await page.evaluate(() => document.querySelector('.town-route__stop[data-zone="1"]')?.click())

  for (const t of [500, 1500, 3000, 5000, 8000, 12000]) {
    await sleep(t === 500 ? 500 : 0)
    if (t !== 500) await sleep(0)
    const s = await page.evaluate(() => {
      const t = window.__jayTown
      const ae = document.activeElement
      const desc = ae ? `${ae.tagName}${ae.id ? '#' + ae.id : ''}${ae.className && typeof ae.className === 'string' ? '.' + ae.className.split(' ')[0] : ''}` : 'null'
      const blocked = !!ae?.closest?.('input,textarea,select,[contenteditable="true"],dialog[open],.song-drawer:not([hidden]),.video-panel:not([hidden])')
      const vids = []
      t.scene.traverse((o) => {
        if (!o.name?.startsWith('jayMedia:')) return
        const v = o.children.find((c) => c.isMesh && c.material?.map?.isVideoTexture)
        if (v) vids.push(`${o.name.replace('jayMedia:', '')}:${v.material.map.image.paused ? 'P' : 'R'}${v.material.map.image.currentTime.toFixed(1)}`)
      })
      return {
        frames: t.renderer.info.render.frame,
        player: [+t.player.pos.x.toFixed(2), +t.player.pos.z.toFixed(2)],
        active: desc,
        blocked,
        hidden: document.hidden,
        vids,
      }
    })
    console.log(`+${t}ms`, JSON.stringify(s))
    if (t !== 12000) await sleep(t * 0 + (t === 500 ? 1000 : 1500))
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
