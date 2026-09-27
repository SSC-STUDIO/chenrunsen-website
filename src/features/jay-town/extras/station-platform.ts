import * as THREE from 'three'
import { toonMaterial } from '../toon'

/** Lived-in platform props for the existing sakura-town station canopy. */
export function addStationPlatform(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const group = new THREE.Group()
  group.name = 'Station platform extras'
  scene.add(group)

  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => {
    resources.push(value)
    return value
  }

  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1))
  const planeGeo = keep(new THREE.PlaneGeometry(1, 1))
  const cylGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 12))
  const sphereGeo = keep(new THREE.SphereGeometry(1, 10, 8))
  const white = keep(toonMaterial())
  const soft = keep(toonMaterial({ soft: true }))

  const batches = new Map<string, {
    geometry: THREE.BufferGeometry
    material: THREE.Material
    items: { p: number[]; s: number[]; color: THREE.Color; ry: number; rx: number }[]
  }>()

  function part(
    type: 'box' | 'cyl' | 'sphere' | 'soft',
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: string, ry = 0, rx = 0,
  ) {
    const geometry = type === 'cyl' ? cylGeo : type === 'sphere' ? sphereGeo : boxGeo
    const material = type === 'soft' ? soft : white
    if (!batches.has(type)) batches.set(type, { geometry, material, items: [] })
    batches.get(type)!.items.push({
      p: [x, y, z], s: [sx, sy, sz], color: new THREE.Color(color), ry, rx,
    })
  }

  const mapCanvas = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    draw(canvas.getContext('2d')!)
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }

  const PX = -15
  const PZ = -50.6
  const deckY = 0.54
  const roofY = 4.45

  // Yellow safety line + tactile dots along the track-side edge.
  for (let x = -20.2; x <= -9.8; x += 0.42) {
    part('box', x, deckY + 0.02, PZ - 1.48, 0.36, 0.03, 0.14, '#e8c24a')
    for (const dx of [-0.1, 0, 0.1]) {
      part('cyl', x + dx, deckY + 0.045, PZ - 1.48, 0.035, 0.02, 0.035, '#f0d278')
    }
  }
  part('box', PX, deckY + 0.015, PZ - 1.34, 10.6, 0.02, 0.04, '#d4a82e')

  // Platform paving joints (instanced tile seams).
  for (let x = -20; x <= -10; x += 0.95) {
    part('box', x, deckY + 0.008, PZ, 0.02, 0.01, 3.1, '#c8c2b4')
  }
  for (let z = PZ - 1.4; z <= PZ + 1.4; z += 0.85) {
    part('box', PX, deckY + 0.008, z, 10.4, 0.01, 0.02, '#c8c2b4')
  }

  // Waiting benches along the canopy (instanced wood + iron legs).
  const benchXs = [-18.4, -15.6, -12.8]
  for (const bx of benchXs) {
    part('box', bx, deckY + 0.42, PZ + 0.55, 1.65, 0.08, 0.48, '#c4a078')
    part('box', bx, deckY + 0.68, PZ + 0.72, 1.65, 0.42, 0.07, '#b8926a')
    for (const edge of [-0.68, 0.68]) {
      part('box', bx + edge, deckY + 0.22, PZ + 0.55, 0.08, 0.44, 0.38, '#5a686e')
      part('box', bx + edge, deckY + 0.52, PZ + 0.72, 0.08, 0.28, 0.08, '#5a686e')
    }
  }

  // Suitcase + paper cup on the middle bench.
  const sx = -15.35
  const sz = PZ + 0.48
  part('box', sx, deckY + 0.62, sz, 0.38, 0.28, 0.52, '#6b8a9a')
  part('box', sx, deckY + 0.78, sz, 0.34, 0.06, 0.48, '#4e6a78')
  part('box', sx + 0.02, deckY + 0.62, sz + 0.28, 0.18, 0.04, 0.08, '#d7c4a0')
  part('cyl', sx + 0.12, deckY + 0.88, sz - 0.08, 0.03, 0.12, 0.03, '#8a9aa0')
  part('cyl', -15.85, deckY + 0.52, PZ + 0.4, 0.055, 0.11, 0.055, '#f2ebe0')
  part('cyl', -15.85, deckY + 0.58, PZ + 0.4, 0.06, 0.02, 0.06, '#e8ddd0')
  part('soft', -15.85, deckY + 0.545, PZ + 0.4, 0.04, 0.04, 0.04, '#c45a62')

  // Round station clock hung from a roof beam.
  const clockX = -13.2
  const clockY = 3.55
  const clockZ = PZ + 0.05
  part('cyl', clockX, clockY, clockZ, 0.04, 0.55, 0.04, '#5c6a70', 0, Math.PI / 2)
  part('cyl', clockX, clockY - 0.28, clockZ, 0.42, 0.08, 0.42, '#ece6d8', 0, Math.PI / 2)
  part('cyl', clockX, clockY - 0.28, clockZ + 0.05, 0.38, 0.02, 0.38, '#f7f3ea', 0, Math.PI / 2)
  part('box', clockX, clockY - 0.28, clockZ + 0.07, 0.025, 0.22, 0.02, '#3a4a52')
  part('box', clockX + 0.08, clockY - 0.22, clockZ + 0.07, 0.14, 0.022, 0.02, '#3a4a52', 0.55)
  part('sphere', clockX, clockY - 0.28, clockZ + 0.08, 0.04, 0.04, 0.04, '#c4514a')

  // Canvas timetable board.
  const timetableTex = mapCanvas(512, 640, (ctx) => {
    ctx.fillStyle = '#2f4a55'
    ctx.fillRect(0, 0, 512, 640)
    ctx.fillStyle = '#e8dcc8'
    ctx.fillRect(18, 18, 476, 604)
    ctx.fillStyle = '#c4514a'
    ctx.fillRect(18, 18, 476, 88)
    ctx.fillStyle = '#fff8ef'
    ctx.font = 'bold 48px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('桜町站', 256, 78)
    ctx.fillStyle = '#3a4f58'
    ctx.font = 'bold 34px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.fillText('下一班', 256, 160)
    ctx.font = '28px "Yu Gothic","Microsoft YaHei",sans-serif'
    const rows = [
      ['上り', '桜台', '14:22'],
      ['下り', '河岸', '14:35'],
      ['上り', '本町', '14:48'],
      ['特急', '海辺', '15:05'],
    ]
    rows.forEach(([dir, dest, time], i) => {
      const y = 220 + i * 90
      ctx.fillStyle = i % 2 ? '#f3ebe0' : '#e6ddd0'
      ctx.fillRect(40, y - 40, 432, 78)
      ctx.fillStyle = '#c4514a'
      ctx.font = 'bold 26px "Yu Gothic","Microsoft YaHei",sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(dir, 58, y)
      ctx.fillStyle = '#3a4f58'
      ctx.fillText(dest, 160, y)
      ctx.textAlign = 'right'
      ctx.font = 'bold 30px Georgia,serif'
      ctx.fillText(time, 448, y)
    })
    ctx.fillStyle = '#7a8a84'
    ctx.font = '20px Georgia,serif'
    ctx.textAlign = 'center'
    ctx.fillText('SAKURA-MACHI', 256, 600)
  })
  const timetableMat = keep(toonMaterial({ map: timetableTex, side: THREE.DoubleSide }))
  const timetable = new THREE.Mesh(planeGeo, timetableMat)
  timetable.position.set(-17.6, deckY + 1.55, PZ - 0.9)
  timetable.scale.set(1.05, 1.32, 1)
  timetable.rotation.y = Math.PI * 0.08
  group.add(timetable)
  part('box', -17.6, deckY + 1.55, PZ - 0.96, 1.12, 1.4, 0.06, '#5c6a70', Math.PI * 0.08)
  part('box', -17.6, deckY + 0.72, PZ - 0.96, 0.08, 0.9, 0.08, '#5c6a70')
  part('box', -17.1, deckY + 0.72, PZ - 0.9, 0.08, 0.9, 0.08, '#5c6a70')

  // Hanging station sign under the cream roof.
  const hangTex = mapCanvas(512, 160, (ctx) => {
    ctx.fillStyle = '#c4514a'
    ctx.fillRect(0, 0, 512, 160)
    ctx.strokeStyle = '#f6f1e8'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, 492, 140)
    ctx.fillStyle = '#fff8ef'
    ctx.font = 'bold 64px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('桜町  PLATFORM 1', 256, 82)
  })
  const hangMat = keep(toonMaterial({ map: hangTex, side: THREE.DoubleSide }))
  const hangSign = new THREE.Mesh(planeGeo, hangMat)
  hangSign.position.set(-16.2, 3.55, PZ)
  hangSign.scale.set(2.4, 0.72, 1)
  hangSign.rotation.y = Math.PI / 2
  group.add(hangSign)
  part('box', -16.2, 3.9, PZ, 0.06, 0.55, 0.06, '#5c6a70')
  part('box', -16.2, 3.55, PZ - 0.02, 0.08, 0.78, 2.5, '#b8453f', Math.PI / 2)

  // Departure lamp — blinks slowly in update().
  const lampPoleX = -11.2
  part('cyl', lampPoleX, deckY + 1.1, PZ + 1.1, 0.05, 2.2, 0.05, '#4a585e')
  part('box', lampPoleX, deckY + 2.25, PZ + 1.1, 0.28, 0.12, 0.28, '#3a484e')
  const lampGlass = keep(toonMaterial({
    color: '#f2c44a', soft: true, transparent: true, opacity: 0.92,
  }))
  const lampMesh = new THREE.Mesh(sphereGeo, lampGlass)
  lampMesh.position.set(lampPoleX, deckY + 2.42, PZ + 1.1)
  lampMesh.scale.set(0.14, 0.14, 0.14)
  group.add(lampMesh)
  const lampGlow = keep(new THREE.PointLight('#ffd27a', 0.55, 4.5, 2))
  lampGlow.position.copy(lampMesh.position)
  group.add(lampGlow)

  // Vending machine + route map at the road-facing end (x≈-10).
  const vx = -10.05
  const vz = PZ + 0.35
  part('box', vx, deckY + 1.05, vz, 0.82, 1.95, 0.62, '#6a9aaa')
  part('box', vx, deckY + 2.08, vz, 0.86, 0.1, 0.66, '#e8ebe2')
  part('box', vx - 0.08, deckY + 1.35, vz + 0.32, 0.52, 0.95, 0.04, '#c8dde0')
  part('box', vx + 0.28, deckY + 1.15, vz + 0.32, 0.12, 0.62, 0.03, '#3d555c')
  part('box', vx, deckY + 0.35, vz + 0.32, 0.58, 0.18, 0.03, '#334850')
  const canColors = ['#e8a0aa', '#b8d48a', '#f0d890', '#9ec8d8']
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      part('cyl', vx - 0.26 + col * 0.14, deckY + 1.05 + row * 0.28, vz + 0.34,
        0.04, 0.16, 0.04, canColors[col])
    }
  }

  const mapTex = mapCanvas(384, 512, (ctx) => {
    ctx.fillStyle = '#f4efe4'
    ctx.fillRect(0, 0, 384, 512)
    ctx.strokeStyle = '#c4514a'
    ctx.lineWidth = 14
    ctx.strokeRect(8, 8, 368, 496)
    ctx.fillStyle = '#c4514a'
    ctx.font = 'bold 36px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('路線図', 192, 58)
    ctx.fillStyle = '#5a6a70'
    ctx.font = '22px Georgia,serif'
    ctx.fillText('SAKURA LINE', 192, 92)
    // Stylized route ribbon.
    ctx.strokeStyle = '#c4514a'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(60, 420)
    ctx.quadraticCurveTo(100, 280, 192, 260)
    ctx.quadraticCurveTo(290, 240, 330, 140)
    ctx.stroke()
    const stops = [
      [70, 400, '河岸'],
      [140, 320, '桜町'],
      [220, 250, '本町'],
      [300, 170, '海辺'],
    ] as const
    stops.forEach(([x, y, label], i) => {
      ctx.fillStyle = i === 1 ? '#c4514a' : '#4a5a62'
      ctx.beginPath()
      ctx.arc(x, y, i === 1 ? 14 : 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3a4a50'
      ctx.font = 'bold 24px "Yu Gothic","Microsoft YaHei",sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, x + 18, y + 8)
    })
    ctx.fillStyle = '#c4514a'
    ctx.font = '18px "Yu Gothic","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('← あなたはここ', 192, 470)
  })
  const mapMat = keep(toonMaterial({ map: mapTex, side: THREE.DoubleSide }))
  const mapBoard = new THREE.Mesh(planeGeo, mapMat)
  // Face the main road so pedestrians can read it from the street.
  mapBoard.position.set(-9.55, deckY + 1.45, PZ - 0.55)
  mapBoard.scale.set(0.95, 1.25, 1)
  mapBoard.rotation.y = Math.PI / 2
  group.add(mapBoard)
  part('box', -9.62, deckY + 1.45, PZ - 0.55, 0.06, 1.32, 1.02, '#5c6a70')
  part('box', -9.62, deckY + 0.55, PZ - 0.85, 0.08, 0.7, 0.08, '#5c6a70')
  part('box', -9.62, deckY + 0.55, PZ - 0.25, 0.08, 0.7, 0.08, '#5c6a70')

  // Cat on the roof ridge — subtle breathing / ear flick in update().
  const cat = new THREE.Group()
  cat.position.set(-14.2, roofY + 0.12, PZ)
  group.add(cat)
  const catBody = new THREE.Mesh(sphereGeo, keep(toonMaterial({ soft: true, color: '#e8d4b8' })))
  catBody.scale.set(0.22, 0.14, 0.28)
  catBody.position.set(0, 0.08, 0)
  cat.add(catBody)
  const catHead = new THREE.Mesh(sphereGeo, keep(toonMaterial({ soft: true, color: '#ecdcc4' })))
  catHead.scale.set(0.14, 0.13, 0.13)
  catHead.position.set(0.18, 0.18, 0.02)
  cat.add(catHead)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(boxGeo, keep(toonMaterial({ color: '#e0c8a8' })))
    ear.scale.set(0.06, 0.1, 0.04)
    ear.position.set(0.22, 0.3, side * 0.08)
    ear.rotation.z = side * 0.25
    cat.add(ear)
  }
  const catTail = new THREE.Mesh(cylGeo, keep(toonMaterial({ color: '#e4ceb0' })))
  catTail.scale.set(0.035, 0.22, 0.035)
  catTail.position.set(-0.22, 0.14, 0)
  catTail.rotation.z = 0.9
  cat.add(catTail)
  // Two pigeons farther along the ridge.
  const pigeons: THREE.Group[] = []
  for (const [px, pzOff] of [[-17.5, -0.15], [-12.1, 0.2]] as const) {
    const bird = new THREE.Group()
    bird.position.set(px, roofY + 0.08, PZ + pzOff)
    group.add(bird)
    const body = new THREE.Mesh(sphereGeo, keep(toonMaterial({ soft: true, color: '#9aa8b0' })))
    body.scale.set(0.1, 0.07, 0.14)
    bird.add(body)
    const head = new THREE.Mesh(sphereGeo, keep(toonMaterial({ soft: true, color: '#a8b4ba' })))
    head.scale.set(0.055, 0.05, 0.055)
    head.position.set(0.1, 0.05, 0)
    bird.add(head)
    const beak = new THREE.Mesh(boxGeo, keep(toonMaterial({ color: '#d4a060' })))
    beak.scale.set(0.05, 0.02, 0.02)
    beak.position.set(0.15, 0.04, 0)
    bird.add(beak)
    pigeons.push(bird)
  }

  // Small blossom drifts caught against a canopy post.
  for (let i = 0; i < 8; i++) {
    const a = i * 0.85
    part('soft', -19.15 + Math.sin(a) * 0.25, deckY + 0.08 + (i % 3) * 0.04,
      PZ - 0.4 + Math.cos(a) * 0.3, 0.08, 0.03, 0.1,
      i % 2 ? '#f5c4d4' : '#f8dae6', a)
  }

  const scratch = new THREE.Object3D()
  for (const [name, batch] of batches) {
    const mesh = keep(new THREE.InstancedMesh(batch.geometry, batch.material, batch.items.length))
    batch.items.forEach((item, i) => {
      scratch.position.set(item.p[0], item.p[1], item.p[2])
      scratch.scale.set(item.s[0], item.s[1], item.s[2])
      scratch.rotation.set(item.rx, item.ry, 0)
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
      mesh.setColorAt(i, item.color)
    })
    mesh.name = `Station platform ${name}`
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = name !== 'soft'
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    group.add(mesh)
  }

  return {
    update(time: number, night: number) {
      const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.6))
      lampGlass.opacity = THREE.MathUtils.lerp(0.55, 0.98, blink)
      lampGlow.intensity = THREE.MathUtils.lerp(0.2, 0.85 + night * 0.6, blink)
      cat.rotation.y = Math.sin(time * 0.35) * 0.08
      cat.position.y = roofY + 0.12 + Math.sin(time * 1.1) * 0.012
      catTail.rotation.z = 0.9 + Math.sin(time * 2.2) * 0.25
      pigeons.forEach((bird, i) => {
        bird.position.y = roofY + 0.08 + Math.sin(time * 1.4 + i * 1.7) * 0.018
        bird.rotation.y = Math.sin(time * 0.55 + i) * 0.2
      })
    },
    dispose() {
      scene.remove(group)
      resources.forEach((resource) => resource.dispose())
    },
  }
}
