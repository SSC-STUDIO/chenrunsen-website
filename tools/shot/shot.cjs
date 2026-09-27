/**
 * 截图巡游：对指定站点做逐屏截图，用于新旧版本视觉对比。
 * 用法：node shot.cjs <baseUrl> <outDir> [--mode=tour|intro|dark|pages|hover]
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const [, , baseUrl, outDir, ...rest] = process.argv
if (!baseUrl || !outDir) {
  console.error('usage: node shot.cjs <baseUrl> <outDir> [--mode=...]')
  process.exit(1)
}
const mode = (rest.find((a) => a.startsWith('--mode=')) || '--mode=tour').slice(
  7
)

fs.mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let shotIndex = 0
async function snap(page, name) {
  shotIndex += 1
  const file = path.join(
    outDir,
    `${String(shotIndex).padStart(2, '0')}-${name}.png`
  )
  await page.screenshot({ path: file })
  console.log('shot:', file)
}

async function scrollTo(page, y) {
  await page.evaluate((targetY) => {
    if (window.lenis) {
      window.lenis.scrollTo(targetY, { immediate: true, force: true })
    }
    window.scrollTo(0, targetY)
  }, y)
  await sleep(900)
}

async function sectionTop(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    return Math.round(el.getBoundingClientRect().top + window.scrollY)
  }, selector)
}

async function waitReady(page) {
  await page
    .waitForFunction(
      () => document.documentElement.classList.contains('is-site-ready'),
      { timeout: 8000 }
    )
    .catch(() => console.log('warn: is-site-ready timeout'))
  await sleep(1200)
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--window-size=1500,1000', '--hide-scrollbars', '--disable-gpu-vsync'],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()

  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  if (mode === 'intro') {
    // 全新会话，入场必播；按时间轴抓帧
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    const marks = [250, 600, 1000, 1400, 1900, 2500]
    let prev = 0
    for (const t of marks) {
      await sleep(t - prev)
      prev = t
      await snap(page, `intro-${t}ms`)
    }
    await waitReady(page)
    await snap(page, 'after-intro-hero')
  }

  if (mode === 'tour') {
    // 跳过入场，逐屏巡游
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('site-intro-seen', '1')
    })
    await page.goto(baseUrl, { waitUntil: 'networkidle2' })
    await waitReady(page)
    await snap(page, 'hero')

    // 指针在 hero 区画几笔，看画布交互
    for (const [x, y] of [
      [400, 400],
      [700, 450],
      [1000, 500],
      [800, 380],
    ]) {
      await page.mouse.move(x, y, { steps: 12 })
      await sleep(80)
    }
    await sleep(250)
    await snap(page, 'hero-pointer')

    const anchors = [
      ['.s-about', 'about'],
      ['.s-my-way', 'myway'],
      ['.s-cta', 'cta'],
    ]

    const aboutTop = await sectionTop(page, '.s-about')
    if (aboutTop != null) {
      await scrollTo(page, aboutTop - 80)
      await snap(page, 'about')
      await scrollTo(page, aboutTop + 500)
      await snap(page, 'about-mid')
    }

    // 作品区是钉住的长卷，按多档滚动截取
    const workTop = await sectionTop(page, '.s-work')
    if (workTop != null) {
      const offsets = [0, 400, 900, 1500, 2100, 2800, 3600]
      for (const off of offsets) {
        await scrollTo(page, workTop + off)
        await snap(page, `work-${off}`)
      }
    }

    const mywayTop = await sectionTop(page, '.s-my-way')
    if (mywayTop != null) {
      await scrollTo(page, mywayTop - 60)
      await snap(page, 'myway')
      await scrollTo(page, mywayTop + 600)
      await snap(page, 'myway-mid')
    }

    const ctaTop = await sectionTop(page, '.s-cta')
    if (ctaTop != null) {
      await scrollTo(page, ctaTop - 60)
      await snap(page, 'cta')
    }

    const maxY = await page.evaluate(
      () => document.body.scrollHeight - window.innerHeight
    )
    await scrollTo(page, maxY)
    await sleep(400)
    await snap(page, 'footer')
  }

  if (mode === 'dark') {
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('site-intro-seen', '1')
      localStorage.setItem('site-theme', 'dark')
    })
    await page.goto(baseUrl, { waitUntil: 'networkidle2' })
    await waitReady(page)
    await snap(page, 'dark-hero')

    const workTop = await sectionTop(page, '.s-work')
    if (workTop != null) {
      await scrollTo(page, workTop + 900)
      await snap(page, 'dark-work')
    }

    const maxY = await page.evaluate(
      () => document.body.scrollHeight - window.innerHeight
    )
    await scrollTo(page, maxY)
    await snap(page, 'dark-footer')
  }

  if (mode === 'pages') {
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('site-intro-seen', '1')
    })
    for (const p of ['/projects/', '/articles/', '/awards/', '/class/']) {
      await page.goto(baseUrl.replace(/\/$/, '') + p, {
        waitUntil: 'networkidle2',
      })
      await sleep(1500)
      await snap(page, `page${p.replace(/\//g, '-')}top`)
      const maxY = await page.evaluate(
        () => document.body.scrollHeight - window.innerHeight
      )
      await scrollTo(page, Math.min(900, maxY))
      await snap(page, `page${p.replace(/\//g, '-')}mid`)
    }
  }

  if (errors.length) {
    const logFile = path.join(outDir, `console-errors-${mode}.log`)
    fs.writeFileSync(logFile, errors.join('\n\n'))
    console.log('console errors saved:', logFile)
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
