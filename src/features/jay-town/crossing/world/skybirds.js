import * as THREE from 'three';
import { cel } from '../core/toon.js';
import { makeCrow, birdSplitGeo } from './props.js';

/**
 * Birds.
 *
 * Perched crows on the overhead cables sit perfectly still -- that is what they
 * do -- and the airborne birds have to flap, because a bird that does not flap
 * is not flying, it is hanging.
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

/**
 * A crow on the street's overhead cables.
 *
 * `along` picks a station on the chain, `drop` how far below the *lowest*
 * cable's attachment point to sit -- the chains run three or four cables at
 * `-0.7`, `-0.42` and `-0.86`, and a crow lands on one of them.
 */
function perchOnWire(poles, { chain, along, sag = 0.55, drop = -0.7 }) {
  const a = poles[chain[0]];
  const b = poles[chain[chain.length - 1]];
  const x = a.x + (b.x - a.x) * along;
  const z = a.z + (b.z - a.z) * along;
  /* `makeWires` hangs every cable from `pole.top - 0.6`, so the crow has to be
   * measured from the same place or it sits two-thirds of a metre off. */
  const y = cableY(a, b, sag, along) - 0.6 + drop;
  const yaw = Math.atan2(b.x - a.x, b.z - a.z) + (along - 0.5) * 3.0;
  return { x, y, z, yaw };
}

/** Cable height at `t` along a run, matching `makeWires`' own sag. */
export function cableY(a, b, sag, t) {
  return a.top + (b.top - a.top) * t - Math.sin(Math.PI * t) * sag;
}

export function buildSkyBirds(ctx, poles = []) {
  const flock = buildFlock(ctx);
  if (!poles.length) return flock;

  const spots = [
    perchOnWire(poles, { chain: [0, 1, 2, 3], along: 0.62, drop: -0.7 }),
    perchOnWire(poles, { chain: [0, 1, 2, 3], along: 0.2, drop: -1.12 }),
    perchOnWire(poles, { chain: [4, 5, 6], along: 0.7, drop: -0.7 }),
    perchOnWire(poles, { chain: [0, 1, 2, 3], along: 0.86, drop: -0.42 }),
  ];

  const group = new THREE.Group();
  group.name = 'wireCrows';
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

