/**
 * 素材落位验收（Lead 所有）。
 *
 * 用户的要求是「public/jay-town 里每一个素材都要出现在场景里」。这件事不能靠
 * 肉眼看截图点头 —— 它能被数出来：media.ts 那张表里有几条，场景里就该有几块
 * 牌子，每一块的贴图就该有一次成功的请求。这个脚本就是那把尺子。
 *
 * 用法（tools/shot 下）：
 *   node verify-media.cjs [--url=http://127.0.0.1:4399/jay-town/] [--shots]
 *
 * 判据：
 *   expected === boards            场景里建出来的牌子数
 *   missing.length === 0           表里有、场景里没有的
 *   failedRequests.length === 0    贴图/视频 404
 *   videosPlaying ≥ 1              走近之后至少一台在播
 *   navItems === expected          表层缩略图导航的条目数
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const BASE = flag('url', 'http://127.0.0.1:4399/jay-town/')
const OUT = path.resolve(flag('out', path.join(__dirname, 'jay-media-shots')))
const SHOTS = argv.includes('--shots')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: [
      '--window-size=720,450', '--hide-scrollbars', '--no-sandbox',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: 720, height: 450, deviceScaleFactor: 1 },
  })
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

  const failed = []
  const mediaResponses = []
  page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`))
  page.on('response', (r) => {
    const u = r.url()
    if (u.includes('/jay-town/media/')) mediaResponses.push({ url: u.split('/jay-town/media/')[1], status: r.status() })
  })
  page.on('pageerror', (e) => failed.push(`pageerror: ${e.message}`))

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const t0 = performance.now()
        const poll = () => {
          const t = window.__jayTown
          if (t && t.world && (t.renderer.info.render.frame ?? 0) > 2) return resolve(true)
          if (performance.now() - t0 > ms) return resolve(false)
          setTimeout(poll, 120)
        }
        poll()
      }),
    60000,
  )

  /* 1) 表 vs 场景：按名字数牌子。 */
  const scene = await page.evaluate(() => {
    const t = window.__jayTown
    const boards = []
    const guides = []
    t.scene.traverse((o) => {
      if (o.name?.startsWith('jayMedia:')) boards.push(o.name.slice('jayMedia:'.length))
      if (o.name?.startsWith('jayMediaGuide:')) guides.push(o.name.slice('jayMediaGuide:'.length))
    })
    return {
      boards,
      guides,
      table: t.media().map((m) => ({ id: m.id, kind: m.kind, title: m.title, zone: m.zone, src: m.src })),
    }
  })

  const ids = scene.table.map((m) => m.id)
  const missing = ids.filter((id) => !scene.boards.includes(id))
  const extra = scene.boards.filter((id) => !ids.includes(id))

  /* 2) 贴图/视频有没有真的请求到，以及 media/ 里每个文件是否都被用到。
   *
   * `net::ERR_ABORTED` 是 <video> 换源时的正常现象（浏览器主动掐掉上一个
   * range 请求），不能当失败算；真正的判据是「这个文件有没有成功响应过」。 */
  const byFile = new Map()
  for (const r of mediaResponses) {
    /* 按**文件名**归并：`media/thumbs/x.jpg` 与 `media/x.jpg` 在盘上互不相同，
     * 但 basename 在这里是唯一的（视频缩略图是 jpg，视频本体是 mp4）。 */
    const key = r.url.split('/').pop()
    const prev = byFile.get(key)
    if (prev === undefined || (prev >= 400 && r.status < 400)) byFile.set(key, r.status)
  }
  const served = new Set([...byFile.entries()].filter(([, s]) => s < 400).map(([u]) => u))
  const mediaDir = path.join(__dirname, '..', '..', 'site', 'public', 'jay-town', 'media')
  const onDisk = []
  for (const entry of fs.readdirSync(mediaDir, { withFileTypes: true })) {
    if (entry.isFile()) onDisk.push({ file: entry.name, url: entry.name })
    else if (entry.isDirectory()) {
      for (const f of fs.readdirSync(path.join(mediaDir, entry.name))) {
        onDisk.push({ file: `${entry.name}/${f}`, url: f })
      }
    }
  }
  const neverServed = onDisk.filter((e) => !served.has(e.url)).map((e) => e.file)
  const hardFailed = failed.filter((f) => !f.includes('ERR_ABORTED'))

  /* 3) 视频：把玩家瞬移到每一段视频牌前面，看它播没播。 */
  const videoProbe = await page.evaluate(() => {
    const t = window.__jayTown
    const out = []
    const seen = new Set()
    t.scene.traverse((o) => {
      if (!o.name?.startsWith('jayMedia:')) return
      const v = o.children.find((c) => c.isMesh && c.material?.map?.isVideoTexture)
      if (v && !seen.has(o.name)) {
        seen.add(o.name)
        out.push(o.name)
      }
    })
    /* 牌子组是 rigid 的，`o.position` 是吸附后的球面世界坐标；要拿它跟
     * `player.pos`（平面坐标）比就必须反解。`flatAt` 就在 planet.js 里，
     * 但没挂在 __jayTown 上 —— 所以这里只取 id，位置用站点的出生点代替：
     * 验收要回答的是「视频会不会播」，不是「牌子在哪一厘米」。 */
    const byId = new Map(t.media().map((m) => [m.id, m]))
    return out.map((name) => ({ name, board: byId.get(name.slice('jayMedia:'.length)) ?? null }))
  })

  const played = []
  for (const v of videoProbe) {
    const zone = v.board?.zone ?? 0
    await page.evaluate((z) => {
      document.querySelector(`.town-route__stop[data-zone="${z}"]`)?.click()
    }, zone)
    /* 站在这一站等它自己播起来。
     *
     * **不能「睡 3 秒然后断言」。** 这个验收跑在 SwiftShader 上，渲染一帧要
     * 一两秒，而「按距离起播」是挂在每帧的 world.update 里的 —— 3 秒只够跑
     * 两三帧，量出来的是软件渲染器的速度，不是产品行为。等状态、不等时钟。 */
    const state = await page.evaluate(
      async (name) => {
        const deadline = performance.now() + 20000
        const read = () => {
          const t = window.__jayTown
          let found = null
          t.scene.traverse((o) => {
            if (o.name !== name) return
            const v = o.children.find((c) => c.isMesh && c.material?.map?.isVideoTexture)
            if (v) {
              const video = v.material.map.image
              found = {
                name: o.name,
                paused: video.paused,
                time: +video.currentTime.toFixed(2),
                readyState: video.readyState,
                w: video.videoWidth,
                h: video.videoHeight,
                err: video.error ? video.error.code : null,
              }
            }
          })
          return found
        }
        let s = read()
        while (performance.now() < deadline && (!s || s.paused)) {
          await new Promise((r) => setTimeout(r, 400))
          s = read()
        }
        return s
      },
      v.name,
    )
    if (state) played.push(state)
    if (SHOTS) {
      await page.screenshot({ path: path.join(OUT, `video-${v.name.replace('jayMedia:', '')}.png`) })
    }
  }

  /* 4) 表层导航的条目数。缩略图是异步 decode 的，等一下再数 —— 早数会把
   *    「还没解码完」误判成「没加载」。 */
  const nav = await page.evaluate(async () => {
    const items = [...document.querySelectorAll('[data-media-id]')]
    const deadline = performance.now() + 12000
    const loaded = () => items.filter((b) => {
      const img = b.querySelector('img')
      return !!img && img.complete && img.naturalWidth > 0
    }).length
    let n = loaded()
    while (n < items.length && performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250))
      n = loaded()
    }
    const broken = items.filter((b) => {
      const img = b.querySelector('img')
      return !!img && img.complete && img.naturalWidth === 0
    }).map((b) => b.dataset.mediaId)
    return {
      count: items.length,
      thumbsLoaded: n,
      brokenThumbs: broken,
      zones: items.map((b) => Number(b.dataset.mediaZone)),
    }
  })

  const report = {
    url: BASE,
    expected: ids.length,
    boardsInScene: scene.boards.length,
    missing,
    extra,
    guideBoards: scene.guides.length,
    filesOnDisk: onDisk.length,
    filesServed: served.size,
    neverServed,
    mediaRequests: [...byFile.entries()].map(([u, s]) => `${s} ${u}`).sort(),
    videos: played,
    /* 只判 paused：刚起播的那一瞬 currentTime 就是 0，拿 time>0 判会把
     * 「已经在播」算成没播。 */
    videosPlaying: played.filter((p) => !p.paused && p.readyState >= 2).length,
    navItems: nav.count,
    navThumbsLoaded: nav.thumbsLoaded,
    brokenThumbs: nav.brokenThumbs,
    failedRequests: hardFailed,
    abortedRangeRequests: failed.length - hardFailed.length,
  }
  console.log(JSON.stringify(report, null, 2))

  const ok =
    report.missing.length === 0 &&
    report.extra.length === 0 &&
    report.neverServed.length === 0 &&
    report.videosPlaying === report.videos.length &&
    report.videos.length === 4 &&
    report.navItems === report.expected &&
    report.navThumbsLoaded === report.expected &&
    report.brokenThumbs.length === 0 &&
    report.failedRequests.length === 0
  console.log(ok ? 'MEDIA OK' : 'MEDIA PROBLEMS')

  if (SHOTS) {
    await page.evaluate(() => window.__jayTown.world.setPlayer(0, 0))
    await page.screenshot({ path: path.join(OUT, 'page-nav.png') })
  }
  await browser.close()
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
