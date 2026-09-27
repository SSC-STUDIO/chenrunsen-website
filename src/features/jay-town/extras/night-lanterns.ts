import * as THREE from 'three'
import { toonMaterial } from '../toon'

/** Paper lanterns, noren and thin pole-to-pole strings — the town's night read. */
export function addNightLanterns(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const POLE_X = 9.2
  const POLE_STEP = 17.5
  const LANE_EDGE = 5.5
  const group = new THREE.Group()
  group.name = 'Night lanterns and noren'
  scene.add(group)

  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => {
    resources.push(value)
    return value
  }

  const palette = [
    new THREE.Color('#e07a3a'), // persimmon
    new THREE.Color('#e8c86a'), // pale gold
    new THREE.Color('#e8a0b0'), // sakura pink
  ]
  const dayTint = new THREE.Color('#9a9088')
  const nightWarm = new THREE.Color('#fff0d4')
  const emissiveDay = new THREE.Color('#000000')
  const emissiveNight = new THREE.Color('#ffb070')
  const norenGlow = new THREE.Color('#402018')
  const tasselDay = new THREE.Color('#6a4a3a')
  const tasselNight = new THREE.Color('#a06040')
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const euler = new THREE.Euler()
  const up = new THREE.Vector3(0, 1, 0)
  const dir = new THREE.Vector3()

  type LanternSlot = {
    x: number
    y: number
    z: number
    sx: number
    sy: number
    sz: number
    color: THREE.Color
    sway: number
    phase: number
  }
  type TasselSlot = {
    x: number
    y: number
    z: number
    h: number
    r: number
    color: THREE.Color
    sway: number
    phase: number
  }

  const lanterns: LanternSlot[] = []
  const tassels: TasselSlot[] = []

  const pushLantern = (
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    size = 0.22,
    sway = 0,
    phase = 0,
  ) => {
    const sx = size * (0.92 + (phase % 1) * 0.16)
    const sy = size * (1.05 + ((phase * 1.7) % 1) * 0.22)
    const sz = size * (0.9 + ((phase * 2.3) % 1) * 0.18)
    lanterns.push({ x, y, z, sx, sy, sz, color, sway, phase })
    tassels.push({
      x,
      y: y - sy * 0.55 - 0.16,
      z,
      h: 0.18 + ((phase * 3.1) % 1) * 0.12,
      r: 0.018,
      color: color.clone().multiplyScalar(0.55),
      sway,
      phase,
    })
  }

  /** Hang just inward of the utility poles, clear of the traffic lane. */
  const hangX = (side: number, inset = 0.85) => {
    const x = side * (POLE_X - inset)
    return Math.sign(x) * Math.max(LANE_EDGE + 0.35, Math.abs(x))
  }

  const allPoles: number[] = []
  for (let z = 21; z > -136; z -= POLE_STEP) allPoles.push(z)

  // Near street rhythm (z≈20…-20): poles at 21, 3.5, -14.
  const nearPoles = allPoles.filter((z) => z <= 21 && z >= -14)
  // Far bank sparse set: poles framing z=-105…-130.
  const farPoles = allPoles.filter((z) => z <= -101 && z >= -130)

  for (const side of [-1, 1] as const) {
    nearPoles.forEach((z, pi) => {
      const base = hangX(side, 0.72 + (pi % 3) * 0.08)
      pushLantern(base, 3.95, z + 0.35, palette[pi % 3], 0.24, 0.035, pi * 1.7 + side)
      pushLantern(base - side * 0.12, 3.55, z - 0.55, palette[(pi + 1) % 3], 0.2, 0.05, pi * 2.1 + 3)
      if (pi % 2 === 0) {
        pushLantern(base + side * 0.05, 4.15, z + 1.1, palette[(pi + 2) % 3], 0.18, 0.028, pi * 0.9)
      }
    })
  }

  for (const side of [-1, 1] as const) {
    for (let i = 0; i < nearPoles.length - 1; i++) {
      const a = nearPoles[i]
      const b = nearPoles[i + 1]
      const mid = (a + b) * 0.5
      const x = hangX(side, 0.55)
      pushLantern(x, 3.35, mid, palette[(i + (side < 0 ? 0 : 1)) % 3], 0.21, 0.06, i * 1.3 + side * 2)
      pushLantern(x - side * 0.08, 3.55, mid + (a - b) * 0.18, palette[(i + 2) % 3], 0.17, 0.045, i + 5)
    }
  }

  for (const side of [-1, 1] as const) {
    farPoles.forEach((z, i) => {
      const x = hangX(side, 0.9)
      pushLantern(x, 3.85, z - 1.2, palette[(i + (side < 0 ? 0 : 2)) % 3], 0.23, 0.03, i * 2.4 + 11)
      pushLantern(x - side * 0.1, 3.45, z - 3.6, palette[(i + 1) % 3], 0.19, 0.04, 14 + side + i)
    })
    if (farPoles.length >= 2) {
      const mid = (farPoles[0] + farPoles[1]) * 0.5
      pushLantern(hangX(side, 0.65), 3.4, mid, palette[1], 0.2, 0.05, 18 + side)
    }
  }

  const bodyGeo = keep(new THREE.SphereGeometry(1, 12, 10))
  const tasselGeo = keep(new THREE.CylinderGeometry(1, 0.55, 1, 6))
  const bodyMat = keep(toonMaterial({ soft: true, color: '#ffffff' })) as THREE.MeshToonMaterial
  bodyMat.emissive = new THREE.Color('#000000')
  bodyMat.emissiveIntensity = 0
  const tasselMat = keep(toonMaterial({ color: '#6a4a3a' })) as THREE.MeshToonMaterial

  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, lanterns.length)
  bodyMesh.name = 'Paper lantern bodies'
  bodyMesh.castShadow = true
  bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const tasselMesh = new THREE.InstancedMesh(tasselGeo, tasselMat, tassels.length)
  tasselMesh.name = 'Lantern tassels'
  tasselMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const writeLantern = (index: number, slot: LanternSlot, time: number) => {
    const sway = slot.sway * Math.sin(time * 1.35 + slot.phase)
    const bob = slot.sway * 0.35 * Math.sin(time * 1.1 + slot.phase * 1.7)
    position.set(slot.x + sway * 0.55, slot.y + bob, slot.z)
    euler.set(sway * 0.35, 0, sway * 0.55)
    quaternion.setFromEuler(euler)
    scale.set(slot.sx, slot.sy, slot.sz)
    matrix.compose(position, quaternion, scale)
    bodyMesh.setMatrixAt(index, matrix)
    bodyMesh.setColorAt(index, slot.color)
  }
  const writeTassel = (index: number, slot: TasselSlot, time: number) => {
    const sway = slot.sway * Math.sin(time * 1.35 + slot.phase)
    const bob = slot.sway * 0.35 * Math.sin(time * 1.1 + slot.phase * 1.7)
    position.set(slot.x + sway * 0.85, slot.y + bob - 0.02, slot.z)
    euler.set(sway * 0.55, 0, sway * 0.8)
    quaternion.setFromEuler(euler)
    scale.set(slot.r, slot.h, slot.r)
    matrix.compose(position, quaternion, scale)
    tasselMesh.setMatrixAt(index, matrix)
    tasselMesh.setColorAt(index, slot.color)
  }

  lanterns.forEach((slot, i) => writeLantern(i, slot, 0))
  tassels.forEach((slot, i) => writeTassel(i, slot, 0))
  bodyMesh.instanceMatrix.needsUpdate = true
  tasselMesh.instanceMatrix.needsUpdate = true
  if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true
  if (tasselMesh.instanceColor) tasselMesh.instanceColor.needsUpdate = true
  group.add(bodyMesh, tasselMesh)

  const cordGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 5))
  const cordMat = keep(toonMaterial({ color: '#5c5348' }))
  const placeCord = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius = 0.012) => {
    const dx = bx - ax
    const dy = by - ay
    const dz = bz - az
    const len = Math.hypot(dx, dy, dz)
    if (len < 0.01) return
    dir.set(dx, dy, dz).normalize()
    const mesh = new THREE.Mesh(cordGeo, cordMat)
    mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5)
    mesh.scale.set(radius, len, radius)
    mesh.quaternion.setFromUnitVectors(up, dir)
    group.add(mesh)
  }
  const sagged = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag = 0.55, segments = 5) => {
    let px = ax
    let py = ay
    let pz = az
    for (let s = 1; s <= segments; s++) {
      const t = s / segments
      const nx = THREE.MathUtils.lerp(ax, bx, t)
      const nz = THREE.MathUtils.lerp(az, bz, t)
      const ny = THREE.MathUtils.lerp(ay, by, t) - Math.sin(t * Math.PI) * sag
      placeCord(px, py, pz, nx, ny, nz)
      px = nx
      py = ny
      pz = nz
    }
  }

  for (const side of [-1, 1] as const) {
    const x = hangX(side, 0.55)
    for (let i = 0; i < nearPoles.length - 1; i++) {
      sagged(x, 4.05, nearPoles[i], x, 4.05, nearPoles[i + 1], 0.62, 6)
    }
    for (const z of nearPoles) {
      placeCord(side * POLE_X, 4.1, z, hangX(side, 0.72), 3.95, z, 0.014)
    }
    if (farPoles.length >= 2) {
      const fx = hangX(side, 0.65)
      sagged(fx, 4.0, farPoles[0], fx, 4.0, farPoles[farPoles.length - 1], 0.7, 5)
      for (const z of farPoles) placeCord(side * POLE_X, 4.05, z, fx, 3.85, z, 0.013)
    }
  }

  // Shop noren under the near eaves — fabric slits, still solid objects by day.
  const norenGeo = keep(new THREE.BoxGeometry(1, 1, 1))
  const norenMats = ['#c45c3a', '#d9b56a', '#d4899a', '#b86b4a'].map(
    (hex) => keep(toonMaterial({ color: hex, soft: true })) as THREE.MeshToonMaterial,
  )
  const norenSpots: { side: number; z: number; w: number; color: number }[] = [
    { side: -1, z: 14.5, w: 1.35, color: 0 },
    { side: 1, z: 11.2, w: 1.2, color: 1 },
    { side: -1, z: 5.4, w: 1.5, color: 2 },
    { side: 1, z: 2.1, w: 1.15, color: 3 },
    { side: -1, z: -6.8, w: 1.4, color: 1 },
    { side: 1, z: -12.5, w: 1.25, color: 0 },
    { side: -1, z: -17.8, w: 1.3, color: 2 },
    { side: 1, z: -19.2, w: 1.1, color: 3 },
  ]
  for (const spot of norenSpots) {
    const mat = norenMats[spot.color]
    const slits = 4
    const panelW = spot.w / slits
    const x = spot.side * 7.85
    for (let s = 0; s < slits; s++) {
      const mesh = new THREE.Mesh(norenGeo, mat)
      mesh.position.set(x + spot.side * (s - (slits - 1) * 0.5) * panelW * 0.92, 2.55, spot.z)
      mesh.scale.set(panelW * 0.82, 1.15, 0.04)
      group.add(mesh)
    }
    const rod = new THREE.Mesh(cordGeo, cordMat)
    rod.position.set(x, 3.2, spot.z)
    rod.scale.set(0.02, spot.w + 0.15, 0.02)
    rod.rotation.z = Math.PI / 2
    group.add(rod)
  }

  const lights: THREE.PointLight[] = []
  const lightAnchors = [
    { x: hangX(-1, 0.7), y: 3.6, z: 3.5 },
    { x: hangX(1, 0.7), y: 3.6, z: -14 },
    { x: hangX(-1, 0.7), y: 3.5, z: 14 },
    { x: hangX(1, 0.65), y: 3.5, z: -112 },
    { x: hangX(-1, 0.65), y: 3.45, z: -119 },
    { x: hangX(1, 0.55), y: 3.4, z: -6 },
  ]
  for (const anchor of lightAnchors) {
    const light = new THREE.PointLight(0xffc48a, 0, 9.5, 2)
    light.position.set(anchor.x, anchor.y, anchor.z)
    light.visible = false
    group.add(light)
    lights.push(light)
  }

  const update = (time: number, night: number) => {
    const n = THREE.MathUtils.clamp(night, 0, 1)
    for (let i = 0; i < lanterns.length; i++) writeLantern(i, lanterns[i], time)
    for (let i = 0; i < tassels.length; i++) writeTassel(i, tassels[i], time)
    bodyMesh.instanceMatrix.needsUpdate = true
    tasselMesh.instanceMatrix.needsUpdate = true

    bodyMat.color.copy(dayTint).lerp(nightWarm, n)
    bodyMat.emissive.copy(emissiveDay).lerp(emissiveNight, n)
    bodyMat.emissiveIntensity = THREE.MathUtils.lerp(0.02, 0.95, n)
    tasselMat.color.copy(tasselDay).lerp(tasselNight, n * 0.35)

    for (const mat of norenMats) {
      mat.emissive.copy(emissiveDay).lerp(norenGlow, n * 0.45)
      mat.emissiveIntensity = n * 0.25
    }

    for (const light of lights) {
      light.intensity = n * 1.15
      light.visible = n > 0.04
    }
  }

  return {
    update,
    dispose() {
      scene.remove(group)
      group.clear()
      bodyMesh.dispose()
      tasselMesh.dispose()
      resources.forEach((resource) => resource.dispose())
    },
  }
}
