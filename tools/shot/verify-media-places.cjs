/**
 * 素材装置落位体检：每块牌子正面有没有被别的东西挡住、离地多高、朝哪。
 *
 * 为什么需要它：牌子是我按平面坐标手放的，视觉上「贴不贴墙、会不会悬空、
 * 前面有没有东西挡着」光靠看代码看不出来。这里用一个很直接的办法 ——
 * 在牌子正面 3 米、抬到画面中心的高度打一条射线打回牌子，
 * 看第一个命中是不是这块牌子本身：
 *
 *   命中 = 牌子本身、距离 ≈ 3m   → 正面通畅，拍得到
 *   命中 = 别的东西、距离 < 3m  → 被挡住了（墙、雨棚、别人的道具）
 *   没命中                        → 牌子不在这条线上（坐标或朝向不对）
 *
 * 用法（tools/shot 下）：
 *   node verify-media-places.cjs [--url=...] [--dist=3] [--json]
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
const DIST = Number(flag('dist', 3))
const AS_JSON = argv.includes('--json')
const OUT = path.join(__dirname, flag('out', 'jay-town-shots'))

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
    args: ['--window-size=720,450', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 720, height: 450 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
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

  const report = await page.evaluate((dist) => {
    const t = window.__jayTown
    const R = 160
    const V = t.camera.position.constructor
    const surface = (x, y, z, out) => {
      const la = x / R
      const ph = z / R
      const cp = Math.cos(ph)
      out.set(Math.sin(la) * cp, Math.cos(la) * cp, Math.sin(ph))
      out.multiplyScalar(R + y)
      return out
    }
    /* 玩家射线用的那个 raycaster 有 near/far 与 layers 配置，借它最省事。 */
    const ray = t.player.raycaster
    if (!ray) return [{ error: 'player.raycaster missing' }]

    const out = []
    for (const p of t.mediaPlacements()) {
      const ground = t.world.heightAt(p.x, p.z)
      const centerY = ground + p.y + p.h / 2
      const cx = p.x + Math.sin(p.face) * dist
      const cz = p.z + Math.cos(p.face) * dist
      const camGround = t.world.heightAt(cx, cz)
      const cam = new V()
      const tgt = new V()
      surface(cx, camGround + 1.62, cz, cam)
      surface(p.x, centerY, p.z, tgt)
      const dir = tgt.clone().sub(cam).normalize()

      ray.set(cam, dir)
      const far = dist + 6
      const prevFar = ray.far
      ray.far = far
      const hits = ray.intersectObjects(t.scene.children, true)
      ray.far = prevFar
      const first = hits[0] ?? null
      const boardHit = hits.find((h) => {
        for (let o = h.object; o; o = o.parent) if (o.name === `jayMedia:${p.id}`) return true
        return false
      }) ?? null

      out.push({
        id: p.id,
        kind: p.kind,
        zone: p.zone,
        board: { x: p.x, z: p.z, y: +centerY.toFixed(2), face: +p.face.toFixed(2) },
        camGround: +camGround.toFixed(2),
        firstHit: first ? { name: first.object.name || first.object.type, d: +first.distance.toFixed(2) } : null,
        boardHit: boardHit ? +boardHit.distance.toFixed(2) : null,
        verdict: boardHit
          ? (first && first.object !== boardHit.object ? 'blocked' : 'clear')
          : 'not-on-line',
      })
    }
    return out
  }, DIST)

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const pad = (v, n) => String(v).padEnd(n)
    console.log(pad('id', 30), pad('verdict', 12), pad('boardHit', 9), 'first hit')
    for (const r of report) {
      console.log(
        pad(r.id, 30),
        pad(r.verdict, 12),
        pad(r.boardHit ?? '-', 9),
        r.firstHit ? `${r.firstHit.name} @ ${r.firstHit.d} m` : '(nothing)',
      )
    }
    const bad = report.filter((r) => r.verdict !== 'clear')
    console.log(`\n${report.length - bad.length}/${report.length} clear`)
    if (bad.length) console.log('needs a look:', bad.map((b) => b.id).join(', '))
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
