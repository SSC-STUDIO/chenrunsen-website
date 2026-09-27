/**
 * 实测：视频屏对帧时间的代价，以及世界有没有在更新。
 * 用法：node diag-perf.cjs [--zone=1]
 */
const puppeteer = require('puppeteer-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:4399/jay-town/'
const ZONE = Number(process.argv.find((a) => a.startsWith('--zone='))?.slice(7) || 1)
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

  const countFrames = (ms) =>
    page.evaluate(
      (win) => new Promise((res) => {
        const t = window.__jayTown
        const f0 = t.renderer.info.render.frame
        const t0 = performance.now()
        setTimeout(() => {
          res({ frames: t.renderer.info.render.frame - f0, ms: Math.round(performance.now() - t0) })
        }, win)
      }),
      ms,
    )

  const setVideos = (on) =>
    page.evaluate((enable) => {
      const t = window.__jayTown
      let n = 0
      t.scene.traverse((o) => {
        if (!o.name?.startsWith('jayMedia:')) return
        const v = o.children.find((c) => c.isMesh && c.material?.map?.isVideoTexture)
        if (v) { v.visible = enable; n++ }
      })
      return n
    }, on)

  await page.evaluate((z) => document.querySelector(`.town-route__stop[data-zone="${z}"]`)?.click(), ZONE)
  await sleep(4000)

  console.log('zone', ZONE)
  console.log('  videos ON :', JSON.stringify(await countFrames(6000)))
  const hidden = await setVideos(false)
  console.log('  hid', hidden, 'videos')
  console.log('  videos OFF:', JSON.stringify(await countFrames(6000)))
  await setVideos(true)
  console.log('  videos ON :', JSON.stringify(await countFrames(6000)))

  /* 帧内成本：关掉后期，看世界本身的绘制。 */
  const post = await page.evaluate(() => {
    const p = window.__jayTown.pipeline
    return { ink: p.enabled.ink, grade: p.enabled.grade, fxaa: p.enabled.fxaa, scale: p.scale, size: [p.size.x, p.size.y] }
  })
  console.log('  pipeline:', JSON.stringify(post))
  await page.evaluate(() => {
    const p = window.__jayTown.pipeline
    p.enabled.ink = false; p.enabled.grade = false; p.enabled.fxaa = false
  })
  console.log('  no post   :', JSON.stringify(await countFrames(6000)))

  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
