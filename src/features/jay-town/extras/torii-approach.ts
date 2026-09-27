import * as THREE from 'three'
import { toonMaterial } from '../toon'

/** Approach dressing for the street-mouth torii: paving, shrine props, plants, a swaying shimenawa. */
export function addToriiApproach(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const group = new THREE.Group()
  group.name = 'Torii approach'
  scene.add(group)

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const keepG = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g)
  const keepM = <T extends THREE.Material>(m: T) => (materials.push(m), m)
  const keepT = <T extends THREE.Texture>(t: T) => (textures.push(t), t)

  const boxGeo = keepG(new THREE.BoxGeometry(1, 1, 1))
  const cylGeo = keepG(new THREE.CylinderGeometry(1, 1, 1, 8))
  const sphGeo = keepG(new THREE.SphereGeometry(1, 8, 6))
  const planeGeo = keepG(new THREE.PlaneGeometry(1, 1))
  const torusGeo = keepG(new THREE.TorusGeometry(1, 0.12, 6, 16))

  const stone = keepM(toonMaterial({ color: '#9a9e93' }))
  const moss = keepM(toonMaterial({ color: '#5f7a4a', soft: true }))
  const wood = keepM(toonMaterial({ color: '#8b7355' }))
  const darkWood = keepM(toonMaterial({ color: '#5c4634' }))
  const straw = keepM(toonMaterial({ color: '#c4a86a' }))
  const leaf = keepM(toonMaterial({ color: '#4f7340', soft: true }))
  const bloom = keepM(toonMaterial({ color: '#d4788a', soft: true }))
  const azalea = keepM(toonMaterial({ color: '#c45a6e', soft: true }))
  const paper = keepM(toonMaterial({ color: '#f2ebe0' }))
  const lanternBody = keepM(toonMaterial({ color: '#8a8680' }))
  const lanternGlow = keepM(new THREE.MeshBasicMaterial({
    color: '#f0d9a0',
    transparent: true,
    opacity: 0.35,
    toneMapped: false,
  }))

  type Item = { p: THREE.Vector3; s: THREE.Vector3; r: THREE.Euler; c: THREE.Color }
  const batches = new Map<THREE.Material, { geo: THREE.BufferGeometry; items: Item[] }>()
  const dummy = new THREE.Object3D()
  const colorScratch = new THREE.Color()

  function push(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color?: THREE.ColorRepresentation,
    ry = 0, rx = 0, rz = 0,
  ) {
    let batch = batches.get(mat)
    if (!batch) {
      batch = { geo, items: [] }
      batches.set(mat, batch)
    }
    batch.items.push({
      p: new THREE.Vector3(x, y, z),
      s: new THREE.Vector3(sx, sy, sz),
      r: new THREE.Euler(rx, ry, rz),
      c: colorScratch.set(color ?? '#ffffff').clone(),
    })
  }

  // Irregular stone slabs along sidewalk edges leading to the gate (outside driving lane).
  const slabSeeds: [number, number, number, number, number][] = [
    [-7.4, 18.2, 0.72, 0.55, 0.18], [-7.9, 19.1, 0.58, 0.7, -0.3],
    [-7.55, 20.0, 0.85, 0.48, 0.4], [-8.1, 21.2, 0.62, 0.62, -0.15],
    [-7.35, 22.4, 0.7, 0.5, 0.55], [-7.85, 23.5, 0.55, 0.68, -0.45],
    [-7.5, 24.6, 0.78, 0.52, 0.2], [-8.0, 14.0, 0.65, 0.6, -0.25],
    [-7.45, 12.8, 0.7, 0.48, 0.35], [-7.95, 11.5, 0.58, 0.72, -0.1],
    [7.4, 18.0, 0.68, 0.58, -0.22], [7.85, 19.3, 0.6, 0.65, 0.4],
    [7.5, 20.5, 0.8, 0.5, -0.35], [8.05, 21.8, 0.55, 0.7, 0.15],
    [7.4, 23.0, 0.72, 0.52, -0.5], [7.9, 24.2, 0.6, 0.6, 0.28],
    [7.55, 14.2, 0.66, 0.55, 0.12], [8.0, 12.6, 0.58, 0.68, -0.4],
  ]
  for (const [x, z, sx, sz, ry] of slabSeeds) {
    const h = 0.06 + ((Math.abs(x * 10 + z) % 7) * 0.004)
    push(boxGeo, stone, x, 0.12 + h * 0.5, z, sx, h, sz, '#8e9288', ry)
    // Moss tufts nestled at slab corners.
    push(sphGeo, moss, x + sx * 0.28, 0.14, z + sz * 0.2, 0.14, 0.05, 0.12, '#5a7644')
    push(sphGeo, moss, x - sx * 0.22, 0.13, z - sz * 0.18, 0.11, 0.04, 0.1, '#6a8450')
  }

  // Stone lantern (tōrō) — negative-x only, set back near x=-10, z=20.
  const lx = -10.05
  const lz = 20.15
  push(cylGeo, lanternBody, lx, 0.12, lz, 0.32, 0.1, 0.32, '#7d7a74')
  push(cylGeo, lanternBody, lx, 0.42, lz, 0.14, 0.5, 0.14, '#8a8680')
  push(boxGeo, lanternBody, lx, 0.78, lz, 0.55, 0.08, 0.55, '#75726c')
  push(boxGeo, lanternBody, lx, 1.05, lz, 0.38, 0.48, 0.38, '#8f8b84') // chamber frame
  push(boxGeo, lanternGlow, lx, 1.05, lz, 0.28, 0.36, 0.28, '#f0d9a0')
  push(boxGeo, lanternBody, lx, 1.38, lz, 0.62, 0.1, 0.62, '#6f6c66')
  push(sphGeo, lanternBody, lx, 1.52, lz, 0.1, 0.08, 0.1, '#5e5b56')

  // Wooden ema rack with a few painted plaques.
  const rx = -9.85
  const rz = 19.2
  push(boxGeo, darkWood, rx, 0.55, rz, 0.08, 1.0, 0.08, '#4a3828')
  push(boxGeo, darkWood, rx + 0.9, 0.55, rz, 0.08, 1.0, 0.08, '#4a3828')
  push(boxGeo, wood, rx + 0.45, 0.95, rz, 1.05, 0.06, 0.1, '#8b7355')
  push(boxGeo, wood, rx + 0.45, 0.55, rz, 1.05, 0.05, 0.08, '#7a6548')

  const emaColors = ['#f3e6c8', '#e8d4b0', '#f0ebe0', '#e5d8b8']
  const emaPaint = [
    { label: '願', accent: '#8a3a3a' },
    { label: '桜', accent: '#c45a6e' },
    { label: '幸', accent: '#3d5a4a' },
    { label: '音', accent: '#4a5a7a' },
  ]
  const emaTextures: THREE.CanvasTexture[] = []
  for (let i = 0; i < 4; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 160
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = emaColors[i]
    ctx.fillRect(0, 0, 128, 160)
    ctx.strokeStyle = '#6a5540'
    ctx.lineWidth = 6
    ctx.strokeRect(4, 4, 120, 152)
    ctx.fillStyle = emaPaint[i].accent
    ctx.font = 'bold 64px "Yu Mincho","KaiTi",serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emaPaint[i].label, 64, 72)
    ctx.fillStyle = '#a08060'
    ctx.font = '14px Georgia'
    ctx.fillText('ema', 64, 130)
    const tex = keepT(new THREE.CanvasTexture(canvas))
    tex.colorSpace = THREE.SRGBColorSpace
    emaTextures.push(tex)
    const mat = keepM(toonMaterial({ map: tex, side: THREE.DoubleSide }))
    const plaque = new THREE.Mesh(planeGeo, mat)
    const px = rx + 0.12 + i * 0.22
    plaque.position.set(px, 0.78, rz + 0.06)
    plaque.scale.set(0.18, 0.24, 1)
    plaque.rotation.y = 0.08
    group.add(plaque)
    // Tiny hanging peg.
    push(cylGeo, darkWood, px, 0.92, rz + 0.02, 0.02, 0.06, 0.02, '#3a2c20', 0, Math.PI / 2)
  }

  // Camellia / low azalea clumps — sidewalk margins only.
  const shrubs: [number, number, number][] = [
    [-9.4, 21.4, 0], [-8.6, 22.8, 1], [-9.8, 18.4, 0],
    [-8.9, 13.6, 1], [8.7, 19.6, 0], [9.3, 22.0, 1],
    [8.5, 14.0, 0], [9.1, 24.0, 1],
  ]
  for (const [sx, sz, kind] of shrubs) {
    push(sphGeo, leaf, sx, 0.28, sz, 0.42, 0.28, 0.38, '#4a6e3a')
    push(sphGeo, leaf, sx + 0.22, 0.32, sz - 0.1, 0.3, 0.24, 0.28, '#5a8048')
    push(sphGeo, leaf, sx - 0.18, 0.26, sz + 0.15, 0.28, 0.22, 0.26, '#3f6334')
    const petal = kind ? azalea : bloom
    for (let k = 0; k < 5; k++) {
      const a = k * 1.35 + sx
      push(sphGeo, petal, sx + Math.cos(a) * 0.22, 0.42 + (k % 2) * 0.06, sz + Math.sin(a) * 0.2,
        0.07, 0.05, 0.07, kind ? '#c45a6e' : '#d4788a')
    }
  }

  // Straw wreath (shimenawa ring) on the negative-x torii post.
  const postX = -7.55
  const postZ = 16.2
  push(torusGeo, straw, postX - 0.28, 2.4, postZ, 0.22, 0.22, 0.08, '#c4a86a', 0, Math.PI / 2)
  // Zigzag paper streamers dangling from the wreath.
  for (let i = 0; i < 3; i++) {
    push(boxGeo, paper, postX - 0.28 + (i - 1) * 0.08, 2.15 - i * 0.05, postZ + 0.05,
      0.04, 0.22, 0.01, '#f2ebe0', 0.1 * i)
  }

  // Tiny offering box (saisen) beside the lantern base.
  push(boxGeo, darkWood, lx + 0.55, 0.22, lz + 0.35, 0.35, 0.28, 0.28, '#4a3828')
  push(boxGeo, wood, lx + 0.55, 0.38, lz + 0.35, 0.38, 0.04, 0.32, '#8b7355')
  push(boxGeo, darkWood, lx + 0.55, 0.32, lz + 0.48, 0.22, 0.04, 0.04, '#3a2c20') // coin slot lip

  // Vertical wooden sign: 桜町口, facing the street (toward +X / center).
  {
    const canvas = document.createElement('canvas')
    canvas.width = 192
    canvas.height = 640
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#d8c4a0'
    ctx.fillRect(0, 0, 192, 640)
    ctx.fillStyle = '#6b4e32'
    ctx.fillRect(0, 0, 192, 28)
    ctx.fillRect(0, 612, 192, 28)
    ctx.strokeStyle = '#5a4030'
    ctx.lineWidth = 10
    ctx.strokeRect(8, 36, 176, 568)
    ctx.fillStyle = '#3a2a1a'
    ctx.font = 'bold 92px "Yu Mincho","KaiTi",serif'
    ctx.textAlign = 'center'
    ;['桜', '町', '口'].forEach((ch, i) => ctx.fillText(ch, 96, 160 + i * 140))
    ctx.fillStyle = '#8a6a4a'
    ctx.font = '18px Georgia'
    ctx.fillText('SAKURA', 96, 560)
    const tex = keepT(new THREE.CanvasTexture(canvas))
    tex.colorSpace = THREE.SRGBColorSpace
    const signMat = keepM(toonMaterial({ map: tex, side: THREE.DoubleSide }))
    const sign = new THREE.Mesh(planeGeo, signMat)
    // On negative-x sidewalk, facing street (rotation so face looks toward +X / road).
    sign.position.set(-8.35, 1.55, 22.6)
    sign.scale.set(0.42, 1.4, 1)
    sign.rotation.y = Math.PI / 2
    group.add(sign)
    push(boxGeo, darkWood, -8.42, 1.55, 22.6, 0.08, 1.48, 0.48, '#5c4634')
    push(cylGeo, darkWood, -8.42, 0.55, 22.6, 0.07, 1.05, 0.07, '#4a3828')
  }

  // Shimenawa / paper streamer across the torii beam area (y≈5.2).
  const ropeGroup = new THREE.Group()
  ropeGroup.name = 'Torii shimenawa'
  ropeGroup.position.set(0, 5.2, 16.2)
  group.add(ropeGroup)

  const ropeMat = keepM(toonMaterial({ color: '#c9b07a' }))
  const ropeSegs: THREE.Mesh[] = []
  const span = 14.2
  const segments = 18
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1)
    const x = -span / 2 + t * span
    const sag = Math.sin(t * Math.PI) * 0.18
    const mesh = new THREE.Mesh(cylGeo, ropeMat)
    mesh.position.set(x, -sag, 0)
    mesh.scale.set(0.055, 0.82, 0.055)
    mesh.rotation.z = Math.PI / 2
    ropeGroup.add(mesh)
    ropeSegs.push(mesh)
  }
  // Zigzag shide papers hanging from the rope.
  const shideMats = [
    keepM(toonMaterial({ color: '#f5efe4', side: THREE.DoubleSide })),
    keepM(toonMaterial({ color: '#efe6d4', side: THREE.DoubleSide })),
  ]
  const shides: THREE.Mesh[] = []
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9
    const x = -span / 2 + t * span
    const sag = Math.sin(t * Math.PI) * 0.18
    const shide = new THREE.Mesh(planeGeo, shideMats[i % 2])
    shide.position.set(x, -sag - 0.28, 0.04)
    shide.scale.set(0.1, 0.36, 1)
    ropeGroup.add(shide)
    shides.push(shide)
  }

  // Flush InstancedMeshes for batched lit props.
  for (const [mat, batch] of batches) {
    if (batch.items.length === 0) continue
    const mesh = new THREE.InstancedMesh(batch.geo, mat, batch.items.length)
    batch.items.forEach((item, i) => {
      dummy.position.copy(item.p)
      dummy.scale.copy(item.s)
      dummy.rotation.copy(item.r)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, item.c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    group.add(mesh)
  }

  const baseGlowOpacity = 0.35
  const baseGlowColor = new THREE.Color('#f0d9a0')
  const nightGlowColor = new THREE.Color('#ffd78a')

  return {
    update(time: number, night: number) {
      const sway = Math.sin(time * 1.4) * 0.035
      const sway2 = Math.sin(time * 1.9 + 0.7) * 0.02
      ropeGroup.rotation.z = sway
      ropeGroup.rotation.x = sway2 * 0.4
      for (let i = 0; i < shides.length; i++) {
        shides[i].rotation.z = Math.sin(time * 2.1 + i * 0.6) * 0.18
        shides[i].rotation.x = Math.sin(time * 1.6 + i) * 0.08
      }
      const lit = night > 0.4 ? THREE.MathUtils.smoothstep(night, 0.4, 1) : 0
      lanternGlow.opacity = baseGlowOpacity + lit * 0.55
      lanternGlow.color.copy(baseGlowColor).lerp(nightGlowColor, lit)
    },
    dispose() {
      scene.remove(group)
      group.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) obj.dispose()
      })
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
    },
  }
}
