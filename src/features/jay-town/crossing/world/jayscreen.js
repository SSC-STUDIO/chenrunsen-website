import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { box, cyl, shadowify } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { groundY } from './street.js';
import { SCREENS } from '../../screens/screens.js';

/* ------------------------------------------------------------------ *
 * The screens themselves.
 *
 * One per stop, and every one of them is *geometry* rather than a texture:
 * the picture is a DOM element composited over the canvas by
 * `screens/screen-hub.ts`, and all this module owes that is a rectangle in
 * exactly the place `screens.ts` says it is.  Get that wrong by a centimetre
 * and the video sits visibly off its frame, so the size and the height come
 * from the table and are never repeated here.
 *
 * What is *not* shared is the mount.  A drive-in sheet bolted to a gable, a
 * listening booth in a shop window and a station departure board are three
 * different objects that happen to have a lit rectangle on them, and dressing
 * them identically is the one thing that would make the set read as a
 * developer's placeholder.
 *
 * The curtain -- the lit surface under the video -- matters more than it
 * looks.  It is what fills the frame before any player has loaded, what shows
 * at the soft edge the occlusion mask leaves, and what you see from behind,
 * where an iframe cannot go.  It is deliberately a little lighter than black,
 * so that at night it reads as an unlit screen rather than as a hole in the
 * wall.
 * ------------------------------------------------------------------ */

/** Every curtain in the world, so the day/night toggle can relight them. */
const curtains = [];

/**
 * The built screen groups, by zone.
 *
 * A module-level registry rather than a traverse of the world root: the bake
 * re-seats these groups but leaves them parented, and looking them up by zone
 * is both cheaper and harder to get wrong than filtering several thousand
 * meshes by a `userData` flag.
 */
const screenGroups = new Map();

/**
 * The lit surface of a screen.
 *
 * Marked `jayScreen` for the hub to find, `planetRigid` so the bake leaves it
 * as its own pivot instead of folding its geometry into the sphere, and
 * `noBatch` so static batching cannot merge it away.  All three are load
 * bearing -- lose any one and the portal stops tracking the frame.
 */
function makeCurtain(warm) {
  const mat = cel({
    color: warm ? 0x2b3140 : 0x232a38,
    bands: 2,
    tint: 0x4a4468,
    emissive: 0x1a2030,
    emissiveIntensity: 0.35,
    cache: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  /* Double-sided because the viewer may walk round the back of a free-standing
   * screen; `noOutline` because a flat quad's hull shell would z-fight it. */
  mat.side = THREE.DoubleSide;
  mesh.receiveShadow = true;
  mesh.userData.noOutline = true;
  curtains.push(mesh);
  return mesh;
}

/** The frame around a curtain: four bars, each with a drawn contour. */
function makeSurround(w, h, depth, thickness, mat) {
  const g = new THREE.Group();
  const halfW = w / 2;
  const halfH = h / 2;
  const bars = [
    box(w + thickness * 2, thickness, depth, mat, 0, halfH + thickness / 2, 0),
    box(w + thickness * 2, thickness, depth, mat, 0, -halfH - thickness / 2, 0),
    box(thickness, h, depth, mat, -halfW - thickness / 2, 0, 0),
    box(thickness, h, depth, mat, halfW + thickness / 2, 0, 0),
  ];
  for (const bar of bars) {
    bar.castShadow = true;
    bar.receiveShadow = true;
    g.add(bar);
    hullOutline(bar, { thickness: 0.004 });
  }
  return g;
}

/** A run of festoon bulbs along the top of a screen. */
function bulbRun(w, y, z, count = 7, color = 0xffe6b0) {
  const g = new THREE.Group();
  const mat = flat({ color, cache: false });
  for (let i = 0; i < count; i++) {
    const x = -(w / 2) + (i / (count - 1)) * w;
    g.add(cyl(0.04, 0.04, 0.07, 6, mat, x, y, z));
  }
  return g;
}

/**
 * 时代广场 -- a sheet bolted to a gable, seen from the level crossing.
 *
 * Whitewashed board, steel posts and a run of bulbs, because the only
 * distance the opening frame ever sees this from is forty metres: it has to
 * read as *switched on* from back there or it may as well not exist.
 */
function mountDriveIn(spec) {
  const g = new THREE.Group();
  const w = spec.w + 0.34;
  const h = spec.h + 0.34;
  const boardMat = cel({ color: 0xe8e2d4, bands: 3, tint: 0x5c5680 });
  const steel = cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 });

  const backing = box(w, h, 0.16, boardMat, 0, 0, -0.11);
  shadowify(backing);
  g.add(backing);
  hullOutline(backing, { thickness: 0.005 });

  g.add(makeSurround(spec.w, spec.h, 0.1, 0.13, boardMat));

  const hood = box(w + 0.5, 0.12, 0.62, boardMat, 0, h / 2 + 0.2, 0.16);
  hood.castShadow = true;
  g.add(hood);
  g.add(bulbRun(w, h / 2 + 0.1, 0.42));

  // two braced posts, so it is visibly standing on something
  const drop = spec.y + spec.h / 2;
  for (const sx of [-1, 1]) {
    const px = sx * (spec.w / 2 - 0.1);
    const post = box(0.13, drop, 0.13, steel, px, -drop / 2, -0.16);
    post.castShadow = true;
    g.add(post);
    const brace = box(0.1, drop * 0.9, 0.1, steel, px, -drop * 0.45, 0.2);
    brace.rotation.x = -0.3;
    g.add(brace);
  }
  return g;
}

/** 唱片行 -- a listening booth inside a shop window.  Small, warm, reachable. */
function mountListeningBooth(spec) {
  const g = new THREE.Group();
  const wood = cel({ color: 0x8a6f52, bands: 3, tint: 0x5c5680 });
  const woodDark = cel({ color: 0x6a5240, bands: 3, tint: 0x554e74 });

  const carcass = box(spec.w + 0.5, spec.h + 0.5, 0.3, woodDark, 0, 0, -0.2);
  shadowify(carcass);
  g.add(carcass);
  hullOutline(carcass, { thickness: 0.004 });
  g.add(makeSurround(spec.w, spec.h, 0.12, 0.11, wood));

  // the booth's shelf of sleeves, and the shop's awning over the whole window
  g.add(box(spec.w + 0.7, 0.1, 0.66, wood, 0, spec.h / 2 + 0.34, 0.14));
  const sleeveColors = [0xc45a6a, 0x3f7fbf, 0xe25a4a, 0x4f9d6a, 0xd8b05a];
  for (let i = 0; i < 5; i++) {
    const sleeve = box(0.03, 0.3, 0.3,
      cel({ color: sleeveColors[i], bands: 2, tint: 0x6f6790 }),
      -(spec.w / 2 - 0.1) + i * 0.28, -(spec.h / 2 + 0.36), 0.14);
    sleeve.rotation.z = (i - 2) * 0.05;
    g.add(sleeve);
  }
  const awning = box(spec.w + 1.0, 0.08, 0.8,
    cel({ color: PAL.awningGreen, bands: 3, tint: 0x514b70 }),
    0, spec.h / 2 + 0.66, 0.32);
  awning.rotation.x = -0.22;
  g.add(awning);
  return g;
}

/**
 * 天台 -- the concrete roof, watched from across the precinct.
 *
 * A free-standing gantry with a truss and a water tank, because the point of
 * this one is that you can see it is *up there*: the legs and the tank are
 * what say roof rather than wall.
 */
function mountRooftop(spec) {
  const g = new THREE.Group();
  const concrete = cel({ color: PAL.concreteMid, bands: 3, tint: 0x6a6288 });
  const steel = cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 });

  g.add(makeSurround(spec.w, spec.h, 0.2, 0.16, concrete));
  const back = box(spec.w + 0.6, spec.h + 0.6, 0.12, concrete, 0, 0, -0.14);
  shadowify(back);
  g.add(back);

  const drop = spec.y - spec.h / 2;
  for (const sx of [-1, 1]) {
    const px = sx * (spec.w / 2 - 0.12);
    g.add(box(0.14, Math.max(0.4, drop), 0.14, steel, px, -(spec.h / 2 + drop / 2), -0.1));
    const brace = box(0.09, spec.h, 0.09, steel, px, 0, 0.1);
    brace.rotation.z = sx * 0.2;
    g.add(brace);
  }

  const tankMat = cel({ color: PAL.metalWarm, bands: 3, tint: 0x5c5680 });
  const tank = cyl(0.62, 0.62, 1.0, 12, tankMat, spec.w / 2 + 0.7, spec.h / 2 + 0.6, -0.5);
  tank.castShadow = true;
  g.add(tank);
  g.add(box(1.5, 0.1, 1.5, steel, spec.w / 2 + 0.7, spec.h / 2 + 1.15, -0.5));
  for (const [dx, dz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    g.add(box(0.07, 1.15, 0.07, steel, spec.w / 2 + 0.7 + dx, spec.h / 2 + 0.1, -0.5 + dz));
  }

  g.add(bulbRun(spec.w, spec.h / 2 + 0.44, 0.08, 9, 0xffe0a8));
  return g;
}

/** 毕业那天 -- the departure-board frame on an unstaffed platform. */
function mountStationBoard(spec) {
  const g = new THREE.Group();
  const steel = cel({ color: 0x2a3040, bands: 2, tint: 0x4a4468 });
  const plate = cel({ color: PAL.metal, bands: 3, tint: 0x5c5680 });

  g.add(makeSurround(spec.w, spec.h, 0.12, 0.1, steel));
  const back = box(spec.w + 0.5, spec.h + 0.5, 0.1, steel, 0, 0, -0.09);
  shadowify(back);
  g.add(back);

  // post down to the platform, with a foot and a brace
  const drop = Math.max(0.3, spec.y - spec.h / 2 - 0.15);
  g.add(cyl(0.075, 0.075, drop, 8, plate, 0, -(spec.h / 2 + drop / 2), -0.1));
  g.add(box(0.42, 0.07, 0.42, plate, 0, -(spec.h / 2 + drop), -0.1));
  const brace = box(0.06, spec.h * 0.8, 0.06, plate, 0.26, -(spec.h / 2 + 0.22), -0.12);
  brace.rotation.z = -0.5;
  g.add(brace);

  // the little glazed hood a departure board always has
  const hood = box(spec.w + 0.3, 0.07, 0.42, plate, 0, spec.h / 2 + 0.24, 0.09);
  hood.rotation.x = -0.16;
  g.add(hood);
  return g;
}

/**
 * 七里香河堤 -- a sheet hung between two posts on the canal bank.
 *
 * The only one of the five with nothing behind it, and the only one you are
 * meant to look at from *along* rather than from in front: a screen over
 * water is watched from the other bank and from a hundred metres of towpath,
 * so it is hung from its own posts and the gaps under it are the point.
 */
function mountWaterScreen(spec) {
  const g = new THREE.Group();
  const postMat = cel({ color: PAL.concrete, bands: 3, tint: 0x6a6288 });
  const steel = cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 });

  const board = box(spec.w + 0.3, spec.h + 0.3, 0.1,
    cel({ color: 0xb8c4cc, bands: 3, tint: 0x5c5680 }), 0, 0, -0.08);
  shadowify(board);
  g.add(board);
  hullOutline(board, { thickness: 0.004 });
  g.add(makeSurround(spec.w, spec.h, 0.1, 0.1, steel));

  const postLen = Math.max(0.6, spec.y + spec.h / 2);
  for (const sx of [-1, 1]) {
    const px = sx * (spec.w / 2 + 0.55);
    const post = cyl(0.11, 0.13, postLen, 8, postMat, px, -postLen / 2, -0.06);
    post.castShadow = true;
    g.add(post);
    // a stay back to the bank: what keeps a sheet over water upright
    const stay = box(0.07, postLen * 0.85, 0.07, steel, px + sx * 0.4, -postLen * 0.45, -0.34);
    stay.rotation.z = sx * 0.42;
    g.add(stay);
  }
  return g;
}

const MOUNTS = {
  'drive-in': mountDriveIn,
  booth: mountListeningBooth,
  rooftop: mountRooftop,
  board: mountStationBoard,
  water: mountWaterScreen,
};

/** Mount per stop, in the same order as `SCREENS`. */
const MOUNT_FOR_ZONE = ['drive-in', 'booth', 'rooftop', 'board', 'water'];

/**
 * Build every screen in the table.
 *
 * The group carries `userData.jayScreen`, its zone, and its curtain, and it is
 * left as a live pivot for the bake to re-seat -- `scene.ts` finds these by
 * traversing the world root and hands them to the hub.  `onScreen` is called
 * once per built group, purely so that discovery does not have to be a
 * traverse of the whole world.
 */
export function buildJayScreens(ctx, onScreen) {
  SCREENS.forEach((spec, index) => {
    const mount = MOUNTS[MOUNT_FOR_ZONE[index]] || mountDriveIn;
    const group = new THREE.Group();
    group.name = `jayScreen:${spec.zone}`;

    const curtain = makeCurtain(spec.zone === 1 || spec.zone === 4);
    curtain.scale.set(spec.w, spec.h, 1);
    curtain.position.z = 0.02;
    group.add(curtain);
    group.add(mount(spec));

    /* Load bearing, all three: the bake must leave this group alone and
     * re-seat it (planetRigid), batching must not merge it (noBatch), and the
     * hub has to be able to find the curtain's own rect (jayScreen). */
    group.userData.planetRigid = true;
    group.userData.noBatch = true;

    const y = (spec.baseY || groundY(spec.z)) + spec.y;
    group.position.set(spec.x, y, spec.z);
    group.rotation.y = spec.yaw;
    group.userData.jayZone = spec.zone;
    group.userData.curtain = curtain;
    group.traverse((o) => { if (o.isMesh) o.userData.jayScreen = spec.zone; });

    ctx.add(group);
    screenGroups.set(spec.zone, group);
    onScreen?.(spec.zone, group);

    /* A thin collider so the viewer cannot walk through a screen.  It is
     * deliberately much narrower than the frame: at four metres wide a
     * full-width collider would wall off a five-metre footway. */
    const halfW = spec.w / 2 + 0.3;
    const c = Math.cos(spec.yaw);
    const s = Math.sin(spec.yaw);
    const ex = Math.abs(halfW * c) + Math.abs(0.4 * s);
    const ez = Math.abs(halfW * s) + Math.abs(0.4 * c);
    ctx.collide(spec.x - ex, spec.z - ez, spec.x + ex, spec.z + ez, y + spec.h / 2 + 0.4);
  });
}

/**
 * The built screens, by zone.  Read once by `scene.ts` after the world is up.
 */
export function screenRegistry() {
  return screenGroups;
}

/**
 * Day/night for the screens.
 *
 * At night an unlit screen has to be *brighter* than the wall it hangs on or
 * it stops reading as a screen, and the bulbs have to come up.  This drives
 * the curtain's own emissive, which is why the curtains are not built through
 * the shared material cache.
 */
export function setScreenNight(amount) {
  const t = Math.min(1, Math.max(0, amount));
  for (const mesh of curtains) {
    const mat = mesh.material;
    mat.emissive.setHex(t > 0.02 ? 0x2a3348 : 0x1a2030);
    mat.emissiveIntensity = 0.35 + t * 0.5;
    mat.color.setHex(0x232a38).lerp(new THREE.Color(0x39415a), t);
  }
}
