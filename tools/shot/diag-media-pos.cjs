/**
 * 每块素材牌子在球面上的真实位置 vs 它的 authoring 坐标。
 * 用来回答「我按 (x,z,face) 把相机摆过去，牌子到底在不在那儿」。
 */
const puppeteer = require('puppeteer-core')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:4402/jay-town/'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
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
  if (!ready) throw new Error('scene never became ready (dist mid-build?)')

  const out = await page.evaluate(() => {
    /* 「哪一格能站、哪一格是墙」：`world.heightAt(x, z)` 会把**所有平台**算进去，
     * 所以一栋房子所在的位置会返回屋顶高度而不是街面高度。于是「高得离谱」
     * 就是「这里不是街面」——一个 2 cm 成本、不用射线、不建树的可走性图。
     *
     * 这正是 scenic-owner 手写的那种扫描，只是换成从页面里问 world 拿数据。 */
    const t = window.__jayTown
    const zones = [
      { zone: 0, cx: 1.85, cz: 13.6, half: 12 },
      { zone: 1, cx: 22.2, cz: 28.5, half: 12 },
      { zone: 2, cx: -27.9, cz: 31.5, half: 12 },
      { zone: 3, cx: 22.5, cz: -3.6, half: 12 },
      { zone: 4, cx: 4.2, cz: -29.4, half: 12 },
    ]
    const step = 1.0
    const maps = []
    for (const z of zones) {
      const rows = []
      const hs = []
      for (let dz = -z.half; dz <= z.half; dz += step) {
        const row = []
        for (let dx = -z.half; dx <= z.half; dx += step) {
          const x = +(z.cx + dx).toFixed(2)
          const zz = +(z.cz + dz).toFixed(2)
          row.push(+t.world.heightAt(x, zz).toFixed(2))
        }
        rows.push(row)
      }
      for (const r of rows) for (const h of r) hs.push(h)
      hs.sort((a, b) => a - b)
      /* 街面高度取中位数：街区里「能走的」占多数，房顶与树是少数。 */
      const street = hs[Math.floor(hs.length / 2)]
      maps.push({ zone: z.zone, cx: z.cx, cz: z.cz, half: z.half, step, street: +street.toFixed(2), rows })
    }
    const placements = new Map(t.mediaPlacements().map((p) => [p.id, p]))
    const boards = []
    t.scene.traverse((o) => {
      if (!o.name?.startsWith('jayMedia:')) return
      const id = o.name.slice('jayMedia:'.length)
      boards.push({ id, spec: placements.get(id) ?? null })
    })
    return { maps, boards, heights: t.mediaPlacements().map((p) => ({ id: p.id, ground: +t.world.heightAt(p.x, p.z).toFixed(2) })) }
  })

  /* 把每站的图打出来：# = 明显高于街面（建筑/树），. = 街面，+ = 牌子作者坐标。 */
  for (const m of out.maps) {
    console.log(`\n=== zone ${m.zone} (centre ${m.cx},${m.cz}) street=${m.street} ===`)
    const marks = new Map()
    for (const b of out.boards) {
      const s = b.spec
      if (!s || s.zone !== m.zone) continue
      const gx = Math.round((s.x - m.cx) / m.step) + m.half / m.step
      const gz = Math.round((s.z - m.cz) / m.step) + m.half / m.step
      marks.set(`${gz},${gx}`, (b.id[0] || '?').toUpperCase())
    }
    for (let i = 0; i < m.rows.length; i++) {
      let line = ''
      for (let j = 0; j < m.rows[i].length; j++) {
        const mark = marks.get(`${i},${j}`)
        if (mark) { line += mark; continue }
        const h = m.rows[i][j]
        line += h > m.street + 0.6 ? '#' : (h < m.street - 0.6 ? '_' : '.')
      }
      console.log(String(i).padStart(2), line)
    }
  }

  console.log('\n=== board ground height vs street ===')
  for (const h of out.heights) {
    const spec = out.boards.find((b) => b.id === h.id)?.spec
    console.log(`${h.id.padEnd(30)} ground=${h.ground}  (authored x=${spec?.x} z=${spec?.z} face=${spec?.face?.toFixed(2)})`)
  }

  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
