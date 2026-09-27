import * as THREE from 'three'

/**
 * Projecting an in-world rectangle onto the page.
 *
 * The browser cannot put an iframe inside WebGL, so the video stays a DOM
 * element and this module works out the 2D transform that makes it *sit* on
 * the 3D screen: the four world-space corners are pushed through the camera
 * to viewport pixels, and the resulting quad becomes a CSS matrix.
 *
 * ## Why not `matrix3d` plus a `perspective`
 *
 * The obvious route -- build a 4x4 carrying the projection's w row and let the
 * parent's `perspective` do the divide -- is what three.js's own
 * `CSS3DRenderer` does, and it is wrong in Firefox, which reads `perspective`
 * as an explicit property rather than something a matrix implies, and drops
 * the divide.  Here the 3D projection is instead inverted analytically: the
 * element's own box is mapped to the projected quad by one homography, its
 * inverse goes into `matrix3d`, and no `perspective` is involved at all.  The
 * divide that `CSS3DRenderer` has to fake falls out of the maths.
 *
 * ## Corner order
 *
 * The source rectangle is the element's own CSS box, in DOM order:
 *
 *     s0 = (0, 0) top-left        s1 = (1, 0) top-right
 *     s3 = (0, 1) bottom-left     s2 = (1, 1) bottom-right
 *
 * (`quadToHomography` solves in that unit-square space; `matrix3dCss` is what
 * converts to the element's own pixel box.)  The screen's own `(u, v)` is the
 * `PlaneGeometry` uv, which is DOM-like -- v grows *downward* -- so the mapping
 * is direct and needs no flip, but that is exactly the kind of claim that is
 * cheaper to check than to argue about, so `scripts/verify-jay-town.mjs`
 * asserts the rendered video's top edge against the 3D screen's top edge.
 */

/** One corner of the projected rectangle, in CSS pixels, viewport-relative. */
export type Pt = { x: number; y: number }

/** Bumped when the maths here changes, so a stale dev bundle is obvious. */
export const PROJECTION_REVISION = 'p3'

/** Corners in DOM order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt]

/** Reusable corner buffers, so a per-frame call allocates nothing. */
export type CornerSet = [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]

export function makeCorners(): CornerSet {
  return [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  ]
}

/**
 * Fill the four corners of a plane-centred rectangle.
 *
 * `right` and `up` are taken from the live screen group's world matrix rather
 * than recomputed from the flat basis, so whatever the planet bake did to the
 * frame -- and whatever the builder rotated it by -- is what gets projected.
 */
export function fillCorners(
  center: THREE.Vector3,
  right: THREE.Vector3,
  up: THREE.Vector3,
  halfW: number,
  halfH: number,
  corners: CornerSet,
): void {
  /* `up` points to the *top* of the screen, and DOM order starts at the top
   * left, so the first corner is centre + up - right. */
  for (let i = 0; i < 4; i++) {
    const sx = i === 0 || i === 3 ? -1 : 1     // left, right, right, left
    const sy = i === 0 || i === 1 ? 1 : -1     // top, top, bottom, bottom
    corners[i]
      .copy(center)
      .addScaledVector(right, sx * halfW)
      .addScaledVector(up, sy * halfH)
  }
}

const _view = new THREE.Vector3()

/**
 * Corners of a rectangle seen through `camera`, in viewport CSS pixels.
 *
 * Returns `null` when any corner is at or behind the eye: the projection is
 * meaningless there and the quad would wrap around the screen.  Every caller
 * treats `null` as "the portal is not currently a thing that can be drawn",
 * which is also what a screen behind the camera wants.
 */
export function projectQuad(
  camera: THREE.PerspectiveCamera,
  corners: CornerSet,
  width: number,
  height: number,
  out: Quad,
): Quad | null {
  camera.updateMatrixWorld()
  for (let i = 0; i < 4; i++) {
    _view.copy(corners[i]).applyMatrix4(camera.matrixWorldInverse)
    if (_view.z > -0.08) return null
    _view.applyMatrix4(camera.projectionMatrix)
    out[i].x = (_view.x * 0.5 + 0.5) * width
    out[i].y = (1 - (_view.y * 0.5 + 0.5)) * height
  }
  return out
}

/**
 * The homography taking the element's unit box to `q`, column-major.
 *
 * Written into `out` as the 3x3 in slot order `[m00, m10, m20, m01, m11, m21,
 * m02, m12, m22]`, where the last *row* is the perspective pair `(g, h, 1)`.
 * That is the same layout CSS uses, so `invert3x3` can take it straight to a
 * `matrix3d`.
 *
 * ## Winding, which is the mirroring bug
 *
 * The source box is in DOM order -- left-to-right, top-to-bottom -- and the
 * first version of this mapped it to `q` in the same order, on the assumption
 * that `fillCorners` also walked the screen left-to-right.  **It does not.**  A
 * screen whose yaw turns it to face the viewer has a world-space basis whose
 * `right` vector points the *other* way, so the corner that lands on the
 * viewer's left is the one `fillCorners` emitted last.  The mapping then sends
 * the element's left edge to the viewer's right, and the picture is mirrored --
 * which is exactly what a π-rotated screen showed.
 *
 * So the winding is checked rather than assumed: the signed area of `q` in
 * screen space (where y grows downward, so a non-mirrored quad is positive)
 * says whether the corners arrived reversed, and if they did, the two pairs are
 * swapped before solving.  That is a transpose, not a flip, so the vertical
 * order is preserved along with it.
 *
 * Returns `null` for a degenerate quad -- a screen seen exactly edge-on has no
 * area to draw into, and the caller shows an empty frame instead of a
 * collapsed video.
 */
export function quadToHomography(q: Quad, out: Float32Array): Float32Array | null {
  /* Shoelace, in screen space.  Positive means the quad runs clockwise on the
   * page, which is what DOM order produces when the screen is not reversed. */
  const area
    = (q[1].x - q[0].x) * (q[1].y + q[0].y)
    + (q[2].x - q[1].x) * (q[2].y + q[1].y)
    + (q[3].x - q[2].x) * (q[3].y + q[2].y)
    + (q[0].x - q[3].x) * (q[0].y + q[3].y)

  const [p0, p1, p2, p3] = area < 0
    ? [q[0], q[3], q[2], q[1]]
    : [q[0], q[1], q[2], q[3]]

  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y

  const det = dx1 * dy2 - dx2 * dy1
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null

  const g = (dx3 * dy2 - dx2 * dy3) / det
  const h = (dx1 * dy3 - dx3 * dy1) / det

  // first column: s -> (1,0)
  out[0] = p1.x - p0.x + g * p1.x
  out[1] = p1.y - p0.y + g * p1.y
  out[2] = g
  // second column: s -> (0,1)
  out[3] = p3.x - p0.x + h * p3.x
  out[4] = p3.y - p0.y + h * p3.y
  out[5] = h
  // third column: the origin
  out[6] = p0.x
  out[7] = p0.y
  out[8] = 1
  return out
}

/**
 * Invert a column-major 3x3.
 *
 * This delegates to `THREE.Matrix3` rather than rolling the cofactors by hand.
 * The first version here *did* roll them, and got the transpose: `Matrix3`
 * addresses its elements column-major (`te[1]` is row 1 of column 0), and
 * reading the classic adjugate formula left to right walks straight into that
 * trap. The failure was silent and looked exactly like a perspective bug -- the
 * projected rectangle came out 240 times too small -- which is a bad enough
 * hour to be worth one extra scratch object.
 */
const _m3 = new THREE.Matrix3()

export function invert3x3(a: ArrayLike<number>, out: Float32Array): Float32Array | null {
  _m3.set(a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8])
  const det = _m3.determinant()
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null
  _m3.invert()
  const e = _m3.elements
  out[0] = e[0]; out[1] = e[1]; out[2] = e[2]
  out[3] = e[3]; out[4] = e[4]; out[5] = e[5]
  out[6] = e[6]; out[7] = e[7]; out[8] = e[8]
  return out
}

/**
 * A column-major homography from the unit square, read out as the CSS
 * `matrix3d` that maps an element's own pixel box onto the projected quad.
 *
 * `m` is the *forward* map -- `quadToHomography`, not its inverse -- and the
 * conversion is the part that took three attempts to get right, so it is worth
 * stating precisely.
 *
 * The element is `boxW` x `boxH` CSS pixels and CSS feeds `(x, y)` in those
 * units.  The forward map wants `(u, v)` in the unit square, and CSS scales
 * linearly between the two, `u = x / boxW`.  Substituting into all three of the
 * matrix's columns at once -- which is the same as right-multiplying by
 * `diag(1/boxW, 1/boxH, 1)` -- gives
 *
 *     m00' = m00 / boxW      m01' = m01 / boxH      m20' = m20 / boxW
 *     m10' = m10 / boxW      m11' = m11 / boxH      m21' = m21 / boxH
 *
 * and leaves the translation column alone: it is already in viewport pixels,
 * which is the output domain.
 *
 * The two `m2x` terms are easy to forget and they only show up when a corner is
 * off the centre of the element -- all four corners then fly apart in different
 * directions, which reads as a perspective blow-up rather than as a units
 * mistake.  Hence the note.
 *
 * **The perspective pair goes in the fourth *column*, not the fourth row.**
 * CSS `matrix3d` is column-major, so slots 3 and 7 -- `m14` and `m24` -- are
 * the values that multiply `x` and `y` into `w`:
 *
 *     x' = m11·x + m21·y + m41      w = m14·x + m24·y + m44
 *
 * and `m44 = 1` keeps the divide a no-op rather than a division by zero.
 */
export function matrix3dCss(
  m: ArrayLike<number>,
  boxW: number,
  boxH: number,
  scratch: number[],
): string {
  const kx = boxW > 0 ? 1 / boxW : 1
  const ky = boxH > 0 ? 1 / boxH : 1
  // 3x3 column-major: m[0]=m00 m[1]=m10 m[2]=m20, m[3]=m01 m[4]=m11 m[5]=m21,
  //                  m[6]=m02 m[7]=m12 m[8]=m22
  scratch[0] = m[0] * kx; scratch[1] = m[1] * kx; scratch[2] = 0; scratch[3] = m[2] * kx
  scratch[4] = m[3] * ky; scratch[5] = m[4] * ky; scratch[6] = 0; scratch[7] = m[5] * ky
  scratch[8] = 0; scratch[9] = 0; scratch[10] = 1; scratch[11] = 0
  scratch[12] = m[6]; scratch[13] = m[7]; scratch[14] = 0; scratch[15] = m[8]
  if (!scratch.every((n) => Number.isFinite(n))) return ''
  /* Eight places, not six.  The linear terms are ~1/box, so at six places a
   * matrix whose translation is seven hundred pixels carries about half a pixel
   * of rounding on the far corners -- small, but it is free to be exact and the
   * harness measures alignment in pixels. */
  const body = scratch.map((n) => (Math.abs(n) < 1e-9 ? 0 : +n.toFixed(8))).join(',')
  return `matrix3d(${body})`
}

/**
 * Is the camera on the far side of the screen?
 *
 * The video must not appear there -- an iframe cannot be mirrored, and a
 * mirrored Jay Chou is worse than no Jay Chou -- so the portal is hidden and
 * the screen falls back to its unlit cloth.
 */
export function isBehind(
  cameraPos: THREE.Vector3,
  center: THREE.Vector3,
  normal: THREE.Vector3,
): boolean {
  return center.clone().sub(cameraPos).dot(normal) <= 0
}
