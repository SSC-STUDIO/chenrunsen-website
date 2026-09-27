import * as THREE from 'three'
import { eachShop, POLE_X, SIDEWALK_X, TREE_X, type ShopSpot } from './layout'
import { toonMaterial } from './toon'

export type TownWorld = {
  dispose: () => void
  update: (time: number, night: number) => void
  colliders: THREE.Box3[]
}

type Instance = {
  position: THREE.Vector3
  scale: THREE.Vector3
  rotation: THREE.Quaternion
  color: THREE.Color
}

const UP = new THREE.Vector3(0, 1, 0)
export function buildTown(scene: THREE.Scene): TownWorld {
  const town = new THREE.Group()
  town.name = 'Jay Sakura Town'
  scene.add(town)

  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const colliders: THREE.Box3[] = []
  const boxGeometry = keepGeometry(new THREE.BoxGeometry(1, 1, 1))
  const roundGeometry = keepGeometry(new THREE.SphereGeometry(1, 10, 7))
  const cylinderGeometry = keepGeometry(new THREE.CylinderGeometry(1, 1, 1, 7))
  const branchGeometry = keepGeometry(new THREE.CylinderGeometry(0.42, 1, 1, 7))
  const ringGeometry = keepGeometry(new THREE.TorusGeometry(0.38, 0.045, 5, 14))
  const planeGeometry = keepGeometry(new THREE.PlaneGeometry(1, 1))
  const boxes: Instance[] = []
  const rounds: Instance[] = []
  const cylinders: Instance[] = []
  const treeBranches: Instance[] = []
  const rings: Instance[] = []
  const flowerCards: Instance[] = []
  const instancedMeshes = new Set<THREE.InstancedMesh>()
  const litWindows: Instance[] = []
  const lampBulbs: Instance[] = []
  const lampLights: THREE.PointLight[] = []
  const lampPositions: THREE.Vector3[] = []
  const lampHalos: THREE.Sprite[] = []
  const signMaterials: THREE.MeshBasicMaterial[] = []

  function keepGeometry<T extends THREE.BufferGeometry>(resource: T): T {
    geometries.add(resource)
    return resource
  }

  function keepMaterial<T extends THREE.Material>(resource: T): T {
    materials.add(resource)
    return resource
  }

  function keepTexture<T extends THREE.Texture>(resource: T): T {
    textures.add(resource)
    return resource
  }

  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const c = (value: THREE.ColorRepresentation) => new THREE.Color(value)
  const noRotation = new THREE.Quaternion()
  const pitch = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2)

  function instance(
    list: Instance[],
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: THREE.ColorRepresentation,
    rotation = noRotation,
  ) {
    list.push({ position: v(x, y, z), scale: v(sx, sy, sz), rotation: rotation.clone(), color: c(color) })
  }

  const box = (
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: THREE.ColorRepresentation,
    rotation = noRotation,
  ) => instance(boxes, x, y, z, sx, sy, sz, color, rotation)

  const sphere = (
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: THREE.ColorRepresentation,
  ) => instance(rounds, x, y, z, sx, sy, sz, color)

  function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: THREE.ColorRepresentation) {
    const delta = b.clone().sub(a)
    const rotation = new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize())
    instance(cylinders, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, radius, delta.length(), radius, color, rotation)
  }

  function branch(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const delta = b.clone().sub(a)
    const rotation = new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize())
    instance(treeBranches, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2,
      radius, delta.length(), radius, '#9b7978', rotation)
  }

  const line = (a: [number, number, number], b: [number, number, number], radius: number, color: THREE.ColorRepresentation) =>
    rod(v(...a), v(...b), radius, color)

  function makeInstanced(
    list: Instance[], geometry: THREE.BufferGeometry, material: THREE.Material,
    name: string, castShadow = false,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length)
    const transform = new THREE.Object3D()
    list.forEach((item, index) => {
      transform.position.copy(item.position)
      transform.scale.copy(item.scale)
      transform.quaternion.copy(item.rotation)
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
      mesh.setColorAt(index, item.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.name = name
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    town.add(mesh)
    instancedMeshes.add(mesh)
    return mesh
  }

  const ground = keepMaterial(toonMaterial())
  const blossom = keepMaterial(toonMaterial({ soft: true }))
  const wood = keepMaterial(toonMaterial())
  const lampMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
  const windowMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.52, toneMapped: false, depthWrite: false }))

  // The walkable spine is continuous; the river is visible on both sides of its bridge.
  box(0, -0.34, -56, 13.4, 0.65, 164, '#566978')
  box(0, -0.02, -56, 12.0, 0.06, 164, '#657480')
  for (const side of [-1, 1]) {
    box(side * SIDEWALK_X, 0.02, -56, 2.7, 0.19, 164, '#cad0c5')
    box(side * 6.15, 0.065, -56, 0.12, 0.035, 163.5, '#e5e3d1')
    box(side * 9.15, -0.11, -56, 0.55, 0.4, 164, '#abb8a9')
    box(side * 28, -0.25, -25.5, 38, 0.55, 103, '#87a895')
    box(side * 28, -0.25, -116, 38, 0.55, 44, '#87a895')
    box(side * 6.35, 0.13, -56, 0.12, 0.12, 164, '#b4b9aa')
  }
  for (let z = 22; z > -84; z -= 6) box(0, 0.04, z, 0.12, 0.014, 2.2, '#d8b35f')
  for (let z = -98; z > -136; z -= 5.8) box(0, 0.04, z, 0.1, 0.014, 1.9, '#d8b35f')
  for (const z of [-31, -49, -74, -104, -123]) {
    for (let x = -5.5; x <= 5.5; x += 0.78) box(x, 0.052, z, 0.49, 0.016, 2.65, '#e4e3d5')
  }
  for (const side of [-1, 1]) {
    box(side * 7.8, 0.13, -86, 0.3, 0.32, 26, '#aab8bb')
    for (let z = -99; z < -73; z += 2.15) {
      box(side * 7.8, 0.72, z, 0.18, 1.1, 0.18, '#e8ddd0')
    }
    box(side * 7.8, 1.24, -86, 0.16, 0.13, 26, '#c3ae9f')
    const railX = side * 7.8
    colliders.push(new THREE.Box3(v(railX - 0.4, 0, -99), v(railX + 0.4, 1.6, -73)))
  }

  const water = new THREE.Mesh(
    keepGeometry(new THREE.PlaneGeometry(160, 24)),
    keepMaterial(toonMaterial({ color: 0x6fa9ba, transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false })),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(0, -0.11, -86)
  town.add(water)
  for (let i = 0; i < 90; i++) {
    const x = -70 + (i * 31.7) % 140
    const z = -97 + (i * 7.37) % 22
    box(x, -0.09, z, 0.6 + (i % 4) * 0.3, 0.008, 0.035, i % 3 ? '#b5d7d4' : '#e3e9d7')
  }
  for (const side of [-1, 1]) {
    box(side * 30, -0.04, -72.6, 42, 0.6, 2.2, '#84a78a')
    box(side * 30, -0.04, -99.4, 42, 0.6, 2.2, '#84a78a')
    for (const z of [-73.6, -98.4]) {
      box(side * 32, -0.12, z, 48, 0.75, 0.55, '#b8beb5')
      box(side * 32, 0.3, z, 48, 0.13, 0.78, '#d4d3c4')
    }
    for (const z of [-72.6, -99.4]) {
      box(side * 7.9, 0.47, z, 0.58, 0.84, 0.58, '#e6ded0')
      box(side * 7.9, 0.95, z, 0.77, 0.17, 0.77, '#b8a893')
    }
    box(side * 7.85, 0.72, -86, 0.08, 0.075, 26, '#d1c5b6')
    for (const z of [-71.2, -100.8]) {
      box(side * 28, 0.055, z, 36, 0.08, 1.45, '#c5cabd')
      for (let x = 10; x < 44; x += 2.2) {
        box(side * x, 0.112, z, 0.045, 0.015, 1.32, '#e0ddd1')
      }
    }
    const benchZ = side < 0 ? -71.0 : -101.2
    box(side * 12.4, 0.52, benchZ, 1.8, 0.12, 0.52, '#b99672')
    box(side * 12.4, 0.74, benchZ - 0.2, 1.8, 0.55, 0.12, '#ad856b')
    for (const edge of [-0.68, 0.68]) box(side * 12.4 + edge, 0.28, benchZ, 0.12, 0.56, 0.43, '#6f7773')
  }

  const buildingColors = ['#e7ddd1', '#d4d9d5', '#edd5cd', '#c5d4ce', '#dad4dc', '#efe5d5']
  const trimColors = ['#677d7a', '#8a776f', '#716d80', '#7b8975']
  const roofColors = ['#596a70', '#77727d', '#655e68', '#637474']
  const shopNames = ['晴天唱片', '七里香花房', '稻香面包', '告白气球', '轨迹书屋', '枫叶咖啡', '蒲公英杂货', '星晴唱片']

  function shopSign(label: string, side: number, x: number, y: number, z: number, width: number, tint: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = 'rgba(255,255,255,.54)'
    ctx.fillRect(11, 9, 490, 3)
    ctx.fillRect(11, 116, 490, 3)
    ctx.fillStyle = '#283d4a'
    ctx.font = 'bold 58px "Noto Sans SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 256, 63)
    const texture = keepTexture(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const material = keepMaterial(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }))
    signMaterials.push(material)
    const mesh = new THREE.Mesh(keepGeometry(new THREE.PlaneGeometry(width, 0.9)), material)
    mesh.rotation.y = -side * Math.PI / 2
    mesh.position.set(x, y, z)
    town.add(mesh)
  }

  function building(spot: ShopSpot) {
    const { side, z, index, width, height, depth, x, towardStreet, record } = spot
    const wall = buildingColors[index % buildingColors.length]
    const trim = trimColors[index % trimColors.length]
    const roof = roofColors[index % roofColors.length]
    box(x, height / 2, z, depth, height, width, wall)
    box(x, height + 0.11, z, depth + 0.45, 0.22, width + 0.55, '#e0d9cd')
    for (const slope of [-1, 1]) {
      const roofRotation = new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), -slope * 0.29)
      box(x + slope * depth * 0.26, height + 0.57, z, depth * 0.58, 0.19, width + 0.78, roof, roofRotation)
      for (let rib = -3; rib <= 3; rib++) {
        box(x + slope * depth * 0.26, height + 0.69, z + rib * width * 0.13,
          depth * 0.57, 0.035, 0.045, '#b5b5ad', roofRotation)
      }
    }
    box(x, height + 0.99, z, 0.25, 0.19, width + 0.9, '#4c5962')
    box(x, height - 0.18, z - width * 0.47, depth + 0.1, 0.08, 0.09, '#e9e5da')
    box(x, height - 0.18, z + width * 0.47, depth + 0.1, 0.08, 0.09, '#e9e5da')
    box(towardStreet - side * 0.07, 1.34, z, 0.18, 2.3, width - 0.5, '#526c70')
    box(towardStreet - side * 0.18, 1.25, z, 0.04, 1.85, width - 0.8, '#84a8ae')
    for (let pane = -2; pane <= 2; pane++) {
      const pz = z + pane * width * 0.15
      box(towardStreet - side * 0.23, 1.35, pz, 0.055, 1.95, 0.075, '#d5d9cf')
      box(towardStreet - side * 0.26, 1.75, pz + width * 0.045, 0.025, 0.75, 0.08, '#cce0dd',
        new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), -0.34))
    }
    box(towardStreet - side * 0.24, 0.84, z + width * 0.23, 0.07, 1.62, 1.05, '#577982')
    box(towardStreet - side * 0.3, 1.25, z + width * 0.23, 0.03, 0.72, 0.72, '#93b6bb')
    sphere(towardStreet - side * 0.34, 0.85, z + width * 0.1, 0.045, 0.045, 0.045, '#e7d4a8')
    box(towardStreet - side * 0.29, 2.25, z, 0.06, 0.07, width - 0.65, '#e6e6dc')
    box(towardStreet - side * 0.22, 1.23, z + width * 0.23, 0.05, 1.87, 0.12, '#e8dbcb')
    box(towardStreet - side * 0.22, 1.23, z - width * 0.23, 0.05, 1.87, 0.12, '#e8dbcb')
    for (const shift of [-1, 1]) {
      box(towardStreet - side * 0.06, height - 2.1, z + shift * width * 0.25, 0.12, 1.55, 1.3, trim)
      box(towardStreet - side * 0.135, height - 2.1, z + shift * width * 0.25, 0.04, 1.33, 1.08, '#7695a0')
      instance(litWindows, towardStreet - side * 0.155, height - 2.1, z + shift * width * 0.25, 0.035, 1.28, 1.05, index % 2 ? '#f5c98d' : '#f4d8ab')
      box(towardStreet - side * 0.19, height - 2.1, z + shift * width * 0.25, 0.045, 1.32, 0.055, '#eff0e7')
      box(towardStreet - side * 0.19, height - 2.1, z + shift * width * 0.25, 0.045, 0.055, 1.07, '#eff0e7')
      box(towardStreet - side * 0.2, height - 2.13, z + shift * width * 0.25 + 0.18, 0.02, 1.01, 0.12,
        '#d4e8e5', new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), -0.33))
    }
    for (const edge of [-1, 1]) {
      box(towardStreet - side * 0.14, height * 0.48, z + edge * (width / 2 - 0.13), 0.24, height * 0.96, 0.22, trim)
      box(towardStreet + side * 0.12, height * 0.48, z + edge * (width / 2 - 0.28), 0.08, height * 0.96, 0.08, '#e2e1d6')
    }
    // A striped fabric awning faces the road, with the scallop visible at pedestrian height.
    box(towardStreet - side * 0.78, 2.94, z, 1.6, 0.12, width - 0.2, record ? '#2a4558' : index % 2 ? '#d9e0d1' : '#eccbc1')
    for (let j = 0; j < 8; j++) {
      box(towardStreet - side * 0.83, 3.0, z - width * 0.43 + j * (width * 0.86 / 7), 1.62, 0.035, width * 0.085, j % 2 ? '#f6ecde' : trim)
    }
    shopSign(record ? '晴天唱片' : shopNames[index % shopNames.length], side, towardStreet - side * 0.22, 3.71, z, Math.min(width - 0.8, 5.1), record ? '#1d3a44' : index % 2 ? '#e8c9aa' : '#c9d9cf')
    if (record) {
      const bladeX = towardStreet - side * 1.55
      const bladeZ = z + width * 0.42
      box(bladeX, 3.35, bladeZ, 1.85, 1.55, 0.1, '#16343c')
      box(bladeX, 3.35, bladeZ, 1.62, 1.28, 0.04, '#f4e7d4')
      box(towardStreet - side * 0.7, 3.35, bladeZ, 0.9, 0.08, 0.08, '#16343c')
    }
    // A small projecting sign reads clearly when approaching along the street.
    box(towardStreet - side * 0.67, 4.4, z + width * 0.42, 0.76, 0.76, 0.08, '#ece4d6')
    box(towardStreet - side * 0.74, 4.4, z + width * 0.42, 0.7, 0.7, 0.02, '#dba7a5')
    colliders.push(new THREE.Box3(v(x - depth / 2, 0, z - width / 2), v(x + depth / 2, height + 0.7, z + width / 2)))
    if (index % 3 === 0) {
      // Plants and the shop's wooden crate soften the ground-floor facade.
      for (const shift of [-1, 1]) {
        const pz = z + shift * (width / 2 - 0.65)
        box(towardStreet - side * 0.53, 0.34, pz, 0.65, 0.58, 0.65, '#a77e65')
        sphere(towardStreet - side * 0.53, 0.9, pz, 0.46, 0.5, 0.46, '#6f9984')
      }
    }
    if (index % 4 === 1) {
      box(towardStreet - side * 0.78, 0.42, z + width * 0.39, 0.9, 0.7, 0.8, '#b08c75')
      box(towardStreet - side * 0.82, 0.82, z + width * 0.39, 1.0, 0.08, 0.9, '#e9d4b6')
    }
  }

  eachShop(building)

  // The far bank continues as a quieter residential street beyond the bridge.
  for (const side of [-1, 1]) {
    for (const [index, z] of [-101, -110, -119, -128].entries()) {
      const width = 5.8 + (index % 2) * 1.1
      const depth = 5.0 + (index % 3) * 0.6
      const height = 4.5 + ((index + (side + 1) / 2) % 3) * 0.8
      // Bring the far-bank façades closer to the eight-metre road so they
      // remain readable from the approach and fifth stop.
      const x = side * (14.4 + (index % 2) * 0.7)
      const front = x - side * (depth / 2 + 0.05)
      const wall = buildingColors[(index + 2 + (side + 1) / 2) % buildingColors.length]
      const roof = roofColors[(index + 1) % roofColors.length]
      box(x, height / 2, z, depth, height, width, wall)
      for (const slope of [-1, 1]) {
        box(x + slope * depth * 0.25, height + 0.38, z, depth * 0.59, 0.16, width + 0.65,
          roof, new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), -slope * 0.27))
      }
      box(x, height + 0.77, z, 0.18, 0.15, width + 0.73, '#626b70')
      box(front - side * 0.08, 1.3, z, 0.11, 2.3, width - 0.5, '#617f86')
      for (const offset of [-0.26, 0.26]) {
        const wz = z + width * offset
        box(front - side * 0.17, height - 1.45, wz, 0.07, 1.3, 1.1, '#8dafb2')
        box(front - side * 0.21, height - 1.45, wz, 0.04, 0.07, 1.13, '#e4e7dc')
      }
      box(front - side * 0.45, 2.67, z, 0.93, 0.1, width - 0.4, index % 2 ? '#b2c4aa' : '#cfb7aa')
    }
  }
  const farBankSigns = ['青い春書店', '夜風茶屋', '春灯り商店', '河岸写真館']
  for (const side of [-1, 1]) {
    for (const [index, z] of [-101, -110, -119, -128].entries()) {
      const x = side * (12.55 + (index % 2) * 0.45)
      // Narrow hanging signs and fabric awnings make the far-bank façades
      // legible at street level instead of leaving them as blank blocks.
      shopSign(farBankSigns[(index + (side < 0 ? 0 : 2)) % farBankSigns.length], side,
        x - side * 0.06, 3.36 + (index % 2) * 0.18, z, 4.15,
        index % 2 ? '#d9c8b4' : '#bcd2cc')
      box(x - side * 0.45, 2.72, z, 1.02, 0.1, 4.5, index % 2 ? '#e5c1b6' : '#cad5c6')
      box(x - side * 0.57, 2.4, z + 1.9, 0.08, 0.62, 0.08, '#a37969')
      box(x - side * 0.57, 2.4, z + 1.9, 0.36, 0.06, 0.36, '#d8b27e')
    }
  }
  // A small river-lane gate gives the long road a destination landmark.
  box(-4.65, 2.05, -133.6, 0.32, 4.1, 0.34, '#6f5a59')
  box(4.65, 2.05, -133.6, 0.32, 4.1, 0.34, '#6f5a59')
  box(0, 4.05, -133.6, 9.65, 0.34, 0.34, '#6f5a59')
  const gateCanvas = document.createElement('canvas')
  gateCanvas.width = 1024; gateCanvas.height = 180
  const gateCtx = gateCanvas.getContext('2d')!
  gateCtx.fillStyle = '#ead7c2'; gateCtx.fillRect(0, 0, 1024, 180)
  gateCtx.strokeStyle = '#9a7774'; gateCtx.lineWidth = 9; gateCtx.strokeRect(12, 12, 1000, 156)
  gateCtx.fillStyle = '#4a5960'; gateCtx.font = 'bold 92px "Microsoft YaHei", sans-serif'
  gateCtx.textAlign = 'center'; gateCtx.textBaseline = 'middle'; gateCtx.fillText('河岸春町  RIVERSIDE', 512, 96)
  const gateTexture = keepTexture(new THREE.CanvasTexture(gateCanvas)); gateTexture.colorSpace = THREE.SRGBColorSpace
  const gateMaterial = keepMaterial(new THREE.MeshBasicMaterial({ map: gateTexture, side: THREE.DoubleSide, toneMapped: false }))
  const gate = new THREE.Mesh(keepGeometry(new THREE.PlaneGeometry(8.8, 1.45)), gateMaterial)
  gate.position.set(0, 4.25, -133.38); town.add(gate)
  box(0, -0.02, -135.5, 76, 0.06, 7.5, '#63747b')
  for (const side of [-1, 1]) {
    box(side * 18, 0.12, -133.3, 23, 0.24, 0.75, '#b4c3b7')
    for (let i = 0; i < 5; i++) {
      const x = side * (17 + i * 4.4)
      box(x, 0.54, -139.5 + i % 2, 0.12, 1.04, 0.12, '#8d897c')
      sphere(x, 1.58, -139.5 + i % 2, 1.35, 1.4, 1.16,
        i % 2 ? '#77968a' : '#94b0a1')
      sphere(x + side * 0.73, 1.35, -139.5 + i % 2, 0.82, 0.88, 0.78, '#a9bca9')
    }
  }

  // The station and record shop identify the middle stops from the road.
  box(-12.7, 2.6, -59.6, 7.4, 5.2, 11.5, '#d9d7cb')
  for (const slope of [-1, 1]) {
    const roofRotation = new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), -slope * 0.26)
    box(-12.7 + slope * 1.95, 5.62, -59.6, 4.35, 0.21, 12.65, '#657779', roofRotation)
    for (let rib = -5; rib <= 5; rib++) {
      box(-12.7 + slope * 1.95, 5.74, -59.6 + rib * 1.0, 4.3, 0.04, 0.04, '#c3c5bb', roofRotation)
    }
  }
  box(-12.7, 6.15, -59.6, 0.25, 0.18, 12.75, '#52656b')
  box(-8.82, 3.4, -59.6, 0.18, 1.5, 9.9, '#3c586a')
  box(-8.69, 1.4, -59.6, 0.08, 2.5, 9.85, '#8eaeb3')
  for (let z = -64; z < -55; z += 1.42) {
    box(-8.6, 1.42, z, 0.065, 2.55, 0.075, '#e2e5dc')
    box(-8.57, 2.0, z + 0.28, 0.02, 0.8, 0.12, '#c9e0e1',
      new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), -0.25))
  }
  for (const z of [-63.5, -55.7]) {
    box(-8.55, 2.77, z, 1.9, 0.17, 0.18, '#ece4d5')
    box(-7.9, 1.32, z, 0.2, 2.68, 0.2, '#596d70')
  }
  box(-8.6, 0.53, -59.6, 0.52, 0.14, 3.7, '#bd9c7c')
  box(-8.6, 0.13, -59.6, 1.3, 0.18, 4.2, '#c9b9a3')
  shopSign('樱町站', -1, -8.68, 4.47, -59.6, 5.6, '#edddc6')
  colliders.push(new THREE.Box3(v(-16.4, 0, -65.4), v(-9, 5.8, -53.8)))
  box(-15, 0.34, -50.6, 11, 0.38, 3.4, '#e7e2d6')
  for (let x = -19.2; x <= -10.8; x += 2.8) box(x, 2.35, -50.6, 0.16, 4.05, 0.16, '#5c6a70')
  box(-15, 4.45, -50.6, 12.2, 0.14, 4.6, '#f6f1e8')
  box(-15, 4.18, -49.0, 12.2, 0.22, 0.14, '#c4514a')
  shopSign('站台', -1, -10.15, 3.15, -50.6, 3.8, '#f3e6d2')
  colliders.push(new THREE.Box3(v(-20.6, 0, -52.4), v(-9.4, 4.6, -48.8)))

  // Plaza crossing: the side road sits above the long sidewalk so the junction stays open.
  for (const side of [-1, 1]) {
    box(side * 20, 0.16, -31.5, 26, 0.08, 8.6, '#657480')
    box(side * 20, 0.2, -31.5 - 5.1, 26, 0.1, 1.8, '#cad0c5')
    box(side * 20, 0.2, -31.5 + 5.1, 26, 0.1, 1.8, '#cad0c5')
    for (let x = 8.2; x <= 16; x += 0.72) box(side * x, 0.22, -31.5, 0.28, 0.02, 6.4, '#e7e4d8')
  }
  box(0, 0.08, -31.5, 22, 0.16, 20, '#c8c8b9')
  for (let x = -9; x <= 9; x += 1.3) box(x, 0.175, -31.5, 0.055, 0.012, 18, '#dddbcc')
  box(-11.2, 0.35, -26.4, 3.2, 0.4, 3.2, '#a6c2bd')
  sphere(-11.2, 0.56, -26.4, 1.35, 0.28, 1.35, '#95bbbd')
  box(-11.2, 0.76, -26.4, 0.22, 0.32, 0.22, '#d7e4db')
  colliders.push(new THREE.Box3(v(-12.9, 0, -28.1), v(-9.5, 1.05, -24.7)))
  for (const side of [-1, 1]) {
    for (const z of [-38.5, -24.5]) {
      box(side * 14.5, 0.5, z, 0.28, 0.55, 1.9, '#a8816b')
      box(side * 14.5, 0.82, z, 0.36, 0.12, 2.1, '#c89c76')
    }
  }

  // Station approach: a short cross street in front of the platform.
  for (const side of [-1, 1]) {
    box(side * 18, 0.16, -47, 22, 0.08, 7.4, '#657480')
    box(side * 18, 0.2, -47 - 4.4, 22, 0.1, 1.5, '#cad0c5')
    box(side * 18, 0.2, -47 + 4.4, 22, 0.1, 1.5, '#cad0c5')
    for (let x = 8; x <= 14.5; x += 0.72) box(side * x, 0.22, -47, 0.26, 0.02, 5.4, '#e7e4d8')
  }

  function cottage(x: number, z: number) {
    const wall = x > 0 ? '#efe4d6' : '#e7ddd4'
    const roof = x > 0 ? '#6a5968' : '#5d6a72'
    box(x, 2.35, z, 6.4, 4.7, 5.6, wall)
    for (const slope of [-1, 1]) {
      box(x + slope * 1.7, 5.05, z, 3.5, 0.22, 6.2, roof, new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), -slope * 0.32))
    }
    box(x, 5.55, z, 0.22, 0.2, 6.3, '#4e5960')
    box(x, 1.5, z, 0.12, 2.2, 2.4, '#6d8b92')
    colliders.push(new THREE.Box3(v(x - 3.3, 0, z - 2.9), v(x + 3.3, 5.6, z + 2.9)))
  }
  cottage(27.2, -31.5)
  cottage(-27.2, -31.5)
  cottage(23.5, -47)
  cottage(-23.5, -47)
  for (const [x, z] of [[27.2, -31.5], [-27.2, -31.5], [23.5, -47], [-23.5, -47]] as const) {
    box(x, 0.42, z + 3.3, 4.2, 0.55, 0.16, '#d9d4c6')
    box(x - 1.8, 0.7, z + 3.3, 0.12, 1.15, 0.12, '#8d7b68')
    box(x + 1.8, 0.7, z + 3.3, 0.12, 1.15, 0.12, '#8d7b68')
  }

  // Street-mouth torii. The posts sit on the sidewalk so the road stays open.
  const toriiZ = 16.2
  const toriiSpan = 7.55
  const toriiH = 6.35
  for (const side of [-1, 1]) {
    box(side * toriiSpan, toriiH * 0.46, toriiZ, 0.42, toriiH, 0.42, '#c23a32')
    box(side * toriiSpan, 0.28, toriiZ, 0.62, 0.16, 0.62, '#2a2424')
    colliders.push(new THREE.Box3(
      v(side * toriiSpan - 0.4, 0, toriiZ - 0.4),
      v(side * toriiSpan + 0.4, toriiH, toriiZ + 0.4),
    ))
  }
  box(0, toriiH * 0.93, toriiZ, toriiSpan * 2 + 1.8, 0.22, 0.7, '#2a2424')
  box(0, toriiH * 0.82, toriiZ, toriiSpan * 2 + 0.5, 0.16, 0.52, '#c23a32')
  box(0, toriiH * 0.6, toriiZ, toriiSpan * 2 - 0.7, 0.12, 0.28, '#c23a32')

  for (const side of [-1, 1]) {
    for (const z of [8, -12, -18]) {
      box(side * 11.35, 0.48, z, 0.08, 0.72, 3.4, '#e4dfd4')
      box(side * 11.35, 0.86, z - 1.6, 0.12, 1.5, 0.12, '#8d7b68')
      box(side * 11.35, 0.86, z + 1.6, 0.12, 1.5, 0.12, '#8d7b68')
    }
  }

  const flowerShades = ['#fff0f4', '#f9d7e4', '#f6bfd4', '#ffe2eb', '#edb2ce', '#f9c9d9']
  const hash = (value: number) => {
    const result = Math.sin(value * 127.1) * 43758.5453
    return result - Math.floor(result)
  }

  function flowerCloud(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number,
    seed: number, count: number, size: number) {
    for (let i = 0; i < count * 3; i++) {
      const key = seed * 97 + i * 17
      const longitude = hash(key + 1) * Math.PI * 2
      const latitude = (hash(key + 2) * 2 - 1) * 0.9
      const radial = 0.25 + hash(key + 3) * 0.73
      const ring = Math.sqrt(1 - latitude * latitude)
      const px = cx + Math.cos(longitude) * ring * rx * radial
      const py = cy + latitude * ry * radial
      const pz = cz + Math.sin(longitude) * ring * rz * radial
      const yaw = (hash(key + 5) - 0.5) * Math.PI * 1.35
      const tilt = (hash(key + 4) - 0.5) * Math.PI * 0.95
      const roll = hash(key + 6) * Math.PI * 2
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        tilt, yaw, roll,
      ))
      const cardSize = Math.min(0.56, (0.28 + hash(key + 7) * 0.17) * size)
      const shade = flowerShades[(seed + i) % flowerShades.length]
      instance(flowerCards, px, py, pz, cardSize, cardSize * (0.85 + hash(key + 8) * 0.22), 1, shade, rotation)
      const crossed = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * 0.75, yaw + Math.PI / 2, roll + 0.34))
      instance(flowerCards, px, py, pz, cardSize * 0.88, cardSize, 1, shade, crossed)
    }
  }

  function sakuraTree(x: number, z: number, size: number, seed: number) {
    const height = (3.1 + hash(seed * 19 + 2) * 0.85) * size
    const bendX = (hash(seed * 13 + 1) - 0.5) * 0.54 * size
    const bendZ = (hash(seed * 17 + 5) - 0.5) * 0.45 * size
    const spreadX = 0.82 + hash(seed * 29 + 3) * 0.38
    const spreadZ = 0.83 + hash(seed * 31 + 7) * 0.34
    const lower = v(x + bendX * 0.28, height * 0.38, z + bendZ * 0.28)
    const upper = v(x + bendX * 0.81, height * 0.79, z + bendZ * 0.72)
    const crown = v(x + bendX, height, z + bendZ)
    branch(v(x, 0.08, z), lower, 0.23 * size)
    branch(lower, upper, 0.17 * size)
    branch(upper, crown, 0.105 * size)
    const armCount = 4 + seed % 3
    for (let arm = 0; arm < armCount; arm++) {
      const angle = arm * 2.399 + seed * 0.47 + (hash(seed * 43 + arm) - 0.5) * 0.6
      const direction = v(Math.cos(angle), 0, Math.sin(angle))
      const length = (1.13 + hash(seed * 47 + arm * 3) * 0.68) * size
      const stem = v(x + bendX * 0.63, height * (0.56 + arm * 0.047), z + bendZ * 0.55)
      const elbow = v(stem.x + direction.x * length * 0.46 * spreadX,
        stem.y + (0.13 + hash(seed * 53 + arm) * 0.27) * size,
        stem.z + direction.z * length * 0.39 * spreadZ)
      const fork = v(crown.x + direction.x * length * spreadX,
        height + (hash(seed * 59 + arm) - 0.35) * 0.73 * size,
        crown.z + direction.z * length * spreadZ)
      branch(stem, elbow, 0.11 * size)
      branch(elbow, fork, 0.074 * size)
      for (const turn of [-1, 1]) {
        const sideReach = (0.21 + hash(seed * 67 + arm * 3 + turn) * 0.36) * size
        const end = v(fork.x + direction.x * 0.44 * size + turn * direction.z * sideReach,
          fork.y + (0.16 + hash(seed * 71 + arm * 7 + turn) * 0.47) * size,
          fork.z + direction.z * 0.44 * size - turn * direction.x * sideReach)
        branch(fork, end, 0.046 * size)
        const tip = v(end.x + (direction.x + turn * direction.z * 0.3) * 0.28 * size,
          end.y + (0.1 + hash(seed * 73 + arm * 9 + turn) * 0.18) * size,
          end.z + (direction.z - turn * direction.x * 0.3) * 0.28 * size)
        branch(end, tip, 0.024 * size)
      }
      flowerCloud(fork.x, fork.y + 0.34 * size, fork.z,
        1.24 * size * spreadX, 0.94 * size, 1.13 * size * spreadZ,
        seed + arm, 14, size)
      flowerCloud(fork.x + direction.x * 0.58 * size, fork.y + 0.22 * size,
        fork.z + direction.z * 0.54 * size,
        0.77 * size * spreadX, 0.62 * size, 0.75 * size * spreadZ,
        seed + arm + 8, 7, size)
    }
    flowerCloud(crown.x, height + 1.05 * size, crown.z,
      1.9 * size * spreadX, 1.16 * size, 1.73 * size * spreadZ,
      seed + 16, 28, size)
    flowerCloud(crown.x - 0.44 * size, height + 1.62 * size, crown.z - 0.24 * size,
      1.18 * size * spreadX, 0.74 * size, 1.15 * size * spreadZ, seed + 24, 16, size)
    if (seed % 3 === 0 && Math.abs(x) < 7) {
      const innerX = x - Math.sign(x) * 3.5 * size
      const arch = v(innerX, height + 0.46 * size, z - 0.45 * size)
      branch(v(x + bendX * 0.7, height * 0.7, z + bendZ * 0.6), arch, 0.09 * size)
      branch(arch, v(arch.x - Math.sign(x) * 0.54 * size, arch.y + 0.3 * size, arch.z - 0.24 * size), 0.042 * size)
      flowerCloud(innerX, height + 0.78 * size, z - 0.45 * size,
        1.7 * size, 0.82 * size, 1.48 * size, seed + 29, 18, size)
    }
    colliders.push(new THREE.Box3(v(x - 0.25 * size, 0, z - 0.25 * size), v(x + 0.25 * size, 3.4 * size, z + 0.25 * size)))
  }

  let treeIndex = 0
  for (const side of [-1, 1]) {
    for (let z = side === -1 ? 21 : 17.5, row = 0; z > -77;
      row++, z -= 6.9 + hash(row * 23 + side * 7 + 8) * 1.7) {
      if (z < -48 && z > -60) continue
      if (side === -1 && z > 18) continue // foreground cherry tree replaces this regular tree
      if (side === -1 && z > 6 && z < 12) continue // bus stop
      const irregular = hash(treeIndex * 37 + 5) - 0.5
      sakuraTree(side * (TREE_X + irregular * 0.45), z + irregular * 1.9,
        0.77 + hash(treeIndex * 19 + 2) * 0.29, treeIndex++)
    }
    for (const [i, z] of [-80, -84, -90, -94].entries()) {
      sakuraTree(side * (8.8 + (i % 2) * 4.3), z, 1.02 + i * 0.04, treeIndex++)
    }
  }
  // A second, quieter cherry-lined lane keeps the far bank from reading as
  // an empty backdrop when the player reaches the fifth stop.
  for (const side of [-1, 1]) {
    let row = 0
    for (let z = -99; z > -136; z -= 7.4 + hash(row * 31 + side * 5) * 1.1) {
      const wobble = (hash(row * 41 + side * 11) - 0.5) * 0.65
      sakuraTree(side * (TREE_X + wobble * 0.35), z, 0.78 + hash(row * 19 + side * 17) * 0.2, treeIndex++)
      row++
    }
  }
  sakuraTree(-6.4, 20.4, 1.45, 57)
  sakuraTree(1.15, -31.5, 2.45, 880)
  sakuraTree(-6.16, -107.3, 0.64, 104)
  sakuraTree(6.08, -118.5, 0.67, 109)
  for (const [i, [x, z]] of [[-11, -24], [11, -24], [-11, -39], [11, -39]].entries()) {
    sakuraTree(x, z, 1.23, i + 42)
  }

  // Streetlights and utility lines provide the town's strong street perspective.
  for (const side of [-1, 1]) {
    const poles: number[] = []
    // Continue the utility rhythm over the bridge and into the far-bank
    // neighborhood so the world reads as one connected Japanese street.
    for (let z = 21; z > -136; z -= 17.5) {
      poles.push(z)
      const x = side * POLE_X
      line([x, 0.1, z], [x, 7.65, z], 0.095, '#55616c')
      line([x, 7.4, z], [x - side * 1.8, 7.4, z], 0.065, '#55616c')
      line([x, 5.95, z - 0.54], [x, 5.95, z + 0.54], 0.055, '#6d747a')
      line([x, 6.42, z - 0.64], [x, 6.42, z + 0.64], 0.045, '#6d747a')
      box(x - side * 1.73, 7.31, z, 0.44, 0.16, 0.72, '#d7dfd4')
      instance(lampBulbs, x - side * 1.73, 7.21, z, 0.22, 0.09, 0.35, '#f3cf92')
      const lampPosition = v(x - side * 1.73, 7.13, z)
      lampPositions.push(lampPosition)
      if ((poles.length - 1) % 3 === 0) {
        const light = new THREE.PointLight(0xffd9a3, 0, 12, 2)
        light.position.copy(lampPosition)
        light.visible = false
        town.add(light)
        lampLights.push(light)
      }
      for (const offset of [-0.42, 0.42]) box(x, 0.52, z + offset, 0.22, 0.75, 0.12, '#e4c06c')
    }
    for (let p = 0; p < poles.length - 1; p++) {
      for (const height of [5.95, 6.42]) {
        const start = poles[p]
        const end = poles[p + 1]
        for (const offset of [-0.48, 0.48]) {
          let prev = v(side * POLE_X, height, start + offset)
          for (let segment = 1; segment <= 5; segment++) {
            const t = segment / 5
            const next = v(side * POLE_X, height - Math.sin(t * Math.PI) * 0.74, THREE.MathUtils.lerp(start, end, t) + offset)
            rod(prev, next, 0.012, '#404b55')
            prev = next
          }
        }
      }
    }
  }
  for (const z of [19, -16, -68, -116]) {
    for (const offset of [-0.5, 0.4]) {
      let prev = v(-POLE_X, 6.4, z + offset)
      for (let segment = 1; segment <= 8; segment++) {
        const t = segment / 8
        const next = v(THREE.MathUtils.lerp(-POLE_X, POLE_X, t), 6.4 - Math.sin(t * Math.PI) * 1.1, z + offset)
        rod(prev, next, 0.012, '#404b55')
        prev = next
      }
    }
  }

  // Railway crossing. A train moves only on its own track, behind the barrier.
  for (const z of [-54.9, -52.8]) {
    box(0, 0.13, z, 82, 0.11, 0.12, '#595a5c')
    for (let x = -39; x <= 39; x += 1.4) box(x, 0.04, z + (z === -54.9 ? 1 : -1) * 1.05, 0.24, 0.1, 3.3, '#746a61')
  }
  for (const side of [-1, 1]) {
    const x = side * 8.15
    for (const z of [-56.1, -51.4]) {
      line([x, 0.1, z], [x, 3.4, z], 0.1, '#505865')
      box(x, 3.1, z, 0.72, 0.65, 0.28, '#3f4853')
      sphere(x - side * 0.11, 3.14, z + 0.19, 0.14, 0.14, 0.08, '#e95852')
      sphere(x + side * 0.11, 3.14, z + 0.19, 0.14, 0.14, 0.08, '#f3d36b')
      line([x, 2.2, z], [x - side * 6.4, 2.2, z], 0.07, '#eee6d5')
      for (let offset = 0.5; offset <= 6.2; offset += 0.7) {
        box(x - side * offset, 2.2, z, 0.21, 0.19, 0.21, '#d96b60')
      }
    }
  }
  const train = new THREE.Group()
  town.add(train)
  const trainBody = keepMaterial(toonMaterial({ color: 0xf4e9dc }))
  const trainTrim = keepMaterial(toonMaterial({ color: 0xb68683 }))
  const trainGlass = keepMaterial(toonMaterial({ color: 0x77909b }))
  const trainBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(boxGeometry, mat)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    train.add(mesh)
  }
  for (const carriage of [-1, 1]) {
    const cx = carriage * 5.8
    trainBox(cx, 1.53, -53.87, 10.9, 2.62, 2.3, trainBody)
    trainBox(cx, 1.48, -52.65, 10.8, 0.24, 0.1, trainTrim)
    trainBox(cx, 2.73, -53.87, 10.9, 0.22, 2.42, trainTrim)
    for (let i = -4; i <= 4; i += 1.18) {
      trainBox(cx + i, 1.88, -52.68, 0.82, 0.76, 0.045, trainGlass)
      trainBox(cx + i, 1.88, -55.06, 0.82, 0.76, 0.045, trainGlass)
    }
    for (const wx of [-3.5, 3.5]) {
      trainBox(cx + wx, 0.31, -53.87, 1.05, 0.43, 0.25, trainTrim)
    }
  }

  // A parked neighborhood bus and bicycles make the street feel inhabited.
  box(-8.7, 1.45, 8.9, 2.2, 2.7, 4.8, '#c8c6d9')
  box(-8.7, 2.3, 8.9, 2.23, 0.92, 4.25, '#8aa5ad')
  box(-7.55, 2.26, 8.9, 0.04, 0.95, 3.75, '#b5d0d2')
  box(-8.7, 0.54, 8.9, 2.24, 0.12, 4.8, '#817f92')
  for (const wheelZ of [7.25, 10.55]) {
    instance(rings, -7.55, 0.45, wheelZ, 0.65, 0.65, 0.65, '#46515a', pitch)
    instance(rings, -9.84, 0.45, wheelZ, 0.65, 0.65, 0.65, '#46515a', pitch)
  }
  colliders.push(new THREE.Box3(v(-9.85, 0, 6.5), v(-7.55, 2.9, 11.3)))

  function bicycle(x: number, z: number, shade: string) {
    for (const wheelZ of [z - 0.48, z + 0.48]) instance(rings, x, 0.45, wheelZ, 0.8, 0.8, 0.8, '#384d56', pitch)
    line([x, 0.46, z - 0.48], [x, 1.02, z - 0.05], 0.034, shade)
    line([x, 1.02, z - 0.05], [x, 0.46, z + 0.48], 0.034, shade)
    line([x, 0.46, z + 0.48], [x, 0.46, z - 0.48], 0.034, shade)
    line([x, 0.46, z + 0.48], [x, 1.23, z + 0.39], 0.034, shade)
    line([x - 0.2, 1.23, z + 0.39], [x + 0.2, 1.23, z + 0.39], 0.035, '#35434a')
    box(x, 1.12, z - 0.08, 0.33, 0.08, 0.15, '#454a4b')
  }
  function pedestrian(x: number, z: number, coat: string, facing = 0) {
    // Small silhouettes give the street a human scale without adding a
    // skeletal animation system or blocking the walkable road.
    const body = 0.26
    box(x, 0.92, z, body, 0.74, body * 0.72, coat,
      new THREE.Quaternion().setFromAxisAngle(UP, facing))
    sphere(x, 1.52, z, 0.18, 0.2, 0.18, '#e8b997')
    box(x, 0.39, z - 0.08, 0.12, 0.44, 0.12, '#3d4f5b')
    box(x, 0.39, z + 0.08, 0.12, 0.44, 0.12, '#3d4f5b')
  }
  function parkedCar(x: number, z: number, bodyColor: string) {
    box(x, 0.64, z, 1.42, 0.48, 3.18, bodyColor)
    box(x, 0.99, z - 0.05, 1.16, 0.34, 1.42, '#7f9ca4')
    box(x, 0.98, z + 0.08, 1.2, 0.05, 1.5, '#d6e3df')
    for (const wheelZ of [z - 1.05, z + 1.05]) {
      instance(rings, x - 0.75, 0.42, wheelZ, 0.31, 0.31, 0.31, '#27363f', pitch)
      instance(rings, x + 0.75, 0.42, wheelZ, 0.31, 0.31, 0.31, '#27363f', pitch)
    }
  }
  bicycle(8.7, 12.4, '#b76372')
  bicycle(-8.75, -12.8, '#729594')
  bicycle(8.7, -42, '#c18d60')
  bicycle(-8.75, -103.8, '#ad6b74')
  bicycle(8.7, -117.2, '#738b9e')
  pedestrian(-7.3, -101.8, '#bf7d83', Math.PI)
  pedestrian(7.35, -108.2, '#6a8791', 0)
  pedestrian(-7.3, -116.2, '#d2a36e', Math.PI)
  pedestrian(7.35, -127.1, '#7b7899', 0)
  parkedCar(-9.4, -110.8, '#bf837c')
  parkedCar(9.4, -130.2, '#7c9a98')

  // Ridge silhouettes ring the district. They stay outside the walk and out of the shadow map.
  const treeGeometry = keepGeometry(new THREE.SphereGeometry(1, 6, 5))
  function ridgeMesh(seed: number, width: number, height: number, cool: number) {
    const shape = new THREE.Shape()
    shape.moveTo(-width, 0)
    const steps = 14
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = -width + t * width * 2
      const envelope = Math.sin(t * Math.PI)
      const jag = 0.42 + hash(seed * 3 + i * 1.9) * 0.7
      const y = Math.max(1.2, envelope * height * jag + Math.sin(t * 11 + seed) * height * 0.08)
      shape.lineTo(x, y)
    }
    shape.lineTo(width, 0)
    shape.closePath()
    const color = new THREE.Color('#6d8f84').lerp(new THREE.Color('#d0deea'), cool)
    const mesh = new THREE.Mesh(
      keepGeometry(new THREE.ShapeGeometry(shape)),
      keepMaterial(new THREE.MeshBasicMaterial({ color, fog: true, toneMapped: false, side: THREE.DoubleSide })),
    )
    mesh.castShadow = false
    mesh.receiveShadow = false
    return mesh
  }
  const ridges: { x: number; z: number; width: number; height: number; yaw: number; cool: number; seed: number }[] = [
    { x: 0, z: -168, width: 78, height: 34, yaw: 0, cool: 0.78, seed: 2 },
    { x: -36, z: -156, width: 42, height: 22, yaw: 0.08, cool: 0.48, seed: 5 },
    { x: 40, z: -154, width: 46, height: 24, yaw: -0.06, cool: 0.5, seed: 8 },
    { x: -8, z: 58, width: 54, height: 20, yaw: Math.PI, cool: 0.62, seed: 11 },
  ]
  for (let i = 0; i < 5; i++) {
    const z = 8 - i * 32
    ridges.push({ x: 84, z, width: 28, height: 16 + hash(i * 4) * 10, yaw: Math.PI / 2, cool: 0.22 + i * 0.08, seed: 20 + i })
    ridges.push({ x: -84, z, width: 28, height: 15 + hash(i * 6) * 11, yaw: -Math.PI / 2, cool: 0.22 + i * 0.08, seed: 40 + i })
  }
  for (const ridge of ridges) {
    const mesh = ridgeMesh(ridge.seed, ridge.width, ridge.height, ridge.cool)
    mesh.position.set(ridge.x, 0, ridge.z)
    mesh.rotation.y = ridge.yaw
    town.add(mesh)
    for (let clump = 0; clump < 5; clump++) {
      const along = (clump - 2) * ridge.width * 0.28
      const crown = new THREE.Mesh(
        treeGeometry,
        keepMaterial(new THREE.MeshBasicMaterial({
          color: new THREE.Color(clump % 2 ? '#7f9d86' : '#8f7f96').lerp(new THREE.Color('#c5d4de'), ridge.cool),
          fog: true, toneMapped: false,
        })),
      )
      crown.position.set(
        ridge.x + Math.cos(ridge.yaw) * along,
        2.2 + (clump % 3) * 0.8,
        ridge.z - Math.sin(ridge.yaw) * along,
      )
      crown.scale.set(4.2, 2.6, 4.2)
      crown.castShadow = false
      crown.receiveShadow = false
      town.add(crown)
    }
  }

  function paintedFlowers(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    let state = 24681357
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000 }

    // A connected blossom mass gives the crown body; irregular lobes and loose petals fray its edge.
    ctx.fillStyle = '#fff2f6'
    ctx.beginPath()
    ctx.ellipse(256, 258, 174, 142, -0.12, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 22; i++) {
      const angle = i * 2.39996
      const distance = 95 + random() * 78
      const x = 256 + Math.cos(angle) * distance
      const y = 256 + Math.sin(angle) * distance * 0.77
      const rx = 38 + random() * 54
      const ry = 28 + random() * 47
      ctx.fillStyle = i % 4 === 0 ? '#fff9fb' : i % 3 === 0 ? '#fbe5ee' : '#fff1f6'
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, angle * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
    const petalColors = ['#fffafd', '#f6dce7', '#fff5f9', '#fae4ed']
    for (let i = 0; i < 4800; i++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random())
      const edge = 0.88 + Math.sin(angle * 5 + 0.6) * 0.055 + Math.sin(angle * 9 - 0.7) * 0.045
      if (distance > edge + 0.1 || random() < distance * distance * 0.11) continue
      const x = 256 + Math.cos(angle) * distance * 253
      const y = 256 + Math.sin(angle) * distance * 222
      const radius = 1.4 + random() * 2.8
      const color = petalColors[Math.floor(random() * petalColors.length)]
      ctx.fillStyle = color
      if (i % 4 === 0) {
        // Small individual five-petal blossoms give the cluster its fine edge.
        for (let petal = 0; petal < 5; petal++) {
          const a = petal * Math.PI * 2 / 5 + angle
          ctx.beginPath()
          ctx.ellipse(x + Math.cos(a) * radius * 0.7, y + Math.sin(a) * radius * 0.7,
            radius * 0.42, radius * 0.65, a, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#edbf83'
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.28, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.ellipse(x, y, radius * 0.52, radius * (0.45 + random() * 0.35), angle, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const texture = keepTexture(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  const flowerCardMaterial = keepMaterial(toonMaterial({
    map: paintedFlowers(), soft: true, alphaTest: 0.15, side: THREE.DoubleSide,
  }))

  makeInstanced(boxes, boxGeometry, ground, 'Buildings, road, props and shopfronts', true)
  makeInstanced(rounds, roundGeometry, blossom, 'Planting and plaza fountain')
  makeInstanced(cylinders, cylinderGeometry, wood, 'Branches, lamps and utility lines', true)
  makeInstanced(treeBranches, branchGeometry, wood, 'Tapered cherry branches', true)
  makeInstanced(rings, ringGeometry, ground, 'Bicycle and bus wheels')
  const canopy = makeInstanced(flowerCards, planeGeometry, flowerCardMaterial, 'Dense blossom canopy')
  canopy.receiveShadow = false
  const litMesh = makeInstanced(litWindows, boxGeometry, windowMaterial, 'Warm shop windows')
  const bulbMesh = makeInstanced(lampBulbs, roundGeometry, lampMaterial, 'Streetlight bulbs')

  const haloTexture = keepTexture((() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,230,180,.64)')
    gradient.addColorStop(0.38, 'rgba(255,215,158,.24)')
    gradient.addColorStop(1, 'rgba(255,215,158,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  })())
  for (const position of lampPositions) {
    const halo = new THREE.Sprite(keepMaterial(new THREE.SpriteMaterial({ map: haloTexture, color: 0xffd39b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })))
    halo.position.copy(position)
    halo.scale.set(3.5, 3.5, 1)
    town.add(halo)
    lampHalos.push(halo)
  }

  function update(time: number, night: number) {
    const darkness = THREE.MathUtils.clamp(night, 0, 1)
    lampLights.forEach((light) => { light.visible = darkness > 0.01; light.intensity = darkness * 3.1 })
    lampHalos.forEach((halo) => { (halo.material as THREE.SpriteMaterial).opacity = darkness * 0.77 })
    windowMaterial.opacity = 0.06 + darkness * 0.86
    lampMaterial.color.setRGB(0.7 + darkness * 0.3, 0.71 + darkness * 0.2, 0.67 + darkness * 0.1)
    signMaterials.forEach((material) => material.color.setScalar(1 - darkness * 0.12))
    litMesh.visible = windowMaterial.opacity > 0
    bulbMesh.visible = true
    train.position.x = ((time * 2.5 + 12) % 110) - 55
  }

  update(0, 0)

  return {
    colliders,
    update,
    dispose() {
      scene.remove(town)
      for (const mesh of instancedMeshes) mesh.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      for (const texture of textures) texture.dispose()
      colliders.length = 0
    },
  }
}
