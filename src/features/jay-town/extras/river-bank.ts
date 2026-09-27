import * as THREE from 'three'
import { toonMaterial } from '../toon'

/** Soft river-bank life: reeds, koi hints, bridge lanterns, a moored boat, and far-bank laundry. */
export function addRiverBank(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const group = new THREE.Group()
  group.name = 'River bank extras'
  scene.add(group)

  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => {
    resources.push(value)
    return value
  }

  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1))
  const cylGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 8))
  const sphereGeo = keep(new THREE.SphereGeometry(1, 8, 6))
  const coneGeo = keep(new THREE.ConeGeometry(1, 1, 7))
  const planeGeo = keep(new THREE.PlaneGeometry(1, 1))
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  const reedMat = keep(toonMaterial({ color: '#6f8f6a' }))
  const tipMat = keep(toonMaterial({ color: '#c9b87a', soft: true }))
  const stoneMat = keep(toonMaterial({ color: '#8a9496' }))
  const wetMat = keep(toonMaterial({ color: '#6e7f86', soft: true }))
  const koiMat = keep(toonMaterial({ color: '#e28a5a', soft: true, transparent: true, opacity: 0.78, depthWrite: false }))
  const koiWhite = keep(toonMaterial({ color: '#efe6d8', soft: true, transparent: true, opacity: 0.7, depthWrite: false }))
  const woodMat = keep(toonMaterial({ color: '#9a7556' }))
  const darkWood = keep(toonMaterial({ color: '#6a5344' }))
  const canvasMat = keep(toonMaterial({ color: '#e8d8c4' }))
  const padMat = keep(toonMaterial({ color: '#5f8a62', soft: true, transparent: true, opacity: 0.86, depthWrite: false }))
  const laundryMat = keep(toonMaterial({ color: '#f0e6da', soft: true }))
  const teaMat = keep(toonMaterial({ color: '#c9b48e' }))
  const ropeMat = keep(toonMaterial({ color: '#a89078' }))
  const lanternBodyMat = keep(toonMaterial({ color: '#f2e4c8', soft: true }))
  const lanternFrameMat = keep(toonMaterial({ color: '#6d5650' }))
  const glowMat = keep(new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    toneMapped: false,
  }))

  function placeInstance(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
    tint?: string,
  ) {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, ry, 0)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (tint) mesh.setColorAt(index, color.set(tint))
  }

  // --- Reeds along near (z≈-74) and far (z≈-98) banks, clear of the roadway ---
  const REED_COUNT = 72
  const reeds = new THREE.InstancedMesh(cylGeo, reedMat, REED_COUNT)
  reeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const tips = new THREE.InstancedMesh(coneGeo, tipMat, REED_COUNT)
  let ri = 0
  for (let i = 0; i < REED_COUNT; i++) {
    const bank = i < REED_COUNT / 2 ? -1 : 1
    const zBase = bank < 0 ? -73.2 : -98.8
    const lane = (i % 18) / 17
    const side = i % 2 === 0 ? 1 : -1
    const x = side * (8.6 + lane * 22 + (i % 5) * 0.35)
    const z = zBase + (i % 7) * 0.22 * bank + Math.sin(i * 1.7) * 0.35
    const h = 0.55 + (i % 5) * 0.09
    const lean = (i % 3 - 1) * 0.12
    placeInstance(reeds, ri, x, h * 0.5 - 0.02, z, 0.035, h, 0.035, lean)
    placeInstance(tips, ri, x, h + 0.04, z, 0.05, 0.12, 0.05, lean)
    ri++
  }
  reeds.count = ri
  tips.count = ri
  reeds.castShadow = true
  group.add(reeds, tips)

  // --- Wet stones clustered at bank edges ---
  const STONE_COUNT = 48
  const stones = new THREE.InstancedMesh(sphereGeo, stoneMat, STONE_COUNT)
  stones.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const wetStones = new THREE.InstancedMesh(sphereGeo, wetMat, 24)
  let si = 0
  let wi = 0
  for (let i = 0; i < STONE_COUNT; i++) {
    const bank = i < 24 ? -1 : 1
    const zBase = bank < 0 ? -74.4 : -97.6
    const side = i % 2 === 0 ? 1 : -1
    const x = side * (9.2 + (i % 12) * 1.55 + (i % 3) * 0.2)
    const z = zBase + Math.sin(i * 2.1) * 0.55
    const s = 0.18 + (i % 4) * 0.07
    placeInstance(stones, si++, x, -0.02, z, s, s * 0.55, s * 0.85, i * 0.4, i % 3 ? '#8a9496' : '#7a868a')
    if (i % 2 === 0 && wi < 24) {
      placeInstance(wetStones, wi++, x + 0.2, -0.04, z - bank * 0.35, s * 0.7, s * 0.35, s * 0.6, i)
    }
  }
  stones.count = si
  wetStones.count = wi
  if (stones.instanceColor) stones.instanceColor.needsUpdate = true
  group.add(stones, wetStones)

  // --- Soft koi shapes just under the surface near banks (|x|>8) ---
  const KOI_COUNT = 10
  const koiWarm = new THREE.InstancedMesh(sphereGeo, koiMat, KOI_COUNT)
  const koiPale = new THREE.InstancedMesh(sphereGeo, koiWhite, KOI_COUNT)
  const koiHome: { x: number; z: number; phase: number; amp: number }[] = []
  for (let i = 0; i < KOI_COUNT; i++) {
    const bank = i < 5 ? -1 : 1
    const side = i % 2 === 0 ? 1 : -1
    const x = side * (10.5 + (i % 5) * 3.2)
    const z = (bank < 0 ? -76.5 : -95.5) + (i % 3) * 1.1
    koiHome.push({ x, z, phase: i * 1.3, amp: 0.35 + (i % 3) * 0.12 })
    placeInstance(koiWarm, i, x, -0.05, z, 0.28, 0.07, 0.12, i * 0.5)
    placeInstance(koiPale, i, x + 0.12, -0.048, z + 0.04, 0.16, 0.05, 0.08, i * 0.5)
  }
  group.add(koiWarm, koiPale)

  // --- Lily pads that shimmer slowly (transparent, sparse — water stays readable) ---
  const PAD_COUNT = 14
  const pads = new THREE.InstancedMesh(planeGeo, padMat, PAD_COUNT)
  pads.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const padHome: { x: number; z: number; s: number; phase: number }[] = []
  for (let i = 0; i < PAD_COUNT; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const x = side * (11 + (i % 7) * 2.4 + (i % 3) * 0.4)
    const z = -78 - (i % 5) * 3.6 - (i % 2) * 1.2
    // Keep clear of the bridge deck band |x|<8
    const px = Math.abs(x) < 8.5 ? side * 9.5 : x
    const s = 0.45 + (i % 4) * 0.12
    padHome.push({ x: px, z, s, phase: i * 0.9 })
    dummy.position.set(px, -0.085, z)
    dummy.rotation.set(-Math.PI / 2, 0, i * 0.7)
    dummy.scale.set(s, s * 0.85, 1)
    dummy.updateMatrix()
    pads.setMatrixAt(i, dummy.matrix)
  }
  group.add(pads)

  // --- Bridge lanterns hanging along existing rails at x=±7.8 ---
  const LANTERN_Z = [-96.5, -92.2, -87.9, -83.6, -79.3, -75.0]
  const lanternGlows: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    for (const z of LANTERN_Z) {
      const x = side * 7.8
      const post = new THREE.Mesh(boxGeo, lanternFrameMat)
      post.position.set(x, 1.42, z)
      post.scale.set(0.06, 0.28, 0.06)
      const frame = new THREE.Mesh(boxGeo, lanternFrameMat)
      frame.position.set(x, 1.18, z)
      frame.scale.set(0.22, 0.28, 0.22)
      const body = new THREE.Mesh(boxGeo, lanternBodyMat)
      body.position.set(x, 1.18, z)
      body.scale.set(0.16, 0.22, 0.16)
      const cap = new THREE.Mesh(coneGeo, lanternFrameMat)
      cap.position.set(x, 1.38, z)
      cap.scale.set(0.14, 0.1, 0.14)
      const glow = new THREE.Mesh(sphereGeo, glowMat)
      glow.position.set(x, 1.18, z)
      glow.scale.set(0.32, 0.38, 0.32)
      lanternGlows.push(glow)
      group.add(post, frame, body, cap, glow)
    }
  }

  // --- Moored wooden boat on the positive-x bank ---
  const boat = new THREE.Group()
  boat.position.set(14.2, -0.02, -88.5)
  boat.rotation.y = -0.35
  const hull = new THREE.Mesh(boxGeo, woodMat)
  hull.scale.set(2.4, 0.28, 0.95)
  hull.position.y = 0.08
  const bow = new THREE.Mesh(coneGeo, woodMat)
  bow.rotation.z = Math.PI / 2
  bow.position.set(1.35, 0.1, 0)
  bow.scale.set(0.48, 0.9, 0.42)
  const seat = new THREE.Mesh(boxGeo, darkWood)
  seat.scale.set(0.55, 0.12, 0.7)
  seat.position.set(-0.2, 0.22, 0)
  const gunwaleL = new THREE.Mesh(boxGeo, darkWood)
  gunwaleL.scale.set(2.1, 0.06, 0.06)
  gunwaleL.position.set(0, 0.22, 0.42)
  const gunwaleR = gunwaleL.clone()
  gunwaleR.position.z = -0.42
  boat.add(hull, bow, seat, gunwaleL, gunwaleR)

  // Mooring rope to a bank post
  const moorPost = new THREE.Mesh(cylGeo, darkWood)
  moorPost.position.set(16.1, 0.35, -87.2)
  moorPost.scale.set(0.06, 0.7, 0.06)
  const rope = new THREE.Mesh(cylGeo, ropeMat)
  rope.position.set(15.15, 0.18, -87.85)
  rope.rotation.z = 1.15
  rope.scale.set(0.025, 1.1, 0.025)
  group.add(moorPost, rope)

  // Fishing rod leaning from the boat
  const rod = new THREE.Mesh(cylGeo, darkWood)
  rod.position.set(0.6, 0.55, 0.15)
  rod.rotation.set(0.15, 0, -0.85)
  rod.scale.set(0.018, 1.35, 0.018)
  const line = new THREE.Mesh(cylGeo, ropeMat)
  line.position.set(1.35, 0.15, 0.22)
  line.rotation.set(0.4, 0, 0.2)
  line.scale.set(0.008, 0.7, 0.008)
  boat.add(rod, line)
  group.add(boat)

  // Canvas sign 七里香 near the mooring
  const signCanvas = document.createElement('canvas')
  signCanvas.width = 256
  signCanvas.height = 128
  const sctx = signCanvas.getContext('2d')!
  sctx.fillStyle = '#e8d8c4'
  sctx.fillRect(0, 0, 256, 128)
  sctx.strokeStyle = '#8a6b52'
  sctx.lineWidth = 8
  sctx.strokeRect(6, 6, 244, 116)
  sctx.fillStyle = '#4a5a52'
  sctx.font = 'bold 52px "Microsoft YaHei", "Noto Sans SC", sans-serif'
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.fillText('七里香', 128, 64)
  const signTex = keep(new THREE.CanvasTexture(signCanvas))
  signTex.colorSpace = THREE.SRGBColorSpace
  const signMat = keep(new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: false }))
  const signBoard = new THREE.Mesh(planeGeo, signMat)
  signBoard.position.set(15.6, 1.05, -86.4)
  signBoard.rotation.y = -0.9
  signBoard.scale.set(1.1, 0.55, 1)
  const signPost = new THREE.Mesh(cylGeo, darkWood)
  signPost.position.set(15.55, 0.5, -86.35)
  signPost.scale.set(0.05, 1.0, 0.05)
  group.add(signBoard, signPost)

  // --- Far-bank tea canopy + laundry near x=14, z=-104 (off the road) ---
  const teaX = 14.2
  const teaZ = -104.2
  const poleL = new THREE.Mesh(cylGeo, darkWood)
  poleL.position.set(teaX - 1.4, 1.1, teaZ)
  poleL.scale.set(0.07, 2.2, 0.07)
  const poleR = poleL.clone()
  poleR.position.x = teaX + 1.4
  const canopy = new THREE.Mesh(boxGeo, teaMat)
  canopy.position.set(teaX, 2.15, teaZ)
  canopy.scale.set(3.2, 0.08, 2.4)
  canopy.rotation.z = 0.04
  const canopyEdge = new THREE.Mesh(boxGeo, keep(toonMaterial({ color: '#a8886a' })))
  canopyEdge.position.set(teaX, 2.05, teaZ)
  canopyEdge.scale.set(3.35, 0.05, 2.55)
  const table = new THREE.Mesh(cylGeo, woodMat)
  table.position.set(teaX, 0.42, teaZ + 0.2)
  table.scale.set(0.7, 0.08, 0.7)
  const tableLeg = new THREE.Mesh(cylGeo, darkWood)
  tableLeg.position.set(teaX, 0.2, teaZ + 0.2)
  tableLeg.scale.set(0.08, 0.4, 0.08)
  group.add(poleL, poleR, canopy, canopyEdge, table, tableLeg)

  // Laundry line between canopy posts and a far post
  const laundryPost = new THREE.Mesh(cylGeo, darkWood)
  laundryPost.position.set(teaX + 3.6, 0.95, teaZ - 1.8)
  laundryPost.scale.set(0.06, 1.9, 0.06)
  group.add(laundryPost)
  const lineGeo = keep(new THREE.CylinderGeometry(0.012, 0.012, 1, 4))
  const clothesLine = new THREE.Mesh(lineGeo, ropeMat)
  clothesLine.position.set(teaX + 2.5, 1.85, teaZ - 0.9)
  clothesLine.rotation.set(0.15, 0.6, 1.45)
  clothesLine.scale.set(1, 4.2, 1)
  group.add(clothesLine)

  const clothColors = ['#f0e6da', '#d8c4b0', '#c5d4ce', '#e8c9c0']
  for (let i = 0; i < 4; i++) {
    const cloth = new THREE.Mesh(planeGeo, keep(toonMaterial({ color: clothColors[i], soft: true, side: THREE.DoubleSide })))
    cloth.position.set(teaX + 1.6 + i * 0.55, 1.45 - (i % 2) * 0.08, teaZ - 0.5 - i * 0.35)
    cloth.rotation.set(0.1, 0.55, 0.08 * (i % 2 ? 1 : -1))
    cloth.scale.set(0.45, 0.7, 1)
    group.add(cloth)
  }
  // Small towel on the nearer post for depth from the far stop
  const towel = new THREE.Mesh(planeGeo, laundryMat)
  towel.position.set(teaX - 1.35, 1.2, teaZ + 0.15)
  towel.rotation.y = 0.2
  towel.scale.set(0.35, 0.55, 1)
  group.add(towel)

  const boatBaseY = boat.position.y

  return {
    update(time: number, night: number) {
      // Gentle boat bob
      boat.position.y = boatBaseY + Math.sin(time * 1.1) * 0.025
      boat.rotation.z = Math.sin(time * 0.85) * 0.03
      boat.rotation.x = Math.cos(time * 0.7) * 0.018

      // Lily pad shimmer — slight y bob and opacity pulse
      for (let i = 0; i < PAD_COUNT; i++) {
        const p = padHome[i]
        const lift = Math.sin(time * 0.9 + p.phase) * 0.012
        dummy.position.set(p.x, -0.085 + lift, p.z)
        dummy.rotation.set(-Math.PI / 2, 0, i * 0.7 + Math.sin(time * 0.4 + p.phase) * 0.08)
        dummy.scale.set(p.s, p.s * 0.85, 1)
        dummy.updateMatrix()
        pads.setMatrixAt(i, dummy.matrix)
      }
      pads.instanceMatrix.needsUpdate = true
      padMat.opacity = 0.78 + Math.sin(time * 0.6) * 0.08

      // Slow koi drift under the banks
      for (let i = 0; i < KOI_COUNT; i++) {
        const h = koiHome[i]
        const dx = Math.sin(time * 0.35 + h.phase) * h.amp
        const dz = Math.cos(time * 0.28 + h.phase) * h.amp * 0.55
        placeInstance(koiWarm, i, h.x + dx, -0.05, h.z + dz, 0.28, 0.07, 0.12, time * 0.2 + h.phase)
        placeInstance(koiPale, i, h.x + dx + 0.12, -0.048, h.z + dz + 0.04, 0.16, 0.05, 0.08, time * 0.2 + h.phase)
      }
      koiWarm.instanceMatrix.needsUpdate = true
      koiPale.instanceMatrix.needsUpdate = true

      // Lanterns warm up at night
      const glow = 0.12 + night * 0.55
      glowMat.opacity = glow
      lanternBodyMat.color.setRGB(
        THREE.MathUtils.lerp(0.95, 1.0, night),
        THREE.MathUtils.lerp(0.89, 0.82, night),
        THREE.MathUtils.lerp(0.78, 0.55, night),
      )
      for (const g of lanternGlows) {
        const pulse = 1 + Math.sin(time * 2.2 + g.position.z) * 0.06 * night
        g.scale.setScalar(0.32 * (0.85 + night * 0.5) * pulse)
      }
    },
    dispose() {
      scene.remove(group)
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          // Shared geos/mats disposed via resources; skip per-mesh
        }
      })
      for (const r of resources) r.dispose()
    },
  }
}
