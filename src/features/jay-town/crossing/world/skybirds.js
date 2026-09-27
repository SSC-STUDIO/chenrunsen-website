import * as THREE from 'three';
import { makeCrow } from './props.js';

/**
 * Birds.
 *
 * This module used to fly six crows in two circles over the crossing, with a
 * fixed wing pose: one rigid low-poly silhouette, orbiting at a constant
 * height.  From the ground that reads as six dark shapes *hanging* in the sky,
 * and the closer ones -- the near flock's radius put two of them almost
 * directly overhead at the opening view -- were the first thing you noticed in
 * a frame that is otherwise a quiet street.  A bird that does not flap is worse
 * than no bird at all.
 *
 * So the circling flock is gone and what is left is perched: crows sitting on
 * the overhead cables, which is what the wires are for and what a crow is
 * actually doing at that height.  They are static, and static is correct for a
 * perched bird -- the bug was never that they did not move, it was that they
 * were pretending to fly.
 *
 * ## Height
 *
 * `poles` carries the resolved pole heights out of `world/index.js` (which
 * already accounts for the footway step and each pole's `baseSink`), so the
 * crows are seated on the *calculated* cable height rather than on a number
 * copied out of the pole table -- which would have gone stale the first time
 * somebody moved a pole.  See `cableY` for how the sag is modelled: it is the
 * same cosine the wire itself is drawn with.
 */

/** Cable height at `t` along a run, matching `makeWires`' own sag. */
export function cableY(a, b, sag, t) {
  return a.top + (b.top - a.top) * t - Math.sin(Math.PI * t) * sag;
}

/**
 * A crow on the street's overhead cables.
 *
 * `along` picks a station on the chain, `drop` how far below the *lowest*
 * cable's attachment point to sit -- the chains run three or four cables at
 * `-0.7`, `-0.42` and `-0.86`, and a crow lands on one of them.
 *
 * The first two are on the left-hand street chain, which is the set crossing
 * the opening frame; the others are on the chain beyond the crossing and on
 * the top cable, for variety in the sky rather than in a row.
 */
function perchOnWire(poles, { chain, along, sag = 0.55, drop = -0.7 }) {
  const a = poles[chain[0]];
  const b = poles[chain[chain.length - 1]];
  const x = a.x + (b.x - a.x) * along;
  const z = a.z + (b.z - a.z) * along;
  /* `makeWires` hangs every cable from `pole.top - 0.6`, so the crow has to be
   * measured from the same place or it sits two-thirds of a metre off. */
  const y = cableY(a, b, sag, along) - 0.6 + drop;
  // Face along the cable, with a little scatter so they are not clones.
  const yaw = Math.atan2(b.x - a.x, b.z - a.z) + (along - 0.5) * 3.0;
  return { x, y, z, yaw };
}

export function buildSkyBirds(ctx, poles = []) {
  if (!poles.length) return null;

  const spots = [
    perchOnWire(poles, { chain: [0, 1, 2, 3], along: 0.62, drop: -0.7 }),
    perchOnWire(poles, { chain: [0, 1, 2, 3], along: 0.2, drop: -1.12 }),
    perchOnWire(poles, { chain: [4, 5, 6], along: 0.7, drop: -0.7 }),
    perchOnWire(poles, { chain: [0, 1, 2, 3], along: 0.86, drop: -0.42 }),
  ];

  const group = new THREE.Group();
  group.name = 'wireCrows';
  /* Static geometry, so they must NOT be `planetRigid` -- but they are not
   * quite static either: each one runs a small idle tick.  That is fine for the
   * bake, which only cares that they do not move *between* placements; the
   * per-frame work is a couple of Euler components on a mesh nobody is
   * shadow-casting from. */
  const crows = [];
  spots.forEach((spot, i) => {
    const crow = makeCrow({
      x: spot.x, y: spot.y, z: spot.z, ry: spot.yaw, scale: 1.05 - (i % 2) * 0.1,
    });
    crows.push(crow);
    group.add(crow);
  });

  ctx.add(group);
  /* A per-bird phase, so four crows on one street are four birds rather than
   * one animation played four times. */
  ctx.update((dt) => {
    for (let i = 0; i < crows.length; i++) {
      crows[i].userData.tick?.(dt, i * 1.7);
    }
  });
  return group;
}

