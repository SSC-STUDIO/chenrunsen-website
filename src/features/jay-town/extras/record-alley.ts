import * as THREE from 'three'
import { toonMaterial } from '../toon'

/** Outdoor props for 晴天唱片 — narrow shop on −x at z≈0.6, façade ≈ x −12…−16. */
export function addRecordAlley(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const FACADES = -12.945
  const Z = 0.6
  const WIDTH = 4.4
  // Outside the glass, still clear of the |x|<5.2 road lane.
  const curb = FACADES + 0.55

  const group = new THREE.Group()
  group.name = '晴天唱片 alley'
  scene.add(group)

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const meshes: THREE.InstancedMesh[] = []
  const keepG = <T extends THREE.BufferGeometry>(g: T) => { geometries.push(g); return g }
  const keepM = <T extends THREE.Material>(m: T) => { materials.push(m); return m }
  const keepT = <T extends THREE.Texture>(t: T) => { textures.push(t); return t }

  const box = keepG(new THREE.BoxGeometry(1, 1, 1))
  const cyl = keepG(new THREE.CylinderGeometry(1, 1, 1, 16))
  const torus = keepG(new THREE.TorusGeometry(1, 0.12, 8, 20))
  const plane = keepG(new THREE.PlaneGeometry(1, 1))
  const sphere = keepG(new THREE.SphereGeometry(1, 10, 8))

  const wood = keepM(toonMaterial({ color: '#7a5a42' }))
  const woodDark = keepM(toonMaterial({ color: '#5a4030' }))
  const cream = keepM(toonMaterial({ color: '#e8d4b8' }))
  const vinylMat = keepM(toonMaterial({ color: '#1a1c22' }))
  const metal = keepM(toonMaterial({ color: '#6a7a78' }))
  const seat = keepM(toonMaterial({ color: '#c48a6a' }))
  const plastic = keepM(toonMaterial({ color: '#8aa89e' }))
  const frameMat = keepM(toonMaterial({ color: '#2a3e44' }))

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  function instanced(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    place: (i: number, o: THREE.Object3D, c: THREE.Color) => void,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      color.set('#ffffff')
      place(i, dummy, color)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    group.add(mesh)
    meshes.push(mesh)
    return mesh
  }

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0) {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, 0)
    m.scale.set(sx, sy, sz)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    return m
  }

  function canvasMap(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    paint(canvas.getContext('2d')!)
    const tex = keepT(new THREE.CanvasTexture(canvas))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  // —— Wooden browsing crates stacked along the façade ——
  const crateColors = ['#8b6348', '#6e4e38', '#9a7355', '#5c4030', '#7d5a40']
  instanced('Vinyl crates', box, wood, 7, (i, o, c) => {
    const row = i < 4 ? 0 : 1
    const col = i < 4 ? i : i - 4
    const baseZ = Z - WIDTH * 0.28 + col * 0.52 + (row ? 0.18 : 0)
    o.position.set(curb + 0.08 + row * 0.42, 0.22 + row * 0.38, baseZ)
    o.rotation.y = (i % 2 ? 0.08 : -0.06) + row * 0.04
    o.scale.set(0.52, 0.38, 0.48)
    c.set(crateColors[i % crateColors.length])
  })
  // Crate rim lips
  instanced('Crate rims', box, woodDark, 7, (i, o, c) => {
    const row = i < 4 ? 0 : 1
    const col = i < 4 ? i : i - 4
    const baseZ = Z - WIDTH * 0.28 + col * 0.52 + (row ? 0.18 : 0)
    o.position.set(curb + 0.08 + row * 0.42, 0.42 + row * 0.38, baseZ)
    o.rotation.y = (i % 2 ? 0.08 : -0.06) + row * 0.04
    o.scale.set(0.54, 0.04, 0.5)
    c.set('#4a3226')
  })

  // Sleeve-facing vinyls peeking from crates (InstancedMesh)
  const sleevePalette = ['#d8919e', '#78a6ae', '#e7b16f', '#9ab298', '#8f93b0', '#c97b6a', '#6a8f9a']
  instanced('Crate vinyls', box, cream, 18, (i, o, c) => {
    const crate = i % 7
    const slot = Math.floor(i / 7)
    const row = crate < 4 ? 0 : 1
    const col = crate < 4 ? crate : crate - 4
    const baseZ = Z - WIDTH * 0.28 + col * 0.52 + (row ? 0.18 : 0)
    const lean = (slot - 1) * 0.06
    o.position.set(
      curb + 0.08 + row * 0.42 + 0.02,
      0.48 + row * 0.38 + slot * 0.02,
      baseZ + lean,
    )
    o.rotation.set(-0.12, 0.05 * (slot - 1), 0.35 + slot * 0.04)
    o.scale.set(0.02, 0.28, 0.28)
    c.set(sleevePalette[i % sleevePalette.length])
  })

  // —— Spinning display record on a short pedestal ——
  const pedX = curb + 0.95
  const pedZ = Z + WIDTH * 0.18
  mesh(cyl, woodDark, pedX, 0.18, pedZ, 0.16, 0.36, 0.16)
  mesh(cyl, cream, pedX, 0.38, pedZ, 0.22, 0.04, 0.22)

  const discTex = canvasMap(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 124)
    g.addColorStop(0, '#2a2e36')
    g.addColorStop(0.22, '#14161c')
    g.addColorStop(0.55, '#1c1e24')
    g.addColorStop(0.78, '#12141a')
    g.addColorStop(1, '#0a0b0e')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,240,210,.08)'
    for (let r = 28; r < 118; r += 7) {
      ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.fillStyle = '#e8b07a'
    ctx.beginPath(); ctx.arc(128, 128, 26, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a4550'
    ctx.beginPath(); ctx.arc(128, 128, 18, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f0d4a8'
    ctx.beginPath(); ctx.arc(128, 128, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(232,176,122,.55)'
    ctx.font = 'bold 11px "Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('晴天', 128, 132)
  })
  const discMat = keepM(toonMaterial({ map: discTex }))
  // Thin upright cylinder = disc lying flat; spin around Y in update().
  const spinningRecord = mesh(cyl, discMat, pedX, 0.52, pedZ, 0.34, 0.018, 0.34)

  // —— Listening stool + headphone hook ——
  const stoolX = curb + 1.35
  const stoolZ = Z - 0.15
  mesh(cyl, seat, stoolX, 0.28, stoolZ, 0.2, 0.06, 0.2)
  mesh(cyl, woodDark, stoolX, 0.14, stoolZ, 0.045, 0.28, 0.045)
  for (const a of [0, 2.1, 4.2]) {
    mesh(cyl, wood, stoolX + Math.cos(a) * 0.14, 0.06, stoolZ + Math.sin(a) * 0.14, 0.03, 0.12, 0.03)
  }
  mesh(cyl, woodDark, stoolX, 0.02, stoolZ, 0.16, 0.03, 0.16)

  // Wall hook + headphones
  const hookX = FACADES + 0.12
  const hookZ = stoolZ - 0.55
  mesh(cyl, metal, hookX, 1.35, hookZ, 0.025, 0.08, 0.025, 0, Math.PI / 2)
  mesh(sphere, metal, hookX + 0.06, 1.35, hookZ, 0.035, 0.035, 0.035)
  mesh(sphere, metal, hookX + 0.1, 1.18, hookZ - 0.12, 0.09, 0.1, 0.07)
  mesh(sphere, metal, hookX + 0.1, 1.18, hookZ + 0.12, 0.09, 0.1, 0.07)
  mesh(torus, metal, hookX + 0.08, 1.28, hookZ, 0.14, 1, 0.14, Math.PI / 2, Math.PI / 2)
  mesh(cyl, keepM(toonMaterial({ color: '#3a4a48' })), hookX + 0.1, 1.18, hookZ, 0.025, 0.22, 0.025, 0, Math.PI / 2)

  // —— Neon blade sign 晴天唱片 (canvas; dull by day, bright at night) ——
  const neonTex = canvasMap(256, 512, (ctx) => {
    ctx.fillStyle = '#0e1c22'
    ctx.fillRect(0, 0, 256, 512)
    ctx.strokeStyle = '#3a8a92'
    ctx.lineWidth = 10
    ctx.strokeRect(14, 14, 228, 484)
    ctx.strokeStyle = '#7ec8c4'
    ctx.lineWidth = 3
    ctx.strokeRect(28, 28, 200, 456)
    // vinyl glyph
    ctx.strokeStyle = '#e8b07a'
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(128, 108, 42, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(128, 108, 14, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#e8b07a'
    ctx.beginPath(); ctx.arc(128, 108, 5, 0, Math.PI * 2); ctx.fill()
    const chars = [...'晴天唱片']
    ctx.textAlign = 'center'
    ctx.font = 'bold 72px "Yu Mincho","KaiTi","Microsoft YaHei",serif'
    chars.forEach((ch, i) => {
      ctx.fillStyle = '#5fd4d0'
      ctx.shadowColor = '#2a9a96'
      ctx.shadowBlur = 18
      ctx.fillText(ch, 128, 210 + i * 68)
    })
    ctx.shadowBlur = 0
    ctx.fillStyle = '#c9a078'
    ctx.font = '16px Arial,"Microsoft YaHei",sans-serif'
    ctx.fillText('VINYL · TAIPEI · 2000s', 128, 490)
  })
  const neonMat = keepM(new THREE.MeshBasicMaterial({
    map: neonTex,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    opacity: 0.55,
  }))
  const neonSign = mesh(plane, neonMat, FACADES + 0.35, 3.15, Z + WIDTH * 0.38, 0.72, 1.45, 1, Math.PI / 2)
  const neonGlow = keepM(new THREE.MeshBasicMaterial({
    color: '#3ec8c0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }))
  mesh(plane, neonGlow, FACADES + 0.32, 3.15, Z + WIDTH * 0.38, 0.82, 1.55, 1, Math.PI / 2)

  // —— Narrow alley gap: posters + milk crate ——
  const alleyZ = Z - WIDTH / 2 - 0.35
  const alleyX = FACADES + 0.2
  const posterCopy = [
    { title: '葉惠美', sub: '2003', ink: '#e597ab', ground: '#2a3538' },
    { title: '七里香', sub: '夏日', ink: '#79a29c', ground: '#243038' },
    { title: '十一月的蕭邦', sub: 'LIVE', ink: '#e5ad75', ground: '#2e2830' },
  ]
  posterCopy.forEach((p, i) => {
    const tex = canvasMap(256, 384, (ctx) => {
      ctx.fillStyle = p.ground
      ctx.fillRect(0, 0, 256, 384)
      ctx.strokeStyle = p.ink
      ctx.lineWidth = 8
      ctx.strokeRect(12, 12, 232, 360)
      ctx.fillStyle = p.ink
      ctx.beginPath(); ctx.arc(128, 120, 48, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = p.ground
      ctx.beginPath(); ctx.arc(128, 120, 28, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#f4e7d4'
      ctx.beginPath(); ctx.arc(128, 120, 8, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = p.ink
      ctx.font = 'bold 28px "Microsoft YaHei",sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(p.title, 128, 230)
      ctx.font = '18px Arial,sans-serif'
      ctx.fillStyle = '#c9b8a0'
      ctx.fillText(p.sub, 128, 268)
      ctx.fillStyle = 'rgba(244,231,212,.35)'
      ctx.fillRect(40, 300, 176, 3)
      ctx.font = '14px Arial,sans-serif'
      ctx.fillText('晴天唱片', 128, 340)
    })
    const mat = keepM(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }))
    const tilt = (i - 1) * 0.12
    mesh(plane, mat, alleyX + 0.04, 1.15 + i * 0.08, alleyZ + i * 0.22, 0.42, 0.62, 1, Math.PI / 2 + tilt)
    mesh(box, frameMat, alleyX, 1.15 + i * 0.08, alleyZ + i * 0.22 - 0.02, 0.04, 0.66, 0.46, tilt)
  })
  // Milk crate
  mesh(box, plastic, alleyX + 0.55, 0.2, alleyZ + 0.15, 0.38, 0.32, 0.38, 0.15)
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2 + 0.15
    mesh(box, keepM(toonMaterial({ color: '#6e9088' })), alleyX + 0.55 + Math.cos(a) * 0.14, 0.2, alleyZ + 0.15 + Math.sin(a) * 0.14, 0.02, 0.28, 0.28, 0.15)
  }
  instanced('Milk-crate discs', box, vinylMat, 5, (i, o, c) => {
    o.position.set(alleyX + 0.55 + (i - 2) * 0.04, 0.42, alleyZ + 0.15 + (i % 2) * 0.03)
    o.rotation.set(-0.2, 0.1 * i, 0.4)
    o.scale.set(0.015, 0.22, 0.22)
    c.set(sleevePalette[i % sleevePalette.length])
  })

  // —— Bicycle with basket of records (sidewalk edge, not in road) ——
  const bikeX = -8.4
  const bikeZ = Z + 0.85
  const bikeBlue = keepM(toonMaterial({ color: '#3d5c68' }))
  // Frame
  mesh(cyl, bikeBlue, bikeX, 0.42, bikeZ, 0.025, 0.55, 0.025, 0, 0.9)
  mesh(cyl, bikeBlue, bikeX + 0.35, 0.48, bikeZ, 0.025, 0.42, 0.025, 0, -0.55)
  mesh(cyl, bikeBlue, bikeX + 0.18, 0.62, bikeZ, 0.025, 0.5, 0.025, Math.PI / 2, 0.2)
  mesh(cyl, bikeBlue, bikeX - 0.05, 0.75, bikeZ, 0.02, 0.28, 0.02, 0, 0.3)
  // Wheels
  mesh(torus, metal, bikeX - 0.28, 0.32, bikeZ, 0.28, 1, 0.28, Math.PI / 2)
  mesh(torus, metal, bikeX + 0.55, 0.32, bikeZ, 0.28, 1, 0.28, Math.PI / 2)
  mesh(cyl, woodDark, bikeX - 0.28, 0.32, bikeZ, 0.04, 0.04, 0.04, 0, Math.PI / 2)
  mesh(cyl, woodDark, bikeX + 0.55, 0.32, bikeZ, 0.04, 0.04, 0.04, 0, Math.PI / 2)
  // Seat + handle
  mesh(box, seat, bikeX - 0.02, 0.88, bikeZ, 0.18, 0.05, 0.12, 0.2)
  mesh(cyl, metal, bikeX + 0.42, 0.82, bikeZ, 0.015, 0.28, 0.015, Math.PI / 2, 0.4)
  // Basket
  mesh(box, keepM(toonMaterial({ color: '#c4a882' })), bikeX + 0.72, 0.72, bikeZ, 0.32, 0.18, 0.28, 0.1)
  instanced('Basket records', box, cream, 6, (i, o, c) => {
    o.position.set(bikeX + 0.72 + (i % 3 - 1) * 0.06, 0.86, bikeZ + (Math.floor(i / 3) - 0.5) * 0.08)
    o.rotation.set(-0.15, 0.2 * i, 0.5 + i * 0.05)
    o.scale.set(0.015, 0.2, 0.2)
    c.set(sleevePalette[(i + 2) % sleevePalette.length])
  })

  // —— Warm window glow (strengthens with night) ——
  const glowMat = keepM(new THREE.MeshBasicMaterial({
    color: '#f5c98d',
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }))
  const windowGlow = mesh(plane, glowMat, FACADES + 0.08, 1.35, Z, WIDTH - 1.0, 1.7, 1, Math.PI / 2)
  const spillMat = keepM(new THREE.MeshBasicMaterial({
    color: '#e8a86a',
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }))
  const spill = mesh(plane, spillMat, curb + 0.6, 0.05, Z, 2.2, WIDTH * 0.7, 1)
  spill.rotation.x = -Math.PI / 2

  const point = new THREE.PointLight(0xffc889, 0, 5.5, 2)
  point.position.set(FACADES + 0.4, 1.6, Z)
  group.add(point)

  function update(time: number, night: number) {
    const n = THREE.MathUtils.clamp(night, 0, 1)
    spinningRecord.rotation.y = time * 0.85
    neonMat.opacity = 0.42 + n * 0.58
    neonGlow.opacity = n * 0.35
    glowMat.opacity = 0.06 + n * 0.72
    spillMat.opacity = 0.02 + n * 0.28
    point.intensity = n * 2.4
  }

  update(0, 0)

  return {
    update,
    dispose() {
      scene.remove(group)
      for (const m of meshes) m.dispose()
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}
