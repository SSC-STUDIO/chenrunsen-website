/**
 * Jay-town scene mount: Sakura Crossing world on the existing Astro canvas.
 * Upstream: Kenton-GMI/sakura-crossing @ de01898 (MIT) — see crossing/NOTICE.
 * Site chrome (stops, song drawer, day/night) stays in jay-town.astro.
 */
import * as THREE from 'three'
import { PAL } from './crossing/core/palette.js'
import { Pipeline } from './crossing/core/post.js'
import { buildSky } from './crossing/core/sky.js'
import { R, CENTER, basisAt, positionAt } from './crossing/world/planet.js'
import { setOutlineResolution } from './crossing/core/outline.js'
import { Player } from './crossing/core/player.js'
import { buildWorld } from './crossing/world/index.js'
import { createEbike } from './crossing/world/ebike.js'
import { screenRegistry, setScreenNight } from './crossing/world/jayscreen.js'
import { ScreenHub, type ScreenInfo, type HubSong } from './screens/screen-hub'

type Options = {
  onReady?: () => void
  onError?: () => void
  onZoneChange?: (index: number) => void
  /** Fired when the in-world screens are attached and ready to be driven. */
  onScreensReady?: (hub: ScreenHub) => void
  /** Fired every frame with the per-screen state, for the page's compass. */
  onScreenInfo?: (info: ScreenInfo[]) => void
  /**
   * Fired between build phases with a short human label.
   *
   * `mountTownScene` is synchronous and blocks for seconds, so a caller that
   * wants to paint progress has to give the browser a frame in between; the
   * page does that by awaiting a rAF inside this callback.
   */
  onPhase?: (label: string) => void
}

export type TownSceneHandle = {
  goTo(index: number): void
  setNight(value: boolean): void
  setMove(x: number, z: number): void
  setPaused(value: boolean): void
  /* The in-world screens.  `setSong` picks what every screen is showing;
   * `focus` wakes one by hand, which is what the drawer's play buttons do. */
  screens: ScreenHub | null
  setSong(song: HubSong | null): void
  focusScreen(zone: number): void
  dispose(): void
}

/**
 * Five themed stops mapped onto real places in Sakura Crossing
 * (flat authoring x/z, yaw in local surface frame).
 *
 * 0 樱花街口 — opening spawn at the level crossing
 * 1 唱片小巷 — さくら坂商店街 corridor (晴天唱片)
 * 2 晴天广场 — shrine terrace / precinct
 * 3 花海车站 — unstaffed platform east of the tracks
 * 4 七里香河堤 — canal south service path / bridge approach
 */
const STOPS = [
  { x: 1.85, z: 13.6, yaw: 0.20, pitch: -0.008 },
  { x: 22.2, z: 28.5, yaw: -0.05, pitch: -0.02 },
  { x: -27.9, z: 31.5, yaw: 0.0, pitch: -0.04 },
  { x: 22.5, z: -3.6, yaw: Math.PI * 0.5, pitch: -0.02 },
  { x: 4.2, z: -29.4, yaw: -0.15, pitch: -0.03 },
] as const

const clamp = THREE.MathUtils.clamp

const inputFocused = () => {
  const active = document.activeElement as HTMLElement | null
  return !!active?.closest('input,textarea,select,[contenteditable="true"],dialog[open],.song-drawer:not([hidden]),.video-panel:not([hidden])')
}

export function mountTownScene(canvas: HTMLCanvasElement, options: Options = {}): TownSceneHandle {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  /* `?lite=1` / `?lite=0` force the quality tier, which is the only way to
   * measure what the tier is worth on one machine at one moment -- the
   * pointer-coarse test cannot be varied from a desktop viewport. */
  const liteParam = new URLSearchParams(window.location.search).get('lite')
  const lite = liteParam === null
    ? coarse || window.innerWidth < 700
    : liteParam === '1'
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
  } catch {
    options.onError?.()
    return {
      goTo() {}, setNight() {}, setMove() {}, setPaused() {},
      screens: null, setSong() {}, focusScreen() {}, dispose() {},
    }
  }

  renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.shadowMap.enabled = !lite
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.setClearColor(new THREE.Color(PAL.fog), 1)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(PAL.fog, lite ? 36 : 44, lite ? 160 : 205)

  const camera = new THREE.PerspectiveCamera(46, 1, 0.25, 600)
  camera.rotation.order = 'YXZ'

  const sun = new THREE.DirectionalLight(PAL.sun, 2.25)
  sun.position.set(-52, 62, 56)
  sun.castShadow = !lite
  sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048)
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 200 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.035
  scene.add(sun, sun.target)

  const fill = new THREE.DirectionalLight(PAL.fill, 1.08)
  fill.position.set(48, 26, -44)
  scene.add(fill, fill.target)

  const bounce = new THREE.DirectionalLight(0xd8cbe8, 0.34)
  bounce.position.set(10, -18, 40)
  scene.add(bounce, bounce.target)

  const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.12)
  scene.add(hemi)

  const day = {
    sunI: 2.25, fillI: 1.08, bounceI: 0.34, hemiI: 1.12,
    fog: new THREE.Color(PAL.fog),
    sunC: new THREE.Color(PAL.sun),
    fillC: new THREE.Color(PAL.fill),
    hemiSky: new THREE.Color(PAL.hemiSky),
    hemiGround: new THREE.Color(PAL.hemiGround),
  }
  const night = {
    sunI: 0.28, fillI: 0.42, bounceI: 0.18, hemiI: 0.55,
    fog: new THREE.Color(0x2a3048),
    sunC: new THREE.Color(0xa8b8e8),
    fillC: new THREE.Color(0x6e7eb8),
    hemiSky: new THREE.Color(0x6a7aa0),
    hemiGround: new THREE.Color(0x3a3558),
  }

  let sky: ReturnType<typeof buildSky>
  let world: ReturnType<typeof buildWorld>
  let player: Player
  let ebike: ReturnType<typeof createEbike> | null = null
  let pipeline: Pipeline

  try {
    sky = buildSky(scene, 500)
    world = buildWorld(scene, options.onPhase)
    player = new Player(camera, canvas, world, { freeWalk: true, dragLook: true })
    player.pos.y = world.heightAt(player.pos.x, player.pos.z)
    player.applyCamera(0)
    if (!lite) ebike = createEbike({ scene, world, player, hud: null })
    pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: lite ? 1.6e6 : 3.8e6 })
    /* **Supersampling is a desktop luxury, and the pipeline cannot know that.**
     *
     * `Pipeline.setSize` picks a render scale from the device pixel ratio alone
     * -- 1.5 on a 1x screen, up to 2 on a 2x one -- and then clamps it by the
     * pixel budget.  On a phone that means *supersampling a scene of 8.7
     * million triangles*, which is the wrong place to spend a mobile GPU's
     * budget by a wide margin: the ink pass wants the extra resolution, but not
     * at 2.9x the fill.
     *
     * `forceScale` is the hook the pipeline already has for exactly this, and
     * it takes precedence over the dpr guess.  1.0 on `lite` -- render at
     * layout size.  The ink lines soften slightly and the frame time drops by
     * most of a factor of three. */
    if (lite) pipeline.forceScale = 1
  } catch (error) {
    console.error('Unable to mount Sakura Crossing town', error)
    renderer.dispose()
    options.onError?.()
    return {
      goTo() {}, setNight() {}, setMove() {}, setPaused() {},
      screens: null, setSong() {}, focusScreen() {}, dispose() {},
    }
  }

  /* The in-world screens.  The hub owns its own overlay layer, created here
   * rather than in the page markup: the projection is only correct inside the
   * canvas's own viewport-sized box, and tying the two together in one place
   * is what stops them drifting apart. */
  const screenHost = document.createElement('div')
  screenHost.className = 'screen-layer'
  canvas.parentElement?.appendChild(screenHost)
  const screens = new ScreenHub(screenHost)
  screens.onInfo = (info) => options.onScreenInfo?.(info)
  screens.setLite(lite)
  for (const [zone, group] of screenRegistry()) screens.attach(zone, group)
  /* `?screens=0` leaves the frames in the world and switches the projection
   * off, which is how `scripts/verify-jay-town.mjs` measures what this system
   * costs.  Nothing in the product sets it. */
  if (new URLSearchParams(window.location.search).get('screens') === '0') {
    screens.setEnabled(false)
  }

  player.onInteract = (target) => {
    if (ebike?.riding) { ebike.dismount(); return }
    target?.action?.()
  }

  let disposed = false
  let paused = false
  let hidden = document.hidden
  let nightTarget = 0
  let nightAmt = 0
  let zone = 0
  let frame = 0
  let planetView = false
  let orbit = 0.6
  const clock = new THREE.Clock()
  const shadowTarget = new THREE.Vector3()
  const sunOffset = new THREE.Vector3()
  const orbitDir = new THREE.Vector3()
  const SUN_LOCAL = new THREE.Vector3(-52, 62, 56)
  const FILL_LOCAL = new THREE.Vector3(48, 26, -44)
  const BOUNCE_LOCAL = new THREE.Vector3(10, -18, 40)
  const savedFog = scene.fog
  const savedFar = camera.far

  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null

  function seatLight(light: THREE.DirectionalLight, local: THREE.Vector3, basis: ReturnType<typeof basisAt>, origin: THREE.Vector3) {
    sunOffset.set(0, 0, 0)
      .addScaledVector(basis.east, local.x)
      .addScaledVector(basis.up, local.y)
      .addScaledVector(basis.north, local.z)
    light.target.position.copy(origin)
    light.position.copy(origin).add(sunOffset)
  }

  function setPlanetView(on: boolean) {
    planetView = on
    scene.fog = on ? null : savedFog
    camera.far = on ? 1600 : savedFar
    camera.updateProjectionMatrix()
    const s = sun.shadow.camera
    const half = on ? R * 1.15 : 34
    s.left = -half; s.right = half; s.top = half; s.bottom = -half
    s.far = on ? R * 6 : 200
    s.updateProjectionMatrix()
  }

  function updateZoneFromPos() {
    let nearest = 0
    let best = Infinity
    STOPS.forEach((stop, index) => {
      const d = Math.hypot(player.pos.x - stop.x, player.pos.z - stop.z)
      if (d < best) { best = d; nearest = index }
    })
    if (zone !== nearest) {
      zone = nearest
      options.onZoneChange?.(zone)
    }
    canvas.dataset.zone = String(zone)
    canvas.dataset.position = `${player.pos.x.toFixed(2)},${player.pos.z.toFixed(2)}`
  }

  function goTo(index: number) {
    const stop = STOPS[clamp(Math.round(index), 0, STOPS.length - 1)]
    if (ebike?.riding) ebike.dismount()
    if (planetView) setPlanetView(false)
    player.pos.x = stop.x
    player.pos.z = stop.z
    player.pos.y = world.heightAt(stop.x, stop.z)
    player.yaw = stop.yaw
    player.pitch = stop.pitch
    player.vel.set(0, 0, 0)
    player.bob = 0
    player.keys.clear()
    player.setExternalMove(0, 0)
    player.applyCamera(0)
    zone = clamp(Math.round(index), 0, STOPS.length - 1)
    options.onZoneChange?.(zone)
    updateZoneFromPos()
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    camera.aspect = w / Math.max(h, 1)
    camera.updateProjectionMatrix()
    pipeline.setSize(w, h)
    setOutlineResolution(pipeline.size.x, pipeline.size.y)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || paused || inputFocused()) return
    if (/^[1-5]$/.test(event.key)) {
      event.preventDefault()
      goTo(Number(event.key) - 1)
      return
    }
    if (event.code === 'KeyP' && !event.repeat) {
      setPlanetView(!planetView)
      return
    }
    if (event.code === 'KeyV' && !event.repeat && ebike) {
      if (planetView) setPlanetView(false)
      else ebike.toggle()
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (paused || event.button !== 0 || inputFocused()) return
    // Prefer pointer lock on fine pointers; drag-look always available as fallback.
    if (!coarse && !player.locked && !document.pointerLockElement) {
      try { player.lock() } catch { /* optional */ }
    }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false }
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId || player.locked) return
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true
    player.look(event.clientX - drag.x, event.clientY - drag.y)
    drag.x = event.clientX
    drag.y = event.clientY
  }
  const onPointerUp = (event: PointerEvent) => {
    if (drag && drag.id === event.pointerId) drag = null
    canvas.classList.remove('is-dragging')
  }

  const onContextLost = (event: Event) => {
    event.preventDefault()
    paused = true
    options.onError?.()
  }
  const onContextRestored = () => {
    paused = false
    options.onReady?.()
  }

  const onVisibility = () => {
    hidden = document.hidden
    player.keys.clear()
    player.setExternalMove(0, 0)
    if (hidden) {
      cancelAnimationFrame(frame)
      clock.stop()
    } else if (!disposed) {
      clock.start()
      frame = requestAnimationFrame(tick)
    }
  }

  function applyNight(amt: number) {
    const t = amt
    sun.intensity = THREE.MathUtils.lerp(day.sunI, night.sunI, t)
    fill.intensity = THREE.MathUtils.lerp(day.fillI, night.fillI, t)
    bounce.intensity = THREE.MathUtils.lerp(day.bounceI, night.bounceI, t)
    hemi.intensity = THREE.MathUtils.lerp(day.hemiI, night.hemiI, t)
    sun.color.copy(day.sunC).lerp(night.sunC, t)
    fill.color.copy(day.fillC).lerp(night.fillC, t)
    hemi.color.copy(day.hemiSky).lerp(night.hemiSky, t)
    hemi.groundColor.copy(day.hemiGround).lerp(night.hemiGround, t)
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(day.fog).lerp(night.fog, t)
    sky.setNight(t)
    setScreenNight(t)
  }

  function tick() {
    if (disposed || hidden) return
    const dt = media.matches ? 0 : Math.min(clock.getDelta(), 1 / 20)

    if (!paused && !inputFocused()) {
      if (!planetView) {
        player.update(dt)
        ebike?.update(dt)
      }
      world.update(dt)
    }

    if (planetView) {
      orbit += dt * 0.09
      orbitDir.set(Math.sin(orbit) * 0.8, 1.0, Math.cos(orbit) * 0.8).normalize()
      camera.position.copy(CENTER).addScaledVector(orbitDir, R * 3.3)
      camera.up.set(0, 1, 0)
      camera.lookAt(CENTER)
      sun.target.position.copy(CENTER)
      sun.position.copy(CENTER).add(new THREE.Vector3(-1.05, 0.95, 0.75).multiplyScalar(R * 2.2))
      hemi.position.set(0, 1, 0)
      seatLight(fill, FILL_LOCAL, { east: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), north: new THREE.Vector3(0, 0, 1) }, CENTER)
      bounce.visible = false
    } else {
      bounce.visible = true
      const b = basisAt(player.pos.x, player.pos.z)
      positionAt(player.pos.x, 0, player.pos.z, shadowTarget)
      seatLight(sun, SUN_LOCAL, b, shadowTarget)
      seatLight(fill, FILL_LOCAL, b, shadowTarget)
      seatLight(bounce, BOUNCE_LOCAL, b, shadowTarget)
      hemi.position.copy(b.up)
    }

    sky.dome.position.copy(camera.position)
    sky.clouds.position.copy(camera.position)

    nightAmt = media.matches ? nightTarget : THREE.MathUtils.lerp(nightAmt, nightTarget, 1 - Math.exp(-dt * 1.8))
    applyNight(nightAmt)

    if (!planetView && !paused) updateZoneFromPos()

    const hovered = !planetView && (player.locked || player.freeWalk) ? player.pick(world.interactables) : null
    void hovered

    pipeline.render()

    /* After the colour pass on purpose: the screens' occlusion mask needs the
     * depth the render just produced, and the mask is a single quad over a
     * few hundred pixels rather than anything that belongs in the scene. */
    screens.update({
      renderer,
      camera,
      depthTexture: pipeline.rtScene.depthTexture,
      sceneWidth: pipeline.size.x,
      sceneHeight: pipeline.size.y,
      flatX: player.pos.x,
      flatZ: player.pos.z,
    }, dt)

    frame = requestAnimationFrame(tick)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    player.keys.clear()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    canvas.removeEventListener('webglcontextrestored', onContextRestored)
    if (document.pointerLockElement === canvas) document.exitPointerLock?.()
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.()
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((m) => m?.dispose?.())
      }
    })
    sun.shadow.dispose()
    screens.dispose()
    screenHost.remove()
    renderer.dispose()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', resize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  resize()
  updateZoneFromPos()
  options.onReady?.()
  options.onScreensReady?.(screens)
  /* Dev handle.  The screens are the one part of this page whose correctness
   * cannot be read off the DOM, so the harness in `scripts/verify-jay-town.mjs`
   * needs a way in; it is inert in production. */
  ;(window as unknown as { __jayTown?: unknown }).__jayTown = { scene, screens, player, world, camera, renderer, pipeline }
  frame = requestAnimationFrame(tick)

  return {
    goTo,
    screens,
    setSong(song) { screens.setSong(song) },
    focusScreen(zone) { screens.focus(zone) },
    setNight(value) { nightTarget = value ? 1 : 0 },
    setMove(x, z) {
      // Page pad: z=-1 forward, x=+1 right → player fwd/side
      player.setExternalMove(clamp(x, -1, 1), clamp(-z, -1, 1))
    },
    setPaused(value) {
      paused = value
      if (value) {
        player.keys.clear()
        player.setExternalMove(0, 0)
        if (document.pointerLockElement === canvas) document.exitPointerLock?.()
      }
    },
    dispose,
  }
}
