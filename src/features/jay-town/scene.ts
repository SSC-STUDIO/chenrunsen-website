import * as THREE from 'three'
import { buildTown } from './world'
import { addTownDetails } from './details'
import { addStorefrontDetails } from './storefronts'
import { softenCanopies } from './canopy'
import { createCelInk } from './toon'
import { insideDistrict } from './layout'
import { addToriiApproach } from './extras/torii-approach'
import { addRecordAlley } from './extras/record-alley'
import { addPlazaCrossing } from './extras/plaza-crossing'
import { addStationPlatform } from './extras/station-platform'
import { addRiverBank } from './extras/river-bank'
import { addSideStreets } from './extras/side-streets'
import { addNightLanterns } from './extras/night-lanterns'
import { addSkyLife } from './extras/sky-life'
import { addShopVariety } from './extras/shop-variety'
import { addMvScreens } from './extras/mv-screens'

type DetailHandle = { update?: (time: number, night: number) => void; dispose: () => void }

type Options = {
  onReady?: () => void
  onError?: () => void
  onZoneChange?: (index: number) => void
}

export type TownSceneHandle = {
  goTo(index: number): void
  setNight(value: boolean): void
  setMove(x: number, z: number): void
  setPaused(value: boolean): void
  dispose(): void
}

const STOPS = [
  // Just before the torii, turned enough that the gate frames the street.
  { x: -1.8, z: 25.2, yaw: 0.32 },
  { x: -1.4, z: -1.2, yaw: 0.95 },
  { x: 2.2, z: -28.2, yaw: -0.55 },
  { x: 2.4, z: -45.6, yaw: 0.72 },
  // The river is a transition, not the end of the town. The last stop sits
  // on the far-bank lane so the player can actually see the second district.
  // Faces back across the widened river from the far bank.
  { x: 0.4, z: -106, yaw: Math.PI },
]
const clamp = THREE.MathUtils.clamp

export function mountTownScene(canvas: HTMLCanvasElement, options: Options = {}): TownSceneHandle {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false })
  } catch {
    options.onError?.()
    return { goTo() {}, setNight() {}, setMove() {}, setPaused() {}, dispose() {} }
  }

  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const lite = coarse || window.innerWidth < 700
  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(resource: T) => { resources.push(resource); return resource }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.15 : 1.3))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.shadowMap.enabled = !lite
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xc5dae6, 78, 300)
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 640)
  camera.rotation.order = 'YXZ'
  camera.position.set(-1.8, 1.85, 25.2)

  const hemisphere = new THREE.HemisphereLight(0xd5e6f6, 0x8d7eaa, 0.82)
  const sun = new THREE.DirectionalLight(0xffe2b8, 1.22)
  sun.position.set(-28, 34, 16)
  sun.castShadow = !lite
  sun.shadow.mapSize.set(1536, 1536)
  Object.assign(sun.shadow.camera, { left: -58, right: 58, top: 52, bottom: -52, near: 1, far: 140 })
  sun.shadow.bias = -0.0003
  sun.shadow.normalBias = 0.08
  const fill = new THREE.DirectionalLight(0xa9c0e6, 0.46)
  fill.position.set(32, 18, -24)
  scene.add(hemisphere, sun, sun.target, fill)

  // An unlit sky dome keeps the pastel horizon and cloud whites independent of exposure.
  const skyMaterial = keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { night: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      varying vec3 direction; uniform float night; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec3 d=normalize(direction); float h=max(0.,d.y);
        vec3 day=mix(vec3(.78,.88,.96),vec3(.20,.46,.88),pow(h,.62));
        vec3 dusk=mix(vec3(.29,.32,.48),vec3(.035,.075,.18),pow(h,.6));
        vec3 color=mix(day,dusk,night);
        vec2 uv=d.xz/max(d.y+.12,.06)*3.+vec2(time*.001,0.);
        float n=noise(uv)*.53+noise(uv*2.1)*.26+noise(uv*4.3)*.13+noise(uv*8.7)*.055+noise(uv*17.5)*.025;
        float cloud=smoothstep(.52,.63,n)*smoothstep(.02,.15,h)*(1.-smoothstep(.65,.95,h));
        vec3 white=mix(vec3(.87,.91,.96),vec3(1.,.99,.98),smoothstep(.54,.69,n));
        color=mix(color,mix(white,vec3(.36,.40,.57),night),cloud*.92);
        float sun=pow(max(0.,dot(d,normalize(vec3(-.7,.6,-.4)))),200.);
        color+=vec3(1.,.86,.6)*sun*(1.-night)*.7;
        vec2 grid=floor(d.xz/(h+.3)*320.); float star=step(.997,hash(grid));
        color+=star*night*smoothstep(.08,.28,h)*(.5+.15*sin(time+hash(grid)*60.));
        gl_FragColor=vec4(color,1.);
      }`,
  }))
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(420, 24, 16)), skyMaterial)
  const ink = createCelInk(!lite)
  sky.renderOrder = -1
  scene.add(sky)

  let world: ReturnType<typeof buildTown>
  let details: ReturnType<typeof addTownDetails>
  let storefronts: ReturnType<typeof addStorefrontDetails>
  let canopies: ReturnType<typeof softenCanopies>
  const streetDetails: DetailHandle[] = []
  try {
    world = buildTown(scene)
    details = addTownDetails(scene)
    storefronts = addStorefrontDetails(scene)
    canopies = softenCanopies(scene)
    streetDetails.push(
      addToriiApproach(scene),
      addRecordAlley(scene),
      addPlazaCrossing(scene),
      addStationPlatform(scene),
      addRiverBank(scene),
      addSideStreets(scene),
      addNightLanterns(scene),
      addSkyLife(scene),
      addShopVariety(scene),
      addMvScreens(scene),
    )
  } catch (error) {
    streetDetails.forEach(detail => detail.dispose())
    canopies?.dispose()
    storefronts?.dispose()
    world?.dispose()
    details?.dispose()
    ink.dispose()
    resources.forEach(resource => resource.dispose())
    renderer.dispose()
    console.error('Unable to build sakura town', error)
    options.onError?.()
    return { goTo() {}, setNight() {}, setMove() {}, setPaused() {}, dispose() {} }
  }

  // Petals are a single instanced draw call, with transparent edges painted locally.
  const petalCanvas = document.createElement('canvas')
  petalCanvas.width = petalCanvas.height = 64
  const ctx = petalCanvas.getContext('2d')!
  ctx.fillStyle = '#fff1f7'
  ctx.beginPath()
  ctx.moveTo(32, 9)
  ctx.bezierCurveTo(62, 17, 54, 48, 21, 59)
  ctx.bezierCurveTo(1, 37, 7, 8, 25, 5)
  ctx.lineTo(29, 16)
  ctx.closePath()
  ctx.fill()
  const petalTexture = keep(new THREE.CanvasTexture(petalCanvas))
  petalTexture.colorSpace = THREE.SRGBColorSpace
  const petalMaterial = keep(new THREE.MeshBasicMaterial({ map: petalTexture, color: 0xffc4da, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, depthWrite: false }))
  const petalCount = lite ? 135 : 310
  const petals = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1)), petalMaterial, petalCount)
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  petals.frustumCulled = false
  scene.add(petals)
  const petalData = Array.from({ length: petalCount }, (_, i) => ({
    x: Math.sin(i * 127.1) * 18,
    y: (i * 1.618) % 12,
    z: (i * 7.731) % 58 - 38,
    speed: 0.45 + (i % 7) * 0.055,
    scale: 0.07 + (i % 5) * 0.016,
  }))
  const dummy = new THREE.Object3D()
  function updatePetals(time: number) {
    petalData.forEach((petal, i) => {
      const cycle = (petal.y - time * petal.speed) % 12
      const y = cycle < 0 ? cycle + 12 : cycle
      dummy.position.set(petal.x + Math.sin(time * 0.4 + i) * 1.6, y + 0.15, camera.position.z + petal.z + Math.sin(i + time * 0.2))
      dummy.rotation.set(time * 0.7 + i, i + time * 0.55, time * 0.3 + i)
      dummy.scale.set(petal.scale, petal.scale * 0.72, petal.scale)
      dummy.updateMatrix()
      petals.setMatrixAt(i, dummy.matrix)
    })
    petals.instanceMatrix.needsUpdate = true
  }

  const keys = new Set<string>()
  const mobileMove = new THREE.Vector2()
  let paused = false, disposed = false, hidden = document.hidden
  let nightTarget = 0, night = 0, yaw = 0, pitch = 0.045
  let elapsed = performance.now() / 1000, previousTime = 0, frame = 0, zone = 0
  let shadowCenter = Infinity
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null
  let journey: { from: THREE.Vector3; to: THREE.Vector3; yawFrom: number; yawTo: number; start: number } | null = null
  let wheelVelocity = 0
  const position = camera.position.clone()
  const dayFog = new THREE.Color(0xc5dae6), nightFog = new THREE.Color(0x30344d)
  const daySky = new THREE.Color(0xd5e6f6), nightSky = new THREE.Color(0x809cca)
  const dayGround = new THREE.Color(0x8d7eaa), nightGround = new THREE.Color(0x3a3558)
  const daySun = new THREE.Color(0xffe2b8), nightSun = new THREE.Color(0xacc8ff)
  const dayFill = new THREE.Color(0xa9c0e6), nightFill = new THREE.Color(0x6e82b8)
  const pointer = new THREE.Vector2()
  const raycaster = new THREE.Raycaster()

  const inputFocused = () => {
    const active = document.activeElement as HTMLElement | null
    return !!active?.closest('input,textarea,select,[contenteditable="true"],dialog[open]')
  }
  const updateZone = () => {
    let nearest = 0, distance = Infinity
    STOPS.forEach((stop, index) => {
      const d = Math.abs(position.z - stop.z)
      if (d < distance) { nearest = index; distance = d }
    })
    if (zone !== nearest) { zone = nearest; options.onZoneChange?.(zone) }
    // Exposes real scene state to assistive/debug tooling, never a synthetic progress counter.
    canvas.dataset.zone = String(zone)
    canvas.dataset.position = `${position.x.toFixed(2)},${position.z.toFixed(2)}`
  }
  const canStand = (x: number, z: number) => {
    if (!insideDistrict(x, z)) return false
    return !world.colliders.some(box => x > box.min.x - 0.28 && x < box.max.x + 0.28 && z > box.min.z - 0.28 && z < box.max.z + 0.28 && box.min.y < 2 && box.max.y > 0.3)
  }

  function goTo(index: number) {
    const target = STOPS[clamp(Math.round(index), 0, STOPS.length - 1)]
    keys.clear(); mobileMove.set(0, 0); wheelVelocity = 0
    const to = new THREE.Vector3(target.x, 1.85, target.z)
    if (media.matches) { position.copy(to); yaw = target.yaw; journey = null; updateZone() }
    else journey = { from: position.clone(), to, yawFrom: yaw, yawTo: yaw + Math.atan2(Math.sin(target.yaw - yaw), Math.cos(target.yaw - yaw)), start: performance.now() / 1000 }
    pitch = 0.045
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || paused || inputFocused()) return
    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) {
      event.preventDefault(); keys.add(key); journey = null
    }
    if (/^[1-5]$/.test(key)) goTo(Number(key) - 1)
  }
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase())
  const clearMovement = () => { keys.clear(); mobileMove.set(0, 0); wheelVelocity = 0; drag = null; canvas.classList.remove('is-dragging') }
  const onPointerDown = (event: PointerEvent) => {
    if (paused || event.button !== 0) return
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false }
    journey = null
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true
    yaw -= (event.clientX - drag.x) * 0.003
    pitch = clamp(pitch - (event.clientY - drag.y) * 0.0027, -0.85, 0.85)
    drag.x = event.clientX; drag.y = event.clientY
  }
  const songIdFromObject = (object: THREE.Object3D | null): string | null => {
    let node: THREE.Object3D | null = object
    while (node) {
      const songId = node.userData?.songId
      if (typeof songId === 'string' && songId) return songId
      node = node.parent
    }
    return null
  }
  const pickSongAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(scene.children, true)
    for (const hit of hits) {
      const songId = songIdFromObject(hit.object)
      if (!songId) continue
      canvas.dispatchEvent(new CustomEvent('jay-town-open-song', { bubbles: true, detail: { songId } }))
      return
    }
  }
  const onPointerUp = (event: PointerEvent) => {
    const wasClick = event.type === 'pointerup' && drag && drag.id === event.pointerId && !drag.moved
    const clickX = event.clientX, clickY = event.clientY
    drag = null
    canvas.classList.remove('is-dragging')
    if (wasClick && !paused) pickSongAt(clickX, clickY)
  }
  const onWheel = (event: WheelEvent) => {
    if (paused) return
    event.preventDefault()
    journey = null
    wheelVelocity = clamp(wheelVelocity + event.deltaY * 0.004, -3, 3)
  }
  const onContextLost = (event: Event) => { event.preventDefault(); clearMovement(); paused = true; options.onError?.() }
  const onContextRestored = () => { paused = false; renderer.shadowMap.needsUpdate = true; options.onReady?.() }
  const resize = () => {
    const width = canvas.clientWidth || innerWidth, height = canvas.clientHeight || innerHeight
    camera.aspect = width / height
    camera.fov = width < height ? 70 : 62
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    ink.resize(Math.floor(width * renderer.getPixelRatio()), Math.floor(height * renderer.getPixelRatio()))
  }
  const onVisibility = () => {
    hidden = document.hidden
    clearMovement()
    if (hidden) { cancelAnimationFrame(frame); previousTime = 0 }
    else if (!disposed) frame = requestAnimationFrame(tick)
  }
  const onPageHide = (event: PageTransitionEvent) => { clearMovement(); if (!event.persisted) dispose() }
  const onPageShow = () => { if (!disposed) { hidden = document.hidden; previousTime = 0; cancelAnimationFrame(frame); frame = requestAnimationFrame(tick) } }

  function tick(now: number) {
    if (disposed || hidden) return
    const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.6) : 0.016
    previousTime = now; elapsed = now / 1000
    const animateTime = media.matches ? 0 : elapsed
    if (journey && !paused) {
      const t = clamp((elapsed - journey.start) / 1.6, 0, 1)
      const smooth = t * t * (3 - 2 * t)
      position.lerpVectors(journey.from, journey.to, smooth)
      yaw = THREE.MathUtils.lerp(journey.yawFrom, journey.yawTo, smooth)
      if (t === 1) journey = null
    }
    let walking = false
    if (!journey && !paused && !inputFocused()) {
      let mx = mobileMove.x + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
      let mz = mobileMove.y + Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
      const length = Math.hypot(mx, mz)
      if (length > 1) { mx /= length; mz /= length }
      mz -= wheelVelocity
      wheelVelocity *= Math.exp(-dt * 8)
      if (Math.abs(wheelVelocity) < 0.01) wheelVelocity = 0
      const speed = (keys.has('shift') ? 7 : 3.8) * dt
      const dx = (mx * Math.cos(yaw) + mz * Math.sin(yaw)) * speed
      const dz = (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) * speed
      // Substeps preserve wall collision at a low frame rate without slowing the walk.
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15))
      for (let step = 0; step < steps; step++) {
        if (canStand(position.x + dx / steps, position.z)) position.x += dx / steps
        if (canStand(position.x, position.z + dz / steps)) position.z += dz / steps
      }
      walking = Math.abs(dx) + Math.abs(dz) > 0.001
    }
    updateZone()
    camera.position.copy(position)
    if (walking && !media.matches) camera.position.y += Math.sin(elapsed * 9) * 0.027
    camera.rotation.set(pitch, yaw, 0)
    night = media.matches ? nightTarget : THREE.MathUtils.lerp(night, nightTarget, 1 - Math.exp(-dt * 1.8))
    sky.position.copy(camera.position)
    skyMaterial.uniforms.night.value = night
    skyMaterial.uniforms.time.value = animateTime
    ;(scene.fog as THREE.Fog).color.copy(dayFog).lerp(nightFog, night)
    hemisphere.color.copy(daySky).lerp(nightSky, night)
    hemisphere.groundColor.copy(dayGround).lerp(nightGround, night)
    hemisphere.intensity = THREE.MathUtils.lerp(0.82, 0.42, night)
    sun.color.copy(daySun).lerp(nightSun, night)
    sun.intensity = THREE.MathUtils.lerp(1.22, 0.34, night)
    fill.color.copy(dayFill).lerp(nightFill, night)
    fill.intensity = THREE.MathUtils.lerp(0.46, 0.18, night)
    // The town and canopy are static. Keep their shadow map until the walk
    // reaches a new section instead of drawing all the branches every frame.
    if (Math.abs(position.z - shadowCenter) > 2.5) {
      shadowCenter = position.z
      sun.position.z = shadowCenter + 15
      sun.target.position.set(0, 0, shadowCenter - 10)
      renderer.shadowMap.needsUpdate = true
    }
    world.update(animateTime, night)
    canopies.update(night, canvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)))
    streetDetails.forEach(detail => detail.update?.(animateTime, night))
    updatePetals(animateTime)
    ink.render(renderer, scene, camera)
    frame = requestAnimationFrame(tick)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    clearMovement()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', clearMovement)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('lostpointercapture', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    canvas.removeEventListener('webglcontextrestored', onContextRestored)
    petals.dispose()
    world.dispose()
    details.dispose()
    storefronts.dispose()
    canopies.dispose()
    streetDetails.forEach(detail => detail.dispose())
    sun.shadow.dispose()
    ink.dispose()
    resources.forEach(resource => resource.dispose())
    renderer.dispose()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearMovement)
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('lostpointercapture', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)
  resize()
  updatePetals(0)
  ink.render(renderer, scene, camera)
  options.onReady?.()
  updateZone()
  frame = requestAnimationFrame(tick)
  return {
    goTo,
    setNight(value) { nightTarget = value ? 1 : 0 },
    setMove(x, z) { mobileMove.set(clamp(x, -1, 1), clamp(z, -1, 1)); if (x || z) journey = null },
    setPaused(value) { paused = value; if (value) clearMovement() },
    dispose,
  }
}
