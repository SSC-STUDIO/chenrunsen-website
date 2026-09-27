/**
 * 每一站四周到底有什么：从玩家相机出发打一圈水平射线。
 *
 * 关键教训：不要自己算球面坐标去造射线起点 —— 第一版这么写得到「全 open」，
 * 因为起点在球面上但 `raycaster` 打的是世界坐标，一个符号错了就整圈打空。
 * 玩家自己的相机位置一定是对的（画面就出在那儿），直接用它。
 *
 * 用法：node diag-walls.cjs [--url=...] [--rays=32] [--range=16] [--zone=0]
 */
const puppeteer = require('puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const argv = process.argv.slice(2)
const flag = (n, d) => {
  const h = argv.find((a) => a.startsWith(`--${n}=`))
  return h ? h.slice(n.length + 3) : d
}
const BASE = flag('url', 'http://127.0.0.1:4402/jay-town/')
const RAYS = Number(flag('rays', 32))
const RANGE = Number(flag('range', 16))
const ZONE = flag('zone', '')

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 900000,
    args: ['--window-size=720,450', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'],
    defaultViewport: { width: 720, height: 450 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const ready = await page.evaluate(
    (ms) => new Promise((res) => {
      const t0 = performance.now()
      const p = () => {
        const t = window.__jayTown
        if (t && t.world && (t.renderer.info.render.frame ?? 0) > 2) return res(true)
        if (performance.now() - t0 > ms) return res(false)
        setTimeout(p, 150)
      }
      p()
    }),
    120000,
  )
  if (!ready) throw new Error('scene never became ready')

  const zones = ZONE === '' ? [0, 1, 2, 3, 4] : [Number(ZONE)]
  for (const zone of zones) {
    await page.evaluate((z) => {
      document.querySelector(`.town-route__stop[data-zone="${z}"]`)?.click()
    }, zone)
    await new Promise((r) => setTimeout(r, 1200))

    const out = await page.evaluate(
      async ({ rays, range }) => {
        const t = window.__jayTown
        t.scene.updateMatrixWorld(true)
        const targets = []
        t.scene.traverse((o) => { if (o.isMesh && o.visible) targets.push(o) })
        const V = t.camera.position.constructor
        const cam = t.camera.position.clone()
        /* 玩家的 forward：和 applyCamera 同一套（局部 -Z）。 */
        const fwd = new V(0, 0, -1).applyQuaternion(t.camera.quaternion)
        const up = new V(0, 1, 0).applyQuaternion(t.camera.quaternion)
        const right = new V().crossVectors(fwd, up).normalize()
        const flatFwd = fwd.clone().projectOnPlane(up).normalize()
        const flatRight = right.clone().projectOnPlane(up).normalize()

        /* 自检：正前方 1 m 的地面方向打一条，必须命中。 */
        const ray = t.player.raycaster
        const prevFar = ray.far
        ray.far = range
        const checkDir = flatFwd.clone().multiplyScalar(0.2).add(up.clone().multiplyScalar(-1)).normalize()
        ray.set(cam, checkDir)
        const selfCheck = ray.intersectObjects(targets, false).length

        const hits = []
        for (let i = 0; i < rays; i++) {
          const a = (i / rays) * Math.PI * 2
          /* 水平一圈：forward 权重 cos、right 权重 sin，再加一点上仰避开地面。 */
          const dir = flatFwd.clone().multiplyScalar(Math.cos(a))
            .addScaledVector(flatRight, Math.sin(a))
            .addScaledVector(up, 0.04)
            .normalize()
          ray.set(cam, dir)
          const found = ray.intersectObjects(targets, false)
          hits.push({
            deg: Math.round((a * 180) / Math.PI),
            d: found.length ? +found[0].distance.toFixed(2) : null,
            name: found.length ? (found[0].object.name || found[0].object.type) : null,
          })
          if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0))
        }
        ray.far = prevFar
        return {
          cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)],
          player: [+t.player.pos.x.toFixed(2), +t.player.pos.z.toFixed(2)],
          selfCheck,
          hits,
        }
      },
      { rays: RAYS, range: RANGE },
    )

    const closed = out.hits.filter((h) => h.d !== null)
    console.log(`\n=== zone ${zone} player=${out.player.join(',')} cam=${out.cam.join(',')} selfcheck=${out.selfCheck} ===`)
    console.log(`  有遮挡 ${closed.length}/${out.hits.length}`)
    console.log('  ' + out.hits.map((h) => `${h.deg}:${h.d ?? 'open'}`).join('  '))
    if (closed.length) {
      const names = {}
      for (const h of closed) names[h.name] = (names[h.name] ?? 0) + 1
      console.log('  命中对象:', JSON.stringify(names))
    }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
