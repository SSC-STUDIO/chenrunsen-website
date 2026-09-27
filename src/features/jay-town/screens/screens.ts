/**
 * Where each screen is, and the rule it follows.
 *
 * Every entry is placed on the **view axis of its own stop**, which is the only
 * thing about this table that matters and the thing the first version of it got
 * wrong.  Those coordinates were chosen from the world's building list -- "hang
 * it on the gable of the house at x = -9.6" -- without checking which way the
 * stop's camera actually looks.  Four of the five ended up behind or beside the
 * viewer; the one that projected at all did so past the edge of the frame.
 *
 * The stops and their headings, measured in the running scene at `yaw` from
 * `STOPS` in `scene.ts`:
 *
 *     zone  flat (x, z)      looks toward
 *     0     (1.85, 13.6)     (-0.20, -0.98)   down the street, south-west
 *     1     (22.2, 28.5)     ( 0.07, -0.99)   along the shopping street, south
 *     2     (-27.9, 31.5)    (-0.03, -0.99)   off the precinct terrace, south
 *     3     (22.5, -3.6)     (-0.99,  0.00)   west, down the platform
 *     4     (4.2, -29.4)     ( 0.14, -0.97)   south, along the canal bank
 *
 * So a screen goes roughly ten metres along that heading, three or four metres
 * off it, at a height you can see over a barrier.  `yaw` is the rotation about
 * the surface normal, and a screen facing *back* down the axis that looks at it
 * faces the opposite way: for a viewer looking along -z, the screen turns by PI.
 *
 * `baseY` is metres above the local ground and `y` is the screen centre's
 * height above that same ground, not a world y.  Keep `w / h` at 16:9: the
 * portal is an `<iframe>` and anything else letterboxes.
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

const ROAD_Y = 0.135

export const SCREENS: ScreenSpec[] = [
  /* 时代广场 -- the level crossing, seen from the kerb north of the barrier.
   * Ahead and to the right, on the corner shop's flank, clear of the boom. */
  { zone: 0, name: '时代广场', x: 5.6, z: 4.2, yaw: 0, baseY: ROAD_Y, y: 3.0, w: 4.4, h: 2.475 },

  /* 唱片行 -- the listening booth, in the shopping street's east row.  The
   * stop looks down the middle of the street; measured `facing` says this
   * turns by PI, not by -PI/2. */
  { zone: 1, name: '唱片行', x: 25.2, z: 21.6, yaw: Math.PI, baseY: ROAD_Y, y: 1.45, w: 1.9, h: 1.069 },

  /* 天台 -- the gantry, off the precinct terrace's south edge.  Bigger and
   * higher than the rest, because it is meant to be watched from across the
   * terrace rather than walked up to.  Also turned by PI. */
  { zone: 2, name: '天台', x: -28.4, z: 23.4, yaw: Math.PI, baseY: 2.09, y: 2.9, w: 3.9, h: 2.194 },

  /* 毕业那天 -- the departure board, on the platform the stop stands on.
   * The stop looks west along the rails, so this faces back east at it. */
  { zone: 3, name: '毕业那天', x: 13.6, z: -4.4, yaw: Math.PI, baseY: ROAD_Y, y: 2.35, w: 2.8, h: 1.575 },

  /* 七里香河堤 -- hung over the canal's south bank, ahead of the stop along
   * the towpath.  The water side of the town is where the blossom belongs. */
  { zone: 4, name: '七里香河堤', x: 5.6, z: -38.6, yaw: 0, baseY: ROAD_Y, y: 1.95, w: 3.2, h: 1.8 },
]

export const SCREEN_BY_ZONE = (zone: number): ScreenSpec | undefined =>
  SCREENS.find((s) => s.zone === zone)
