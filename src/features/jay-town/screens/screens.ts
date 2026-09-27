/**
 * The in-world screens.
 *
 * Every screen is authored in the same flat (x, z, yaw) space as the rest of
 * the world, and is *built* by `crossing/world/jaytheme.js`.  This table is
 * the single source of truth for both sides: the builder places the geometry
 * from it, and `screen-hub.ts` projects the matching rectangle onto the page.
 * If the two ever disagree the video stops lining up with the frame, so they
 * are deliberately never written twice.
 *
 * `baseY` is metres above the local ground and `y` is the screen centre's
 * height above that same ground -- not a world y.  Keep `w / h` at 16:9: the
 * portal is a `<video>`/`<iframe>` and anything else letterboxes.
 */
export type ScreenSpec = {
  /** Zone index, 0-4.  Exactly one screen per zone. */
  zone: number
  /** Short name, used in the page's status line. */
  name: string
  /** Flat authoring position of the screen's frame. */
  x: number
  z: number
  /** Rotation about the surface normal, in the world's yaw convention. */
  yaw: number
  /** Ground height the frame stands on, in flat metres. */
  baseY: number
  /** Screen centre height above `baseY`. */
  y: number
  /** Screen size in metres.  16:9. */
  w: number
  h: number
}

export const SCREENS: ScreenSpec[] = [
  /* 时代广场 -- the level crossing.  A drive-in style sheet slung on the gable
   * facing the crossing, so the first thing the opening view contains is a
   * lit screen.  High enough to clear the barrier and the parked traffic. */
  { zone: 0, name: '时代广场', x: -9.4, z: 18.6, yaw: 0, baseY: 0.135, y: 3.55, w: 4.4, h: 2.475 },

  /* 唱片行 -- the listening booth inside the record shop's window.  Low and
   * small on purpose: you have to walk up to it, which is the whole gesture. */
  { zone: 1, name: '唱片行', x: 24.0, z: 30.0, yaw: -Math.PI / 2, baseY: 0.135, y: 1.35, w: 1.7, h: 0.956 },

  /* 天台 -- the concrete roof behind the precinct.  The biggest of the four:
   * it is meant to be watched from across the terrace. */
  { zone: 2, name: '天台', x: -24.4, z: 34.8, yaw: 0.3, baseY: 2.09, y: 3.05, w: 3.6, h: 2.025 },

  /* 毕业那天 -- the station departure board, turned into a music programme. */
  { zone: 3, name: '毕业那天', x: 20.6, z: -5.2, yaw: Math.PI / 2, baseY: 0.135, y: 2.25, w: 2.6, h: 1.4625 },

  /* 七里香河堤 -- the water screen over the canal, hung between two posts on
   * the south bank so the blossom side of the town is watched across water. */
  { zone: 4, name: '七里香河堤', x: 14.8, z: -36.6, yaw: 0, baseY: 0.135, y: 1.9, w: 3.0, h: 1.6875 },
]

export const SCREEN_BY_ZONE = (zone: number): ScreenSpec | undefined =>
  SCREENS.find((s) => s.zone === zone)
