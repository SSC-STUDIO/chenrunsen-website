/**
 * 樱花树专项度量 / 取景（tree-artist 临时工具，不进 site/）。
 *
 * 为什么不用 jay-town.cjs 的 trees 模式量 drawCalls：post.js 的 render() 最后
 * 一次画的是全屏三角（ink/grade/fxaa 的 quad），而 renderer.info 在每次
 * renderer.render() 开头自动 reset —— 所以在帧与帧之间读 info.render 拿到的是
 * 那最后一张全屏 quad 的数字（calls=1 / triangles=1），不是主场景的。
 * 这里把 renderer.render 包一层，只取 scene === 主场景 的那一次调用做差。
 *
 * 用法（在 tools/shot 下）：
 *   node tree-check.cjs stats [--stop=0] [--url=...]
 *   node tree-check.cjs shot  --name=tree-close --target=-7.1,3.4,5.8 --dist=6 --bearing=0.9 [--up=1.6] [--big]
 *   node tree-check.cjs lite  [--url=...]        # dense 路径是否被 matchMedia 判成 lite
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_DEFAULT = 'http://127.0.0.1:4399/jay-town/'

const argv = process.argv.slice(2)
const mode = argv[0] || 'stats'
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const has = (name) => argv.includes(`--${name}`)

const BASE = flag('url', URL_DEFAULT)
const OUT = path.resolve(flag('out', path.join(__dirname, 'jay-town-shots')))
const WAIT = Number(flag('wait', 90000))
const [VW, VH] = (flag('vp', '720x450')).split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch() {
  const w = has('big') ? 1440 : VW
  const h = has('big') ? 900 : VH
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: [
      `--window-size=${w},${h}`,
      '--hide-scrollbars',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-vsync',
      '--no-sandbox',
    ],
    defaultViewport: { width: w, height: h, deviceScaleFactor: 1 },
  })
  const page = await browser.newPage()
  // headless 报 prefers-reduced-motion: reduce，见 jay-town.cjs 头部第 1 条
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  return { browser, page }
}

async function open() {
  const { browser, page } = await launch()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const state = await page.evaluate((ms) => new Promise((resolve) => {
    const start = performance.now()
    const poll = () => {
      const t = window.__jayTown
      const frames = t?.renderer?.info?.render?.frame ?? 0
      if (t && t.world && t.camera && frames > 2) return resolve({ ok: true, frames })
      if (performance.now() - start > ms) return resolve({ ok: false, frames, keys: t ? Object.keys(t) : [] })
      setTimeout(poll, 120)
    }
    poll()
  }), WAIT)
  if (!state.ok) { await browser.close(); throw new Error('not ready: ' + JSON.stringify(state)) }
  await page.evaluate(() => document.getElementById('ui-hide')?.click())
  await sleep(400)
  return { browser, page, errors }
}

async function goToStop(page, index) {
  await page.evaluate((i) => document.querySelector(`.town-route__stop[data-zone="${i}"]`)?.click(), index)
  await sleep(900)
}

/** 装一个只测「主场景那一次 render」的量尺，并返回读数函数。 */
const ARM = `
window.__treeArm = () => {
  const t = window.__jayTown
  const r = t.renderer
  if (!r.__treeOrig) {
    r.__treeOrig = r.render.bind(r)
    r.render = function (scene, camera) {
      const info = r.info.render
      const c0 = info.calls, t0 = info.triangles
      const out = r.__treeOrig(scene, camera)
      if (scene === t.scene) {
        window.__mainPass = {
          calls: info.calls - c0,
          triangles: info.triangles - t0,
          programs: r.info.programs ? r.info.programs.length : null,
        }
      }
      return out
    }
  }
  window.__mainPass = null
}
window.__treeRead = () => new Promise((resolve) => {
  // 等两帧，确保 __mainPass 是这一轮的
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.__mainPass)))
})
/** 主场景里所有名字以 sakura 开头的 mesh 的确定性三角形数 */
window.__treeMeshes = () => {
  const scene = window.__jayTown.scene
  const rows = []
  scene.traverse((o) => {
    if (!o.isMesh || !/^sakura/.test(o.name || '')) return
    const g = o.geometry
    const pos = g.getAttribute('position')
    const tris = g.index ? g.index.count / 3 : pos.count / 3
    rows.push({
      name: o.name,
      instanced: !!o.isInstancedMesh,
      instances: o.isInstancedMesh ? o.count : 1,
      verts: pos.count,
      trisPerUnit: Math.round(tris),
      trisTotal: Math.round(tris * (o.isInstancedMesh ? o.count : 1)),
    })
  })
  return rows
}
window.__treeLite = () => ({
  innerWidth: window.innerWidth,
  coarse: window.matchMedia('(pointer: coarse)').matches,
  lite: window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700,
})
/** 把相机摆到 target 前方 dist 米、方位角 bearing 处看向 target（沿用 player 的 yaw 约定） */
window.__treeLook = ({ tx, tz, tyoff, dist, bearing, up, pitch }) => {
  const t = window.__jayTown
  const p = t.player
  const ty = t.world.heightAt(tx, tz) + tyoff
  p.pos.x = tx + Math.sin(bearing) * dist
  p.pos.z = tz + Math.cos(bearing) * dist
  p.pos.y = t.world.heightAt(p.pos.x, p.pos.z) + up
  p.yaw = bearing
  p.pitch = pitch === null ? Math.atan2(ty - (p.pos.y + 1.62), dist) : pitch
  p.vel.set(0, 0, 0)
  p.applyCamera(0)
  return { target: [tx, ty, tz], cam: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch }
}

/**
 * 不经过 player 的 yaw/planet basis，直接把相机摆好再 lookAt。
 *
 * 为什么需要：player.applyCamera 走的是 basisAt 的曲面切空间（east/up/north），
 * 它的 yaw 和平面世界的方位角并不是同一个数 —— 实测用 __treeLook 瞄准一棵树，
 * 树会稳定地落在画面右侧三四十度以外，取景根本对不准。这里把 applyCamera 换成
 * 空函数（渲染循环每帧叫它一次，会把相机摆回 player 的位置），然后自己摆相机。
 */
window.__treeLookExact = ({ tx, tz, tyoff, dist, bearing, up }) => {
  const t = window.__jayTown
  const p = t.player
  const ty = t.world.heightAt(tx, tz) + tyoff
  const cx = tx + Math.sin(bearing) * dist
  const cz = tz + Math.cos(bearing) * dist
  const cy = t.world.heightAt(cx, cz) + up
  p.applyCamera = () => {}
  p.pos.set(cx, cy, cz)
  p.vel.set(0, 0, 0)
  t.camera.position.set(cx, cy, cz)
  t.camera.up.set(0, 1, 0)
  t.camera.lookAt(tx, ty, tz)
  t.camera.updateMatrixWorld(true)
  const f = new t.camera.position.constructor(0, 0, -1).applyQuaternion(t.camera.quaternion)
  const want = new t.camera.position.constructor(tx - cx, ty - cy, tz - cz).normalize()
  return {
    target: [tx, ty, tz],
    cam: [cx, cy, cz],
    aimErrorDeg: Math.acos(Math.max(-1, Math.min(1, f.dot(want)))) * 180 / Math.PI,
  }
}
`

async function stats() {
  const { browser, page, errors } = await open()
  await goToStop(page, Number(flag('stop', 0)))
  await page.evaluate(ARM)
  await page.evaluate(() => window.__treeArm())
  const base = await page.evaluate(() => window.__treeRead())
  const lite = await page.evaluate(() => window.__treeLite())
  const meshes = await page.evaluate(() => window.__treeMeshes())

  // 把樱花树全部隐藏再测一遍 —— 差值就是这棵树对整个帧的真实开销
  await page.evaluate(() => {
    window.__treeHidden = []
    window.__jayTown.scene.traverse((o) => {
      if (o.isMesh && /^sakura/.test(o.name || '') && o.visible) { o.visible = false; window.__treeHidden.push(o) }
    })
  })
  const without = await page.evaluate(() => window.__treeRead())
  await page.evaluate(() => { window.__treeHidden.forEach((o) => { o.visible = true }) })

  const out = {
    lite,
    mainPass: base,
    withoutTrees: without,
    treeCost: base && without
      ? { calls: base.calls - without.calls, triangles: base.triangles - without.triangles }
      : null,
    meshes,
    treeTriangles: meshes.reduce((s, m) => s + m.trisTotal, 0),
  }
  console.log(JSON.stringify(out, null, 2))
  if (errors.length) console.log('console errors:', errors.slice(0, 8))
  await browser.close()
}

async function lite() {
  const { browser, page } = await open()
  await page.evaluate(ARM)
  console.log(JSON.stringify(await page.evaluate(() => window.__treeLite()), null, 2))
  await browser.close()
}

async function shot() {
  const { browser, page, errors } = await open()
  await goToStop(page, Number(flag('stop', 0)))
  await page.evaluate(ARM)
  const [tx, tz] = flag('target', '0,0').split(',').map(Number)
  const p = flag('pitch', null)
  const args = {
    tx, tz,
    tyoff: Number(flag('tyoff', 3.2)),
    dist: Number(flag('dist', 6)),
    bearing: Number(flag('bearing', 0.9)),
    up: Number(flag('up', 1.6)),
    pitch: p === null ? null : Number(p),
  }
  const exact = has('exact')
  const view = await page.evaluate(
    (a) => (a.exact ? window.__treeLookExact(a) : window.__treeLook(a)),
    { ...args, exact },
  )
  console.log('view:', JSON.stringify(view))
  await sleep(900)
  const file = path.join(OUT, `${flag('name', 'tree-shot')}.png`)
  await page.screenshot({ path: file })
  console.log('shot:', file)
  if (errors.length) console.log('console errors:', errors.slice(0, 8))
  await browser.close()
}

async function main() {
  if (mode === 'stats') return stats()
  if (mode === 'shot') return shot()
  if (mode === 'lite') return lite()
  throw new Error('unknown mode ' + mode)
}

main().catch((e) => { console.error(e); process.exit(1) })
