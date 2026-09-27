import * as THREE from 'three'
import { SCREENS, type ScreenSpec } from './screens'
import {
  makeCorners, fillCorners, projectQuad, quadToHomography, invert3x3, matrix3dCss,
  PROJECTION_REVISION,
  type Quad,
} from './projection'
import { ScreenMask } from './mask'
import {
  MediaPortal, ARM_RANGE, RELEASE_RANGE,
  type PortalState, type PortalSource,
} from './media-portal'

/**
 * All the screens, driven from one place.
 *
 * Per frame, for each screen: work out whether it is in front of the camera
 * and how big it is on screen, project its rectangle, and hand the resulting
 * CSS matrix to its portal.  The expensive part -- the depth readback that
 * decides which parts of the screen the world is hiding -- runs on its own
 * slower clock, because nothing about it changes at 60 Hz.
 *
 * The hub never touches the world.  It reads the screen groups' world matrices
 * and the camera, and writes CSS; everything it needs arrives in `update()`.
 */

export type ScreenRole = 'live' | 'placeholder'

export type ScreenInfo = {
  zone: number
  name: string
  role: ScreenRole
  /** Flat distance from the viewer, in metres. */
  distance: number
  /** True when the screen is in front of the camera rather than behind it. */
  facing: boolean
  /** Fraction of the screen the world does not hide, 0-1. */
  coverage: number
  /** Screen-space centre in CSS pixels, for the compass.  Null when not drawn. */
  screenCentre: { x: number; y: number } | null
  state: PortalState
}

export type HubInput = {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  /** The scene's depth attachment, or null when there is none. */
  depthTexture: THREE.DepthTexture | null
  sceneWidth: number
  sceneHeight: number
  /** Viewer position in flat authoring coordinates, for distance and arming. */
  flatX: number
  flatZ: number
}

export type HubSong = PortalSource & { zone: number }

/** Longest a mask may go stale, in seconds. */
const MASK_INTERVAL = 1 / 6
/** Camera move, in metres squared, that invalidates a mask. */
const MASK_MOVE = 0.0004
/** Beyond this the screen is a few pixels of haze and not worth masking. */
const MASK_RANGE = 90
/** Beyond this nothing is projected at all. */
const DRAW_RANGE = 140
/** Cell counts per axis.  ~25 px a cell at 1440 wide. */
const MASK_W = 96
const MASK_H = 54

export class ScreenHub {
  private portals: MediaPortal[] = []
  private groups = new Map<number, THREE.Object3D>()
  private maskCache = new Map<number, ScreenMask>()

  private corners = makeCorners()
  private quad: Quad = [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ]
  private homography = new Float32Array(9)
  private matrixScratch: number[] = new Array(16).fill(0)

  private centre = new THREE.Vector3()
  private right = new THREE.Vector3()
  private up = new THREE.Vector3()
  private normal = new THREE.Vector3()
  private cameraPos = new THREE.Vector3()
  private toCentre = new THREE.Vector3()
  private lastMaskAt = new THREE.Vector3(9e9, 9e9, 9e9)

  private song: HubSong | null = null
  private platform: 'bilibili' | 'youtube' = 'bilibili'
  private pinned: number | null = null
  private maskClock = MASK_INTERVAL
  private info: ScreenInfo[] = []
  private surveyClock = 0
  /** Last frame's projection working, for the verification harness. */
  readonly debug: unknown[] = []
  readonly revision = PROJECTION_REVISION

  /** Called once a frame with the current per-screen state. */
  onInfo: ((info: ScreenInfo[]) => void) | null = null
  /** Called when the song changes hands, with the zone now holding it. */
  onFocus: ((zone: number) => void) | null = null

  constructor(host: HTMLElement, specs: ScreenSpec[] = SCREENS) {
    for (const spec of specs) {
      this.portals.push(new MediaPortal({ spec, host }))
    }
  }

  /** Register built geometry so the hub reads live world matrices. */
  attach(zone: number, group: THREE.Object3D): void {
    this.groups.set(zone, group)
  }

  /**
   * Round-trip the homography for one quad, in the running browser.
   *
   * Exists so the harness can prove the *deployed* module inverts correctly,
   * rather than trusting that the source on disk is the code the browser ran.
   */
  selfCheck(quad: Quad, boxW: number, boxH: number): { det: number; identity: number[]; css: string; mapped: number[] } | null {
    const h = quadToHomography(quad, new Float32Array(9))
    if (!h) return null
    const inv = invert3x3(h, new Float32Array(9))
    if (!inv) return null
    const out: number[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        let s = 0
        for (let k = 0; k < 3; k++) s += inv[k * 3 + r] * h[c * 3 + k]
        out.push(+s.toFixed(4))
      }
    }
    const css = matrix3dCss(h, boxW, boxH, new Array(16).fill(0))
    /* Evaluate the string the browser was actually given, on its own CSS box.
     * Per the spec the 16 values are column-major -- value `4c + r` is row r of
     * column c -- the point is (x, y, 0, 1), and the result is divided by its
     * own fourth component.  `transform-origin` is (0, 0), so nothing else
     * moves. */
    const a = css.slice(css.indexOf('(') + 1, css.indexOf(')')).split(',').map(Number)
    const mapped: number[] = []
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const X = u * boxW
      const Y = v * boxH
      const v0 = a[0] * X + a[4] * Y + a[12]
      const v1 = a[1] * X + a[5] * Y + a[13]
      const v3 = a[3] * X + a[7] * Y + a[15]
      mapped.push(+(v0 / v3).toFixed(1), +(v1 / v3).toFixed(1))
    }
    return {
      det: +new THREE.Matrix3().set(h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]).determinant().toFixed(2),
      identity: out,
      css,
      mapped,
    }
  }

  /**
   * The projected quad for one screen, in scene pixels.
   * Exists for `scripts/verify-jay-town.mjs`, and only for that: alignment is
   * the one property of this system that cannot be checked by looking at the
   * DOM, because a wrong matrix and a right one both produce *a* rectangle.
   */
  probeQuad(zone: number, camera: THREE.PerspectiveCamera, w: number, h: number): Quad | null {
    const group = this.groups.get(zone)
    if (!group) return null
    group.updateWorldMatrix(true, false)
    const e = group.matrixWorld.elements
    const right = new THREE.Vector3(e[0], e[1], e[2]).normalize()
    const up = new THREE.Vector3(e[4], e[5], e[6]).normalize()
    const centre = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld)
    const spec = SCREENS.find((s) => s.zone === zone)
    if (!spec) return null
    const corners = makeCorners()
    fillCorners(centre, right, up, spec.w / 2, spec.h / 2, corners)
    const quad: Quad = [
      { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
    ]
    return projectQuad(camera, corners, w, h, quad)
  }

  /**
   * Point every screen at one song.
   *
   * Only one of them ever loads anything: a page with five live players is
   * five videos talking at once and five times the bandwidth, and the viewer
   * can only be standing in front of one of them.
   */
  setSong(song: HubSong | null): void {
    this.song = song
    if (!song) {
      for (const portal of this.portals) portal.release()
      return
    }
    const target = this.portalForZone(song.zone)
    for (const portal of this.portals) {
      if (portal !== target) portal.release()
    }
  }

  /**
   * Bring one zone's screen to life.
   *
   * Called when the viewer picks a song out of the drawer or presses play on
   * the bar: it is a deliberate act, so the screen is armed even if they are
   * still walking towards it, and the distance test in `survey` will not take
   * it away again.
   */
  focus(zone: number): void {
    if (this.song && this.song.zone !== zone) return
    this.pinned = zone
    const portal = this.portalForZone(zone)
    if (!portal || !this.song) return
    portal.arm(this.song, this.platform)
    portal.show(true)
    this.onFocus?.(zone)
  }

  /** Switch every screen to the other platform, keeping the song. */
  setPlatform(platform: 'bilibili' | 'youtube'): void {
    this.platform = platform
    if (!this.song) return
    this.portalForZone(this.song.zone)?.setPlatform(this.song, platform)
  }

  /**
   * Let the viewer's feet decide whether a screen is awake.
   *
   * Runs four times a second rather than every frame: arming is a network
   * event, and a threshold crossed at 4 Hz is indistinguishable from one
   * crossed at 60 Hz.
   */
  private survey(flatX: number, flatZ: number): void {
    if (!this.song) return
    const own = this.portalForZone(this.song.zone)
    if (!own) return
    const distance = Math.hypot(flatX - own.spec.x, flatZ - own.spec.z)

    if (distance <= ARM_RANGE) {
      if (!own.hasMedia) own.arm(this.song, this.platform)
      this.pinned = this.song.zone
      return
    }

    // Walking away releases the player, but never while the viewer has just
    // asked for this screen by name.
    if (distance > RELEASE_RANGE && this.pinned !== this.song.zone && own.hasMedia) {
      own.release()
    }
  }

  private portalForZone(zone: number): MediaPortal | undefined {
    return this.portals.find((portal) => portal.spec.zone === zone)
  }

  update(input: HubInput, dt: number): void {
    const { camera, renderer, depthTexture } = input
    this.cameraPos.copy(camera.position)
    this.debug.length = 0

    this.surveyClock += dt
    if (this.surveyClock > 0.25) {
      this.surveyClock = 0
      this.survey(input.flatX, input.flatZ)
    }

    this.maskClock += dt
    const moved = this.lastMaskAt.distanceToSquared(this.cameraPos) > MASK_MOVE
    const maskDue = moved && this.maskClock >= MASK_INTERVAL

    const nextInfo: ScreenInfo[] = []

    for (const portal of this.portals) {
      const spec = portal.spec
      const group = this.groups.get(spec.zone)
      if (!group) continue

      /* Basis straight off the live group, so the planet bake and the
       * builder's own rotation are both already folded in. */
      group.updateWorldMatrix(true, false)
      const e = group.matrixWorld.elements
      this.right.set(e[0], e[1], e[2]).normalize()
      this.up.set(e[4], e[5], e[6]).normalize()
      this.normal.copy(this.right).cross(this.up).normalize()
      this.centre.setFromMatrixPosition(group.matrixWorld)

      this.toCentre.copy(this.centre).sub(this.cameraPos)
      const facing = this.toCentre.dot(this.normal) > 0
      const distance = Math.hypot(input.flatX - spec.x, input.flatZ - spec.z)

      fillCorners(this.centre, this.right, this.up, spec.w / 2, spec.h / 2, this.corners)

      const projected = facing && distance < DRAW_RANGE
        ? projectQuad(camera, this.corners, input.sceneWidth, input.sceneHeight, this.quad)
        : null

      let matrix = ''
      let centreX = 0
      let centreY = 0
      if (projected) {
        // `projected` aliases the hub's own quad buffer, so anything that has
        // to outlive this iteration is copied out as plain numbers here.
        centreX = (projected[0].x + projected[1].x + projected[2].x + projected[3].x) / 4
        centreY = (projected[0].y + projected[1].y + projected[2].y + projected[3].y) / 4
        const h = quadToHomography(projected, this.homography)
        matrix = h
          ? matrix3dCss(h, portal.boxWidth, portal.boxHeight, this.matrixScratch)
          : ''
      }
      if (distance < 40) {
        this.debug.push({
          zone: spec.zone,
          quad: projected ? projected.map((p) => [+p.x.toFixed(1), +p.y.toFixed(1)]) : null,
          matrix,
          check: projected ? this.selfCheck(projected, portal.boxWidth, portal.boxHeight) : null,
        })
      }

      let coverage = 1
      let maskUrl: string | null = null
      let draw = Boolean(projected) && matrix !== ''

      if (draw && maskDue && depthTexture && distance < MASK_RANGE) {
        const result = this.maskFor(spec.zone).update(
          renderer, depthTexture, camera, this.centre, camera.near, camera.far,
        )
        maskUrl = result.maskUrl
        coverage = result.coverage
        if (coverage <= 0) draw = false
      }

      portal.place(draw ? matrix : '', maskUrl, coverage)
      portal.show(draw)

      nextInfo.push({
        zone: spec.zone,
        name: spec.name,
        role: portal.hasMedia ? 'live' : 'placeholder',
        distance,
        facing,
        coverage: draw ? coverage : 0,
        screenCentre: draw ? { x: centreX, y: centreY } : null,
        state: portal.currentState,
      })
    }

    if (maskDue) {
      this.lastMaskAt.copy(this.cameraPos)
      this.maskClock = 0
    }

    this.info = nextInfo
    this.onInfo?.(nextInfo)
  }

  private maskFor(zone: number): ScreenMask {
    let mask = this.maskCache.get(zone)
    if (!mask) {
      mask = new ScreenMask(MASK_W, MASK_H)
      this.maskCache.set(zone, mask)
    }
    return mask
  }

  get screenInfo(): ScreenInfo[] {
    return this.info
  }

  dispose(): void {
    for (const portal of this.portals) portal.dispose()
    for (const mask of this.maskCache.values()) mask.dispose()
    this.portals = []
    this.maskCache.clear()
    this.groups.clear()
    this.onInfo = null
    this.onFocus = null
  }
}
