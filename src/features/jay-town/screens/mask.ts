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
    float visible = step(planeDist - 0.04, -viewZ);

    gl_FragColor = vec4(vec3(visible), 1.0);
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
  /** `mask-image` URL, or `null` when no mask is needed. */
  maskUrl: string | null
  /** Raw pixels, one byte per cell, row-major and top-down.  For tests. */
  grid: Uint8Array
  /** Fraction of cells the world does not hide. */
  coverage: number
}

export class ScreenMask {
  private rt: THREE.WebGLRenderTarget
  private material: THREE.ShaderMaterial
  private quad: FullScreenQuad
  private pixels: Uint8Array
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private image: ImageData
  private url: string | null = null
  private pending = false
  private scratch = new THREE.Matrix4()

  readonly width: number
  readonly height: number
  readonly cells: number

  constructor(width = 96, height = 54) {
    this.width = width
    this.height = height
    this.cells = width * height

    this.rt = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
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
      },
      vertexShader: MASK_VERT,
      fragmentShader: MASK_FRAG,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)

    this.pixels = new Uint8Array(this.cells * 4)
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    this.image = this.ctx.createImageData(width, height)
    // white where visible; the alpha channel carries the mask
    for (let i = 0; i < this.cells; i++) {
      this.image.data[i * 4] = 255
      this.image.data[i * 4 + 1] = 255
      this.image.data[i * 4 + 2] = 255
    }
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
        const on = this.pixels[src + x * 4] > 127
        if (on) lit++
        this.grid[y * this.width + x] = on ? 1 : 0
        this.image.data[dst + x * 4 + 3] = on ? 255 : 0
      }
    }

    if (lit === 0) return { maskUrl: null, grid: this.grid, coverage: 0 }
    if (lit === this.cells) return { maskUrl: null, grid: this.grid, coverage: 1 }

    this.ctx.putImageData(this.image, 0, 0)
    /* **Not `toDataURL`.**
     *
     * The first version handed back a base64 PNG, which meant a synchronous
     * *encode* every time the mask refreshed -- and the encode turned out to
     * cost more than the depth readback it was describing.  A blob is a handle
     * to the same canvas with no base64 step at all, and `mask-image` takes a
     * blob URL perfectly well, so the encoding was pure overhead.
     *
     * `toBlob` is still asynchronous, so the URL from the previous refresh
     * stays in place until the new one arrives: the mask lags a frame behind
     * the transform, which at 6 Hz is invisible and far better than blocking
     * the frame on an encoder. */
    if (this.pending) return { maskUrl: this.url, grid: this.grid, coverage: lit / this.cells }
    this.pending = true
    this.canvas.toBlob((blob) => {
      this.pending = false
      if (!blob) return
      if (this.url) URL.revokeObjectURL(this.url)
      this.url = URL.createObjectURL(blob)
    }, 'image/png')
    return { maskUrl: this.url, grid: this.grid, coverage: lit / this.cells }
  }

  dispose() {
    if (this.url) URL.revokeObjectURL(this.url)
    this.rt.dispose()
    this.quad.dispose()
    this.material.dispose()
  }
}
