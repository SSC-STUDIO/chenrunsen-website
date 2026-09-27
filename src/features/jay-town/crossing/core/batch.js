import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 * Static batching -- the pass that made this scene affordable.
 *
 * This runs *after* `bakeToPlanet`, and it only works because of what the
 * bake leaves behind: every static mesh ends up with its geometry in root
 * space and an identity transform.  So two meshes anywhere in the world that
 * happen to share a material can be concatenated into one buffer with no
 * matrix arithmetic at all -- the merge is a memcpy.
 *
 * Why it was needed.  The world reached **20 418 meshes**, and three.js walks
 * the whole graph and issues one draw call per visible mesh, twice a frame
 * (shadow map, then colour).  Measured at the crossing: 5 836 calls, and at
 * the 展望台 15 858.  Cutting the triangle count did nothing for the frame
 * time -- 5.4 M to 2.0 M at the crossing moved it by less than the run-to-run
 * noise -- because the GPU was never the problem.  The cost is per *object*:
 * the traversal, the frustum test, the material state and the draw call.
 *
 * The grouping key is (material, cell, shadow flags, render order).  The cell
 * is what keeps frustum culling meaningful: merge a material across the whole
 * world and you get one draw call that is never off screen, which trades one
 * bottleneck for a worse one.
 *
 * What is deliberately left alone:
 *
 *  - **`planetRigid` rigs and everything under them.**  They animate about
 *    their own pivots; folding them into a shared buffer is exactly the bug
 *    the bake avoids by re-seating them in the first place.
 *  - **Multi-material meshes.**  Every sign in this world is a box with one
 *    mapped face, carried by `geometry.groups`.  Merging would have to
 *    renumber those groups, and getting it wrong makes a mesh vanish
 *    silently -- there is a row in the trap table about precisely that.
 * Transparent meshes *are* batched, which needs saying because it is the one
 * judgement call here.  Three.js sorts transparent objects back to front by
 * bounding-sphere centre, so a batch resolves at one depth instead of many.
 * That only shows where two translucent surfaces **on the same material** and
 * in the same cell overlap on screen, which in this world is a case that does
 * not arise: the lake's five layers are five materials with their own render
 * orders, and glazing is one pane per opening.  The reference frames are the
 * check -- `yubath`, `lkPier` and `showa` are the ones to look at.
 *
 * Outline shells are batched too, since `hullOutline` learned to share its
 * materials by signature.  They are re-parented to the root first so the mesh
 * underneath them stops being a special case.
 * ------------------------------------------------------------------ */

/**
 * Cell size in metres.
 *
 * Bigger means fewer draw calls and looser culling, and on this scene the
 * trade is nowhere near even: the frame cost is per object, and the GPU eats
 * whatever triangles fall out of a loose bound without noticing.  44 m was the
 * first guess and 80 m measures better everywhere -- it merges another 400
 * meshes that were alone in their cell at 44.
 */
export const BATCH_CELL = 80;

const KEEP = ['position', 'normal', 'uv'];

/**
 * Bring a geometry to exactly the attribute set `mergeGeometries` needs.
 *
 * Merging refuses a batch whose members disagree about attributes, and this
 * world has plenty that do -- an extruded profile carries no uv, a lathe does.
 * Rather than dropping those meshes, give the ones that are missing a uv a
 * zero one: it costs 8 bytes a vertex and the material that would read it is
 * by definition not the material on this batch.
 */
function normalise(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!KEEP.includes(name)) g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

/**
 * Collapse a multi-material mesh's groups down to one per *distinct* material.
 *
 * Every sign in this world is a `BoxGeometry` with one mapped face, and
 * `BoxGeometry` emits **six** groups with six material slots -- so a sign that
 * has two materials on it costs six draw calls, five of which set exactly the
 * same state as the one before.  Across the world that is 2 613 calls for 436
 * meshes; sorted by material it is 917, and 34 of those meshes turn out to
 * carry one material in all six slots, which makes them ordinary meshes that
 * `batchStatic` can then merge away entirely.
 *
 * The reordering is done by rewriting the index rather than the attributes,
 * which works whether or not the geometry had one: a non-indexed geometry gets
 * an index that happens to be a permutation.  Triangle order within a mesh has
 * no effect on the result -- there is no per-triangle sorting to disturb.
 *
 * Note the trap this is one step away from: a mesh with a material *array* and
 * no groups is not drawn at all, silently.  So when the array collapses to a
 * single material the material itself has to stop being an array.
 */
function coalesceGroups(root) {
  const stats = { groupMeshes: 0, groupsBefore: 0, groupsAfter: 0, groupsCollapsed: 0 };
  const seen = new WeakSet();
  const targets = [];
  root.traverse((o) => {
    if (o.isMesh && Array.isArray(o.material) && o.geometry?.groups?.length > 1
      && !isInNoBatchSubtree(o, root)) targets.push(o);
  });

  for (const o of targets) {
    const geo = o.geometry;
    if (seen.has(geo)) continue;
    seen.add(geo);
    stats.groupMeshes++;
    stats.groupsBefore += geo.groups.length;

    const mats = [];
    const slot = o.material.map((m) => {
      let i = mats.indexOf(m);
      if (i < 0) { i = mats.length; mats.push(m); }
      return i;
    });

    const buckets = mats.map(() => []);
    for (const g of geo.groups) {
      const t = slot[g.materialIndex] ?? 0;
      for (let i = 0; i < g.count; i++) buckets[t].push(g.start + i);
    }

    const old = geo.index ? geo.index.array : null;
    const order = [];
    const runs = [];
    for (let t = 0; t < buckets.length; t++) {
      const start = order.length;
      for (const k of buckets[t]) order.push(old ? old[k] : k);
      if (order.length > start) runs.push({ start, count: order.length - start, materialIndex: t });
    }

    geo.setIndex(order);
    geo.clearGroups();
    if (runs.length <= 1) {
      o.material = mats[0];
      stats.groupsCollapsed++;
      stats.groupsAfter += 1;
    } else {
      for (const r of runs) geo.addGroup(r.start, r.count, r.materialIndex);
      o.material = mats;
      stats.groupsAfter += runs.length;
    }
  }
  return stats;
}

const isUnderRigid = (o, root) => {
  for (let p = o.parent; p && p !== root.parent; p = p.parent) {
    if (p.userData.planetRigid) return true;
  }
  return false;
};

/** True when the object itself or any ancestor opts out of static batching. */
const isInNoBatchSubtree = (o, root) => {
  for (let p = o; p && p !== root.parent; p = p.parent) {
    if (p.userData.noBatch) return true;
  }
  return false;
};

/**
 * Merge the static meshes of `root` in place.
 *
 * Returns what it did, which is worth logging: the ratio of `before` to
 * `after` is the only honest measure of whether a later change has quietly
 * re-fragmented the scene.
 */
export function batchStatic(root, { cell = BATCH_CELL } = {}) {
  const t0 = performance.now();
  const stats = { before: 0, after: 0, skipped: 0, groups: 0, reparented: 0 };

  /* Shells hang off the mesh they outline.  For anything the bake touched both
   * are in root space under identity transforms by now, so lifting them to the
   * root changes nothing on screen and leaves every candidate childless.
   *
   * Not so inside a `planetRigid` rig: there the pair is still in the rig's
   * local frame, and re-parenting would drop the ink where the rig's origin
   * happens to be rather than round the part. */
  const shells = [];
  root.traverse((o) => {
    if (o.isMesh && o.parent && o.parent.isMesh
      && !isUnderRigid(o, root) && !isInNoBatchSubtree(o, root)) shells.push(o);
  });
  for (const s of shells) { root.add(s); stats.reparented++; }

  /* Runs first: a sign whose six slots turn out to hold one material stops
   * being a multi-material mesh, and can then be batched like anything else. */
  Object.assign(stats, coalesceGroups(root));

  const candidates = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isLine) return;
    stats.before++;
    if (o.userData.planetRigid || isUnderRigid(o, root)) return;
    if (isInNoBatchSubtree(o, root)) return;
    if (Array.isArray(o.material)) return;
    if (o.children.length) return;
    candidates.push(o);
  });

  const groups = new Map();
  const c = new THREE.Vector3();
  for (const o of candidates) {
    const g = o.geometry;
    if (!g || !g.attributes.position) continue;
    if (!g.boundingSphere) g.computeBoundingSphere();
    c.copy(g.boundingSphere.center);
    const key = [
      o.material.uuid,
      o.castShadow ? 1 : 0,
      o.receiveShadow ? 1 : 0,
      o.renderOrder | 0,
      Math.floor(c.x / cell), Math.floor(c.y / cell), Math.floor(c.z / cell),
    ].join('|');
    let b = groups.get(key);
    if (!b) groups.set(key, (b = []));
    b.push(o);
  }

  for (const list of groups.values()) {
    if (list.length < 2) { stats.skipped++; continue; }
    const src = list[0];
    let merged = null;
    try {
      merged = mergeGeometries(list.map((o) => normalise(o.geometry)));
    } catch {
      merged = null;
    }
    if (!merged) { stats.skipped += list.length; continue; }

    const mesh = new THREE.Mesh(merged, src.material);
    mesh.name = `${src.name || 'batch'}*${list.length}`;
    mesh.castShadow = src.castShadow;
    mesh.receiveShadow = src.receiveShadow;
    mesh.renderOrder = src.renderOrder;
    mesh.frustumCulled = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    merged.computeBoundingSphere();
    root.add(mesh);
    stats.groups++;

    for (const o of list) {
      o.parent?.remove(o);
      o.geometry.dispose();
    }
  }

  /* Containers that lost every child are pure traversal cost now. */
  const dead = [];
  root.traverse((o) => {
    if (o === root || o.isMesh || o.isLine) return;
    if (o.children.length === 0 && !o.userData.planetRigid
      && !isInNoBatchSubtree(o, root)) dead.push(o);
  });
  for (const o of dead) o.parent?.remove(o);

  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) stats.after++; });
  stats.ms = Math.round(performance.now() - t0);
  return stats;
}
