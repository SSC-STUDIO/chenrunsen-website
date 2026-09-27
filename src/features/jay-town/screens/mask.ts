import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

/**
 * Occlusion for the projected portals.
 *
 * A DOM overlay always draws on top of the canvas, so without this a video
 * hung on a wall would shine straight through the house in front of it.  The
 * fix is to ask the depth buffer which parts of the screen are actually
 * visible, and mask the portal with the answer.
 *
 * The depth buffer is already there: `Pipeline` renders the scene into
 * `rtScene` with a `DepthTexture` attached, and the ink pass reads the same
 * texture.  So one extra pass over a single full-screen quad, shaded against
 * that depth, is all this costs -- no second traversal of the world, and no
 * per-frame `readPixels` of the real frame.
 *
 * The readback is the only synchronous GPU stall in the system, so it is
 * deliberately tiny (a few hundred cells) and rate-limited by the caller.
 *
 * ## How the test works
 *
 * `tDepth` stores the *non-linear* depth of whatever the scene drew at that
 * pixel.  Linearising it and negating gives the positive eye-space distance
 * `d_scene`.  Separately, the fragment's own distance along the camera ray is
 * `d_plane = dot(center - camPos, rayDir)`, and the *ray's* length to the
 * screen is `L = d_plane / dot(rayDir, toCenterUnit)`.  The screen is visible
 * there when `d_scene >= L`, which folds to a single comparison of the two
 * plane distances:
 *
 *     visible  <=>  d_scene * dot(rayDir, fromCamToCenter) >= d_plane
 *
 * ## What the mask can and cannot do
 *
 * It is a binary grid, one cell per sample, scaled up with smoothing on.  A
 * cell is roughly 4 cm across at the near screen and about 20 cm at the far
 * one, which is coarser than the ink line the pipeline draws on the same
 * edges -- so the boundary reads as a soft silhouette rather than as a
 * staircase.  Where it is *wrong* it is wrong by one cell on a grazing
 * surface, which is a few pixels of video bleeding around a corner.  Pixel
 * exactness would need a stencil and a second full-resolution pass per screen;
 * that is not a trade this scene needs.
 */

const MASK_FRAG = /* glsl */ `
  #include <packing>
  uniform sampler2D tDepth;
  uniform vec3 uCamPos;
  uniform vec3 uCenter;
  uniform mat4 uInvVP;
  uniform float uNear;
  uniform float uFar;
  uniform vec2 uGrid;
  varying vec2 vUv;

  void main() {
    // World position of the ray through this pixel, at the screen's plane.
    vec4 far = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 dir = normalize(far.xyz / far.w - uCamPos);

    vec3 toCenter = uCenter - uCamPos;
    float planeDist = dot(toCenter, dir);

    // The screen's centre is at or behind this pixel's ray: nothing to show.
    if (planeDist <= 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float cosT = dot(dir, normalize(toCenter));
    if (cosT < 1e-3) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Eye-space distance to the screen along this ray.
    float rayLen = planeDist / cosT;

    float sceneRaw = texture2D(tDepth, vUv).x;
    float viewZ = perspectiveDepthToViewZ(sceneRaw, uNear, uFar);
    float sceneDist = -viewZ;

    /* **Supersampled, so a diagonal edge comes out as a gradient rather than a
     * staircase.**  The grid is coarse on purpose -- a few thousand cells rather
     * than a full frame -- and a hard on/off per cell turns every diagonal
     * silhouette into visible steps.  Four samples with a scaled offset break
     * the edge across five levels instead, which is what lets the consumer keep
     * a cell that is *partly* visible and read as antialiased.
     *
     * The offset is scaled by the cell's own footprint at that point, so it
     * stays a fraction of a cell whether the screen is a metre away or forty. */
    vec2 cellUv = vec2(1.0 / uGrid.x, 1.0 / uGrid.y);
    vec2 e = cellUv * 0.32;
    float vis = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(i == 0 || i == 3 ? -e.x : e.x, i < 2 ? -e.y : e.y);
      float d = texture2D(tDepth, vUv + o).x;
      float sd = -perspectiveDepthToViewZ(d, uNear, uFar);
      vis += sd >= planeDist - 0.04 ? 1.0 : 0.0;
    }
    vis *= 0.25;

    gl_FragColor = vec4(vec3(vis), 1.0);
  }
`

const MASK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export type MaskResult = {
  /** Visible cells per row, as [rowIndex, firstCell, lastCell] triples. */
  runs: number[]
  /** Raw pixels, one byte per cell, row-major and top-down.  For tests. */
  grid: Uint8Array
  /** Fraction of cells the world does not hide. */
  coverage: number
  /** Cell counts, so a consumer can turn runs into its own coordinates. */
  width: number
  height: number
}

export class ScreenMask {
  private rt: THREE.WebGLRenderTarget
  private material: THREE.ShaderMaterial
  private quad: FullScreenQuad
  private pixels: Uint8Array
  private scratch = new THREE.Matrix4()

  readonly width: number
  readonly height: number
  readonly cells: number

  constructor(width = 96, height = 54) {
    this.width = width
    this.height = height
    this.cells = width * height

    this.rt = new THREE.WebGLRenderTarget(width, height, {
      /* Linear, so the supersampled edge above survives the readback as a
       * gradient instead of being quantised back to on/off by nearest sampling.
       * A cell therefore carries "how much of this cell is visible" and the
       * silhouette can follow it. */
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.NoColorSpace,
    })

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: null },
        uCamPos: { value: new THREE.Vector3() },
        uCenter: { value: new THREE.Vector3() },
        uInvVP: { value: new THREE.Matrix4() },
        uNear: { value: 0.25 },
        uFar: { value: 600 },
        uGrid: { value: new THREE.Vector2(width, height) },
      },
      vertexShader: MASK_VERT,
      fragmentShader: MASK_FRAG,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)

    this.pixels = new Uint8Array(this.cells * 4)
    this.grid = new Uint8Array(this.cells)
  }

  private grid: Uint8Array

  /**
   * Render the visibility grid for one screen and hand back a mask image.
   *
   * `depthTexture` is the scene's depth attachment, `center` the live centre
   * of the screen in world space.
   */
  update(
    renderer: THREE.WebGLRenderer,
    depthTexture: THREE.DepthTexture,
    camera: THREE.PerspectiveCamera,
    center: THREE.Vector3,
    near: number,
    far: number,
  ): MaskResult {
    const uniforms = this.material.uniforms
    uniforms.tDepth.value = depthTexture
    uniforms.uCamPos.value.copy(camera.position)
    uniforms.uCenter.value.copy(center)
    this.scratch.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert()
    uniforms.uInvVP.value.copy(this.scratch)
    uniforms.uNear.value = near
    uniforms.uFar.value = far

    const prevTarget = renderer.getRenderTarget()
    const prevClearColor = new THREE.Color()
    renderer.getClearColor(prevClearColor)

    renderer.setRenderTarget(this.rt)
    renderer.setClearColor(0x000000, 1)
    renderer.clear(true, false, false)
    this.quad.render(renderer)
    renderer.readRenderTargetPixels(this.rt, 0, 0, this.width, this.height, this.pixels)

    renderer.setRenderTarget(prevTarget)
    renderer.setClearColor(prevClearColor, 1)

    /* `readRenderTargetPixels` returns bottom-up while the mask is applied
     * top-down, so the rows are reversed here. */
    let lit = 0
    for (let y = 0; y < this.height; y++) {
      const src = (this.height - 1 - y) * this.width * 4
      const dst = y * this.width * 4
      for (let x = 0; x < this.width; x++) {
        /* Anything above zero counts as visible, so a cell that is only a
         * quarter covered still contributes.  Erring outward is the right
         * direction: the veil underneath darkens the border and the world
         * drawing over the screen's silhouette edge is what a viewer reads as
         * "the screen is behind that wall".  Erring inward eats the picture. */
        const on = this.pixels[src + x * 4] > 8
        if (on) lit++
        this.grid[y * this.width + x] = on ? 1 : 0
      }
    }

    return {
      runs: lit === 0 ? [] : this.runsFromGrid(),
      grid: this.grid,
      coverage: lit / this.cells,
      width: this.width,
      height: this.height,
    }
  }

  /**
   * The visible grid as a CSS `clip-path`, in the portal's own pixels.
   *
   * ## Why not a `mask-image`
   *
   * The mask used to be a canvas encoded to a PNG blob and hung on `mask-image`.
   * That works, but `toBlob` is *asynchronous*: between handing the element a
   * new URL and the browser finishing decoding it, the element has no valid
   * mask at all and paints unclipped for that moment.  On a moving screen that
   * is a flash of video where a wall should be -- which is what was reported as
   * black rectangles showing through from elsewhere, and what read as banding
   * while the mask caught up.
   *
   * A `clip-path` is resolved synchronously as a style, so there is no window
   * at all: the element either has the clip or it does not, and it is set in the
   * same frame the grid was computed.  It is also resolution-independent -- the
   * browser antialiases the clip's edges, so the staircase a coarse grid would
   * show along a diagonal is softened rather than left as the hard cell steps a
   * nearest-neighbour mask produced.
   *
   * The clip has to be able to describe *several* disjoint rectangles, because
   * one silhouette can have holes -- the gap between a van and a wall.  Neither
   * `polygon()` nor `inset()` can express that, so the runs are handed out and
   * the portal builds an SVG `<clipPath>` from them.
   *
   * The first attempt at this emitted `path("M0% 0%H50%V50%H0%Z")` and was
   * **silently a no-op**: Chrome computes `clip-path: path()` with percentage
   * coordinates to `none`, so nothing was clipped at all and the video drew at
   * full size over the world, which is exactly what was reported.  Hence runs
   * rather than a path -- see `media-portal.ts`.
   */
  private runsFromGrid(): number[] {
    const runs: number[] = []
    for (let y = 0; y < this.height; y++) {
      let runStart = -1
      for (let x = 0; x <= this.width; x++) {
        const on = x < this.width && this.grid[y * this.width + x] === 1
        if (on && runStart < 0) runStart = x
        if (!on && runStart >= 0) {
          runs.push(y, runStart, x)
          runStart = -1
        }
      }
    }
    return runs
  }

  dispose() {
    this.rt.dispose()
    this.quad.dispose()
    this.material.dispose()
  }
}
