/**
 * 素材装置特写：每一件素材都正面拍一张。
 *
 * 这是「每一个素材都要放进场景」这件事的视觉证据 —— 光数牌子数量不够，
 * 还要看得见画面。站位由 `media.ts` 的平面坐标推算：站在牌子正面
 * `dist` 米、抬到画面中心高度，朝向牌子的 yaw。
 *
 * 用法（tools/shot 下）：
 *   node verify-media-shots.cjs [--url=...] [--dist=3.2] [--big]
 *   node verify-media-shots.cjs --only=pig,school-life
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
const BASE = flag('url', 'http://127.0.0.1:4402/jay-town/')
const OUT = path.resolve(flag('out', path.join(__dirname, 'jay-media-shots')))
const DIST = Number(flag('dist', 3.2))
const BIG = argv.includes('--big')
const ONLY = flag('only', '')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: [
      `--window-size=${BIG ? 1440 : 960},${BIG ? 900 : 600}`,
      '--hide-scrollbars', '--no-sandbox',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: BIG ? 1440 : 960, height: BIG ? 900 : 600, deviceScaleFactor: 1 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const ok = await page.evaluate(
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
    90000,
  )
  if (!ok) throw new Error('scene never became ready')

  /* 每件素材的站位：牌子在 (x,z) 朝 face，站在它的正面 dist 米处，镜头朝回它。 */
  const shots = await page.evaluate(({ only }) => {
    const t = window.__jayTown
    const byId = new Map(t.media().map((m) => [m.id, m]))
    const placements = t.mediaPlacements ? t.mediaPlacements() : []
    const want = only ? only.split(',') : null
    return placements
      .filter((p) => !want || want.includes(p.id))
      .map((p) => ({ ...p, meta: byId.get(p.id) ?? null, groundY: t.world.heightAt(p.x, p.z) }))
  }, { only: ONLY })

  if (!shots.length) {
    console.log('no placements: __jayTown.mediaPlacements missing?')
    await browser.close()
    process.exit(1)
  }

  for (const s of shots) {
    const px = s.x + Math.sin(s.face) * DIST
    const pz = s.z + Math.cos(s.face) * DIST
    /* 用 `__jayTown.lookFrom`（平面坐标进、镜头出）而不是自己算 yaw/pitch：
     * 符号约定只有一处，脚本不用再猜第二遍。 */
    const info = await page.evaluate(
      ({ px, pz, atX, atZ, lookUp }) => {
        const t = window.__jayTown
        if (typeof t.lookFrom !== 'function') return { error: 'lookFrom missing' }
        return t.lookFrom(px, pz, atX, atZ, { eye: 1.62, lookUp })
      },
      { px, pz, atX: s.x, atZ: s.z, lookUp: s.y + s.h / 2 },
    )
    if (info?.error) console.log('WARN:', info.error)
    /* 先量一下「牌子背后那面墙离它多远」：从牌子往回墙的方向打一条射线，
     * 再决定相机站多远 —— 不然牌子可能被墙挡住，或者相机站到墙里面去。
     * 这一步是「我按坐标放牌、拍出来是墙」这个循环的止损点。 */
    const wall = await page.evaluate(
      ({ px, pz, atX, atZ }) => {
        const t = window.__jayTown
        const V = t.camera.position.constructor
        const ray = t.player.raycaster
        t.scene.updateMatrixWorld(true)
        const targets = []
        t.scene.traverse((o) => { if (o.isMesh && o.visible) targets.push(o) })
        const origin = t.camera.position.clone()
        const dir = t.camera.position.clone().set(px, t.player.pos.y + 1.62, pz)
        const toCam = origin.clone().sub(dir)
        if (toCam.lengthSq() < 1e-6) return null
        toCam.normalize()
        ray.set(origin, toCam)
        const prev = ray.far
        ray.far = 30
        const hits = ray.intersectObjects(targets, false)
        ray.far = prev
        return hits.length ? { d: +hits[0].distance.toFixed(2), name: hits[0].object.name || hits[0].object.type } : null
      },
      { px, pz, atX: s.x, atZ: s.z },
    )
    console.log('  camera->wall behind board:', JSON.stringify(wall))
    /* 给视频一点起播时间：屏幕要拍到画面，不是拍到第一帧黑。 */
    await sleep(s.kind === 'video' ? 4500 : 1200)
    const file = path.join(OUT, `${s.kind === 'video' ? 'clip' : 'art'}-${s.id}.png`)
    await page.screenshot({ path: file })
    console.log('shot:', file)
  }

  if (errors.length) console.log('console errors:', errors.slice(0, 8))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
