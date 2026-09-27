import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { box, cyl, bake, trs } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { makeBicycle, makeBench } from './props.js';

/* ------------------------------------------------------------------ *
 * 周杰伦小镇 -- 主题道具（第二辑）
 *
 * `jaytheme.js` planted the first four objects (the record crate, the vinyl
 * on its stand, the 晴天唱片 blade, the song-name notice board, the departure
 * board and the canal plate).  This module is the rest of the town: fourteen
 * props across the five stops, one idea each, all of them readable at walking
 * distance and none of them a wall of signboards.
 *
 * ## What may be written on them
 *
 * Song titles, album titles and years -- public facts, the same scale
 * `jaytheme.js` already works at.  **No lyrics.**  `SOURCES.md` and
 * `crossing/NOTICE` are the position: nothing here is downloaded and nothing
 * is traced off a reference; every prop is three.js primitives and every
 * letter is drawn with Canvas2D at start-up.
 *
 * ## Two things that decide how these are built
 *
 * 1. **Static, so they batch.**  Nothing in this file moves.  Not one group
 *    carries `userData.noBatch`, and that is the point: `batchStatic` merges
 *    a static leaf mesh into a per-(material, cell) buffer, so a shelf of
 *    twelve small boxes costs one draw call instead of twelve.  A prop that
 *    wanted to swing or spin would have to opt out of that *and* be re-seated
 *    on the planet, and the bill for one moving wind chime is paid by every
 *    frame.  The chime below is still, and reads as still.
 * 2. **Shared materials.**  `mats()` is a module-level singleton: two hundred
 *    meshes and about twenty materials, so the whole set lands in a handful of
 *    batches.  A `cel()` per prop is how a scene ends up with 2 892 materials
 *    (see `batchStatic`'s header) and no two objects in one batch.
 * ------------------------------------------------------------------ */

const JP = `'Yu Gothic', 'Yu Gothic UI', 'Meiryo', 'MS Gothic', 'Hiragino Kaku Gothic ProN', sans-serif`;

/* ------------------------------- textures ------------------------------- */

function canvasTex(w, h, draw, { repeat = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  draw(c, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

/** The wayfinding board at the level crossing: the town's five stops. */
function tourBoardTex() {
  return canvasTex(512, 384, (c, w, h) => {
    c.fillStyle = '#f2ead6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2f6f68';
    c.fillRect(0, 0, w, 62);
    c.fillStyle = '#fff8ed';
    c.font = `bold 30px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('周杰伦小镇 ・ 案内', w / 2, 32);

    const rows = ['樱花街口', '唱片小巷', '晴天广场', '花海车站', '七里香河堤'];
    rows.forEach((t, i) => {
      const y = 100 + i * 54;
      c.fillStyle = i % 2 ? '#eae1cd' : '#f7f1e4';
      c.fillRect(16, y - 22, w - 32, 44);
      c.fillStyle = '#b5322f';
      c.font = `bold 24px sans-serif`;
      c.textAlign = 'left';
      c.fillText(`0${i + 1}`, 34, y);
      c.fillStyle = '#3a3348';
      c.font = `bold 30px ${JP}`;
      c.textAlign = 'center';
      c.fillText(t, w / 2 + 18, y);
    });
    c.fillStyle = '#7d7466';
    c.font = `600 17px ${JP}`;
    c.fillText('徒歩でめぐれる 5 つの停留所', w / 2, h - 18);
  });
}

/** A small wooden plate: one song title, one year.  `sub` is optional. */
function songPlateTex(title, year, sub = '') {
  return canvasTex(256, 192, (c, w, h) => {
    c.fillStyle = '#e9d9b6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#b5322f';
    c.fillRect(0, 0, w, 12);
    c.fillStyle = '#4a4034';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${title.length > 3 ? 44 : 58}px ${JP}`;
    c.fillText(title, w / 2, h * 0.44);
    c.fillStyle = '#8a7350';
    c.font = `600 26px ${JP}`;
    c.fillText(year, w / 2, h * 0.72);
    if (sub) {
      c.fillStyle = '#9a8f82';
      c.font = `600 18px ${JP}`;
      c.fillText(sub, w / 2, h * 0.89);
    }
  });
}

/**
 * The platform clock face, stopped at 5:20.
 *
 * The hands are *drawn into the texture* rather than being two meshes on a
 * spindle.  It is a stopped clock: nothing here turns, so geometry would buy
 * nothing and cost a draw call and two seams.
 */
function clockFaceTex(station) {
  return canvasTex(256, 256, (c, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    c.fillStyle = '#f7f3e8';
    c.beginPath();
    c.arc(cx, cy, w * 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#4a4468';
    c.lineWidth = 3;
    c.stroke();

    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const big = i % 5 === 0;
      c.strokeStyle = big ? '#3a3348' : '#a8a2b4';
      c.lineWidth = big ? 4 : 2;
      const r0 = big ? 84 : 92;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
      c.stroke();
    }
    c.fillStyle = '#3a3348';
    c.font = `bold 30px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const [n, a] of [[12, -Math.PI / 2], [3, 0], [6, Math.PI / 2], [9, Math.PI]]) {
      c.fillText(String(n), cx + Math.cos(a) * 62, cy + Math.sin(a) * 62);
    }
    c.fillStyle = '#8a8496';
    c.font = `bold 17px ${JP}`;
    c.fillText(station, cx, cy + 34);

    // 5:20 and stopped.  Hour hand between 5 and 6, minute hand on the 4.
    const hand = (angle, len, wide, color) => {
      c.strokeStyle = color;
      c.lineWidth = wide;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      c.stroke();
    };
    hand((5 + 20 / 60) / 12 * Math.PI * 2 - Math.PI / 2, 42, 7, '#39324f');
    hand((20 / 60) * Math.PI * 2 - Math.PI / 2, 72, 5, '#39324f');
    c.fillStyle = '#b5322f';
    c.beginPath();
    c.arc(cx, cy, 7, 0, Math.PI * 2);
    c.fill();
  });
}

/** AM/FM dial for the shop-counter radio. */
function radioDialTex() {
  return canvasTex(384, 224, (c, w, h) => {
    c.fillStyle = '#3b2f26';
    c.fillRect(0, 0, w, h);
    // speaker grille
    c.fillStyle = '#6a5644';
    for (let i = 0; i < 9; i++) c.fillRect(20, 28 + i * 19, 132, 9);
    // dial strip
    c.fillStyle = '#e8dfc8';
    c.fillRect(176, 30, 186, 62);
    c.fillStyle = '#3a3348';
    c.font = `bold 24px sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('SAKURA FM 2000', 186, 62);
    c.fillStyle = '#a8a09a';
    c.font = `600 14px sans-serif`;
    for (let i = 0; i <= 10; i++) c.fillRect(180 + i * 17, 100, 3, 12);
    c.fillStyle = '#b5322f';
    c.fillRect(180 + 6 * 17 - 2, 96, 3, 22);
    // the band label
    c.fillStyle = '#c9c0ac';
    c.font = `600 15px ${JP}`;
    c.fillText('76  80  84  88  92 MHz', 178, 128);
    c.fillStyle = '#8f8578';
    c.font = `600 15px ${JP}`;
    c.fillText('桜町 電気店 ・ 中古', 178, 158);
  });
}

/** Cassette label.  Two short lines, no more. */
function tapeLabelTex(side, year) {
  return canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#f2ead6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = ['#3f7fbf', '#b5322f', '#4f8f6a'][side.length % 3];
    c.fillRect(0, 0, w, 34);
    c.fillStyle = '#fff8ed';
    c.font = `bold 22px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(side, w / 2, 18);
    c.fillStyle = '#4a4034';
    c.font = `bold 30px ${JP}`;
    c.fillText(year, w / 2, 82);
    c.fillStyle = '#9a8f82';
    c.fillRect(24, 118, w - 48, 3);
    c.font = `600 16px ${JP}`;
    c.fillText('60', w / 2, 136);
  });
}

/** The 花海 bento lid. */
function bentoLabelTex() {
  return canvasTex(256, 176, (c, w, h) => {
    c.fillStyle = '#2f5f9c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f0e6';
    c.fillRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#2f5f9c';
    c.font = `bold 40px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('花海駅 弁当', w / 2, 58);
    c.fillStyle = '#3a3348';
    c.font = `600 22px ${JP}`;
    c.fillText('幕の内 ・ 2008', w / 2, 104);
    // a two-car train, four rectangles and two windows
    c.fillStyle = '#3f7fbf';
    c.fillRect(52, 130, 152, 22);
    c.fillStyle = '#e8f2fa';
    for (let i = 0; i < 5; i++) c.fillRect(60 + i * 30, 136, 18, 10);
  });
}

/** 青花 banding: an abstract scroll, drawn, not a trademark pattern. */
function teaBandTex() {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#f7f6f2';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2f5f9c';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 16);
    c.lineTo(w, 16);
    c.moveTo(0, h - 16);
    c.lineTo(w, h - 16);
    c.stroke();
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 42;
      c.beginPath();
      c.arc(x, h / 2, 9, 0.4, Math.PI * 1.5);
      c.stroke();
      c.beginPath();
      c.arc(x + 18, h / 2, 5, Math.PI, Math.PI * 2.6);
      c.stroke();
      c.beginPath();
      c.arc(x + 30, h / 2 + 5, 3, 0, Math.PI * 2);
      c.stroke();
    }
  }, { repeat: [2, 1] });
}

/** White keys on a keybed: 22 of them, drawn once. */
function keybedTex() {
  return canvasTex(512, 64, (c, w, h) => {
    c.fillStyle = '#f6f2e6';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b8b2c0';
    c.lineWidth = 2;
    for (let i = 1; i < 22; i++) {
      const x = (i * w) / 22;
      c.beginPath();
      c.moveTo(x, 6);
      c.lineTo(x, h);
      c.stroke();
    }
    c.fillStyle = '#d8d2dc';
    c.fillRect(0, h - 5, w, 5);
  });
}

/* ------------------------------- materials ------------------------------- */

const M = {};

function mats() {
  if (M.wood) return M;
  M.wood = cel({ color: 0x9a7a58, bands: 3, tint: 0x5c5680 });
  M.woodDark = cel({ color: 0x6a5240, bands: 3, tint: 0x554e74 });
  M.bamboo = cel({ color: PAL.bamboo, bands: 3, tint: 0x5b7f8c });
  M.bambooDeep = cel({ color: PAL.bambooDeep, bands: 3, tint: 0x5b7f8c });
  M.lacquer = cel({ color: 0x241f2c, bands: 2, tint: 0x4b4560 });
  M.brass = cel({ color: 0xc9a24a, bands: 3, tint: 0x6f6790 });
  M.brassIn = cel({ color: 0xc9a24a, bands: 3, side: THREE.DoubleSide, tint: 0x6f6790 });
  M.porcelain = cel({ color: 0xf7f6f2, bands: 3, tint: 0x9aa0c0 });
  M.stone = cel({ color: PAL.stone, bands: 3, tint: 0x6f6790 });
  M.metal = cel({ color: PAL.metal, bands: 3, tint: 0x666090 });
  M.dark = cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 });
  M.white = cel({ color: 0xfaf7f0, bands: 3, tint: 0x8f8ab0 });
  M.cloth = cel({ color: 0xf6f3ec, bands: 2, tint: 0x8f8ab0 });
  M.pink = cel({ color: PAL.blossomDeep, bands: 3, tint: 0x8f86a8 });
  M.red = cel({ color: PAL.red, bands: 3, tint: 0x7a4060 });
  M.blue = cel({ color: PAL.blue, bands: 3, tint: 0x5c5680 });
  M.leaf = cel({ color: PAL.leafDeep, bands: 3, tint: 0x5b6f8c });
  M.ink = cel({ color: 0x2a2734, bands: 2, tint: 0x413c58 });
  M.string = flat({ color: 0x8a8496 });
  M.pearl = cel({ color: 0x3a2c26, bands: 2, tint: 0x4b4560 });
  M.teaBand = flat({ color: 0xffffff, map: teaBandTex(), cache: false });
  M.dial = flat({ color: 0xffffff, map: radioDialTex(), cache: false });
  M.keybed = flat({ color: 0xffffff, map: keybedTex(), cache: false });
  return M;
}

/* ------------------------------- small helpers ------------------------------- */

/** A slab with the art on the +z face and one flat material on the other five. */
function plateMesh(w, h, t, sideMat, faceMat) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, t),
    [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat],
  );
}

/**
 * A cylinder spanning two points -- balloon strings, chime cords, the fishing
 * line, the guitar's six strings.  Written as a helper because the same
 * three lines were about to be typed eleven times, and a string between two
 * points is exactly the sort of thing that quietly ends up not touching
 * either of them.
 */
function rodBetween(a, b, r, mat, seg = 4) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** `bake()` returns a geometry; every caller here wants the mesh. */
function baked(parts, mat) {
  return new THREE.Mesh(bake(parts), mat);
}

/** Cast/receive on every surface, but never on an ink shell. */
function shadowify(g) {
  g.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (o.material && o.material.isShaderMaterial) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

function place(g, o) {
  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/* ------------------------------------------------------------------ *
 * 1. 樱花街口 -- the wayfinding board and the balloons
 * ------------------------------------------------------------------ */

/** The town's notice board: five stops, the same names the route bar uses. */
function makeTourBoard(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:tourBoard';
  const W = 1.16, H = 0.8, Y0 = 0.74;
  for (const s of [-1, 1]) {
    const post = box(0.085, Y0 + H + 0.08, 0.085, m.woodDark, s * (W / 2 - 0.09), (Y0 + H + 0.08) / 2, 0);
    g.add(post);
  }
  const panel = plateMesh(W, H, 0.055, m.wood,
    flat({ color: 0xffffff, map: tourBoardTex(), cache: false }));
  panel.position.set(0, Y0 + H / 2, 0.045);
  g.add(panel);
  hullOutline(panel, { thickness: 0.0026 }).userData.isOutline = true;
  const hood = box(W + 0.2, 0.05, 0.3, cel({ color: PAL.roofSlate, bands: 3, tint: 0x514b70 }), 0, Y0 + H + 0.1, 0.1);
  hood.rotation.x = -0.17;
  g.add(hood);
  g.add(box(W + 0.26, 0.07, 0.07, m.woodDark, 0, 0.035, 0.06));
  return place(shadowify(g), o);
}

/**
 * 告白气球 -- a tied bunch of white balloons with one pink in it.
 *
 * Tied, not floating: the knot is a short post at the kerb, so this is a
 * static prop and batches with everything else.  Eight balloons at 10x8
 * segments is 1 280 triangles for the whole bunch.
 */
function makeBalloonBunch(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:balloons';
  g.add(cyl(0.026, 0.032, 0.66, 6, m.dark, 0, 0.33, 0));
  g.add(cyl(0.08, 0.095, 0.07, 8, m.stone, 0, 0.035, 0));
  const knot = new THREE.Vector3(0, 0.66, 0);
  // One hand's worth: a fat middle, two lower, two high, and a leash out front.
  const SPOTS = [
    [-0.30, 1.72, 0.05, 1.00], [-0.14, 1.94, -0.11, 1.06], [-0.01, 1.76, 0.13, 0.96],
    [0.15, 1.98, -0.05, 1.02], [0.29, 1.74, 0.07, 0.94], [0.07, 2.16, 0.01, 1.10],
    [-0.21, 2.20, -0.07, 1.04], [0.22, 2.22, 0.09, 0.98],
  ];
  SPOTS.forEach((p, i) => {
    const r = 0.155 * p[3];
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), i === 2 ? m.pink : m.white);
    balloon.scale.set(r, r * 1.16, r);
    balloon.position.set(p[0], p[1], p[2]);
    g.add(balloon);
    g.add(rodBetween(knot, new THREE.Vector3(p[0], p[1] - r * 1.12, p[2]), 0.0045, m.string, 3));
  });
  return place(shadowify(g), o);
}

/**
 * 学生の自転車 -- a parked bicycle with a school satchel on the rack.
 *
 * The person is deliberately missing.  There is nobody in this town: that is
 * the convention `props.js` states for the whole world ("how you say people
 * organise here without putting anybody in the frame"), and one low-poly
 * student standing in the road would be the only figure in a hundred and
 * sixty metres of town.  The satchel, the strap and the books in the basket
 * do the telling instead.
 */
function makeStudentBike(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:studentBike';
  const rig = new THREE.Group();
  // makeBicycle writes o.x/o.z straight into position, so build it at the
  // origin and let the rig carry the placement -- the trap `streetprops.js`
  // records for the child's bicycle.
  rig.add(makeBicycle({ x: 0, z: 0, y: 0, ry: 0, lean: 0.05, color: o.color ?? 0x4c6a86 }));
  // satchel on the rear rack (rack top is at y 0.771, z within +-0.075)
  const bag = box(0.26, 0.2, 0.15, cel({ color: PAL.norenRed, bands: 3, tint: 0x6f5a7a }), -0.5, 0.878, 0);
  bag.rotation.z = 0.04;
  rig.add(bag);
  const flap = box(0.27, 0.1, 0.16, cel({ color: 0xa72f23, bands: 3, tint: 0x6f5a7a }), -0.5, 0.935, 0);
  flap.rotation.z = 0.04;
  rig.add(flap);
  rig.add(box(0.04, 0.028, 0.16, m.brass, -0.36, 0.85, 0));
  // a bundle of books in the front basket (basket floor is at y 0.775)
  rig.add(box(0.18, 0.11, 0.14, cel({ color: PAL.wallCream, bands: 2, tint: 0x8f8ab0 }), 0.69, 0.835, 0.01));
  rig.add(box(0.17, 0.03, 0.13, cel({ color: PAL.blue, bands: 2, tint: 0x8f8ab0 }), 0.69, 0.905, 0.01));
  g.add(rig);
  return place(shadowify(g), o);
}

/* ------------------------------------------------------------------ *
 * 2. 唱片小巷 -- the piano, the gramophone, the counter
 * ------------------------------------------------------------------ */

/**
 * 立式钢琴 -- an upright, in the black lacquer every one of them is.
 *
 * The keyboard is the only part that has to be right.  White keys are one
 * box carrying a 22-key strip; the twelve black keys are one baked mesh, so
 * the whole instrument is nine meshes and reads at a glance.  Its front is
 * +z: rotate the group, do not re-author it.
 */
function makeUprightPiano(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:piano';

  const body = box(1.42, 1.06, 0.56, m.lacquer, 0, 0.59, -0.06);
  g.add(body);
  hullOutline(body, { thickness: 0.0034 }).userData.isOutline = true;
  g.add(box(1.46, 0.09, 0.6, m.lacquer, 0, 0.06, -0.05));            // plinth
  g.add(box(1.46, 0.05, 0.62, m.lacquer, 0, 1.145, -0.05));          // lid
  g.add(box(1.34, 0.1, 0.3, m.lacquer, 0, 0.71, 0.26));              // keybed

  const keys = box(1.22, 0.032, 0.15, m.keybed, 0, 0.776, 0.345);
  keys.userData.noOutline = true;
  g.add(keys);
  /* The black keys, from the white-key pitch rather than by eye: 22 keys
   * across 1.22 m is 0.05545 m each, and a C major octave puts the five
   * accidentals on the boundaries after the 1st, 2nd, 4th, 5th and 6th white
   * key.  Three octaves, one baked mesh. */
  const KW = 1.22 / 22;
  const geo = new THREE.BoxGeometry(0.021, 0.028, 0.09);
  const black = [];
  for (let oct = 0; oct < 3; oct++) {
    for (const b of [1, 2, 4, 5, 6]) {
      black.push({ geometry: geo, matrix: trs(-0.61 + (oct * 7 + b) * KW, 0.804, 0.315) });
    }
  }
  g.add(new THREE.Mesh(bake(black), m.lacquer));

  const desk = box(1.06, 0.02, 0.26, m.woodDark, 0, 0.99, 0.14);
  desk.rotation.x = -0.42;
  g.add(desk);
  g.add(box(0.36, 0.06, 0.14, m.lacquer, 0, 0.09, 0.3));             // pedal box
  g.add(baked([-0.11, 0, 0.11].map((dx) => ({
    geometry: new THREE.BoxGeometry(0.05, 0.02, 0.11),
    matrix: trs(dx, 0.135, 0.35),
  })), m.brass));                                                    // three pedals

  // the stool, on the piano's own front
  const stool = new THREE.Group();
  stool.position.set(0, 0, 0.86);
  stool.add(box(0.86, 0.06, 0.32, m.woodDark, 0, 0.5, 0));
  stool.add(baked([[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => ({
    geometry: new THREE.CylinderGeometry(0.028, 0.032, 0.48, 6),
    matrix: trs(sx * 0.36, 0.24, sz * 0.11),
  })), m.woodDark));
  g.add(stool);
  return place(shadowify(g), o);
}

/**
 * 蓄音機 -- the horn gramophone on the counter.
 *
 * The horn is a lathe: five profile points, and the reason it is a lathe and
 * not a cone is the flare.  A cone reads as a funnel; a bell has to open
 * faster at the mouth than at the throat or it looks like plumbing.
 */
function makeGramophone(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:gramophone';

  const cab = box(0.44, 0.16, 0.38, m.woodDark, 0, 0.08, 0);
  g.add(cab);
  g.add(box(0.4, 0.2, 0.34, m.wood, 0, 0.26, 0));
  const platter = cyl(0.155, 0.155, 0.022, 16, m.dark, 0, 0.372, 0.03);
  g.add(platter);
  const disc = cyl(0.142, 0.142, 0.012, 16, m.ink, 0, 0.388, 0.03);
  g.add(disc);
  g.add(cyl(0.045, 0.045, 0.014, 12, m.red, 0, 0.396, 0.03));
  // tone arm: from the platter edge out to the horn's throat
  const a = new THREE.Vector3(0.13, 0.4, 0.06);
  const b = new THREE.Vector3(0.19, 0.62, -0.06);
  g.add(rodBetween(a, b, 0.013, m.brass, 6));
  g.add(cyl(0.03, 0.035, 0.1, 8, m.brass, 0.19, 0.6, -0.06));
  // crank on the near side
  g.add(rodBetween(new THREE.Vector3(-0.23, 0.28, 0.08), new THREE.Vector3(-0.29, 0.28, 0.08), 0.012, m.brass, 6));
  g.add(box(0.02, 0.09, 0.02, m.brass, -0.29, 0.24, 0.08));

  const horn = new THREE.Mesh(
    new THREE.LatheGeometry(
      [[0.032, 0], [0.05, 0.1], [0.1, 0.24], [0.17, 0.38], [0.235, 0.48]]
        .map((p) => new THREE.Vector2(p[0], p[1])),
      16, 0, Math.PI * 2,
    ),
    m.brassIn,
  );
  horn.position.set(0.19, 0.62, -0.06);
  horn.rotation.set(-0.55, 0.35, 0.42);
  horn.castShadow = true;
  g.add(horn);
  return place(shadowify(g), o);
}

/**
 * 老式レコード店の一角 -- a shop counter: the radio, three cassettes, two
 * sleeves standing behind them.
 *
 * This is the one prop carrying the shop's name, so the radio does the
 * talking: `SAKURA FM 2000` on the dial, which is the station the page's own
 * header already claims to be tuned to.
 */
function makeShopCounter(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:shopCounter';

  g.add(box(1.24, 0.05, 0.44, m.wood, 0, 0.62, 0));
  g.add(baked([[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => ({
    geometry: new THREE.BoxGeometry(0.06, 0.6, 0.06),
    matrix: trs(sx * 0.56, 0.3, sz * 0.17),
  })), m.woodDark));

  // the radio: one slab, dial on the front, knobs baked into one mesh
  const radio = plateMesh(0.5, 0.28, 0.17, m.woodDark, m.dial);
  radio.position.set(-0.3, 0.785, 0.01);
  g.add(radio);
  hullOutline(radio, { thickness: 0.0024 }).userData.isOutline = true;
  g.add(baked([[0, 0.09], [0, -0.09]].map(([dx, dy]) => ({
    geometry: new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10),
    matrix: trs(-0.3 + dx, 0.785 + dy, 0.1, Math.PI / 2),
  })), m.brass));
  g.add(rodBetween(new THREE.Vector3(-0.3, 0.925, -0.06), new THREE.Vector3(-0.12, 1.22, -0.02), 0.007, m.metal, 4));

  // three cassettes, face out, leaning on each other
  const cassettes = [['范特西', '2001'], ['魔杰座', '2008'], ['叶惠美', '2003']];
  cassettes.forEach(([side, year], i) => {
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.07, 0.017),
      [m.ink, m.ink, m.ink, m.ink,
        flat({ color: 0xffffff, map: tapeLabelTex(side, year), cache: false }), m.ink],
    );
    t.position.set(0.06 + i * 0.055, 0.682, 0.1);
    t.rotation.set(0, 0.12, 0);
    g.add(t);
    g.add(box(0.105, 0.008, 0.014, m.ink, 0.06 + i * 0.055, 0.715, 0.1));
  });

  // two sleeves standing on the counter, backs to the wall
  for (const [dx, col] of [[0.44, PAL.crate], [0.56, PAL.crateAlt]]) {
    const sleeve = box(0.02, 0.33, 0.33, cel({ color: col, bands: 3, tint: 0x6f6790 }), dx, 0.815, -0.04);
    sleeve.rotation.y = 0.05;
    g.add(sleeve);
    g.add(box(0.021, 0.33, 0.09, m.ink, dx, 0.815, -0.11));
  }
  return place(shadowify(g), o);
}

/* ------------------------------------------------------------------ *
 * 3. 晴天广场 -- the washing, the ema rack, the guitar
 * ------------------------------------------------------------------ */

/** A shirt, as a silhouette.  Used three times on the line. */
function shirtGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.075, 0);          // left collar
  s.lineTo(-0.2, -0.05);        // left shoulder
  s.lineTo(-0.33, -0.17);       // left cuff, out and down
  s.lineTo(-0.275, -0.345);     // under the left sleeve
  s.lineTo(-0.2, -0.3);         // armpit
  s.lineTo(-0.19, -0.62);       // left side seam
  s.lineTo(0.19, -0.62);        // hem
  s.lineTo(0.2, -0.3);
  s.lineTo(0.275, -0.345);
  s.lineTo(0.33, -0.17);
  s.lineTo(0.2, -0.05);
  s.lineTo(0.075, 0);
  s.lineTo(0.042, -0.085);      // the collar's V
  s.lineTo(-0.042, -0.085);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 2 });
  geo.translate(0, 0, -0.01);
  return geo;
}

/**
 * 竹竿に干した白いシャツ -- three white shirts on a bamboo pole.
 *
 * `makeLaundryPole` next door is a *metal* frame with a row of coloured
 * towels on it; this is the other thing a Japanese yard has, which is why it
 * is a separate prop rather than a call to that one: two bamboo uprights, a
 * bamboo rail, and the shirts' own silhouette doing the work.
 */
function makeLaundryLine(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:laundryLine';
  const LEN = 2.2;
  for (const s of [-1, 1]) {
    g.add(cyl(0.034, 0.04, 1.92, 7, m.bamboo, (s * LEN) / 2, 0.96, 0));
    g.add(cyl(0.09, 0.11, 0.08, 8, m.stone, (s * LEN) / 2, 0.04, 0));
  }
  const rail = cyl(0.03, 0.03, LEN + 0.24, 7, m.bambooDeep, 0, 1.9, 0);
  rail.rotation.z = Math.PI / 2;
  g.add(rail);

  const shirt = shirtGeometry();
  const hangers = [];
  [-0.66, 0.0, 0.66].forEach((x, i) => {
    const s = new THREE.Mesh(shirt, i === 1 ? m.cloth : m.white);
    s.position.set(x, 1.86, 0);
    s.rotation.y = (i - 1) * 0.09;
    g.add(s);
    // wire hanger: a shoulder bar and a hook, both baked into one mesh
    hangers.push({ geometry: new THREE.BoxGeometry(0.3, 0.012, 0.012), matrix: trs(x, 1.862, 0) });
    hangers.push({
      geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4),
      matrix: trs(x, 1.9, 0),
    });
  });
  g.add(new THREE.Mesh(bake(hangers), m.string));
  return place(shadowify(g), o);
}

/**
 * 絵馬掛け -- a rack of ema, and a wind chime on one end.
 *
 * The four plaques carry four titles.  The chime is a still bell: it hangs,
 * it does not swing, and that is a decision rather than an omission -- see
 * the file header on `noBatch`.
 */
function makeEmaRack(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:emaRack';
  const W = 1.7;
  for (const s of [-1, 1]) {
    g.add(cyl(0.045, 0.052, 1.62, 7, m.woodDark, (s * W) / 2, 0.81, 0));
    g.add(cyl(0.1, 0.12, 0.08, 8, m.stone, (s * W) / 2, 0.04, 0));
  }
  g.add(box(W + 0.14, 0.075, 0.075, m.wood, 0, 1.58, 0));
  g.add(box(W + 0.14, 0.05, 0.05, m.woodDark, 0, 1.4, 0));

  const titles = [['晴天', '2003'], ['七里香', '2004'], ['稻香', '2008'], ['青花瓷', '2007']];
  const cords = [];
  titles.forEach(([title, year], i) => {
    const x = -0.6 + i * 0.4;
    const plaque = plateMesh(0.26, 0.2, 0.016, m.wood,
      flat({ color: 0xffffff, map: songPlateTex(title, year), cache: false }));
    plaque.position.set(x, 1.2, 0);
    plaque.rotation.z = (i - 1.5) * 0.02;
    g.add(plaque);
    cords.push({
      geometry: new THREE.CylinderGeometry(0.005, 0.005, 0.26, 3),
      matrix: trs(x, 1.43, 0),
    });
  });
  g.add(new THREE.Mesh(bake(cords), m.string));

  // the chime, hung off the west end: bell, clapper, and the paper strip
  const cx = W / 2 + 0.12;
  g.add(box(0.22, 0.035, 0.05, m.wood, cx - 0.11, 1.6, 0));
  g.add(cyl(0.006, 0.006, 0.09, 4, m.string, cx - 0.11, 1.55, 0));
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.13, 12), m.brassIn);
  bell.position.set(cx - 0.11, 1.46, 0);
  g.add(bell);
  g.add(cyl(0.016, 0.016, 0.12, 6, m.metal, cx - 0.11, 1.39, 0));
  const strip = box(0.07, 0.16, 0.008,
    cel({ color: 0xf6f2e8, bands: 2, side: THREE.DoubleSide, tint: 0x8f8ab0 }), cx - 0.11, 1.24, 0);
  strip.rotation.set(0.12, 0.3, 0);
  g.add(strip);
  return place(shadowify(g), o);
}

/** An acoustic guitar, as a body silhouette plus a neck. */
function guitarBodyGeometry() {
  const s = new THREE.Shape();
  // half the outline, mirrored through the centre line, drawn from the heel
  const right = [
    [0.115, 0.0], [0.165, -0.055], [0.185, -0.125], [0.175, -0.2],
    [0.128, -0.255], [0.135, -0.3], [0.172, -0.365], [0.17, -0.44],
    [0.12, -0.49], [0.0, -0.5],
  ];
  s.moveTo(-0.115, 0);
  for (const [x, y] of right) s.lineTo(x, y);
  for (let i = right.length - 2; i >= 0; i--) s.lineTo(-right[i][0], right[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.105, bevelEnabled: false, curveSegments: 2 });
  geo.translate(0, 0.5, -0.0525);   // body from y 0 at the waist to 0.5 at the heel
  return geo;
}

/**
 * 木吉他 -- leaned against the bench, soundboard to the plaza.
 *
 * The body is one extruded figure-eight, which is the whole reason it reads:
 * at four metres an acoustic guitar is a silhouette with a waist in it, and
 * a box with a circle on it is not.
 */
function makeGuitar(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:guitar';
  /* An inner group carries the lean, because `place()` owns the outer yaw and
   * the two rotations are on different axes -- the same split, and the same
   * reason, as the bicycle's `inner` in `props.js`. */
  const inner = new THREE.Group();
  inner.rotation.x = -0.2;
  inner.position.y = 0.02;
  g.add(inner);

  const body = new THREE.Mesh(guitarBodyGeometry(), m.wood);
  inner.add(body);
  hullOutline(body, { thickness: 0.003 }).userData.isOutline = true;
  const hole = cyl(0.052, 0.052, 0.012, 14, m.ink, 0, 0.30, 0.056);
  hole.rotation.x = Math.PI / 2;
  inner.add(hole);
  inner.add(box(0.16, 0.022, 0.028, m.woodDark, 0, 0.115, 0.06));      // bridge
  inner.add(box(0.048, 0.42, 0.022, m.woodDark, 0, 0.7, 0.02));        // neck
  inner.add(box(0.05, 0.44, 0.012, m.ink, 0, 0.7, 0.042));             // fretboard
  const head = box(0.062, 0.17, 0.03, m.woodDark, 0, 1.0, 0.026);
  head.rotation.x = -0.16;
  inner.add(head);
  inner.add(baked([0, 1, 2].flatMap((i) => [-1, 1].map((s) => ({
    geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6),
    matrix: trs(s * 0.045, 0.95 + i * 0.05, 0.026, 0, 0, Math.PI / 2),
  }))), m.brass));
  // six strings, one mesh
  const strings = [];
  for (let i = 0; i < 6; i++) {
    const dx = -0.024 + i * 0.0096;
    strings.push({
      geometry: new THREE.CylinderGeometry(0.0016, 0.0016, 0.77, 3),
      matrix: trs(dx, 0.44, 0.062),
    });
  }
  inner.add(new THREE.Mesh(bake(strings), flat({ color: 0xb9b4c0 })));
  return place(shadowify(g), o);
}

/* ------------------------------------------------------------------ *
 * 4. 花海车站 -- the clock, the bento
 * ------------------------------------------------------------------ */

/**
 * 駅の掛時計 -- the platform clock, on its own post, stopped at 5:20.
 *
 * The face is a `CircleGeometry` disc, not the cylinder's top cap.  The cap
 * version was one mesh fewer and it came out **a quarter turn round**: a
 * `CylinderGeometry` cap maps the texture from its own local x/z, so tilting
 * the cylinder to face +z leaves the numeral 12 on the right-hand side.  A
 * circle's uvs run +u = +x and +v = +y, which is the same frame the canvas is
 * drawn in, so the face is upright by construction.
 */
function makeStationClock(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:clock';
  const H = o.h ?? 2.45;
  g.add(cyl(0.05, 0.058, H, 8, m.dark, 0, H / 2, 0));
  g.add(cyl(0.12, 0.14, 0.1, 8, m.stone, 0, 0.05, 0));
  g.add(box(0.05, 0.05, 0.46, m.dark, 0, H - 0.02, 0.2));
  const CY = H - 0.28;
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 20), m.lacquer);
  caseMesh.position.set(0, CY, 0.34);
  caseMesh.rotation.x = Math.PI / 2;
  g.add(caseMesh);
  hullOutline(caseMesh, { thickness: 0.0026 }).userData.isOutline = true;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.245, 24),
    flat({ color: 0xffffff, map: clockFaceTex(o.station ?? '花海駅'), cache: false }),
  );
  face.position.set(0, CY, 0.387);
  face.userData.noOutline = true;
  g.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.02, 6, 20), m.lacquer);
  bezel.position.set(0, CY, 0.34);
  g.add(bezel);
  // a small plate under the clock, the station's name again from below
  const plate = plateMesh(0.44, 0.16, 0.03, m.dark,
    flat({ color: 0xffffff, map: songPlateTex(o.station ?? '花海駅', o.year ?? '2008'), cache: false }));
  plate.position.set(0, H - 0.68, 0.26);
  plate.rotation.x = -0.2;
  g.add(plate);
  hullOutline(plate, { thickness: 0.0022 }).userData.isOutline = true;
  return place(shadowify(g), o);
}

/**
 * 駅弁とタピオカ -- the blue ekiben and the bubble tea, on the platform
 * bench.
 *
 * Two small still-lifes on one bench, because that is what a platform bench
 * has on it and because both of them are 花海's own props: the box is
 * printed with the station the departure board sends trains to, and the cup
 * is the drink waiting under the canopy.
 */
function makePlatformBench(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:platformBench';
  const bench = makeBench({ x: 0, z: 0, y: 0, len: 1.6, wood: 0xc0a582 });
  g.add(bench);

  // the bento: blue box, printed lid, a band round it, chopsticks alongside
  g.add(box(0.24, 0.06, 0.16, m.blue, -0.34, 0.5, 0.02));
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.245, 0.022, 0.165),
    [m.blue, m.blue, flat({ color: 0xffffff, map: bentoLabelTex(), cache: false }), m.blue, m.blue, m.blue],
  );
  lid.position.set(-0.34, 0.542, 0.02);
  g.add(lid);
  g.add(baked([
    { geometry: new THREE.BoxGeometry(0.25, 0.008, 0.018), matrix: trs(-0.34, 0.553, 0.02) },
    { geometry: new THREE.BoxGeometry(0.018, 0.008, 0.167), matrix: trs(-0.34, 0.553, 0.02) },
  ], m.cloth));
  g.add(baked([0, 1].map((i) => ({
    geometry: new THREE.BoxGeometry(0.006, 0.006, 0.22),
    matrix: trs(-0.2 + i * 0.014, 0.474, 0.1, 0, 0.06, 0),
  })), m.woodDark));

  // the bubble tea: tapered cup, dome lid, straw, and the pearls at the foot
  const T = [0.12, 0.02];
  g.add(cyl(0.046, 0.036, 0.135, 12, cel({ color: 0xf0e4d0, bands: 3, tint: 0x8f8ab0 }), T[0], 0.535, T[1]));
  g.add(cyl(0.042, 0.042, 0.03, 12, m.pearl, T[0], 0.49, T[1]));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.047, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    cel({ color: 0xf2ede0, bands: 3, tint: 0x8f8ab0 }));
  dome.position.set(T[0], 0.6, T[1]);
  dome.scale.y = 0.62;
  g.add(dome);
  const straw = cyl(0.008, 0.008, 0.2, 6, m.red, T[0] + 0.008, 0.66, T[1] - 0.006);
  straw.rotation.z = 0.14;
  g.add(straw);
  return place(shadowify(g), o);
}

/* ------------------------------------------------------------------ *
 * 5. 七里香河堤 -- the plot sign, the rod, the tea things
 * ------------------------------------------------------------------ */

/** A 七里香 hedge: three low clumps, the plant the canal is named after. */
function makeHedgeRow(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:hedge';
  [[-0.62, 0.34, 0.46], [0.0, 0.4, 0.52], [0.62, 0.32, 0.44]].forEach(([x, y, r], i) => {
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), i === 1 ? m.leaf : m.bambooDeep);
    clump.position.set(x, y, 0);
    clump.scale.set(1, 0.78, 0.9);
    clump.rotation.y = i * 0.7;
    g.add(clump);
  });
  return g;
}

/** The plot's board, with the hedge it is standing in. */
function makePlotSign(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:plotSign';
  const H = 1.5;
  for (const s of [-1, 1]) g.add(box(0.07, H, 0.07, m.woodDark, s * 0.3, H / 2, 0));
  const panel = plateMesh(0.86, 0.5, 0.05, m.wood,
    flat({ color: 0xffffff, map: songPlateTex('七里香', '2004', '河堤 ・ 七里香'), cache: false }));
  panel.position.set(0, 1.12, 0.04);
  g.add(panel);
  hullOutline(panel, { thickness: 0.0026 }).userData.isOutline = true;
  const hood = box(0.98, 0.04, 0.24, m.wood, 0, 1.4, 0.07);
  hood.rotation.x = -0.15;
  g.add(hood);
  // the bushes stand beside the board, not through its posts
  const hedge = makeHedgeRow({});
  hedge.position.set(0.62, 0, 0.12);
  g.add(hedge);
  return place(shadowify(g), o);
}

/**
 * 釣り竿とバケツ -- the rod and the bucket on the revetment.
 *
 * Three tapered sections rather than one cylinder, because a fishing rod is
 * a taper and reads as one from thirty metres.  The line runs from the tip
 * to the float, which is the only thing here that has to be in the right
 * place: a float that is not under its own line is visible from the far bank.
 */
function makeFishingGear(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:fishing';
  const butt = new THREE.Vector3(0, 0.04, 0.14);
  const tip = new THREE.Vector3(0.06, 1.62, -0.62);
  const dir = new THREE.Vector3().subVectors(tip, butt);
  const segs = [[0.012, 0.5], [0.0086, 0.55], [0.005, 0.55]];
  let t = 0;
  for (const [r, len] of segs) {
    const a = butt.clone().addScaledVector(dir, t);
    t += len / dir.length();
    g.add(rodBetween(a, butt.clone().addScaledVector(dir, t), r, m.ink, 5));
  }
  g.add(box(0.09, 0.1, 0.05, m.dark, 0.005, 0.1, 0.1));                  // reel seat
  const reel = cyl(0.042, 0.042, 0.03, 12, m.metal, 0.0, 0.15, 0.06);
  reel.rotation.set(Math.PI / 2, 0, 0);
  g.add(reel);
  g.add(cyl(0.012, 0.012, 0.05, 6, m.dark, 0.05, 0.13, 0.06));
  // the float, and the line down to it
  g.add(rodBetween(tip, new THREE.Vector3(0.05, 0.12, -0.95), 0.0022, m.string, 3));
  g.add(cyl(0.011, 0.011, 0.1, 6, m.red, 0.05, 0.075, -0.95));
  g.add(cyl(0.006, 0.006, 0.04, 6, m.white, 0.05, 0.145, -0.95));
  // the bucket, a rim, and a handle that is actually a handle
  g.add(cyl(0.17, 0.14, 0.26, 14, cel({ color: PAL.blue, bands: 3, tint: 0x5c5680 }), 0.5, 0.13, 0.02));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 5, 14), m.metal);
  rim.position.set(0.5, 0.26, 0.02);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 4, 12, Math.PI), m.metal);
  handle.position.set(0.5, 0.26, 0.02);
  handle.rotation.set(0, -0.4, 0);
  g.add(handle);
  g.add(cyl(0.02, 0.02, 0.06, 6, m.white, 0.42, 0.28, -0.03));           // a second float on the rim
  return place(shadowify(g), o);
}

/**
 * 青花の茶器 -- the tea set on its slab.
 *
 * The porcelain is white and the banding is a drawn scroll in cobalt.  It is
 * deliberately *not* a copy of anything: `SOURCES.md` rules out third-party
 * artwork, so the ornament is six arcs and three dots repeated, which is
 * what a blue-and-white band looks like at two metres anyway.
 */
function makeTeaSet(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.name = 'jay:teaSet';
  g.add(box(0.72, 0.07, 0.5, m.stone, 0, 0.3, 0));
  g.add(box(0.3, 0.28, 0.28, m.stone, 0, 0.15, 0));
  g.add(box(0.72, 0.03, 0.5, cel({ color: PAL.stoneDark, bands: 3, tint: 0x6f6790 }), 0, 0.035, 0));

  // the pot: a squashed sphere, a banded shoulder, spout, handle, lid
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), m.porcelain);
  pot.position.set(0, 0.42, 0);
  pot.scale.set(1, 0.85, 1);
  g.add(pot);
  const band = cyl(0.116, 0.116, 0.052, 16, m.teaBand, 0, 0.435, 0);
  band.userData.noOutline = true;
  g.add(band);
  const spout = rodBetween(new THREE.Vector3(0.02, 0.44, 0.06), new THREE.Vector3(0.14, 0.53, 0.06), 0.019, m.porcelain, 7);
  g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 5, 12, Math.PI * 1.2), m.porcelain);
  handle.position.set(-0.1, 0.43, 0);
  handle.rotation.set(0, Math.PI / 2, 0.5);
  g.add(handle);
  g.add(cyl(0.05, 0.062, 0.022, 12, m.porcelain, 0, 0.53, 0));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), m.porcelain);
  knob.position.set(0, 0.55, 0);
  g.add(knob);

  // two cups, banded like the pot
  for (const dx of [-0.2, 0.22]) {
    g.add(cyl(0.041, 0.033, 0.048, 12, m.porcelain, dx, 0.36, 0.12));
    const band = cyl(0.0415, 0.0415, 0.014, 12, m.teaBand, dx, 0.375, 0.12);
    band.userData.noOutline = true;
    g.add(band);
    g.add(cyl(0.032, 0.032, 0.004, 12, cel({ color: 0x8a7f52, bands: 2, tint: 0x6f6790 }), dx, 0.376, 0.12));
  }
  return place(shadowify(g), o);
}

/* ------------------------------------------------------------------ *
 * Placement.
 *
 * Every prop sits on `ctx.groundAt`, not on `groundY`: by the time this runs
 * the footways, the platform and the canal's bank cut are all registered, and
 * a prop seated from the raw grade is buried or floating by exactly the
 * thickness of whatever surface is under it -- which is the bug the bicycles
 * outside two of the houses were reported for.
 *
 * Coordinates are in the same flat authoring space as `scene.ts`'s `STOPS`,
 * and each one is checked against the two things that are already standing
 * there: `jaytheme.js`'s props, and `jaymedia.js`'s frames (the Lead's, kept
 * 1.5 m clear).
 * ------------------------------------------------------------------ */

export function buildJayProps(ctx) {
  const g = (x, z) => ctx.groundAt(x, z);

  /* ---- 樱花街口 (stop 0) ---- */
  {
    /* Both stand on the *west* footway, which is the only kerb at this stop
     * that is both sunlit and inside the spawn's view cone: the east side is a
     * shop frontage under a deep awning, and a white balloon bunch in that
     * shade is a grey balloon bunch.  `dev-jay/stop-0-a.png` is the canvas that
     * settled it -- the first pass put the balloons and the bicycle at
     * x 4.15/4.30 and neither one is legible in it.
     *
     * The west kerb itself is only free in two places.  The ground scan (a
     * vertical ray from 9 m and a second one at chest height, on a 0.75 m grid)
     * gives x = -4.1 as: z 4.6 clear, **z 5.35-7.6 a building**, z 8.35-13.6
     * clear but holding the two bicycles `index.js` already parks at z 8.4 and
     * 12.2, then a building again from 14.35.  So the notice board takes
     * z 10.5, between those two bicycles, and the balloons take the corner at
     * z 4.5 -- which is the second of the two clear cells. */
    ctx.add(makeTourBoard({ x: -4.2, z: 10.5, y: g(-4.2, 10.5), ry: 1.02 }));
    ctx.collide(-4.75, 10.05, -3.65, 10.95, g(-4.2, 10.5) + 1.6);
    /* The balloons go on the *east* kerb, at the one column the ground scan
     * calls completely empty: x = 4.1, z = 7.6 reads as `.` -- nothing above it
     * at all, no awning, no wall at chest height -- where the rest of that
     * frontage is shop under a deep eave.  It is also the closest clear ground
     * to the spawn that is inside the opening frame.
     *
     * The west kerb was tried first and does not work: the two clear cells on
     * it are z 4.6, which a small outbuilding at x ~ -3.5 stands directly in
     * front of, and z 8.35-13.6, which `index.js` already parks two bicycles
     * and this file's notice board in. */
    ctx.add(makeBalloonBunch({ x: 4.2, z: 7.6, y: g(4.2, 7.6), ry: -0.3 }));
    ctx.collide(3.9, 7.2, 4.5, 8.0, g(4.2, 7.6) + 0.6);
  }

  /* ---- 唱片小巷 (stop 1) ---- */
  {
    // The corridor is clear from x 20.0 to 24.5; props go to its two edges and
    // the middle stays walkable.
    ctx.add(makeUprightPiano({ x: 24.05, z: 21.8, y: g(24.05, 21.8), ry: -Math.PI / 2 }));
    ctx.collide(23.35, 20.95, 24.45, 22.65, g(24.05, 21.8) + 1.2);
    ctx.add(makeGramophone({ x: 20.45, z: 23.6, y: g(20.45, 23.6), ry: 0.62 }));
    ctx.collide(20.1, 23.25, 20.8, 23.95, g(20.45, 23.6) + 0.9);
    ctx.add(makeShopCounter({ x: 20.45, z: 20.9, y: g(20.45, 20.9), ry: 0.2 }));
    ctx.collide(20.0, 20.45, 20.9, 21.35, g(20.45, 20.9) + 1.0);
  }

  /* ---- 晴天广场 (stop 2) ---- */
  {
    ctx.add(makeLaundryLine({ x: -30.6, z: 26.6, y: g(-30.6, 26.6), ry: 0.32 }));
    ctx.collide(-30.75, 25.55, -30.45, 26.6, g(-30.6, 26.6) + 1.95);
    ctx.collide(-30.75, 27.65, -30.45, 28.0, g(-30.6, 26.6) + 1.95);
    ctx.add(makeEmaRack({ x: -26.0, z: 26.0, y: g(-26.0, 26.0), ry: -0.22 }));
    ctx.collide(-26.25, 25.6, -25.75, 26.4, g(-26.0, 26.0) + 1.6);
    // The bench first, then the guitar against it -- one seat, two props.
    const gy = g(-30.2, 27.4);
    ctx.add(makeBench({ x: -30.2, z: 27.4, y: gy, ry: -0.35 }));
    ctx.collide(-31.0, 27.1, -29.4, 27.7, gy + 0.72);
    ctx.add(makeGuitar({ x: -29.75, z: 27.05, y: g(-29.75, 27.05), ry: -0.9 }));
    ctx.collide(-30.05, 26.7, -29.45, 27.4, gy + 1.05);
  }

  /* ---- 花海车站 (stop 3) ---- */
  {
    // East platform, out along -x from the stop, clear of the canopy edge at
    // z ~ -1.3 and of the departure board at z -5.1.
    ctx.add(makeStationClock({
      x: 19.4, z: -3.0, y: g(19.4, -3.0),
      /* The face has to point back up the platform, which is +x: an unstaffed
       * platform is walked from the footbridge end, and the first pass had it
       * at -x, so `stop-3-a.png` is a black disc with a clock behind it. */
      ry: Math.PI / 2 + 0.3, station: '花海駅', year: '2008',
    }));
    ctx.collide(19.1, -3.3, 19.7, -2.7, g(19.4, -3.0) + 2.5);
    ctx.add(makePlatformBench({ x: 18.4, z: -5.0, y: g(18.4, -5.0), ry: Math.PI / 2 }));
    ctx.collide(18.1, -5.85, 18.7, -4.15, g(18.4, -5.0) + 0.72);
  }

  /* ---- 七里香河堤 (stop 4) ---- */
  {
    ctx.add(makePlotSign({ x: 3.0, z: -32.4, y: g(3.0, -32.4), ry: 0.18 }));
    ctx.collide(2.4, -32.7, 3.6, -32.1, g(3.0, -32.4) + 1.4);
    ctx.add(makeFishingGear({ x: 4.9, z: -33.6, y: g(4.9, -33.6), ry: -0.45 }));
    ctx.collide(4.5, -33.9, 5.3, -33.3, g(4.9, -33.6) + 0.5);
    ctx.add(makeTeaSet({ x: 6.1, z: -35.4, y: g(6.1, -35.4), ry: 0.85 }));
    ctx.collide(5.7, -35.8, 6.5, -35.0, g(6.1, -35.4) + 0.5);
    /* The student's bicycle, which the first pass had at 樱花街口.  The west
     * kerb there has no room for it -- see the note in that block -- and this
     * is where the brief wanted a bicycle all along: 河堤上的自転車, propped on
     * the service path with the river behind it and the rod in front. */
    ctx.add(makeStudentBike({ x: 2.2, z: -34.6, y: g(2.2, -34.6), ry: 0.42 }));
    ctx.collide(1.75, -35.45, 2.65, -33.75, g(2.2, -34.6) + 1.05);
  }
}
