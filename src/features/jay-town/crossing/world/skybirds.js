import * as THREE from 'three';
import { flat } from '../core/toon.js';
import { birdSilhouetteGeo } from './props.js';
import { groundY } from './street.js';

/**
 * A handful of flying birds above the crossing.
 *
 * Replaces the old extras/sky-life cone flock (which read as dark slabs /
 * sticks).  Unlit flat material + thick low-poly mesh; bill faces travel via
 * Object3D.lookAt (−Z), slight bank on Z.
 */
const COUNT = 6;

export function buildSkyBirds(ctx) {
  const geo = birdSilhouetteGeo(1.6);
  const mat = flat({
    color: 0x4a4658,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.noOutline = true;
  mesh.name = 'skyBirds';
  mesh.userData.planetRigid = true;
  ctx.add(mesh);

  const birds = Array.from({ length: COUNT }, (_, i) => {
    const flock = i < 3 ? 0 : 1;
    const k = i * 1.37;
    return {
      flock,
      phase: (k * 2.17) % (Math.PI * 2),
      radius: (flock === 0 ? 9 : 12) + (k % 1) * 3.5,
      height: (flock === 0 ? 12.5 : 10.5) + ((k * 0.31) % 1) * 2.8,
      speed: 0.26 + ((k * 0.19) % 1) * 0.14,
      bank: ((k * 0.47) % 1 - 0.5) * 0.28,
      cx: flock === 0 ? 0.5 : 5.0,
      cz: flock === 0 ? 10.0 : -8.0,
      scale: 0.95 + ((k * 0.23) % 1) * 0.4,
    };
  });

  const dummy = new THREE.Object3D();
  let t = 0;

  function place(time) {
    for (let i = 0; i < COUNT; i++) {
      const b = birds[i];
      const angle = b.phase + time * b.speed;
      const x = b.cx + Math.cos(angle) * b.radius;
      const z = b.cz + Math.sin(angle) * b.radius;
      const y = groundY(z) + b.height + Math.sin(time * 0.7 + b.phase) * 0.3;

      // Velocity is tangential; lookAt aims local −Z (bill) along that path.
      const aheadX = x - Math.sin(angle);
      const aheadZ = z + Math.cos(angle);
      dummy.position.set(x, y, z);
      dummy.up.set(0, 1, 0);
      dummy.lookAt(aheadX, y, aheadZ);
      dummy.rotateZ(b.bank + Math.sin(angle * 2) * 0.1);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  place(0);
  ctx.update((dt) => {
    t += dt;
    place(t);
  });

  return mesh;
}
