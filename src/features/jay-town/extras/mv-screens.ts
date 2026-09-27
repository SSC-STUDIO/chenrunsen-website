import * as THREE from 'three'
import { songs, type TownSong } from '../songs'
import { toonMaterial } from '../toon'

export type MvScreen = { songId: string; position: THREE.Vector3; zone: number }

type ScreenSpec = {
  zone: number
  position: [number, number, number]
  rotationY: number
  width: number
  height: number
  kind: 'crt' | 'shop' | 'cloth' | 'board' | 'river'
}

/** One screen per zone, all off the roadway (|x| >= 5.5). */
const SPECS: ScreenSpec[] = [
  { zone: 0, position: [12.0, 1.55, 12.0], rotationY: -Math.PI / 2, width: 0.72, height: 0.54, kind: 'crt' },
  { zone: 1, position: [-12.2, 2.15, 0.6], rotationY: Math.PI / 2, width: 1.55, height: 0.95, kind: 'shop' },
  { zone: 2, position: [8.0, 2.4, -34.0], rotationY: -0.35, width: 2.4, height: 1.35, kind: 'cloth' },
  { zone: 3, position: [-10.2, 2.55, -50.6], rotationY: Math.PI / 2, width: 1.9, height: 0.72, kind: 'board' },
  { zone: 4, position: [11.0, 1.05, -104.0], rotationY: -Math.PI / 2 + 0.15, width: 1.35, height: 0.78, kind: 'river' },
]

function songForZone(zone: number): TownSong {
  const song = songs.find((entry) => entry.zone === zone)
  if (!song) throw new Error(`No song for zone ${zone}`)
  return song
}

function lighten(hex: string, amount: number): string {
  const color = new THREE.Color(hex)
  color.lerp(new THREE.Color('#ffffff'), amount)
  return `#${color.getHexString()}`
}

function darken(hex: string, amount: number): string {
  const color = new THREE.Color(hex)
  color.lerp(new THREE.Color('#1a1520'), amount)
  return `#${color.getHexString()}`
}

function paintPoster(ctx: CanvasRenderingContext2D, song: TownSong, kind: ScreenSpec['kind']) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, lighten(song.color, 0.18))
  bg.addColorStop(0.55, song.color)
  bg.addColorStop(1, darken(song.color, 0.35))
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(0, 0, w, h * 0.28)

  // Simple vinyl disc or petal mark — no lyric text.
  if (kind === 'board') {
    drawPetal(ctx, w * 0.82, h * 0.38, Math.min(w, h) * 0.12)
  } else {
    drawRecord(ctx, w * 0.78, h * 0.42, Math.min(w, h) * 0.16)
  }

  ctx.fillStyle = 'rgba(20,16,24,0.55)'
  ctx.fillRect(w * 0.06, h * 0.58, w * 0.88, h * 0.32)

  ctx.fillStyle = '#f7f0e8'
  ctx.font = `600 ${Math.round(h * 0.11)}px "Segoe UI", "PingFang SC", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  fitText(ctx, song.title, w * 0.1, h * 0.68, w * 0.8)

  ctx.fillStyle = 'rgba(247,240,232,0.78)'
  ctx.font = `400 ${Math.round(h * 0.065)}px "Segoe UI", "PingFang SC", sans-serif`
  fitText(ctx, `${song.album}  ·  ${song.year}`, w * 0.1, h * 0.82, w * 0.8)

  if (kind === 'crt') {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let y = 0; y < h; y += 3) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
  }
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  let draw = text
  if (ctx.measureText(draw).width > maxWidth) {
    while (draw.length > 1 && ctx.measureText(`${draw}…`).width > maxWidth) {
      draw = draw.slice(0, -1)
    }
    draw = `${draw}…`
  }
  ctx.fillText(draw, x, y)
}

function drawRecord(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(28,24,32,0.72)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = Math.max(1, r * 0.04)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(240,200,180,0.9)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(40,32,36,0.85)'
  ctx.fill()
}

function drawPetal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.translate(cx, cy)
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5)
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,230,235,0.55)'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,245,220,0.85)'
  ctx.fill()
  ctx.restore()
}

function makePosterTexture(song: TownSong, kind: ScreenSpec['kind']): {
  texture: THREE.CanvasTexture
  canvas: HTMLCanvasElement
} {
  const canvas = document.createElement('canvas')
  canvas.width = kind === 'board' ? 768 : 512
  canvas.height = kind === 'board' ? 288 : 320
  const ctx = canvas.getContext('2d')!
  paintPoster(ctx, song, kind)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return { texture, canvas }
}

function addFrame(
  group: THREE.Group,
  width: number,
  height: number,
  kind: ScreenSpec['kind'],
  materials: THREE.Material[],
  geometries: THREE.BufferGeometry[],
) {
  const thickness = kind === 'crt' ? 0.05 : kind === 'cloth' ? 0.04 : 0.035
  const depth = kind === 'crt' ? 0.08 : 0.04
  const color =
    kind === 'crt' ? '#5a4a42' :
    kind === 'shop' ? '#3a2f2c' :
    kind === 'cloth' ? '#6b5a48' :
    kind === 'board' ? '#2c343c' :
    '#4a4038'

  const mat = toonMaterial({ color })
  materials.push(mat)

  const parts: Array<[number, number, number, number, number, number]> = [
    [width + thickness * 2, thickness, depth, 0, height / 2 + thickness / 2, 0],
    [width + thickness * 2, thickness, depth, 0, -height / 2 - thickness / 2, 0],
    [thickness, height, depth, -width / 2 - thickness / 2, 0, 0],
    [thickness, height, depth, width / 2 + thickness / 2, 0, 0],
  ]

  for (const [w, h, d, x, y, z] of parts) {
    const geo = new THREE.BoxGeometry(w, h, d)
    geometries.push(geo)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    group.add(mesh)
  }

  if (kind === 'crt') {
    const bezelGeo = new THREE.BoxGeometry(width + 0.18, height + 0.22, 0.12)
    geometries.push(bezelGeo)
    const bezelMat = toonMaterial({ color: '#6d5a4e' })
    materials.push(bezelMat)
    const bezel = new THREE.Mesh(bezelGeo, bezelMat)
    bezel.position.z = -0.07
    group.add(bezel)
  }

  if (kind === 'cloth') {
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.05, height + 1.1, 6)
    geometries.push(poleGeo)
    const poleMat = toonMaterial({ color: '#7a6a55' })
    materials.push(poleMat)
    for (const x of [-width / 2 - 0.08, width / 2 + 0.08]) {
      const pole = new THREE.Mesh(poleGeo, poleMat)
      pole.position.set(x, -0.35, -0.06)
      pole.castShadow = true
      group.add(pole)
    }
  }

  if (kind === 'board') {
    const headerGeo = new THREE.BoxGeometry(width + 0.12, 0.12, 0.06)
    geometries.push(headerGeo)
    const headerMat = toonMaterial({ color: '#1e2830' })
    materials.push(headerMat)
    const header = new THREE.Mesh(headerGeo, headerMat)
    header.position.set(0, height / 2 + 0.1, 0.01)
    group.add(header)
  }
}

export function addMvScreens(scene: THREE.Scene): {
  screens: MvScreen[]
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const root = new THREE.Group()
  root.name = 'mv-screens'
  scene.add(root)

  const screens: MvScreen[] = []
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.CanvasTexture[] = []
  const canvases: HTMLCanvasElement[] = []
  const lamps: THREE.Mesh[] = []

  for (const spec of SPECS) {
    const song = songForZone(spec.zone)
    const group = new THREE.Group()
    group.position.set(...spec.position)
    group.rotation.y = spec.rotationY

    const { texture, canvas } = makePosterTexture(song, spec.kind)
    textures.push(texture)
    canvases.push(canvas)

    const panelGeo = new THREE.PlaneGeometry(spec.width, spec.height)
    geometries.push(panelGeo)
    const panelMat = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    })
    materials.push(panelMat)

    const panel = new THREE.Mesh(panelGeo, panelMat)
    panel.name = 'mv-screen'
    panel.userData.songId = song.id
    panel.userData.zone = spec.zone
    group.add(panel)

    // Slightly proud shop screen so it sits off the wall face.
    if (spec.kind === 'shop') panel.position.z = 0.04

    addFrame(group, spec.width, spec.height, spec.kind, materials, geometries)

    const lampGeo = new THREE.SphereGeometry(0.035, 8, 8)
    geometries.push(lampGeo)
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ff6b6b' })
    materials.push(lampMat)
    const lamp = new THREE.Mesh(lampGeo, lampMat)
    lamp.position.set(spec.width / 2 - 0.08, spec.height / 2 + 0.08, 0.06)
    group.add(lamp)
    lamps.push(lamp)

    root.add(group)
    screens.push({
      songId: song.id,
      position: new THREE.Vector3(...spec.position),
      zone: spec.zone,
    })
  }

  function update(time: number, night: number) {
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 3.2))
    const nightBoost = 0.55 + night * 0.45
    for (const lamp of lamps) {
      const mat = lamp.material as THREE.MeshBasicMaterial
      mat.color.setRGB(1 * pulse * nightBoost, 0.35 * pulse, 0.32 * pulse)
    }
  }

  function dispose() {
    scene.remove(root)
    root.clear()
    for (const geo of geometries) geo.dispose()
    for (const mat of materials) mat.dispose()
    for (const tex of textures) tex.dispose()
    for (const canvas of canvases) {
      canvas.width = 0
      canvas.height = 0
    }
    geometries.length = 0
    materials.length = 0
    textures.length = 0
    canvases.length = 0
    lamps.length = 0
  }

  return { screens, update, dispose }
}
