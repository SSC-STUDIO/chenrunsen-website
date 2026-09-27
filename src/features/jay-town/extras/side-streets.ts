import * as THREE from 'three'
import { toonMaterial } from '../toon'

/**
 * Lived-in yards along the two cross streets that end at the cottages.
 * Keeps a 4 m clear path down each road center; does not rebuild cottages.
 */
export function addSideStreets(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const group = new THREE.Group()
  group.name = 'Side street yards'
  scene.add(group)

  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => {
    resources.push(value)
    return value
  }

  const cube = keep(new THREE.BoxGeometry(1, 1, 1))
  const plane = keep(new THREE.PlaneGeometry(1, 1))
  const sphere = keep(new THREE.SphereGeometry(1, 8, 6))
  const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 8))
  const white = keep(toonMaterial())
  const soft = keep(toonMaterial({ soft: true }))

  type Item = { p: number[]; s: number[]; color: THREE.Color; ry: number; rx: number }
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; items: Item[] }>()

  function part(
    type: string,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: string,
    ry = 0,
    rx = 0,
  ) {
    const geometry =
      type === 'sphere' ? sphere : type === 'cylinder' ? cylinder : type === 'plane' ? plane : cube
    const material = type === 'soft' ? soft : white
    if (!batches.has(type)) batches.set(type, { geometry, material, items: [] })
    batches.get(type)!.items.push({
      p: [x, y, z],
      s: [sx, sy, sz],
      color: new THREE.Color(color),
      ry,
      rx,
    })
  }

  const mapCanvas = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    draw(canvas.getContext('2d')!)
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  /** Props stay outside ±2 m of the road centerline so a 4 m corridor stays walkable. */
  const EDGE = 2.35

  function fence(x0: number, x1: number, z: number, posts = 5) {
    const mid = (x0 + x1) / 2
    const len = Math.abs(x1 - x0)
    part('box', mid, 0.42, z, len, 0.04, 0.04, '#8a7a68')
    part('box', mid, 0.78, z, len, 0.04, 0.04, '#8a7a68')
    for (let i = 0; i <= posts; i++) {
      const t = i / posts
      const x = x0 + (x1 - x0) * t
      part('box', x, 0.55, z, 0.07, 1.0, 0.07, '#6e5f50')
    }
  }

  function pot(x: number, z: number, color: string, seed = 0) {
    part('cylinder', x, 0.2, z, 0.16, 0.32, 0.16, color)
    part('cylinder', x, 0.36, z, 0.18, 0.04, 0.18, color)
    for (let i = 0; i < 5; i++) {
      const a = i * 1.9 + seed
      const lx = x + Math.sin(a) * 0.12
      const lz = z + Math.cos(a) * 0.12
      part('sphere', lx, 0.58 + (i % 2) * 0.08, lz, 0.1, 0.14, 0.08, i % 2 ? '#7a9a55' : '#5f8348')
    }
  }

  function nameplate(label: string, sub: string, x: number, y: number, z: number, face: number) {
    const texture = mapCanvas(256, 128, (ctx) => {
      ctx.fillStyle = '#f3ebe0'
      ctx.fillRect(0, 0, 256, 128)
      ctx.strokeStyle = '#6a5848'
      ctx.lineWidth = 8
      ctx.strokeRect(6, 6, 244, 116)
      ctx.fillStyle = '#3d463e'
      ctx.textAlign = 'center'
      ctx.font = 'bold 42px "Yu Mincho","KaiTi","Microsoft YaHei",serif'
      ctx.fillText(label, 128, 58)
      ctx.fillStyle = '#8a7564'
      ctx.font = '18px "Microsoft YaHei",sans-serif'
      ctx.fillText(sub, 128, 96)
    })
    const mat = keep(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }))
    const mesh = new THREE.Mesh(plane, mat)
    mesh.position.set(x, y, z)
    mesh.scale.set(0.9, 0.42, 1)
    mesh.rotation.y = face
    group.add(mesh)
    part('box', x, y, z - Math.sin(face) * 0.03, 0.96, 0.48, 0.05, '#9a8a74', face)
  }

  function deadEnd(cx: number, cz: number, side: number) {
    const faceX = cx - side * 3.55
    // Low gate across the cottage approach
    part('box', faceX, 0.95, cz, 0.08, 1.7, 2.4, '#7a6a58')
    part('box', faceX, 1.85, cz, 0.1, 0.12, 2.55, '#5c4e40')
    for (const dz of [-0.85, 0.85]) {
      part('box', faceX, 0.95, cz + dz, 0.12, 1.7, 0.12, '#5c4e40')
    }
    part('box', faceX + side * 0.08, 1.05, cz + 0.35, 0.06, 0.18, 0.06, '#c4a35a')
    // Step + welcome mat
    part('box', faceX - side * 0.55, 0.12, cz, 0.7, 0.16, 1.4, '#cfc6b4')
    part('box', faceX - side * 0.95, 0.04, cz, 0.7, 0.04, 1.1, '#6b4a52')
    const matTex = mapCanvas(128, 128, (ctx) => {
      ctx.fillStyle = '#6b4a52'
      ctx.fillRect(0, 0, 128, 128)
      ctx.fillStyle = '#e8d5b8'
      ctx.font = 'bold 28px "Microsoft YaHei",sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('欢迎', 64, 72)
    })
    const matMat = keep(toonMaterial({ map: matTex, soft: true }))
    const matMesh = new THREE.Mesh(plane, matMat)
    matMesh.rotation.x = -Math.PI / 2
    matMesh.position.set(faceX - side * 0.95, 0.065, cz)
    matMesh.scale.set(0.7, 1.05, 1)
    group.add(matMesh)
  }

  // ── Yard A: east plaza — vegetable patch + blue tarp ──
  {
    const cx = 27.2
    const cz = -31.5
    const side = 1
    const yardZ = cz - EDGE
    fence(16.5, 23.8, yardZ - 0.15)
    for (let i = 0; i <= 4; i++) part('box', 16.5, 0.55, yardZ - 0.15 + i * 0.35, 0.07, 1.0, 0.07, '#6e5f50')
    // Raised beds
    for (const [bx, bz, w] of [[18.2, yardZ, 1.8], [20.4, yardZ, 1.6], [22.4, yardZ, 1.5]] as const) {
      part('box', bx, 0.18, bz, w, 0.28, 1.1, '#8b7355')
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const px = bx - w * 0.35 + c * (w * 0.22)
          const pz = bz - 0.28 + r * 0.28
          part('sphere', px, 0.42, pz, 0.08, 0.12, 0.08, c % 2 ? '#6d9a48' : '#4f7a3a')
          if (c % 3 === 0) part('sphere', px, 0.52, pz, 0.05, 0.05, 0.05, '#c45a48')
        }
      }
    }
    // Blue tarp draped over poles
    part('cylinder', 19.0, 1.1, yardZ + 0.55, 0.04, 2.0, 0.04, '#6a6a62')
    part('cylinder', 21.6, 1.1, yardZ + 0.55, 0.04, 2.0, 0.04, '#6a6a62')
    part('box', 20.3, 2.05, yardZ + 0.55, 2.9, 0.04, 1.4, '#3a7ab8', 0, 0.18)
    part('box', 20.3, 1.85, yardZ + 0.9, 2.7, 0.03, 0.9, '#2f6aa8', 0, -0.35)
    pot(17.2, yardZ + 0.7, '#b8896a', 1)
    pot(23.2, yardZ + 0.55, '#9a7a5c', 2)
    nameplate('畦畔之家', '青菜 · 时令', 17.0, 1.35, cz - 0.15, Math.PI / 2)
    deadEnd(cx, cz, side)
  }

  // ── Yard B: west plaza — drying futon ──
  {
    const cx = -27.2
    const cz = -31.5
    const side = -1
    const yardZ = cz + EDGE
    fence(-23.8, -16.5, yardZ + 0.1)
    for (let i = 0; i <= 4; i++) part('box', -16.5, 0.55, yardZ + 0.1 - i * 0.35, 0.07, 1.0, 0.07, '#6e5f50')
    // Bamboo drying rack
    for (const dx of [-0.9, 0.9]) {
      part('cylinder', -19.5 + dx, 1.15, yardZ, 0.05, 2.15, 0.05, '#c9b896')
    }
    part('cylinder', -19.5, 2.15, yardZ, 0.04, 0.04, 2.0, '#c9b896', Math.PI / 2)
    part('cylinder', -19.5, 1.55, yardZ, 0.035, 0.035, 1.85, '#c9b896', Math.PI / 2)
    // Futons / bedding hung to dry
    const futonColors = ['#e8c4b8', '#d4e0ec', '#e2d4a8']
    ;[-0.55, 0.05, 0.65].forEach((ox, i) => {
      part('soft', -19.5 + ox, 1.85, yardZ + 0.05, 0.9, 1.35, 0.06, futonColors[i], 0.12 * (i - 1), 0.08)
      part('box', -19.5 + ox, 1.2, yardZ + 0.08, 0.85, 0.08, 0.05, '#f5efe4')
    })
    // Laundry basket
    part('cylinder', -21.8, 0.28, yardZ - 0.2, 0.32, 0.4, 0.32, '#a89070')
    part('sphere', -21.8, 0.55, yardZ - 0.2, 0.28, 0.12, 0.28, '#e8dcc8')
    pot(-17.4, yardZ - 0.35, '#c4a888', 3)
    pot(-22.6, yardZ - 0.15, '#8b9a7a', 4)
    nameplate('暖阳居', '晾晒 · 闲时', -17.0, 1.35, cz + 0.15, -Math.PI / 2)
    deadEnd(cx, cz, side)
  }

  // ── Yard C: east station — persimmon tree + stone path ──
  {
    const cx = 23.5
    const cz = -47
    const side = 1
    const yardZ = cz + EDGE
    fence(14.2, 20.2, yardZ + 0.12)
    for (let i = 0; i <= 3; i++) part('box', 14.2, 0.55, yardZ + 0.12 - i * 0.4, 0.07, 1.0, 0.07, '#6e5f50')
    // Tree trunk + canopy + fruit
    const tx = 17.6
    const tz = yardZ - 0.35
    part('cylinder', tx, 1.3, tz, 0.18, 2.4, 0.18, '#6a5340')
    for (let i = 0; i < 8; i++) {
      const a = i * 0.85
      part('sphere', tx + Math.cos(a) * 0.7, 2.7 + Math.sin(a * 2) * 0.2, tz + Math.sin(a) * 0.7, 0.55, 0.4, 0.5, i % 2 ? '#6e8f4a' : '#557a3c')
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 1.1 + 0.3
      part('sphere', tx + Math.cos(a) * 0.55, 2.35 + (i % 3) * 0.15, tz + Math.sin(a) * 0.5, 0.1, 0.11, 0.1, '#d45a28')
    }
    // Stone path along the yard edge (outside the 4 m clear corridor)
    for (let i = 0; i < 7; i++) {
      const px = 15.4 + i * 0.72
      const pz = yardZ - 0.15 - (i % 2) * 0.25
      part('box', px, 0.06, pz, 0.55 + (i % 3) * 0.08, 0.08, 0.4, i % 2 ? '#a8a49a' : '#9a968c', i * 0.15)
    }
    pot(19.4, yardZ - 0.5, '#b07a5c', 5)
    pot(15.0, yardZ - 0.6, '#8a9a6e', 6)
    nameplate('柿色庭', '晚秋 · 石径', 14.6, 1.3, cz + 0.2, Math.PI / 2)
    deadEnd(cx, cz, side)
  }

  // ── Yard D: west station — mailbox row + kid's bicycle ──
  {
    const cx = -23.5
    const cz = -47
    const side = -1
    const yardZ = cz - EDGE
    fence(-20.2, -14.2, yardZ - 0.1)
    for (let i = 0; i <= 3; i++) part('box', -14.2, 0.55, yardZ - 0.1 + i * 0.4, 0.07, 1.0, 0.07, '#6e5f50')
    // Mailbox row
    const boxColors = ['#c45a48', '#3a6a8a', '#5a7a52', '#c4a048']
    for (let i = 0; i < 4; i++) {
      const mx = -19.8 + i * 1.15
      part('box', mx, 0.55, yardZ, 0.08, 1.0, 0.08, '#6a6a62')
      part('box', mx, 1.15, yardZ, 0.32, 0.38, 0.22, boxColors[i])
      part('box', mx + 0.12, 1.15, yardZ, 0.04, 0.08, 0.06, '#3a3a38')
      part('box', mx, 1.38, yardZ, 0.34, 0.04, 0.24, '#2a2a28')
    }
    // Kid's bicycle leaned near fence
    const bx = -15.6
    const bz = yardZ + 0.45
    part('cylinder', bx - 0.35, 0.28, bz, 0.22, 0.04, 0.22, '#3a3a3a', 0, Math.PI / 2)
    part('cylinder', bx + 0.45, 0.28, bz, 0.22, 0.04, 0.22, '#3a3a3a', 0, Math.PI / 2)
    part('box', bx + 0.05, 0.48, bz, 0.85, 0.04, 0.04, '#d4a028')
    part('box', bx - 0.1, 0.72, bz, 0.04, 0.45, 0.04, '#d4a028')
    part('box', bx + 0.35, 0.85, bz, 0.04, 0.55, 0.04, '#d4a028', 0, 0.4)
    part('box', bx + 0.05, 0.95, bz, 0.35, 0.06, 0.22, '#e07040')
    part('cylinder', bx - 0.35, 0.28, bz, 0.04, 0.04, 0.35, '#5a5a5a', Math.PI / 2)
    part('cylinder', bx + 0.45, 0.28, bz, 0.04, 0.04, 0.35, '#5a5a5a', Math.PI / 2)
    pot(-20.6, yardZ + 0.4, '#c49878', 7)
    pot(-14.8, yardZ + 0.35, '#7a8a6a', 8)
    nameplate('信箱巷', '童车 · 邻里', -14.6, 1.3, cz - 0.15, -Math.PI / 2)
    deadEnd(cx, cz, side)
  }

  // Shared edge pots along both cross streets (outside the clear path)
  for (const [x, z] of [
    [12.5, -31.5 - EDGE],
    [-12.5, -31.5 + EDGE],
    [11.8, -47 + EDGE],
    [-11.8, -47 - EDGE],
  ] as const) {
    pot(x, z, '#a88868', Math.round(Math.abs(x)))
  }

  const transform = new THREE.Object3D()
  for (const [name, batch] of batches) {
    if (batch.items.length === 0) continue
    const mesh = keep(new THREE.InstancedMesh(batch.geometry, batch.material, batch.items.length))
    batch.items.forEach((item, i) => {
      transform.position.set(item.p[0], item.p[1], item.p[2])
      transform.scale.set(item.s[0], item.s[1], item.s[2])
      transform.rotation.set(item.rx, item.ry, 0)
      transform.updateMatrix()
      mesh.setMatrixAt(i, transform.matrix)
      mesh.setColorAt(i, item.color)
    })
    mesh.name = `Side street ${name}`
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = name !== 'sphere' && name !== 'soft'
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    group.add(mesh)
  }

  return {
    dispose() {
      scene.remove(group)
      resources.forEach((r) => r.dispose())
    },
  }
}
