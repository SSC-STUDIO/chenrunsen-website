import * as THREE from 'three'
import { eachShop } from './layout'
import { toonMaterial } from './toon'

type StorefrontHandle = { dispose(): void }
type ShopKind = 'record' | 'flower' | 'bakery' | 'party' | 'book' | 'cafe' | 'general'
type Instance = { position: THREE.Vector3; scale: THREE.Vector3; color: THREE.Color; rotation: THREE.Quaternion }

const KINDS: ShopKind[] = ['record', 'flower', 'bakery', 'party', 'book', 'cafe', 'general', 'record']
const POSTER_COLORS = ['#e597ab', '#79a29c', '#e5ad75', '#a594ba']
const UP = new THREE.Vector3(0, 1, 0)

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function paintRoom(ctx: CanvasRenderingContext2D, kind: ShopKind) {
  const W = 1024, H = 400
  const colors: Record<ShopKind, [string, string, string, string]> = {
    record: ['#1f4249', '#ebae9b', '#f4d691', '#9cbcc0'],
    flower: ['#3a6159', '#f2d9cb', '#f4b4bf', '#b7cf9e'],
    bakery: ['#835d50', '#f5d8aa', '#f0af74', '#d8bd83'],
    party: ['#5d5874', '#f6d5cb', '#e99dac', '#b6ccd1'],
    book: ['#3e5b62', '#e2c6a8', '#d2b28b', '#9ab7b4'],
    cafe: ['#2d5759', '#efd4b3', '#d9a175', '#a8c4b8'],
    general: ['#49605b', '#e8d1bc', '#d6a6a7', '#a7bda7'],
  }
  const [dark, wall, accent, soft] = colors[kind]
  const wallLight = ctx.createLinearGradient(0, 20, W, H)
  wallLight.addColorStop(0, wall)
  wallLight.addColorStop(0.62, '#f9ead7')
  wallLight.addColorStop(1, soft)
  ctx.fillStyle = dark
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = wallLight
  ctx.fillRect(100, 34, 824, 263)
  ctx.fillStyle = '#162e35'
  ctx.fillRect(100, 22, 824, 14)
  ctx.fillStyle = dark
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(101, 34); ctx.lineTo(101, 297); ctx.lineTo(0, 400); ctx.fill()
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(923, 34); ctx.lineTo(923, 297); ctx.lineTo(W, 400); ctx.fill()
  ctx.fillStyle = '#88756d'
  ctx.beginPath(); ctx.moveTo(100, 297); ctx.lineTo(924, 297); ctx.lineTo(W, 400); ctx.lineTo(0, 400); ctx.fill()
  ctx.fillStyle = 'rgba(245,225,201,.3)'
  for (let i = 0; i < 7; i++) {
    ctx.beginPath(); ctx.moveTo(512, 297); ctx.lineTo((i - 1) * 180, 400); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,235,214,.15)'; ctx.stroke()
  }
  for (const x of [200, 512, 824]) {
    ctx.fillStyle = '#496767'
    ctx.fillRect(x - 2, 13, 4, 47)
    ctx.fillStyle = '#f8e4b7'
    ctx.beginPath(); ctx.ellipse(x, 63, 22, 11, 0, 0, Math.PI * 2); ctx.fill()
    const glow = ctx.createRadialGradient(x, 65, 2, x, 65, 85)
    glow.addColorStop(0, 'rgba(255,243,203,.42)')
    glow.addColorStop(1, 'rgba(255,243,203,0)')
    ctx.fillStyle = glow; ctx.fillRect(x - 90, 28, 180, 130)
  }
  ctx.fillStyle = accent
  ctx.fillRect(100, 282, 824, 8)
  ctx.fillStyle = 'rgba(23,43,44,.16)'
  ctx.fillRect(100, 289, 824, 9)

  if (kind === 'record') paintRecords(ctx)
  if (kind === 'flower') paintFlowers(ctx)
  if (kind === 'bakery') paintBakery(ctx)
  if (kind === 'party') paintParty(ctx)
  if (kind === 'book') paintBooks(ctx)
  if (kind === 'cafe') paintCafe(ctx)
  if (kind === 'general') paintGeneral(ctx)

  // Counter and close objects add a second depth plane in front of the back-wall display.
  ctx.fillStyle = kind === 'flower' ? '#6b8c74' : kind === 'record' ? '#385b5b' : '#a87863'
  ctx.fillRect(112, 291, 800, 48)
  ctx.fillStyle = '#f2d7b7'
  ctx.fillRect(102, 286, 820, 10)
  ctx.fillStyle = 'rgba(30,45,46,.35)'
  ctx.fillRect(112, 337, 800, 9)
  ctx.fillStyle = '#f6e9d8'
  ctx.font = '700 25px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(kind === 'record' ? 'VINYL  ·  MUSIC' : kind === 'flower' ? 'FLOWERS  ·  SPRING' : kind === 'cafe' ? 'COFFEE  ·  SAKURA' : 'SAKURA  ·  DAILY', 512, 324)
  ctx.textAlign = 'start'
  ctx.fillStyle = 'rgba(255,253,236,.2)'
  ctx.fillRect(17, 18, 9, 337)
  ctx.fillRect(994, 18, 9, 337)
}

function paintRecords(ctx: CanvasRenderingContext2D) {
  for (let shelf = 0; shelf < 2; shelf++) {
    const y = 128 + shelf * 102
    ctx.fillStyle = '#2d5559'; ctx.fillRect(148, y + 76, 732, 11)
    ctx.fillStyle = '#d5b39c'; ctx.fillRect(148, y + 74, 732, 4)
    for (let i = 0; i < 9; i++) {
      const x = 166 + i * 79
      const fills = ['#d8919e', '#78a6ae', '#e7b16f', '#9ab298', '#8f93b0']
      ctx.fillStyle = '#192f37'; ctx.fillRect(x - 3, y - 3, 68, 72)
      ctx.fillStyle = fills[(i + shelf * 2) % fills.length]; ctx.fillRect(x, y, 61, 65)
      ctx.fillStyle = 'rgba(255,246,223,.48)'; ctx.fillRect(x + 5, y + 5, 51, 5)
      ctx.fillStyle = '#f6e4ca'; ctx.beginPath(); ctx.arc(x + 30, y + 39, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#2a4650'; ctx.beginPath(); ctx.arc(x + 30, y + 39, 13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#eeb98b'; ctx.beginPath(); ctx.arc(x + 30, y + 39, 3, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.fillStyle = '#233e47'; ctx.fillRect(372, 252, 280, 33)
  ctx.fillStyle = '#f4ead5'; ctx.beginPath(); ctx.arc(464, 268, 13, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e7ab8b'; ctx.fillRect(558, 256, 62, 5)
  ctx.fillStyle = '#89b8b6'; ctx.fillRect(558, 266, 47, 4)
}

function paintFlowers(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#779b81'; ctx.fillRect(157, 91, 708, 9)
  for (let i = 0; i < 14; i++) {
    const x = 177 + i * 50
    const y = 210 + (i % 3) * 7
    ctx.strokeStyle = '#648a66'; ctx.lineWidth = 3
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath(); ctx.moveTo(x + s * 12, y + 34); ctx.quadraticCurveTo(x + s * 15, y - 18, x + s * 22, y - 59); ctx.stroke()
      ctx.fillStyle = ['#ed9fac', '#fff0d7', '#dfbd77', '#c8a6ca'][((i + s + 4) % 4)]
      for (let p = 0; p < 5; p++) {
        const angle = p * Math.PI * 2 / 5
        ctx.beginPath(); ctx.ellipse(x + s * 22 + Math.cos(angle) * 8, y - 59 + Math.sin(angle) * 8, 7, 5, angle, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#e3b467'; ctx.beginPath(); ctx.arc(x + s * 22, y - 59, 4, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = i % 2 ? '#d9a78c' : '#efc4a2'
    ctx.beginPath(); ctx.moveTo(x - 25, y + 9); ctx.lineTo(x + 25, y + 9); ctx.lineTo(x + 16, y + 54); ctx.lineTo(x - 16, y + 54); ctx.fill()
    ctx.fillStyle = '#f7dccb'; ctx.fillRect(x - 23, y + 9, 46, 4)
  }
  for (let i = 0; i < 7; i++) {
    const x = 190 + i * 102
    ctx.strokeStyle = '#73956d'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x, 96); ctx.lineTo(x, 140 + (i % 2) * 15); ctx.stroke()
    ctx.fillStyle = i % 2 ? '#d7a6b3' : '#f0d1a7'
    ctx.beginPath(); ctx.ellipse(x, 148 + (i % 2) * 15, 18, 11, 0, 0, Math.PI * 2); ctx.fill()
  }
}

function paintBakery(ctx: CanvasRenderingContext2D) {
  for (const y of [143, 217]) {
    ctx.fillStyle = '#6e544a'; ctx.fillRect(142, y + 47, 738, 10)
    ctx.fillStyle = '#e5bd91'; ctx.fillRect(142, y + 42, 738, 6)
    for (let i = 0; i < 12; i++) {
      const x = 170 + i * 58
      ctx.fillStyle = i % 3 ? '#e0a566' : '#f2c889'
      ctx.beginPath(); ctx.ellipse(x, y + 26, 23, 19, 0, Math.PI, 0); ctx.lineTo(x + 23, y + 42); ctx.lineTo(x - 23, y + 42); ctx.fill()
      ctx.strokeStyle = '#f9dfae'; ctx.lineWidth = 2
      for (let line = -1; line <= 1; line++) { ctx.beginPath(); ctx.moveTo(x + line * 7 - 4, y + 27); ctx.lineTo(x + line * 7 + 2, y + 38); ctx.stroke() }
    }
  }
  ctx.fillStyle = '#734f48'; ctx.fillRect(365, 69, 294, 45)
  ctx.fillStyle = '#f4e0ba'; ctx.font = '700 27px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('BAKERY', 512, 101); ctx.textAlign = 'start'
}

function paintParty(ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < 12; i++) {
    const x = 160 + i * 62, y = 132 + (i % 4) * 22
    ctx.strokeStyle = '#c8aaa2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x + 7, 272); ctx.stroke()
    ctx.fillStyle = ['#e8a0ae', '#eec480', '#9cb6c1', '#d3a8ca'][i % 4]
    ctx.beginPath(); ctx.ellipse(x, y, 23, 29, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f9e1d4'; ctx.beginPath(); ctx.ellipse(x - 6, y - 9, 5, 8, -.3, 0, Math.PI * 2); ctx.fill()
  }
  for (let i = 0; i < 8; i++) {
    const x = 180 + i * 92
    ctx.fillStyle = i % 2 ? '#a5c0c2' : '#e4aab3'; ctx.fillRect(x, 236, 59, 43)
    ctx.strokeStyle = '#fff0dc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 30, 236); ctx.lineTo(x + 30, 279); ctx.moveTo(x, 251); ctx.lineTo(x + 59, 251); ctx.stroke()
  }
}

function paintBooks(ctx: CanvasRenderingContext2D) {
  for (const y of [111, 184, 255]) {
    ctx.fillStyle = '#5f4941'; ctx.fillRect(148, y + 51, 726, 9)
    for (let i = 0; i < 48; i++) {
      const x = 156 + i * 15
      const widths = [11, 8, 13, 10]
      const h = 36 + ((i * 7 + y) % 13)
      ctx.fillStyle = ['#b07678', '#8e9f9d', '#d3ab79', '#a59ab1', '#e0c9a8'][i % 5]
      ctx.fillRect(x, y + 50 - h, widths[i % 4], h)
      ctx.fillStyle = 'rgba(255,237,203,.5)'; ctx.fillRect(x + 2, y + 55 - h, 2, h - 9)
    }
  }
  ctx.fillStyle = '#264249'; ctx.fillRect(390, 56, 244, 38)
  ctx.fillStyle = '#f4deb7'; ctx.font = '700 26px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('BOOKS', 512, 84); ctx.textAlign = 'start'
}

function paintCafe(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#264c50'; ctx.fillRect(326, 59, 368, 157)
  ctx.strokeStyle = '#d1a77e'; ctx.lineWidth = 7; ctx.strokeRect(326, 59, 368, 157)
  ctx.fillStyle = '#f8e7c9'; ctx.font = '700 29px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('COFFEE', 512, 102)
  ctx.font = '22px Arial, sans-serif'; ctx.fillText('ESPRESSO  ·  MILK  ·  TEA', 512, 139); ctx.fillText('CAKE  ·  SPRING', 512, 174); ctx.textAlign = 'start'
  for (const x of [171, 250, 764, 843]) {
    ctx.fillStyle = '#e2bf95'; ctx.fillRect(x - 19, 195, 38, 58)
    ctx.fillStyle = '#fff1d8'; ctx.fillRect(x - 24, 190, 48, 12)
    ctx.strokeStyle = '#fff1d8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x + 22, 219, 14, -Math.PI / 2, Math.PI / 2); ctx.stroke()
  }
  ctx.fillStyle = '#708f83'; ctx.fillRect(405, 221, 214, 55)
  ctx.fillStyle = '#dce4d7'; ctx.fillRect(421, 208, 185, 18)
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#243d3f'; ctx.beginPath(); ctx.arc(454 + i * 55, 246, 16, 0, Math.PI * 2); ctx.fill() }
}

function paintGeneral(ctx: CanvasRenderingContext2D) {
  for (const y of [142, 220]) {
    ctx.fillStyle = '#627567'; ctx.fillRect(150, y + 52, 724, 10)
    for (let i = 0; i < 16; i++) {
      const x = 173 + i * 43
      ctx.fillStyle = ['#ecbd9c', '#b1cad0', '#e8a5b2', '#ded7a5'][i % 4]
      ctx.fillRect(x - 14, y + 10, 29, 40)
      ctx.fillStyle = '#f7efdf'; ctx.fillRect(x - 12, y + 20, 25, 15)
      ctx.fillStyle = '#e9d8b8'; ctx.fillRect(x - 11, y + 5, 23, 6)
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = 280 + i * 116
    ctx.strokeStyle = '#8fa184'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 25); ctx.lineTo(x, 96); ctx.stroke()
    ctx.fillStyle = i % 2 ? '#eeb4b9' : '#f2d4a6'
    ctx.beginPath(); ctx.ellipse(x, 105, 18, 24, 0, 0, Math.PI * 2); ctx.fill()
  }
}

function paintGlass(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 1024, 400)
  ctx.fillStyle = 'rgba(186,224,230,.1)'; ctx.fillRect(0, 0, 1024, 400)
  ctx.fillStyle = 'rgba(255,255,255,.22)'
  ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(206, 0); ctx.lineTo(92, 400); ctx.lineTo(15, 400); ctx.fill()
  ctx.fillStyle = 'rgba(242,252,255,.12)'
  ctx.beginPath(); ctx.moveTo(722, 0); ctx.lineTo(778, 0); ctx.lineTo(667, 400); ctx.lineTo(625, 400); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(948, 0, 5, 400)
  ctx.fillStyle = 'rgba(26,66,73,.17)'; ctx.fillRect(0, 332, 1024, 68)
}

function paintPoster(ctx: CanvasRenderingContext2D, index: number) {
  ctx.fillStyle = POSTER_COLORS[index]
  ctx.fillRect(0, 0, 384, 512)
  ctx.strokeStyle = '#fff5e4'; ctx.lineWidth = 9; ctx.strokeRect(20, 20, 344, 472)
  ctx.fillStyle = index % 2 ? '#255c60' : '#fff5e4'
  ctx.beginPath(); ctx.arc(190, 231, 109, 0, Math.PI * 2); ctx.fill()
  if (index % 2 === 0) {
    ctx.fillStyle = '#2a5d61'; ctx.beginPath(); ctx.arc(190, 231, 77, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#eeb4bd'; ctx.beginPath(); ctx.arc(190, 231, 18, 0, Math.PI * 2); ctx.fill()
  } else {
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7
      ctx.fillStyle = '#f4d7b0'
      ctx.beginPath(); ctx.ellipse(190 + Math.cos(a) * 49, 231 + Math.sin(a) * 49, 23, 49, a - Math.PI / 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#e69eae'; ctx.beginPath(); ctx.arc(190, 231, 28, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = index % 2 ? '#284b4e' : '#fff9e8'
  ctx.textAlign = 'center'; ctx.font = 'bold 47px Arial, sans-serif'; ctx.fillText(index % 2 ? 'SAKURA' : 'MUSIC', 192, 94)
  ctx.font = 'bold 27px Arial, sans-serif'; ctx.fillText('SPRING  /  2000', 192, 422)
  ctx.font = '19px Arial, sans-serif'; ctx.fillText('小镇的周末', 192, 459)
}

function paintStreetPoster(ctx: CanvasRenderingContext2D, index: number) {
  const grounds = ['#f3d8cf', '#e8e8d3', '#d7e5e1']
  const inks = ['#365a60', '#587667', '#66565a']
  ctx.fillStyle = grounds[index]; ctx.fillRect(0, 0, 384, 512)
  ctx.strokeStyle = inks[index]; ctx.lineWidth = 10; ctx.strokeRect(16, 16, 352, 480)
  ctx.strokeStyle = '#fff9eb'; ctx.lineWidth = 3; ctx.strokeRect(30, 30, 324, 452)
  ctx.fillStyle = inks[index]
  ctx.textAlign = 'center'
  ctx.font = 'bold 41px Georgia, serif'
  ctx.fillText(['VINYL', 'FLOWERS', 'COFFEE'][index], 192, 83)
  if (index === 0) {
    ctx.fillStyle = '#2f4d53'; ctx.beginPath(); ctx.arc(192, 265, 125, 0, Math.PI * 2); ctx.fill()
    for (const radius of [95, 74, 53]) {
      ctx.strokeStyle = 'rgba(255,242,222,.38)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(192, 265, radius, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.fillStyle = '#db9b9d'; ctx.beginPath(); ctx.arc(192, 265, 34, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f4e5ca'; ctx.beginPath(); ctx.arc(192, 265, 8, 0, Math.PI * 2); ctx.fill()
  } else if (index === 1) {
    ctx.fillStyle = '#ba8b72'; ctx.beginPath(); ctx.moveTo(125, 323); ctx.lineTo(258, 323); ctx.lineTo(239, 404); ctx.lineTo(145, 404); ctx.fill()
    for (let flower = 0; flower < 7; flower++) {
      const x = 125 + flower * 23, y = 194 + (flower % 3) * 22
      ctx.strokeStyle = '#6d926d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(192, 334); ctx.lineTo(x, y); ctx.stroke()
      ctx.fillStyle = flower % 2 ? '#e8a0af' : '#f2cb91'
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 2 / 5
        ctx.beginPath(); ctx.ellipse(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13, 12, 8, angle, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#c7a55d'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.fillStyle = '#a76f61'; ctx.beginPath(); ctx.moveTo(97, 213); ctx.lineTo(276, 213); ctx.lineTo(256, 361); ctx.lineTo(118, 361); ctx.fill()
    ctx.fillStyle = '#f8efe0'; ctx.fillRect(104, 208, 165, 20)
    ctx.strokeStyle = '#a76f61'; ctx.lineWidth = 17; ctx.beginPath(); ctx.arc(275, 271, 46, -Math.PI / 2, Math.PI / 2); ctx.stroke()
    for (let steam = 0; steam < 3; steam++) {
      const x = 150 + steam * 44
      ctx.strokeStyle = '#6f9c96'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, 184); ctx.bezierCurveTo(x - 22, 158, x + 21, 143, x, 113); ctx.stroke()
    }
  }
  ctx.fillStyle = inks[index]; ctx.font = 'bold 25px Arial, sans-serif'
  ctx.fillText(['晴天唱片  /  2000', '春日花便り', 'SAKURA CAFE'][index], 192, 462)
  ctx.textAlign = 'start'
}

export function addStorefrontDetails(scene: THREE.Scene): StorefrontHandle {
  const group = new THREE.Group()
  group.name = 'Sakura town storefront details'
  scene.add(group)

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const meshes: THREE.InstancedMesh[] = []
  const plane = new THREE.PlaneGeometry(1, 1), boxGeometry = new THREE.BoxGeometry(1, 1, 1)
  const sphereGeometry = new THREE.SphereGeometry(1, 7, 5), cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 7)
  geometries.push(plane, boxGeometry, sphereGeometry, cylinderGeometry)

  const panelTexture = new Map<ShopKind, THREE.CanvasTexture>()
  for (const kind of new Set(KINDS)) {
    const texture = canvasTexture(1024, 400, ctx => paintRoom(ctx, kind))
    if (texture) { panelTexture.set(kind, texture); textures.push(texture) }
  }
  const glassTexture = canvasTexture(1024, 400, paintGlass)
  if (glassTexture) textures.push(glassTexture)
  const posterTextures = POSTER_COLORS.map((_, index) => canvasTexture(384, 512, ctx => paintPoster(ctx, index)))
  posterTextures.forEach(texture => { if (texture) textures.push(texture) })
  const streetPosterTextures = [0, 1, 2].map(index => canvasTexture(384, 512, ctx => paintStreetPoster(ctx, index)))
  streetPosterTextures.forEach(texture => { if (texture) textures.push(texture) })

  const panels = new Map<ShopKind, Instance[]>()
  const glasses: Instance[] = [], posters = POSTER_COLORS.map(() => [] as Instance[])
  const streetPosters = streetPosterTextures.map(() => [] as Instance[])
  const trim: Instance[] = [], leaves: Instance[] = [], petals: Instance[] = [], pipes: Instance[] = []
  const item = (list: Instance[], x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rotation = new THREE.Quaternion()) => {
    list.push({ position: new THREE.Vector3(x, y, z), scale: new THREE.Vector3(sx, sy, sz), color: new THREE.Color(color), rotation })
  }

  eachShop(({ index, side, z, width, height, towardStreet }) => {
      const kind = KINDS[index % KINDS.length]
      const face = new THREE.Quaternion().setFromAxisAngle(UP, -side * Math.PI / 2)
      if (!panels.has(kind)) panels.set(kind, [])
      // The scene's blue pane sits at .18; these layers stay behind its mullions at .23.
      item(panels.get(kind)!, towardStreet - side * 0.204, 1.31, z, width - 0.86, 1.86, 1, '#ffffff', face)
      item(glasses, towardStreet - side * 0.218, 1.31, z, width - 0.86, 1.86, 1, '#ffffff', face)

      const wood = index % 2 ? '#766961' : '#51706b'
      item(trim, towardStreet - side * 0.35, height - 1.14, z, 0.14, 0.17, width - 0.5, wood)
      item(trim, towardStreet - side * 0.3, height - 1.78, z, 0.09, 0.07, width - 0.54, '#e9d5b7')
      for (const shift of [-1, 1]) {
        const wz = z + shift * width * 0.25
        item(trim, towardStreet - side * 0.28, height - 2.91, wz, 0.3, 0.16, 1.2, '#a77865')
        if (index % 3 !== 2) {
          for (let j = -2; j <= 2; j++) {
            const fz = wz + j * 0.18
            item(leaves, towardStreet - side * 0.38, height - 2.75 + Math.abs(j % 2) * 0.09, fz, 0.12, 0.13, 0.12, j % 2 ? '#64956d' : '#81a878')
            item(petals, towardStreet - side * 0.43, height - 2.64 + Math.abs(j % 2) * 0.05, fz, 0.075, 0.055, 0.075, (j + index) % 3 ? '#f3a9bd' : '#f2d792')
          }
        }
      }

      const pipeZ = z - width * 0.46
      item(pipes, towardStreet - side * 0.35, height * 0.5, pipeZ, 0.048, height - 0.8, 0.048, '#a9c1bd')
      item(trim, towardStreet - side * 0.36, height - 0.37, pipeZ + 0.05, 0.18, 0.05, 0.18, '#769b98')
      item(trim, towardStreet - side * 0.37, 0.36, pipeZ - 0.05, 0.17, 0.05, 0.17, '#769b98')

      if (index % 3 === 0) {
        const acX = towardStreet - side * 0.56, acY = height - 2.08
        item(trim, acX, acY, z, 0.42, 0.58, 0.9, '#e2e6dd')
        item(trim, acX - side * 0.23, acY, z, 0.03, 0.4, 0.73, '#719097')
        for (let slat = -3; slat <= 3; slat++) item(trim, acX - side * 0.25, acY + slat * 0.047, z, 0.018, 0.012, 0.68, '#d7e4df')
        item(trim, acX, acY - 0.37, z, 0.46, 0.06, 0.94, '#637e81')
      } else {
        item(posters[index % POSTER_COLORS.length], towardStreet - side * 0.32, height - 2.08, z, 0.76, 1.0, 1, '#ffffff', face)
        item(trim, towardStreet - side * 0.26, height - 2.08, z, 0.05, 1.08, 0.84, '#f4e7d3')
      }
      const streetPoster = index === 2 ? 0 : index === 6 ? 1 : index === 9 ? 2 : -1
      if (streetPoster >= 0) {
        const posterX = towardStreet + side * 0.58, posterZ = z + width / 2 + 0.075
        item(trim, posterX, 2.08, posterZ - 0.045, 0.96, 1.34, 0.055, '#eee5d5')
        item(streetPosters[streetPoster], posterX, 2.08, posterZ, 0.86, 1.24, 1, '#ffffff')
      }
  })

  const drawInstances = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, list: Instance[]) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(geometry, material, list.length)
    const transform = new THREE.Object3D()
    list.forEach((entry, i) => {
      transform.position.copy(entry.position)
      transform.quaternion.copy(entry.rotation)
      transform.scale.copy(entry.scale)
      transform.updateMatrix()
      mesh.setMatrixAt(i, transform.matrix)
      mesh.setColorAt(i, entry.color)
    })
    mesh.name = name
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    group.add(mesh)
    meshes.push(mesh)
  }

  for (const [kind, list] of panels) {
    const texture = panelTexture.get(kind)
    if (!texture) continue
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
    materials.push(material)
    drawInstances(`${kind} interiors`, plane, material, list)
  }
  if (glassTexture) {
    const material = new THREE.MeshBasicMaterial({ map: glassTexture, transparent: true, opacity: 0.47, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    materials.push(material)
    drawInstances('Window reflections', plane, material, glasses)
  }
  posterTextures.forEach((texture, i) => {
    if (!texture) return
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
    materials.push(material)
    drawInstances(`Upper floor poster ${i + 1}`, plane, material, posters[i])
  })
  streetPosterTextures.forEach((texture, i) => {
    if (!texture) return
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
    materials.push(material)
    drawInstances(`Street wall poster ${i + 1}`, plane, material, streetPosters[i])
  })
  const detailMaterial = toonMaterial()
  materials.push(detailMaterial)
  drawInstances('Woodwork and air conditioners', boxGeometry, detailMaterial, trim)
  drawInstances('Window plants', sphereGeometry, detailMaterial, leaves)
  drawInstances('Flower box blossoms', sphereGeometry, detailMaterial, petals)
  drawInstances('Rainwater downpipes', cylinderGeometry, detailMaterial, pipes)

  return {
    dispose() {
      scene.remove(group)
      meshes.forEach(mesh => mesh.dispose())
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      textures.forEach(texture => texture.dispose())
    },
  }
}
