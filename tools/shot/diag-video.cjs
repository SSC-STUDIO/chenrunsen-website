/**
 * 视频屏诊断：为什么有的牌子停在第一帧。
 * 用法：node diag-video.cjs [--zone=1] [--url=...]
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const argv = process.argv.slice(2)
const flag = (n, d) => {
  const h = argv.find((a) => a.startsWith(`--${n}=`))
  return h ? h.slice(n.length + 3) : d
}
const BASE = flag('url', 'http://127.0.0.1:4399/jay-town/')
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
  page.on('console', (m) => console.log('  [page]', m.type(), m.text().slice(0, 200)))
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

  for (const zone of (flag('zones', '1,3').split(',').map(Number))) {
    console.log(`\n=== zone ${zone} ===`)
    await page.evaluate((z) => {
      document.querySelector(`.town-route__stop[data-zone="${z}"]`)?.click()
    }, zone)
    for (const wait of [300, 1500, 4000, 8000]) {
      await sleep(wait === 300 ? 300 : wait - 300)
      const s = await page.evaluate(() => {
        const t = window.__jayTown
        const rows = []
        t.scene.traverse((o) => {
          if (!o.name?.startsWith('jayMedia:')) return
          const v = o.children.find((c) => c.isMesh && c.material?.map?.isVideoTexture)
          if (!v) return
          const video = v.material.map.image
          rows.push({
            id: o.name.replace('jayMedia:', ''),
            paused: video.paused,
            rs: video.readyState,
            t: +video.currentTime.toFixed(2),
            err: video.error?.code ?? null,
            net: video.networkState,
            src: video.currentSrc.split('/').pop(),
          })
        })
        return { player: [t.player.pos.x.toFixed(1), t.player.pos.z.toFixed(1)], rows }
      })
      console.log(`  +${wait}ms player=${JSON.stringify(s.player)}`)
      for (const r of s.rows) console.log('   ', JSON.stringify(r))
    }

    /* 手动推一次，看 play() 的返回。 */
    const forced = await page.evaluate(async () => {
      const t = window.__jayTown
      const out = []
      const vids = []
      t.scene.traverse((o) => {
        if (!o.name?.startsWith('jayMedia:')) return
        const v = o.children.find((c) => c.isMesh && c.material?.map?.isVideoTexture)
        if (v) vids.push({ id: o.name, video: v.material.map.image })
      })
      for (const { id, video } of vids) {
        if (!video.paused) { out.push({ id, note: 'already playing' }); continue }
        try {
          await video.play()
          out.push({ id, note: 'play() resolved', rs: video.readyState, t: video.currentTime })
        } catch (e) {
          out.push({ id, note: `play() rejected: ${e.name}: ${e.message}`, rs: video.readyState })
        }
      }
      return out
    })
    console.log('  forced play:', JSON.stringify(forced))
  }

  fs.mkdirSync(path.join(__dirname, 'jay-media-shots'), { recursive: true })
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
