/**
 * 周杰伦樱花小镇验收脚本（Lead 所有）。
 *
 * 用法（在 tools/shot 下运行）：
 *   node jay-town.cjs probe
 *   node jay-town.cjs birds  [--seconds=4] [--stops=0,3]
 *   node jay-town.cjs shoot  [--stops=0,1,2,3,4] [--big] [--hide-ui]
 *   node jay-town.cjs trees  [--stop=0]
 *   node jay-town.cjs look   [--stop=0] [--pitch=-0.2] [--yaw=1.2] [--dist=6] [--up=1.6]
 *
 * 依赖同目录 node_modules 里的 puppeteer-core 与本机 Chrome。
 * 地址默认 http://127.0.0.1:4322/jay-town/（仓库里的 Astro dev server）。
 *
 * 两个坑，踩过就别再踩：
 *  1. headless Chrome 报 `prefers-reduced-motion: reduce`，而 scene.ts 用它把
 *     dt 归零 —— 整个世界都不更新，量出来「什么都不动」。必须 emulate 成
 *     no-preference。
 *  2. SwiftShader 软件渲染很慢，1440x900 一帧要好几秒，主线程被 raf 占满，
 *     CDP 的 waitForFunction 会被饿死。默认用 720x450 小视口 + 页面内自身轮询。
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_DEFAULT = 'http://127.0.0.1:4322/jay-town/'

const argv = process.argv.slice(2)
const mode = argv[0] || 'shoot'
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const has = (name) => argv.includes(`--${name}`)

const BASE = flag('url', URL_DEFAULT)
const OUT = path.resolve(flag('out', path.join(__dirname, 'jay-town-shots')))
const STOPS = flag('stops', '0,1,2,3,4').split(',').map((s) => Number(s.trim()))
const WAIT = Number(flag('wait', 60000))
const HIDE_UI = has('hide-ui')
const VP = flag('vp', null)
const [VW, VH] = (VP || '720x450').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch(big) {
  const w = big ? 1440 : VW
  const h = big ? 900 : VH
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    /* 页面里的采样器是同步等好几秒才 resolve 的，默认 30s 的协议超时会先炸。 */
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
  /* 见文件头第 1 条。 */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  return { browser, page }
}

function attachLogs(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
}

/**
 * 页面内自己等场景挂载，不依赖 CDP 往返。
 * 返回 { ok, frames, phase, keys }。
 */
async function waitReady(page, timeout = WAIT) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const start = performance.now()
        const poll = () => {
          const t = window.__jayTown
          const frames = t?.renderer?.info?.render?.frame ?? 0
          const done = !!(t && t.world && t.player && t.camera && frames > 2)
          if (done) {
            /* **开场推镜必须先结束，否则每一张截图都是错的机位。**
             *
             * `scene.ts` 在 `applyCamera` 之后还叠一段 2.6 秒的开场位移
             * （`camera.position += north*(9.5k) + up*(3.4k)`，`k=(1-intro)³`）。
             * 软件渲染下一帧 0.3-1 秒，等 0.9 秒墙钟时 intro 才走到 0.3 左右，
             * 取景就比你以为的位置**后退几米、抬高一两米** —— 之前几批
             * 「按坐标摆相机却拍到别处」的截图，一半是这个原因。
             *
             * 按**帧数 + 相机稳定**等，不按墙钟：intro 用 `dt/2.6` 累加而
             * dt 被夹在 1/20，所以 2.6 秒的推镜在 headless 下要跑几十帧。 */
            const target = frames + 26
            const camAt = () => [t.camera.position.x, t.camera.position.y, t.camera.position.z]
            let last = camAt()
            let stable = 0
            const settle = () => {
              const now = camAt()
              const moved = Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2])
              last = now
              if (t.renderer.info.render.frame >= target && moved < 0.01) {
                stable += 1
                if (stable >= 2) {
                  resolve({ ok: true, frames: t.renderer.info.render.frame, phase: null })
                  return
                }
              } else {
                stable = 0
              }
              if (performance.now() - start > ms + 20000) {
                resolve({ ok: true, frames: t.renderer.info.render.frame, phase: 'intro-timeout' })
                return
              }
              setTimeout(settle, 200)
            }
            setTimeout(settle, 200)
            return
          }
          if (performance.now() - start > ms) {
            resolve({
              ok: false,
              frames,
              keys: t ? Object.keys(t) : [],
              phase: document.getElementById('scene-phase')?.textContent ?? null,
            })
            return
          }
          setTimeout(poll, 120)
        }
        poll()
      }),
    timeout,
  )
}

async function open({ big = false, hideUi = HIDE_UI, tries = 3 } = {}) {
  let last = null
  for (let attempt = 1; attempt <= tries; attempt++) {
    const { browser, page } = await launch(big)
    const errors = []
    attachLogs(page, errors)
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const state = await waitReady(page)
    if (state.ok) {
      if (attempt > 1) console.log(`scene ready on attempt ${attempt}, frames =`, state.frames)
      else console.log('scene ready, frames =', state.frames)
      if (hideUi) {
        await page.evaluate(() => document.getElementById('ui-hide')?.click())
        await sleep(500)
      }
      return { browser, page, errors }
    }
    /* 软件渲染下偶发：世界还在同步构建里，渲染循环没转起来。重开一次比调参快。 */
    console.log(`attempt ${attempt}: scene not ready (${JSON.stringify(state)}), retrying`)
    last = state
    await browser.close()
    await sleep(1500)
  }
  throw new Error(`scene never became ready: ${JSON.stringify(last)}`)
}

/** 用路线按钮跳站 —— 就是用户点击的那条路径。 */
async function goToStop(page, index) {
  const ok = await page.evaluate((i) => {
    const btn = document.querySelector(`.town-route__stop[data-zone="${i}"]`)
    if (!btn) return false
    btn.click()
    return true
  }, index)
  if (!ok) throw new Error(`stop button ${index} missing`)
  await sleep(900)
}

async function snap(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  console.log('shot:', file)
}

/* ------------------------------------------------------------------ *
 * 采样：把「鸟到底动没动」变成数字。
 *
 * 每帧采一次，比较各物体相对首帧的变化量。判据：
 *  - crowMove[i] > 0  → 第 i 只栖鸟的姿态/位置真的在变
 *  - flockVertexMax > 0 → 飞行组翅膀顶点在动（uFlap 传进 shader 了）
 *  - cameraTravel > 0 → dt 不是 0，世界在更新（判断 harness 是否可信）
 * ------------------------------------------------------------------ */
const SAMPLER = `
window.__jaySample = (frames, everyMs) => new Promise((resolve) => {
  const t = window.__jayTown
  const scene = t.scene
  const flock = scene.getObjectByName('skyFlock')
  const crows = scene.getObjectByName('wireCrows')
  const g = flock && flock.geometry
  const posAttr = g && g.getAttribute('position')
  const idx = flock && flock.count ? [0, Math.floor(flock.count / 2), flock.count - 1] : []
  const cams = []
  const flockPts = []
  const crowM = []
  const times = []
  let n = 0
  const sample = () => {
    const cam = t.camera
    cams.push([cam.position.x, cam.position.y, cam.position.z, cam.rotation.y, cam.rotation.x])
    if (posAttr) {
      const pts = []
      for (const i of idx) {
        const o = i * 3
        pts.push([posAttr.array[o], posAttr.array[o + 1], posAttr.array[o + 2]])
      }
      flockPts.push(pts)
    }
    if (crows) {
      crowM.push(crows.children.map((c) => {
        const b = c.children[0]
        c.updateWorldMatrix(true, false)
        const wp = new t.camera.position.constructor()
        c.getWorldPosition(wp)
        return [
          wp.x, wp.y, wp.z, c.rotation.y,
          b ? b.rotation.x : 0, b ? b.rotation.y : 0, b ? b.rotation.z : 0,
          b ? b.position.y : 0,
        ]
      }))
    }
    times.push(performance.now())
    n += 1
  }
  sample()
  const id = setInterval(() => {
    sample()
    if (n >= frames) {
      clearInterval(id)
      const first = cams[0]
      const last = cams[cams.length - 1]
      resolve({
        cameraTravel: Math.hypot(last[0] - first[0], last[1] - first[1], last[2] - first[2]),
        cameraYawSwing: (() => {
          let lo = Infinity, hi = -Infinity
          for (const c of cams) { lo = Math.min(lo, c[3]); hi = Math.max(hi, c[3]) }
          return hi - lo
        })(),
        uFlap: flock ? flock.material.userData.uFlap.value : null,
        flockInstances: flock ? flock.count : 0,
        flockVertexMax: flockPts.length > 1
          ? Math.max(...flockPts.map((pts, k) => Math.max(...pts.map((p, j) => Math.hypot(
            p[0] - flockPts[0][j][0], p[1] - flockPts[0][j][1], p[2] - flockPts[0][j][2],
          )))))
          : 0,
        crowCount: crowM.length ? crowM[0].length : 0,
        crowMove: crowM.length > 1
          ? crowM[0].map((_, j) => Math.max(...crowM.map((row) => {
            const a = row[j]
            const b = crowM[0][j]
            return Math.max(
              Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1000,
              Math.abs(a[3] - b[3]) + Math.abs(a[4] - b[4]) + Math.abs(a[5] - b[5]) + Math.abs(a[6] - b[6]),
              Math.abs(a[7] - b[7]) * 1000,
            )
          })))
          : [],
        frames: n,
        spanMs: times[times.length - 1] - times[0],
        fps: (n / Math.max(1, times[times.length - 1] - times[0])) * 1000,
      })
    }
  }, everyMs)
})
`

/** 在一只栖鸟附近取景：把相机怼到电线上的鸟旁边。 */
async function lookAtCrows(page, { dist = 3.2, up = 0.6, yawOffset = 0, pitch = -0.02 } = {}) {
  return page.evaluate(
    ({ dist, up, yawOffset, pitch }) => {
      const t = window.__jayTown
      const crows = t.scene.getObjectByName('wireCrows')
      const c = crows?.children?.[0]
      if (!c) return null
      c.updateWorldMatrix(true, false)
      const p = c.getWorldPosition(c.position.clone())
      const yaw = yawOffset
      t.player.pos.x = p.x + Math.sin(yaw) * dist
      t.player.pos.z = p.z + Math.cos(yaw) * dist
      t.player.pos.y = t.world.heightAt(t.player.pos.x, t.player.pos.z) + up
      t.player.yaw = yaw + Math.PI
      t.player.pitch = pitch + (p.y - t.player.pos.y) / Math.max(dist, 0.5)
      t.player.vel.set(0, 0, 0)
      t.player.applyCamera(0)
      return { crow: [p.x, p.y, p.z], cam: [t.camera.position.x, t.camera.position.y, t.camera.position.z] }
    },
    { dist, up, yawOffset, pitch },
  )
}

async function birds() {
  const { browser, page, errors } = await open()
  await page.evaluate(SAMPLER)
  const seconds = Number(flag('seconds', 4))
  const frames = Math.max(8, Math.round((seconds * 1000) / 90))
  const res = await page.evaluate((f, every) => window.__jaySample(f, every), frames, 90)
  console.log(JSON.stringify(res, null, 2))

  const stops = flag('stops', '0,3').split(',').map(Number)
  for (const stop of stops) {
    await goToStop(page, stop)
    const view = await lookAtCrows(page)
    console.log('look:', JSON.stringify(view))
    await sleep(500)
    await snap(page, `birds-stop${stop}`)
  }
  if (errors.length) console.log('console errors:', errors.slice(0, 12))
  await browser.close()
  return res
}

async function shoot() {
  const { browser, page, errors } = await open({ big: has('big') })
  for (const stop of STOPS) {
    await goToStop(page, stop)
    await snap(page, `stop-${stop}-a`)
    await page.evaluate(() => {
      const t = window.__jayTown
      t.player.pitch = -0.3
      t.player.applyCamera(0)
    })
    await sleep(600)
    await snap(page, `stop-${stop}-b`)
  }
  await page.evaluate(() => document.getElementById('day-toggle')?.click())
  await sleep(2200)
  await snap(page, 'night')
  if (errors.length) console.log('console errors:', errors.slice(0, 12))
  await browser.close()
}

/* ------------------------------------------------------------------ *
 * 真实的每帧渲染成本。
 *
 * **不能用 `renderer.info.render.calls` 去量这个场景。** `Pipeline.render()`
 * 一帧要调 `renderer.render()` 好几趟（G-buffer、描边、调色、FXAA），而
 * WebGLRenderer 每趟都 `info.reset()` —— 于是从外面读到的永远是**最后一趟
 * 全屏 quad 的数**：calls=1、triangles=1。这个数在之前的对比里一直出现，
 * 是无效数据。
 *
 * 正确做法是把 `renderer.render` 包起来，把一帧里每一趟累加。包在每次调用
 * 的自增上，用「两次采样之间的增量 / 帧数」得到每帧成本。
 * ------------------------------------------------------------------ */
const INSTALL_COUNTER = `
window.__jayCost = { calls: 0, tris: 0, frames: 0 }
;(() => {
  const t = window.__jayTown
  if (!t || t.__wrapped) return
  t.__wrapped = true
  const r = t.renderer
  const orig = r.render.bind(r)
  r.render = (scene, camera) => {
    orig(scene, camera)
    window.__jayCost.calls += r.info.render.calls
    window.__jayCost.tris += r.info.render.triangles
    window.__jayCost.frames += 1
  }
})()
`

/** 采样 `seconds` 秒，返回每帧平均的 calls / triangles。 */
async function frameCost(page, seconds = 2.5) {
  await page.evaluate(INSTALL_COUNTER)
  const res = await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const c = window.__jayCost
        const c0 = c.calls
        const t0 = c.tris
        const f0 = c.frames
        setTimeout(() => {
          const df = c.frames - f0
          const dc = c.calls - c0
          const dt = c.tris - t0
          resolve({
            passesPerFrame: df ? +(dc / df).toFixed(2) : null,
            drawCallsPerFrame: df ? Math.round(dc / df) : null,
            trianglesPerFrame: df ? Math.round(dt / df) : null,
            renderPasses: df,
            windowMs: ms,
          })
        }, ms)
      }),
    Math.round(seconds * 1000),
  )
  return res
}

async function trees() {
  const stop = Number(flag('stop', 0))
  const { browser, page, errors } = await open()
  await goToStop(page, stop)
  const info = await page.evaluate(() => {
    const scene = window.__jayTown.scene
    const count = (m) => {
      if (!m) return null
      const p = m.geometry.getAttribute('position')
      return m.isInstancedMesh ? { instances: m.count, verts: p.count } : { verts: p.count }
    }
    let meshes = 0
    scene.traverse((o) => { if (o.isMesh) meshes += 1 })
    return {
      wood: count(scene.getObjectByName('sakuraWood')),
      canopy: [0, 1, 2].map((i) => count(scene.getObjectByName('sakuraCanopy' + i))),
      loose: count(scene.getObjectByName('sakuraLoosePetals')),
      meshes,
      programs: window.__jayTown.renderer.info.programs?.length ?? null,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  console.log('frame cost:', JSON.stringify(await frameCost(page, Number(flag('cost-seconds', 2.5)))))
  await snap(page, `trees-stop${stop}`)
  if (errors.length) console.log('console errors:', errors.slice(0, 12))
  await browser.close()
}

/** 自由取景：以某站为原点挪相机，用来看清一棵树 / 一只鸟。 */
async function look() {
  const stop = Number(flag('stop', 0))
  const { browser, page, errors } = await open({ big: has('big') })
  await goToStop(page, stop)
  const info = await page.evaluate(
    ({ x, z, yaw, pitch, up, dist }) => {
      const t = window.__jayTown
      const s = t.player.pos
      /* 三种给法都要能用，各管各的：
       *   --x/--z   绝对平面坐标（不依赖 dist）
       *   --dist    从当前站点沿 yaw 后退 dist 米
       *   都没给     就站在站点上只转朝向
       * 早先的写法把绝对坐标也塞进 `if (dist !== null)` 里，
       * 于是 `look --x=.. --z=..` 不给 dist 等于什么都没做。 */
      if (x !== null) t.player.pos.x = x
      if (z !== null) t.player.pos.z = z
      if (dist !== null) {
        if (x === null) t.player.pos.x = s.x + Math.sin(yaw) * dist
        if (z === null) t.player.pos.z = s.z + Math.cos(yaw) * dist
      }
      t.player.pos.y = t.world.heightAt(t.player.pos.x, t.player.pos.z) + up
      t.player.yaw = yaw
      t.player.pitch = pitch
      t.player.vel.set(0, 0, 0)
      t.player.applyCamera(0)
      return { pos: [t.player.pos.x, t.player.pos.y, t.player.pos.z], yaw, pitch }
    },
    {
      x: flag('x', null) === null ? null : Number(flag('x', 0)),
      z: flag('z', null) === null ? null : Number(flag('z', 0)),
      yaw: Number(flag('yaw', 0)),
      pitch: Number(flag('pitch', -0.1)),
      up: Number(flag('up', 0)),
      dist: flag('dist', null) === null ? null : Number(flag('dist', 4)),
    },
  )
  console.log('view:', JSON.stringify(info))
  await sleep(700)
  await snap(page, flag('name', `look-stop${stop}`))
  if (errors.length) console.log('console errors:', errors.slice(0, 12))
  await browser.close()
}

async function probe() {
  const { browser, page } = await launch(false)
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  let prev = 0
  for (const t of [2000, 6000, 12000, 20000]) {
    await sleep(t - prev)
    prev = t
    const s = await page.evaluate(() => ({
      has3D: !!window.__jayTown,
      frames: window.__jayTown?.renderer?.info?.render?.frame ?? null,
      phase: document.getElementById('scene-phase')?.textContent ?? null,
      town: document.getElementById('town')?.className ?? null,
      calls: window.__jayTown?.renderer?.info?.render?.calls ?? null,
      tris: window.__jayTown?.renderer?.info?.render?.triangles ?? null,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))
    console.log(`t=${t}`, JSON.stringify(s))
  }
  console.log('--- logs ---\n' + logs.filter((l) => !l.includes('flatShading')).slice(0, 40).join('\n'))
  await snap(page, 'probe')
  await browser.close()
}

/* ------------------------------------------------------------------ *
 * audit：扫一遍「本该在动、其实没动」的对象。
 *
 * 起因是栖鸟那个 bug：`batchStatic` 把会动的 group 里的网格并进静态批、把空容器删掉，
 * 于是代码还在跑、屏幕上什么都没有 —— 没有任何报错。这个模式把同类问题变成一张表：
 *   - 命名 group 的存活情况（wireCrows 之前是 4 个零子节点空 group）
 *   - scene 里所有带 userData.tick 的对象的实测位移
 * ------------------------------------------------------------------ */
const AUDIT = `
window.__jayAudit = (ms) => new Promise((resolve) => {
  const t = window.__jayTown
  const scene = t.scene
  const wanted = ['wireCrows', 'skyFlock', 'wireCrows', 'sakuraWood', 'sakuraCanopy0',
    'sakuraLoosePetals', 'lakeBird', 'petal', 'jayScreens', 'train']
  const groups = {}
  for (const n of wanted) {
    const o = scene.getObjectByName(n)
    groups[n] = o ? { type: o.type, children: o.children.length } : null
  }

  /* 空容器统计：非 mesh / 非 line / 非 rigid / 没子节点。批处理留下的空壳会命中。 */
  let emptyContainers = 0
  const emptyNamed = []
  scene.traverse((o) => {
    if (o === scene || o.isMesh || o.isLine || o.isPoints || o.isLight) return
    if (o.children.length === 0 && !o.userData.planetRigid) {
      emptyContainers++
      if (o.name && emptyNamed.length < 20) emptyNamed.push(o.name)
    }
  })

  /* 所有带 tick 的对象（就是「被设计成会动」的那批）。 */
  const ticked = []
  scene.traverse((o) => { if (typeof o.userData?.tick === 'function') ticked.push(o) })
  const tickedNow = ticked.map((o) => {
    o.updateWorldMatrix(true, false)
    return [o.name || o.type, o.children.length, +o.position.x.toFixed(4), +o.position.y.toFixed(4), +o.position.z.toFixed(4)]
  })

  const flock = scene.getObjectByName('skyFlock')
  const instanced = []
  scene.traverse((o) => { if (o.isInstancedMesh && instanced.length < 40) instanced.push(o.name || '(unnamed)') })

  setTimeout(() => {
    const after = ticked.map((o) => {
      o.updateWorldMatrix(true, false)
      return [o.position.x, o.position.y, o.position.z]
    })
    const tickMove = tickedNow.map((row, i) => Math.hypot(
      after[i][0] - row[2], after[i][1] - row[3], after[i][2] - row[4],
    ))

    /* 顶点级的「到底动没动」：清点每个 InstancedMesh 的实例数。 */
    const instCounts = {}
    scene.traverse((o) => { if (o.isInstancedMesh) instCounts[o.name || '(unnamed)'] = o.count })

    resolve({
      groups,
      emptyContainers,
      emptyNamed,
      tickedCount: ticked.length,
      tickMove: tickMove.map((v) => +v.toFixed(4)),
      tickedNow,
      flockCount: flock ? flock.count : null,
      instCounts,
      instancedSample: instanced,
      drawCalls: t.renderer.info.render.calls,
      triangles: t.renderer.info.render.triangles,
      frames: t.renderer.info.render.frame,
    })
  }, ms)
})
`

async function audit() {
  const { browser, page, errors } = await open()
  await page.evaluate(AUDIT)
  const res = await page.evaluate((ms) => window.__jayAudit(ms), Number(flag('audit-ms', 2500)))
  console.log(JSON.stringify(res, null, 2))
  if (errors.length) console.log('console errors:', errors.slice(0, 12))
  await browser.close()
  return res
}

async function main() {
  if (mode === 'shoot') return shoot()
  if (mode === 'birds') return birds()
  if (mode === 'trees') return trees()
  if (mode === 'look') return look()
  if (mode === 'probe') return probe()
  if (mode === 'audit') return audit()
  throw new Error(`unknown mode ${mode}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
