import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { makeCrow, birdSplitGeo } from './props.js';

/**
 * Birds.
 *
 * Perched crows on the overhead cables, and a flock circling over the town.
 * The two halves want opposite things from an animation.
 *
 * The flock has to flap, because a bird that does not flap is not flying, it
 * is hanging.  The perched ones have the harder job: a crow on a wire is
 * *nearly* still, and everything an animation can get wrong lives in the gap
 * between "nearly" and "exactly".  A bird that is exactly still is a decal
 * somebody stuck to the cable -- which is what this file used to produce, for
 * two separate reasons that both had to be fixed before any of the motion
 * below could be seen at all:
 *
 *  - **the bake owned the crow.**  See `buildSkyBirds`: without
 *    `userData.planetRigid` the crow's meshes are bent into root space and its
 *    transforms are reset, so the idle that used to live in `makeCrow` was
 *    rotating a bird-shaped cloud of world-space geometry about the origin of
 *    the world, several metres away from the bird.
 *  - **the perch was not on the wire.**  See `perchOnWire`: the first version
 *    measured a straight line from the first pole of a run to the last, and
 *    the cables do not go that way.
 *
 * ## Flapping without touching the CPU
 *
 * The flock is one `InstancedMesh`, so there is no per-bird object to rotate a
 * wing on, and uploading new instance matrices every frame to fake it would
 * cost more than the whole rest of the world's animation.  Instead the hinge
 * lives in the vertex shader: `birdSplitGeo` tags each vertex with which part
 * of the bird it belongs to, and the shader rotates the wing parts about their
 * own shoulders by an angle that depends on the instance's `aPhase`.  One
 * uniform changes per frame, for the whole flock.
 */

/** Body and wings in one geometry, hinged in the vertex shader. */
function flapMaterial(bodyTone = 0x3a3648) {
  const mat = cel({ color: bodyTone, bands: 2, tint: 0x4a4460, side: THREE.DoubleSide, cache: false });
  /** The one number the whole flock's animation costs per frame. */
  const uFlap = { value: 0 };
  mat.userData.uFlap = uFlap;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlap = uFlap;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aPart;
         attribute float aPhase;
         attribute float aCut;
         uniform float uFlap;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         if ( aPart > 0.5 ) {
           float side = aPart - 1.5;
           // Down on the beat, up between: the ease is what gives a wing its
           // shape, and the tip lags the shoulder by a third of a cycle.
           float ease = 0.5 + 0.5 * sin( uFlap + aPhase );
           float fold = -0.30 + 1.05 * ease;
           float x = transformed.x;
           float hinge = -aCut;
           float base = abs( x ) <= aCut ? 0.0 : -aCut;
           float arm = x + base;
           // taper so the hinge is at the body and the travel grows outward
           float k = side * fold * clamp( abs( arm ) / 0.34, 0.0, 1.6 );
           float ca = cos( k );
           float sa = sin( k );
           transformed.y = transformed.y * ca - arm * sa;
           transformed.x = transformed.y * sa + x;
         }`,
      );
  };
  mat.customProgramCacheKey = () => 'birdFlap';
  return mat;
}

/**
 * Build the flock.  Each bird is an instance with its own phase, so six of them
 * never beat in time.
 */
export function buildFlock(ctx, { count = 7, center = [1.0, 12.0], radius = 11, height = 15 } = {}) {
  const geo = birdSplitGeo(1.7);
  const mat = flapMaterial();

  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled = false;
  inst.name = 'skyFlock';
  inst.userData.planetRigid = true;
  inst.userData.noOutline = true;
  ctx.add(inst);

  const birds = [];
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const k = i * 1.61;
    birds.push({
      phase: (k * 2.17) % (Math.PI * 2),
      radius: radius * (0.72 + ((k * 0.37) % 1) * 0.6),
      height: height + ((k * 0.29) % 1) * 5.5,
      speed: 0.30 + ((k * 0.21) % 1) * 0.16,
      bank: (((k * 0.53) % 1) - 0.5) * 0.3,
      scale: 0.85 + ((k * 0.27) % 1) * 0.45,
    });
    phases[i] = birds[i].phase;
  }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

  const dummy = new THREE.Object3D();
  let t = 0;
  const place = (time, flapPhase) => {
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      const a = b.phase + time * b.speed;
      const x = center[0] + Math.cos(a) * b.radius;
      const z = center[1] + Math.sin(a) * b.radius;
      const y = b.height + Math.sin(time * 0.7 + b.phase) * 0.45;
      dummy.position.set(x, y, z);
      dummy.up.set(0, 1, 0);
      // bill is local -z, so look along the tangent
      dummy.lookAt(x - Math.sin(a), y, z + Math.cos(a));
      dummy.rotateZ(b.bank + Math.sin(a * 2) * 0.12);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    mat.userData.uFlap.value = flapPhase;
  };

  place(0, 0);
  ctx.update((dt) => {
    t += dt;
    // ~2.6 beats a second, which is a cruising crow rather than a hummingbird
    place(t, t * 16.0);
  });

  return inst;
}

/* ------------------------------------------------------------------ *
 * The perched crows.
 * ------------------------------------------------------------------ */

/**
 * The overhead runs a crow can land on, as `index.js` strings them.
 *
 * `[dy, dz]` is one cable of a run: how far its anchors hang below
 * `pole.top - 0.6`, and how far they are shifted along z.  This table is a
 * copy of the two `chain()` calls that build the street's cabling, and it has
 * to stay a copy of them -- the alternative is reading the vertices back out
 * of the merged wire mesh, which is a lot of machinery to save one table.
 *
 * The first version of this file carried neither the table nor the per-span
 * walk.  It took a single `drop` per bird (-0.7 and -1.12, against cables that
 * actually hang at 0, -0.42 and -0.86) and it interpolated from the first pole
 * of the run to the last, so all four crows sat between half a metre and a
 * metre away from the nearest wire, hovering in the gap between two of them.
 */
const RUNS = [
  { chain: [0, 1, 2, 3], cables: [[0, -0.7], [-0.42, 0], [-0.86, 0.7]] },
  { chain: [4, 5, 6], cables: [[0, -0.7], [-0.42, 0], [-0.86, 0.7]] },
];

/** Every cable hangs from `pole.top - 0.6`. */
const HANG = 0.6;
/** Nominal sag per span, before `makeWires` shortens it on a short one. */
const SAG = 0.55;
/** `makeWires`' default tube radius: a crow stands on top of that, not in it. */
const WIRE_R = 0.026;

/** Where one span of cable is at `t`, matching `sagCurve`'s own curve. */
export function cableY(a, b, sag, t) {
  return a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag;
}

/**
 * A station on a run, in the flat frame the world is authored in.
 *
 * `along` is a fraction of the run's own length, walked pole to pole.  It used
 * to be a fraction of the straight line from the first pole to the last, which
 * is only the same number where a run is straight: this one steps 0.5 m across
 * at each pole and turns through 4 degrees over 30 m, and at `along = 0.62`
 * the end-to-end line is 0.77 m away from the cable it is supposed to be
 * measuring.
 *
 * The height is the cable's own: each span sags by its own amount, because
 * `makeWires` scales the nominal sag down on a short hop and up on a long one.
 */
function perchOnWire(poles, { run, cable, along, face = 0 }) {
  const { chain, cables } = RUNS[run];
  const [dy, dz] = cables[cable];
  /* The anchors, exactly as `makeWires` is handed them. */
  const nodes = chain.map((i) => new THREE.Vector3(
    poles[i].x, poles[i].top - HANG + dy, poles[i].z + dz,
  ));

  const spans = [];
  let total = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const len = nodes[i].distanceTo(nodes[i + 1]);
    spans.push(len);
    total += len;
  }

  let walked = THREE.MathUtils.clamp(along, 0, 1) * total;
  let k = 0;
  while (k < spans.length - 1 && walked > spans[k]) {
    walked -= spans[k];
    k += 1;
  }
  const a = nodes[k];
  const b = nodes[k + 1];
  const t = THREE.MathUtils.clamp(walked / spans[k], 0, 1);

  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    /* The anchor is the cable's axis, because the crow's legs straddle it, so
     * the wire radius is the difference between perching and sinking. */
    y: cableY(a, b, SAG * Math.min(1.6, spans[k] / 14), t) + WIRE_R,
    /* Bill down the run, in the direction the cable is actually going. */
    yaw: Math.atan2(b.x - a.x, b.z - a.z) + face,
  };
}

/**
 * Deterministic 0..1 stream.
 *
 * The birds' schedules are drawn from this rather than from `Math.random`, so
 * a reload replays the street exactly: four birds whose beats never line up,
 * and a frame capture that is worth comparing to the last one.
 */
function stream(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Fast off the mark, slow to settle: what a neck does, where a sine does not. */
const ease = (u) => 1 - (1 - u) ** 3;

/**
 * 0 -> 1 -> 0 across `u`, with the rise and the hold as fractions of a beat.
 *
 * Every gesture in this file is one of these, which is what keeps them
 * shapeable: a sine would be a bird drifting between two poses, and the point
 * of all of them is that they *start*, *happen* and *are over*.
 */
function swell(u, rise, hold) {
  if (u <= 0 || u >= 1) return 0;
  if (u < rise) return ease(u / rise);
  if (u < rise + hold) return 1;
  return 1 - ease((u - rise - hold) / (1 - rise - hold));
}

/* Scratch for the per-frame pose: one quaternion and one axis, reused by all
 * four birds rather than allocated per frame. */
const _spin = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * The idle of one perched crow.
 *
 * ## Why it is this loud
 *
 * The first version asked for +-0.24 rad of yaw, 0.035 of roll and 8 mm of
 * bob, and the report came back that the bird "just sits there".  It was
 * right, and the numbers say why: these crows are read from 8-25 m, where a
 * 0.4 m bird is about 15 px tall on a 720 px frame, so an 8 mm bob is a
 * fortieth of a pixel and 0.24 rad of yaw on a body 0.1 m wide is two pixels
 * of shading change.  What survives that distance is a *silhouette* moving,
 * which is what the amplitudes below are chosen for:
 *
 *  - the turn swings the tail, 0.3 m behind the pivot, through a hand's width;
 *  - the stretch opens one folded wing into a spike, which redraws the whole
 *    outline of the bird;
 *  - the step is 3-6 cm of daylight between the bird and its wire;
 *  - the shake puts both wing tips through +-0.15 m.
 *
 * ## Where the head is
 *
 * There is no head bone: the hull `makeCrow` builds has the crown, the bill
 * and the tail in one sheet, and a perched crow looks at things by pivoting on
 * its feet, which is what the turn here is -- the whole rig yaws about the
 * cable, and the body leads it by a few degrees.  Splitting the hull at the
 * nape would buy a truer head turn and cost a seam and a re-tune of the whole
 * silhouette for something that is three pixels wide from the street.
 *
 * ## Nothing integrates
 *
 * Every frame recomputes the pose from the clock instead of accumulating it,
 * so no gesture can leave the bird anywhere except exactly where it started,
 * and a dropped frame cannot walk it along the wire.  That is a hard
 * requirement here rather than a nicety: the perch is 9 m up over a street.
 */
function inhabit(crow, index) {
  const body = crow.userData.body;
  const wingL = crow.userData.wingL;
  const wingR = crow.userData.wingR;

  /* The perch and the pose `makeCrow` struck.  Nothing below is allowed to
   * move the feet, so everything is measured from these -- and they are read
   * on the *first tick* rather than here.
   *
   * The reason is the bake.  Between this call and the first frame,
   * `bakeToPlanet` re-seats the rig: the crow's flat `(x, y, z)` becomes a
   * point on the sphere and its local +z becomes the tangent direction of the
   * wire rather than the world's.  A copy of the flat numbers taken here and
   * written back every frame therefore undoes the re-seat -- which is exactly
   * what the first version of this did, and it left the birds hanging 0.5 to
   * 2.9 m above their own wires (the gap is `(x^2 + z^2) / 2R`, so it is worst
   * at the far end of the run and invisible at the crossing). */
  let base = null;
  let rest = null;

  const r = stream(index * 7919 + 13);
  const ph = index * 2.31 + r() * 1.3;

  /* Four schedules, each drawn once.  `at` is the next time this bird does
   * this thing.  The first round is staggered by index and lands inside the
   * first ten seconds, so a player who walks up to the crossing is not waiting
   * for the street to wake up; from then on the gaps are wide and random,
   * which is what keeps four birds off each other's beat. */
  const look = { at: 0.4 + index * 0.45 + r() * 0.5, since: -9, dur: 0.24, from: 0, to: 0, yaw: 0, side: 1 };
  const tail = { at: 1.0 + index * 0.35 + r() * 0.9, since: -9, dur: 0.32, amp: 0.14, twice: false };
  const reach = { at: 2.4 + index * 0.50 + r() * 1.0, since: -9, dur: 1.7, amp: 0.7, side: 1 };
  const shake = { at: 4.0 + index * 0.60 + r() * 1.5, since: -9, dur: 0.6, amp: 0.7 };
  const hop = { at: 5.5 + index * 0.70 + r() * 1.0, since: -9, dur: 0.56, dz: 0.07, dy: 0.045 };

  let t = 0;

  return (dt) => {
    if (!base) {
      base = {
        pos: crow.position.clone(),
        quat: crow.quaternion.clone(),
        /* The wire and the sky, in world terms: the rig's own +z and +y. */
        along: new THREE.Vector3(0, 0, 1).applyQuaternion(crow.quaternion),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(crow.quaternion),
      };
      rest = {
        bodyX: body.rotation.x,
        bodyY: body.rotation.y,
        bodyZ: body.rotation.z,
        bodyPosY: body.position.y,
        wingL: wingL.rotation.clone(),
        wingR: wingR.rotation.clone(),
      };
    }
    t += dt;

    /* ---- weight ------------------------------------------------------ *
     * Always on, never zero.  Two incommensurate periods, so the sway never
     * repeats on a beat the eye can count, and about 0.1 rad of roll, which
     * is a bird shifting its balance rather than a bird falling over.
     *
     * There is deliberately no millimetre bob on the body's own height.  It
     * was tried in the first version of this idle and it is worse than
     * nothing twice over: 8 mm is a fortieth of a pixel from the street, and
     * it is the one channel that a measurement harness sees as a huge number
     * (a metre of travel is 1000 units in `tools/shot/jay-town.cjs`), so a
     * motion nobody can see would have carried the whole reading. */
    const roll = Math.sin(t * 1.15 + ph) * 0.075 + Math.sin(t * 2.30 + ph * 1.7) * 0.035;
    const lean = Math.sin(t * 0.90 + ph * 2.1) * 0.16 + Math.sin(t * 1.90 + ph) * 0.05;

    /* ---- the turn ---------------------------------------------------- *
     * Snap round, then hold.  The hold is the behaviour -- a crow that looks
     * at something keeps looking at it, and reading that as a slow sine is
     * exactly what made the first version read as nothing at all. */
    if (t >= look.at) {
      look.from = look.yaw;
      // usually swings back the other way, the way a bird checking a street does
      if (r() < 0.72) look.side = -look.side;
      look.to = look.side * (0.30 + r() * 0.32);
      look.dur = 0.16 + r() * 0.14;
      look.since = t;
      look.at = t + look.dur + 0.9 + r() * 2.6;
    }
    const lu = Math.min(1, (t - look.since) / look.dur);
    look.yaw = look.from + (look.to - look.from) * ease(lu);
    /* How hard the neck is working: peaks as the turn starts, zero while it is
     * held, and it is what drives the shoulder dip. */
    const turn = lu < 1 ? (1 - lu) ** 2 : 0;

    /* ---- the tail ---------------------------------------------------- *
     * A flick is one impulse about 0.3 s long, sometimes doubled.  It rides on
     * the body's pitch, which lifts the tail and drops the head together --
     * which is the gesture, not an accident of there being one mesh. */
    if (t >= tail.at) {
      tail.since = t;
      tail.amp = 0.14 + r() * 0.08;
      tail.dur = 0.26 + r() * 0.12;
      tail.twice = r() < 0.45;
      tail.at = t + tail.dur + 2.4 + r() * 4.4;
    }
    const tu = (t - tail.since) / tail.dur;
    let flick = 0;
    if (tu > 0 && tu < 1) flick = Math.sin(Math.PI * tu) * tail.amp;
    else if (tail.twice && tu > 1.3 && tu < 2.3) {
      flick = Math.sin(Math.PI * (tu - 1.3)) * tail.amp * 0.75;
    }

    /* ---- one wing at a time ------------------------------------------ *
     * The stretch.  It is the biggest silhouette change in this file: the
     * folded wedge opens into a spike, holds there, folds back.  One side
     * only -- both at once is a shrug, and a crow does not shrug. */
    if (t >= reach.at) {
      reach.since = t;
      reach.side = r() < 0.5 ? -1 : 1;
      reach.amp = 0.55 + r() * 0.30;
      reach.dur = 1.5 + r() * 0.7;
      reach.at = t + reach.dur + 4.5 + r() * 8.0;
    }
    const reachK = swell((t - reach.since) / reach.dur, 0.30, 0.22) * reach.amp;

    /* ---- and now and then, a shake ----------------------------------- *
     * Both wings beat in place at roughly 3 Hz for half a second: the move a
     * bird makes when something has landed on it. */
    if (t >= shake.at) {
      shake.since = t;
      shake.dur = 0.50 + r() * 0.24;
      shake.amp = 0.45 + r() * 0.40;
      shake.at = t + shake.dur + 8.0 + r() * 9.0;
    }
    const shu = (t - shake.since) / shake.dur;
    const beat = shu > 0 && shu < 1
      ? Math.sin(shu * Math.PI * 2 * 3.2) * Math.sin(Math.PI * shu) * shake.amp
      : 0;

    /* ---- the step ---------------------------------------------------- *
     * 3-6 cm of air and a hand's width along the cable, out *and back inside
     * one gesture*: a bird that hopped and stayed hopped would walk itself off
     * the end of the run.  The shape is a gather, a ballistic arc, a beat
     * standing at the new spot, a second smaller arc back, and a landing dip.
     * Every seam is at zero height, so nothing here can pop. */
    if (t >= hop.at) {
      hop.since = t;
      hop.dur = 0.50 + r() * 0.16;
      hop.dz = (r() < 0.5 ? -1 : 1) * (0.05 + r() * 0.05);
      hop.dy = 0.035 + r() * 0.025;
      hop.at = t + hop.dur + 8.0 + r() * 11.0;
    }
    const hu = (t - hop.since) / hop.dur;
    const arc = (u) => hop.dy * 4 * u * (1 - u);
    let lift = 0;      // metres of air under the feet
    let step = 0;      // metres along the wire, in the crow's own frame
    let crouch = 0;    // body compression, while the feet are still on the wire
    if (hu > 0 && hu < 1) {
      if (hu < 0.26) {
        crouch = -0.010 * Math.sin(Math.PI * (hu / 0.26));   // gather
      } else if (hu < 0.56) {
        const u = (hu - 0.26) / 0.30;
        lift = arc(u);
        step = hop.dz * u * u * (3 - 2 * u);
      } else if (hu < 0.70) {
        const u = (hu - 0.56) / 0.14;
        crouch = -0.008 * Math.sin(Math.PI * u);             // stood at the new spot
        step = hop.dz;
      } else if (hu < 0.94) {
        const u = (hu - 0.70) / 0.24;
        lift = arc(u) * 0.6;
        step = hop.dz * (1 - u * u * (3 - 2 * u));
      } else {
        const u = (hu - 0.94) / 0.06;
        crouch = -0.005 * Math.sin(Math.PI * u);             // settle
      }
    }
    /* A wing out for balance while airborne, and folded by the time it lands. */
    const hopK = lift > 0 ? Math.min(1, lift / Math.max(hop.dy, 1e-4)) * 0.32 : 0;

    /* ---- put it together --------------------------------------------- *
     * The rig is turned about its *own* up axis and the step is taken along
     * its own +z, so "yaw" and "along the wire" mean the same thing here as
     * they did in the flat world the perch was measured in -- on a sphere
     * where neither axis is the world's. */
    _spin.setFromAxisAngle(_up, lean + look.yaw);
    crow.quaternion.copy(base.quat).multiply(_spin);
    crow.position.copy(base.pos)
      .addScaledVector(base.along, step)
      .addScaledVector(base.up, lift);
    body.rotation.x = rest.bodyX - flick - turn * 0.05;
    // a few degrees of lead, so the pivot reads as the neck and not the feet
    body.rotation.y = rest.bodyY + look.yaw * 0.10;
    body.rotation.z = rest.bodyZ + roll;
    body.position.y = rest.bodyPosY + crouch;

    /* One wing rotation table, used twice: `open` unfolds the fold `makeCrow`
     * struck, `beat` rides the same axes so a shake and a stretch can happen
     * at once without one overwriting the other. */
    const pose = (wing, fold, open, beatK, side) => {
      wing.rotation.y = fold.y * (1 - 0.85 * open);
      wing.rotation.z = fold.z * (1 - 0.95 * open) + side * beatK;
      wing.rotation.x = fold.x + side * (0.30 * open + 0.50 * beatK);
    };
    pose(wingL, rest.wingL, reachK * (reach.side < 0 ? 1 : 0) + hopK, beat, -1);
    pose(wingR, rest.wingR, reachK * (reach.side > 0 ? 1 : 0) + hopK, beat, 1);
  };
}

export function buildSkyBirds(ctx, poles = []) {
  const flock = buildFlock(ctx);
  if (!poles.length) return flock;

  const spots = [
    perchOnWire(poles, { run: 0, cable: 1, along: 0.62, face: 0.12 }),
    perchOnWire(poles, { run: 0, cable: 2, along: 0.20, face: -0.30 }),
    perchOnWire(poles, { run: 1, cable: 0, along: 0.70, face: 0.20 }),
    perchOnWire(poles, { run: 0, cable: 0, along: 0.86, face: Math.PI - 0.25 }),
  ];

  const group = new THREE.Group();
  group.name = 'wireCrows';
  /* `noBatch`, or the perched crows do not exist.
   *
   * `batchStatic` merges every childless static mesh into shared buffers and
   * removes the originals, then deletes the containers it emptied.  A crow is
   * a group of small meshes that animate about its own pivot, so the merge
   * took the body and both wings, left the group empty, and the cull pass
   * deleted it -- `getObjectByName('wireCrows')` came back with four childless
   * groups parked at the origin, still ticking and drawing nothing.  Which is
   * why they read as birds frozen on the wire: the visible ones were baked
   * into the static batch, and the animated ones were invisible.
   *
   * `jayscreen.js` and `train.js` carry the same flag for the same reason.
   * The crows are `planetRigid` as well, which already exempts everything
   * under them, so this is belt and braces -- kept because it is the flag that
   * says what this group *is*, and it is the one that matters if a crow is
   * ever built without a rig of its own. */
  group.userData.noBatch = true;
  const crows = [];
  spots.forEach((spot, i) => {
    const crow = makeCrow({
      x: spot.x, y: spot.y, z: spot.z, ry: spot.yaw, scale: 1.05 - (i % 2) * 0.1,
    });
    /* `planetRigid`, or none of the animation above shows at all.
     *
     * `bakeToPlanet` bends every static geometry vertex onto the sphere and
     * then resets the transform of everything above it, so a crow that goes
     * through the bake comes out as four root-space meshes grouped under an
     * identity matrix parked at the world origin: `crow.position` is [0,0,0],
     * `getWorldPosition` on it answers the origin, and `bodyMesh.rotation.y`
     * swings the bird around the origin of the world instead of about its own
     * feet.  `planetRigid` is the flag that says "leave this rig in its own
     * frame and re-seat it", and `makeCat` carries it for exactly this reason.
     *
     * The cost is that the crow is placed on the sphere rigidly instead of
     * being bent vertex by vertex.  For a rig 0.4 m across that is under a
     * millimetre of difference, and it buys the perch back: the re-seat puts
     * the crow's anchor through the same `positionAt` the bend uses, so it
     * lands on the wire `perchOnWire` measured rather than near it.
     *
     * What the re-seat also means is that the flat numbers a crow was built
     * with are wrong by the time anything animates it, which is why `inhabit`
     * reads the perch off the object on its first tick instead of keeping a
     * copy.  Doing it the other way round cost 0.5-2.9 m of altitude. */
    crow.userData.planetRigid = true;
    crows.push(crow);
    group.add(crow);
  });
  ctx.add(group);

  /* One actor per bird, all four driven from a single updater: the schedules
   * are per-bird, and a crow whose clock is shared with its neighbour is the
   * same crow drawn four times. */
  const actors = crows.map((crow, i) => inhabit(crow, i));
  ctx.update((dt) => {
    for (let i = 0; i < actors.length; i++) actors[i](dt);
  });
  return group;
}
