import * as THREE from 'three'
import { toonMaterial } from '../toon'

const TREE_X = 1.15
const PLAZA_Z = -31.5
const UP = new THREE.Vector3(0, 1, 0)

type Handle = { update?: (time: number, night: number) => void; dispose: () => void }

/** Sunny plaza extras around the hero sakura: stones, stall, nobori, road props. */
export function addPlazaCrossing(scene: THREE.Scene): Handle {
  const group = new THREE.Group()
  group.name = 'Plaza crossing extras'
  scene.add(group)

  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => {
    resources.push(value)
    return value
  }

  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1))
  const cylGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 10))
  const sphereGeo = keep(new THREE.SphereGeometry(1, 8, 6))
  const planeGeo = keep(new THREE.PlaneGeometry(1, 1))
  const coneGeo = keep(new THREE.ConeGeometry(1, 1, 8))

  const mat = keep(toonMaterial())
  const softMat = keep(toonMaterial({ soft: true }))
  const steamMat = keep(toonMaterial({
    color: '#f4f0ea',
    soft: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  }))
  const lanternMat = keep(toonMaterial({ color: '#e8c48a', soft: true }))

  type BatchItem = {
    p: THREE.Vector3
    s: THREE.Vector3
    color: THREE.Color
    q: THREE.Quaternion
  }
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; items: BatchItem[] }>()
  const dummy = new THREE.Object3D()

  function push(
    key: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: string,
    q?: THREE.Quaternion,
  ) {
    if (!batches.has(key)) batches.set(key, { geometry, material, items: [] })
    batches.get(key)!.items.push({
      p: new THREE.Vector3(x, y, z),
      s: new THREE.Vector3(sx, sy, sz),
      color: new THREE.Color(color),
      q: q?.clone() ?? new THREE.Quaternion(),
    })
  }

  const mapCanvas = (w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    paint(canvas.getContext('2d')!)
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  // ——— Low stone ring + fallen petals around the hero trunk ———
  const stoneColors = ['#c5c0b4', '#b7b2a6', '#cec8bc', '#a8a397']
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.11
    const r = 0.72 + (i % 3) * 0.08
    const sx = 0.18 + (i % 4) * 0.04
    const sz = 0.14 + ((i + 1) % 3) * 0.05
    const q = new THREE.Quaternion().setFromAxisAngle(UP, a + i * 0.37)
    push('stone', boxGeo, mat, TREE_X + Math.cos(a) * r, 0.07, PLAZA_Z + Math.sin(a) * r, sx, 0.1 + (i % 2) * 0.03, sz, stoneColors[i % stoneColors.length], q)
  }
  const petalColors = ['#f7dce6', '#fff4f8', '#efc4d4', '#f9e8ef']
  for (let i = 0; i < 42; i++) {
    const a = i * 1.47
    const r = 0.45 + (i % 7) * 0.14 + (i % 3) * 0.05
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(UP, a * 0.6))
    push(
      'petal', planeGeo, softMat,
      TREE_X + Math.cos(a) * r, 0.095, PLAZA_Z + Math.sin(a) * r,
      0.1 + (i % 4) * 0.03, 0.07 + (i % 3) * 0.02, 1,
      petalColors[i % petalColors.length], q,
    )
  }

  // ——— Wooden bench facing the tree (off the lane) ———
  const bx = 4.5
  const bz = -28
  const face = Math.atan2(TREE_X - bx, PLAZA_Z - bz)
  const benchQ = new THREE.Quaternion().setFromAxisAngle(UP, face)
  const seatLocal = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, color: string) => {
    const p = new THREE.Vector3(lx, ly, lz).applyQuaternion(benchQ)
    push('wood', boxGeo, mat, bx + p.x, ly, bz + p.z, sx, sy, sz, color, benchQ)
  }
  seatLocal(0, 0.42, 0, 1.55, 0.1, 0.42, '#b99672')
  seatLocal(0, 0.68, -0.18, 1.55, 0.48, 0.1, '#ad856b')
  for (const edge of [-0.62, 0.62]) seatLocal(edge, 0.24, 0, 0.1, 0.48, 0.38, '#6f7773')
  seatLocal(0, 0.36, 0.18, 1.4, 0.04, 0.06, '#9a7d5e')

  // ——— Taiyaki / tea stall (+x sidewalk, south of lane) ———
  const sx = 7.6
  const sz = -34.1
  push('wood', boxGeo, mat, sx, 0.55, sz, 2.4, 1.05, 1.35, '#d8c4a8')
  push('wood', boxGeo, mat, sx, 1.12, sz, 2.55, 0.08, 1.48, '#c4a888')
  push('wood', boxGeo, mat, sx, 0.08, sz, 2.5, 0.12, 1.5, '#8a7560')
  // Counter shelf + trays
  push('wood', boxGeo, mat, sx - 0.95, 0.92, sz, 0.12, 0.55, 1.2, '#a88868')
  for (let i = 0; i < 4; i++) {
    push('fish', sphereGeo, softMat, sx - 0.7, 1.22, sz - 0.35 + i * 0.22, 0.16, 0.1, 0.22, i % 2 ? '#e8b878' : '#dca868')
    push('cone', coneGeo, mat, sx - 0.7, 1.18, sz - 0.35 + i * 0.22, 0.04, 0.06, 0.04, '#5a4030')
  }
  // Tea cups
  for (const dz of [-0.25, 0.05, 0.35]) {
    push('cup', cylGeo, mat, sx + 0.35, 1.2, sz + dz, 0.07, 0.1, 0.07, '#f2ebe0')
    push('cup', cylGeo, softMat, sx + 0.35, 1.26, sz + dz, 0.05, 0.02, 0.05, '#c8e0c0')
  }

  const awningTex = mapCanvas(256, 128, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#e85a5a' : '#f7f2e8'
      ctx.fillRect(i * 32, 0, 32, 128)
    }
    ctx.fillStyle = 'rgba(40,30,25,.12)'
    ctx.fillRect(0, 0, 256, 8)
    ctx.fillRect(0, 120, 256, 8)
  })
  const awningMat = keep(toonMaterial({ map: awningTex, side: THREE.DoubleSide }))
  const awning = new THREE.Mesh(planeGeo, awningMat)
  awning.position.set(sx - 0.2, 1.85, sz)
  awning.scale.set(2.6, 1.35, 1)
  awning.rotation.x = -Math.PI / 2.35
  awning.rotation.y = Math.PI / 2
  awning.castShadow = true
  group.add(awning)
  // Awning poles
  for (const dz of [-0.55, 0.55]) {
    push('pole', cylGeo, mat, sx - 1.15, 1.2, sz + dz, 0.04, 1.5, 0.04, '#6a5a4a')
  }
  push('wood', boxGeo, mat, sx - 0.2, 2.05, sz, 0.08, 0.08, 1.4, '#6a5a4a')

  // Canvas price board
  const priceTex = mapCanvas(256, 320, (ctx) => {
    ctx.fillStyle = '#f3e6c8'
    ctx.fillRect(0, 0, 256, 320)
    ctx.strokeStyle = '#8a6a48'
    ctx.lineWidth = 10
    ctx.strokeRect(8, 8, 240, 304)
    ctx.fillStyle = '#5a4030'
    ctx.font = 'bold 36px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('たい焼き', 128, 58)
    ctx.font = '22px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.fillStyle = '#7a5840'
    ;[
      ['あんこ', '¥180'],
      ['クリーム', '¥200'],
      ['さくら茶', '¥220'],
      ['ほうじ茶', '¥200'],
    ].forEach(([name, price], i) => {
      ctx.textAlign = 'left'
      ctx.fillText(name, 36, 120 + i * 48)
      ctx.textAlign = 'right'
      ctx.fillText(price, 220, 120 + i * 48)
      ctx.strokeStyle = 'rgba(138,106,72,.25)'
      ctx.beginPath()
      ctx.moveTo(36, 132 + i * 48)
      ctx.lineTo(220, 132 + i * 48)
      ctx.stroke()
    })
  })
  const priceMat = keep(toonMaterial({ map: priceTex, side: THREE.DoubleSide }))
  const priceBoard = new THREE.Mesh(planeGeo, priceMat)
  priceBoard.position.set(sx + 0.2, 1.55, sz + 0.72)
  priceBoard.scale.set(0.55, 0.72, 1)
  priceBoard.rotation.y = Math.PI
  group.add(priceBoard)
  push('wood', boxGeo, mat, sx + 0.2, 0.85, sz + 0.72, 0.05, 1.2, 0.05, '#8a6a48')
  push('wood', boxGeo, mat, sx + 0.2, 1.55, sz + 0.72, 0.58, 0.76, 0.04, '#c4a888')

  // Stall lantern (warms at night)
  const lantern = new THREE.Mesh(sphereGeo, lanternMat)
  lantern.position.set(sx - 0.55, 1.95, sz)
  lantern.scale.set(0.14, 0.18, 0.14)
  group.add(lantern)
  push('pole', cylGeo, mat, sx - 0.55, 1.72, sz, 0.025, 0.2, 0.025, '#5a4030')
  const lanternLight = new THREE.PointLight('#ffb060', 0, 5.5, 2)
  lanternLight.position.set(sx - 0.55, 1.95, sz)
  group.add(lanternLight)

  // Steam puffs above the griddle (own materials so opacity can diverge)
  const steamPuffs: { mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; phase: number }[] = []
  for (let i = 0; i < 5; i++) {
    const puffMat = keep(steamMat.clone())
    const puff = new THREE.Mesh(sphereGeo, puffMat)
    puff.position.set(sx - 0.65, 1.35, sz - 0.2 + i * 0.12)
    puff.scale.setScalar(0.08)
    group.add(puff)
    steamPuffs.push({ mesh: puff, mat: puffMat, phase: i * 1.3 })
  }

  // ——— Festival nobori on sidewalk corners ———
  const bannerLabels = ['晴天', '花見']
  const bannerMeshes: THREE.Mesh[] = []
  const bannerBases: { x: number; z: number; facing: number }[] = [
    { x: 6.1, z: -28.8, facing: -0.35 },
    { x: -6.1, z: -28.8, facing: 0.35 },
    { x: 6.1, z: -34.2, facing: -0.2 },
    { x: -6.1, z: -34.2, facing: 0.2 },
  ]
  bannerBases.forEach((spot, i) => {
    const label = bannerLabels[i % bannerLabels.length]
    const tex = mapCanvas(96, 320, (ctx) => {
      ctx.fillStyle = i % 2 ? '#e85a5a' : '#f0e8d8'
      ctx.fillRect(0, 0, 96, 320)
      ctx.fillStyle = i % 2 ? '#f0e8d8' : '#e85a5a'
      ctx.fillRect(6, 6, 84, 308)
      ctx.fillStyle = i % 2 ? '#e85a5a' : '#f0e8d8'
      ctx.fillRect(12, 12, 72, 296)
      ctx.fillStyle = i % 2 ? '#fff8f0' : '#3a2820'
      ctx.font = 'bold 42px "Yu Gothic","Microsoft YaHei",sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ;[...label].forEach((ch, ci) => ctx.fillText(ch, 48, 70 + ci * 70))
      ctx.fillStyle = i % 2 ? 'rgba(255,240,220,.35)' : 'rgba(60,40,30,.2)'
      ctx.fillRect(20, 250, 56, 40)
    })
    const clothMat = keep(toonMaterial({ map: tex, side: THREE.DoubleSide }))
    const cloth = new THREE.Mesh(planeGeo, clothMat)
    cloth.position.set(spot.x, 2.05, spot.z)
    cloth.scale.set(0.38, 1.65, 1)
    cloth.rotation.y = spot.facing
    cloth.castShadow = true
    group.add(cloth)
    bannerMeshes.push(cloth)
    push('pole', cylGeo, mat, spot.x, 1.55, spot.z, 0.045, 3.0, 0.045, '#6a5a4a')
    push('pole', cylGeo, mat, spot.x, 0.08, spot.z, 0.16, 0.12, 0.16, '#8a8070')
    push('wood', boxGeo, mat, spot.x, 2.95, spot.z, 0.5, 0.06, 0.06, '#5a4a3a')
  })

  // ——— Painted manhole covers (flat, not blockers) ———
  const manholeTex = mapCanvas(256, 256, (ctx) => {
    ctx.fillStyle = '#6a7270'
    ctx.beginPath()
    ctx.arc(128, 128, 118, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#4a5250'
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.strokeStyle = '#8a9290'
    ctx.lineWidth = 3
    for (let r = 30; r < 110; r += 22) {
      ctx.beginPath()
      ctx.arc(128, 128, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(128 + Math.cos(ang) * 28, 128 + Math.sin(ang) * 28)
      ctx.lineTo(128 + Math.cos(ang) * 105, 128 + Math.sin(ang) * 105)
      ctx.stroke()
    }
    ctx.fillStyle = '#5a6260'
    ctx.beginPath()
    ctx.arc(128, 128, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c8c4b8'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('水道', 128, 132)
  })
  const manholeMat = keep(toonMaterial({
    map: manholeTex,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  }))
  for (const [mx, mz] of [[-2.8, -29.6], [3.4, -33.4]] as const) {
    const cover = new THREE.Mesh(planeGeo, manholeMat)
    cover.rotation.x = -Math.PI / 2
    cover.position.set(mx, 0.11, mz)
    cover.scale.set(0.85, 0.85, 1)
    cover.receiveShadow = true
    group.add(cover)
  }

  // ——— Lost-and-found umbrella stand (sidewalk, +x / north corner) ———
  const ux = 6.4
  const uz = -29.2
  push('pole', cylGeo, mat, ux, 0.55, uz, 0.22, 0.08, 0.22, '#7a8078')
  push('pole', cylGeo, mat, ux, 0.95, uz, 0.06, 0.9, 0.06, '#6a7068')
  push('pole', cylGeo, mat, ux, 1.45, uz, 0.28, 0.05, 0.28, '#8a9088')
  const umbrellaColors = ['#d46a7a', '#6a9ab8', '#e8c868']
  umbrellaColors.forEach((color, i) => {
    const a = -0.4 + i * 0.45
    const tipX = ux + Math.sin(a) * 0.15
    const tipZ = uz + Math.cos(a) * 0.12
    const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a * 0.35)
    push('pole', cylGeo, mat, tipX, 1.15, tipZ, 0.025, 1.1, 0.025, '#5a5048', lean)
    push('umbrella', coneGeo, softMat, tipX + Math.sin(a) * 0.08, 1.72, tipZ, 0.28, 0.22, 0.28, color, lean)
  })
  // Small chalkboard tag
  const tagTex = mapCanvas(128, 64, (ctx) => {
    ctx.fillStyle = '#3a4a42'
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = '#e8e0c8'
    ctx.font = 'bold 18px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('忘れ物', 64, 28)
    ctx.font = '14px sans-serif'
    ctx.fillText('umbrellas', 64, 48)
  })
  const tagMat = keep(toonMaterial({ map: tagTex, side: THREE.DoubleSide }))
  const tag = new THREE.Mesh(planeGeo, tagMat)
  tag.position.set(ux + 0.35, 1.05, uz)
  tag.scale.set(0.32, 0.16, 1)
  tag.rotation.y = -0.4
  group.add(tag)

  // Flush instanced batches
  for (const [name, batch] of batches) {
    if (!batch.items.length) continue
    const mesh = keep(new THREE.InstancedMesh(batch.geometry, batch.material, batch.items.length))
    batch.items.forEach((item, i) => {
      dummy.position.copy(item.p)
      dummy.scale.copy(item.s)
      dummy.quaternion.copy(item.q)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, item.color)
    })
    mesh.name = `Plaza ${name}`
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = name !== 'petal'
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    group.add(mesh)
  }

  const bannerBaseY = bannerMeshes.map((m) => m.rotation.y)

  return {
    update(time: number, night: number) {
      const n = THREE.MathUtils.clamp(night, 0, 1)
      lanternMat.emissive.set('#ff9020').multiplyScalar(n * 0.85)
      lanternMat.color.set(n > 0.3 ? '#f0c070' : '#e8c48a')
      lanternLight.intensity = n * 1.8

      steamPuffs.forEach((puff) => {
        const t = time * 0.9 + puff.phase
        const rise = (t % 2.4) / 2.4
        puff.mesh.position.y = 1.35 + rise * 0.55
        puff.mesh.position.x = sx - 0.65 + Math.sin(t * 1.7) * 0.06
        puff.mesh.scale.setScalar(0.06 + rise * 0.14)
        puff.mat.opacity = (0.35 + (1 - rise) * 0.15) * (1 - n * 0.25)
        puff.mesh.visible = n < 0.92
      })

      bannerMeshes.forEach((cloth, i) => {
        cloth.rotation.z = Math.sin(time * 1.4 + i * 1.7) * 0.06
        cloth.rotation.y = bannerBaseY[i] + Math.sin(time * 0.9 + i) * 0.04
      })
    },
    dispose() {
      scene.remove(group)
      resources.forEach((r) => r.dispose())
    },
  }
}
