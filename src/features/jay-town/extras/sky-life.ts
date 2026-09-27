import * as THREE from 'three'

/** Birds, ridge kites, entrance petals and river fireflies — light sky life for the walk. */
export function addSkyLife(scene: THREE.Scene): { update?: (time: number, night: number) => void; dispose: () => void } {
  const group = new THREE.Group()
  group.name = 'Sky life'
  scene.add(group)
  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => { resources.push(value); return value }
  const dummy = new THREE.Object3D()
  const rand = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }

  // Sky dome is repositioned to the camera each frame — use it as a loose camera proxy.
  let skyProxy: THREE.Object3D | null = null
  const cameraPos = new THREE.Vector3(0, 1.85, 25)
  function readCamera() {
    if (!skyProxy) {
      for (const child of scene.children) {
        if (!(child instanceof THREE.Mesh)) continue
        const mat = child.material
        if (mat instanceof THREE.ShaderMaterial && mat.side === THREE.BackSide && mat.uniforms?.night) {
          skyProxy = child
          break
        }
      }
    }
    if (skyProxy) cameraPos.copy(skyProxy.position)
    else cameraPos.set(0, 1.85, 25)
  }

  // ——— Birds: two small flocks as instanced cones ———
  const BIRD_PLAZA = 10
  const BIRD_RIVER = 8
  const birdCount = BIRD_PLAZA + BIRD_RIVER
  const birdGeo = keep(new THREE.ConeGeometry(0.12, 0.42, 4))
  birdGeo.rotateX(Math.PI / 2)
  const birdMat = keep(new THREE.MeshBasicMaterial({
    color: 0x2a2e38, fog: true, toneMapped: false,
  }))
  const birds = new THREE.InstancedMesh(birdGeo, birdMat, birdCount)
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  birds.frustumCulled = false
  birds.name = 'Circling birds'
  group.add(birds)

  type Bird = { flock: 0 | 1; phase: number; radius: number; height: number; speed: number; tilt: number }
  const birdData: Bird[] = Array.from({ length: birdCount }, (_, i) => {
    const flock = (i < BIRD_PLAZA ? 0 : 1) as 0 | 1
    const k = i + flock * 17
    return {
      flock,
      phase: rand(k + 1) * Math.PI * 2,
      radius: (flock === 0 ? 9 : 11) + rand(k + 2) * 5,
      height: (flock === 0 ? 11 : 9) + rand(k + 3) * 4,
      speed: 0.22 + rand(k + 4) * 0.18,
      tilt: (rand(k + 5) - 0.5) * 0.35,
    }
  })

  // ——— Two distant kites on the side ridges ———
  const kiteGeo = keep(new THREE.BufferGeometry())
  kiteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0.55, 0,  -0.42, 0, 0,  0, -0.55, 0,  0.42, 0, 0,
  ]), 3))
  kiteGeo.setIndex([0, 1, 2, 0, 2, 3])
  kiteGeo.computeVertexNormals()
  const pinkMat = keep(new THREE.MeshBasicMaterial({
    color: 0xf2a0b8, side: THREE.DoubleSide, fog: true, toneMapped: false,
  }))
  const indigoMat = keep(new THREE.MeshBasicMaterial({
    color: 0x4a4e8a, side: THREE.DoubleSide, fog: true, toneMapped: false,
  }))
  const stringGeo = keep(new THREE.BufferGeometry())
  stringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -14, 0]), 3))
  const stringMat = keep(new THREE.LineBasicMaterial({ color: 0xc8b8a8, fog: true, toneMapped: false }))

  type Kite = { mesh: THREE.Mesh; string: THREE.Line; base: THREE.Vector3; bob: number; spin: number }
  const kiteSpecs = [
    { x: -46, y: 22, z: -18, mat: pinkMat, bob: 0.9, spin: 0.11 },
    { x: 48, y: 20, z: -58, mat: indigoMat, bob: 1.15, spin: -0.09 },
  ]
  const kites: Kite[] = kiteSpecs.map(spec => {
    const mesh = new THREE.Mesh(kiteGeo, spec.mat)
    mesh.position.set(spec.x, spec.y, spec.z)
    mesh.scale.set(2.4, 2.4, 2.4)
    const string = new THREE.Line(stringGeo, stringMat)
    mesh.add(string)
    group.add(mesh)
    return { mesh, string, base: new THREE.Vector3(spec.x, spec.y, spec.z), bob: spec.bob, spin: spec.spin }
  })

  // ——— Larger foreground petals near the torii (z≈16) ———
  const PETAL_N = 9
  const petalCanvas = document.createElement('canvas')
  petalCanvas.width = petalCanvas.height = 48
  {
    const ctx = petalCanvas.getContext('2d')!
    ctx.fillStyle = '#ffd6e6'
    ctx.beginPath()
    ctx.moveTo(24, 6)
    ctx.bezierCurveTo(44, 14, 40, 36, 16, 44)
    ctx.bezierCurveTo(4, 28, 8, 8, 20, 5)
    ctx.lineTo(22, 12)
    ctx.closePath()
    ctx.fill()
  }
  const petalTex = keep(new THREE.CanvasTexture(petalCanvas))
  petalTex.colorSpace = THREE.SRGBColorSpace
  const petalMat = keep(new THREE.MeshBasicMaterial({
    map: petalTex, color: 0xffb4cc, transparent: true, alphaTest: 0.18,
    side: THREE.DoubleSide, depthWrite: false, fog: true, toneMapped: false,
  }))
  const petalGeo = keep(new THREE.PlaneGeometry(1, 1))
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_N)
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  petals.frustumCulled = false
  petals.name = 'Entrance petals'
  group.add(petals)

  type Petal = { ox: number; oy: number; oz: number; scale: number; spin: number; drift: number }
  const petalData: Petal[] = Array.from({ length: PETAL_N }, (_, i) => ({
    ox: (rand(i * 3.1) - 0.5) * 7,
    oy: 1.2 + rand(i * 5.7) * 3.5,
    oz: 16 + (rand(i * 9.2) - 0.5) * 5,
    scale: 0.28 + rand(i * 11.3) * 0.22,
    spin: 0.35 + rand(i * 13.1) * 0.4,
    drift: 0.4 + rand(i * 17.7) * 0.5,
  }))

  // ——— Night fireflies near the river bank ———
  const FLY_N = 12
  const flyPositions = new Float32Array(FLY_N * 3)
  const flyBase: { x: number; y: number; z: number; phase: number; amp: number }[] = []
  for (let i = 0; i < FLY_N; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const x = side * (11.2 + rand(i * 2.3) * 2.4)
    const y = 0.6 + rand(i * 4.1) * 1.8
    const z = -80 + (rand(i * 6.7) - 0.5) * 8
    flyBase.push({ x, y, z, phase: rand(i * 8.9) * Math.PI * 2, amp: 0.25 + rand(i * 10.1) * 0.35 })
    flyPositions.set([x, y, z], i * 3)
  }
  const flyGeo = keep(new THREE.BufferGeometry())
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPositions, 3))
  const flyMat = keep(new THREE.PointsMaterial({
    color: 0xd4f0a8, size: 0.22, sizeAttenuation: true,
    transparent: true, opacity: 0.85, depthWrite: false, fog: true, toneMapped: false,
  }))
  const fireflies = new THREE.Points(flyGeo, flyMat)
  fireflies.name = 'River fireflies'
  fireflies.visible = false
  fireflies.frustumCulled = false
  group.add(fireflies)

  function placeBirds(time: number) {
    readCamera()
    const anchors = [
      { x: 0, z: -31, follow: 0.28 },
      { x: 2, z: -86, follow: 0.32 },
    ]
    for (let i = 0; i < birdCount; i++) {
      const b = birdData[i]
      const a = anchors[b.flock]
      const pull = THREE.MathUtils.clamp(cameraPos.z - a.z, -28, 28) * a.follow
      const cx = a.x + Math.sin(time * 0.05 + b.flock) * 1.5
      const cz = a.z + pull
      const angle = b.phase + time * b.speed
      const x = cx + Math.cos(angle) * b.radius
      const z = cz + Math.sin(angle) * b.radius * 0.72
      const y = b.height + Math.sin(angle * 2.1 + b.phase) * 0.6
      dummy.position.set(x, y, z)
      dummy.lookAt(x - Math.sin(angle), y, z + Math.cos(angle))
      dummy.rotateZ(b.tilt)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      birds.setMatrixAt(i, dummy.matrix)
    }
    birds.instanceMatrix.needsUpdate = true
  }

  function placePetals(time: number) {
    for (let i = 0; i < PETAL_N; i++) {
      const p = petalData[i]
      const sway = Math.sin(time * p.drift + i) * 0.9
      const fall = ((p.oy - time * 0.22 * p.drift) % 4.5 + 4.5) % 4.5
      dummy.position.set(p.ox + sway, 0.4 + fall, p.oz + Math.sin(time * 0.18 + i) * 0.5)
      dummy.rotation.set(time * p.spin * 0.6 + i, i + time * p.spin, time * 0.25 + i)
      dummy.scale.set(p.scale, p.scale * 0.75, p.scale)
      dummy.updateMatrix()
      petals.setMatrixAt(i, dummy.matrix)
    }
    petals.instanceMatrix.needsUpdate = true
  }

  function placeKites(time: number) {
    for (const kite of kites) {
      const bob = Math.sin(time * kite.bob * 0.35) * 0.85
      const sway = Math.sin(time * kite.bob * 0.22 + 1.2) * 1.1
      kite.mesh.position.set(kite.base.x + sway, kite.base.y + bob, kite.base.z)
      kite.mesh.rotation.set(
        Math.sin(time * 0.3) * 0.12,
        time * kite.spin,
        Math.cos(time * 0.25) * 0.18,
      )
    }
  }

  function placeFireflies(time: number) {
    const attr = flyGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < FLY_N; i++) {
      const f = flyBase[i]
      const t = time * 0.55 + f.phase
      attr.setXYZ(
        i,
        f.x + Math.sin(t) * f.amp,
        f.y + Math.sin(t * 1.7 + 0.4) * f.amp * 0.7,
        f.z + Math.cos(t * 0.9) * f.amp * 0.8,
      )
    }
    attr.needsUpdate = true
    flyMat.opacity = 0.55 + Math.sin(time * 2.2) * 0.2
  }

  // Stable first pose (also covers reduced-motion time=0).
  placeBirds(0)
  placePetals(0)
  placeKites(0)
  placeFireflies(0)

  return {
    update(time: number, night: number) {
      const day = night <= 0.55
      for (const kite of kites) kite.mesh.visible = day
      fireflies.visible = !day
      placeBirds(time)
      placePetals(time)
      if (day) placeKites(time)
      else placeFireflies(time)
    },
    dispose() {
      scene.remove(group)
      birds.dispose()
      petals.dispose()
      resources.forEach(r => r.dispose())
    },
  }
}
