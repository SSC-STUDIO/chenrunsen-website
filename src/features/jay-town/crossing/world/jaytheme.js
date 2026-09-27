import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { box, cyl } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { shopBlade } from '../core/textures.js';
import { makeNoticeBoard, makeCrates, makeSignPost } from './props.js';
import { groundY } from './street.js';

/* ------------------------------------------------------------------ *
 * Jay Chou neighbourhood props — runtime Canvas2D labels only.
 * Song TITLES on a notice board; no lyrics, no downloaded media.
 * ------------------------------------------------------------------ */

const JP = `'Yu Gothic', 'Yu Gothic UI', 'Meiryo', 'MS Gothic', 'Hiragino Kaku Gothic ProN', sans-serif`;

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  draw(c, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function songPosterTex() {
  return canvasTex(384, 512, (c, w, h) => {
    c.fillStyle = '#f4efe4';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2f6f68';
    c.fillRect(0, 0, w, 64);
    c.fillStyle = '#fff8ed';
    c.font = `bold 34px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('町内掲示', w / 2, 34);

    c.fillStyle = '#5a4038';
    c.font = `600 26px ${JP}`;
    c.fillText('今週の曲名', w / 2, 96);

    const titles = ['七里香', '晴天', '稻香', '青花瓷', '简单爱'];
    titles.forEach((t, i) => {
      const y = 150 + i * 62;
      c.fillStyle = i % 2 ? '#ebe4d6' : '#f7f2e8';
      c.fillRect(28, y - 26, w - 56, 52);
      c.fillStyle = '#3a3348';
      c.font = `bold 36px ${JP}`;
      c.fillText(t, w / 2, y);
    });

    c.fillStyle = '#9a8f82';
    c.font = `600 20px ${JP}`;
    c.fillText('※ 曲名のみ ・ 歌詞なし', w / 2, h - 28);
  });
}

function emaQingTianTex() {
  return canvasTex(256, 192, (c, w, h) => {
    c.fillStyle = '#e9d9b6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#b5322f';
    c.fillRect(0, 0, w, 12);
    c.fillStyle = '#4a4034';
    c.font = `bold 58px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('晴天', w / 2, h * 0.48);
    c.fillStyle = '#8a7350';
    c.fillRect(40, h * 0.74, w - 80, 3);
  });
}

function departureBoardTex() {
  return canvasTex(512, 384, (c, w, h) => {
    c.fillStyle = '#1e2434';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2f6f68';
    c.fillRect(0, 0, w, 56);
    c.fillStyle = '#f4f0e6';
    c.font = `bold 30px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('樱町站 ・ 発車案内', w / 2, 28);

    const rows = [
      ['普通', 'さくら台', '13:42', '1'],
      ['普通', 'ひばり山', '14:05', '1'],
      ['普通', '花海', '14:28', '2'],
      ['回送', '車庫', '14:50', '-'],
    ];
    rows.forEach((r, i) => {
      const y = 92 + i * 64;
      c.fillStyle = i % 2 ? '#262c3e' : '#222836';
      c.fillRect(12, y - 28, w - 24, 56);
      c.fillStyle = '#9ad0c4';
      c.font = `bold 24px ${JP}`;
      c.textAlign = 'left';
      c.fillText(r[0], 28, y);
      c.fillStyle = '#f0ebe0';
      c.font = `bold 28px ${JP}`;
      c.fillText(r[1], 120, y);
      c.fillStyle = '#f2d080';
      c.font = `bold 30px sans-serif`;
      c.textAlign = 'right';
      c.fillText(r[2], w - 90, y);
      c.fillStyle = '#a8b0c4';
      c.font = `600 22px ${JP}`;
      c.fillText(r[3], w - 28, y);
    });
  });
}

function canalUseTex() {
  return canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#e8e4d6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#3a5346';
    c.fillRect(0, 0, w, 14);
    c.fillRect(0, h - 14, w, 14);
    c.fillRect(0, 0, 14, h);
    c.fillRect(w - 14, 0, 14, h);
    c.fillStyle = '#2b3340';
    c.font = `bold 52px ${JP}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('七里香用水', w / 2, h * 0.42);
    c.fillStyle = '#5a5346';
    c.font = `600 28px ${JP}`;
    c.fillText('かんがい用水 ・ 遊泳禁止', w / 2, h * 0.72);
  });
}

function mats() {
  return {
    wood: cel({ color: 0x8a6f52, bands: 3, tint: 0x5c5680 }),
    woodDark: cel({ color: 0x6a5240, bands: 3, tint: 0x554e74 }),
    vinyl: cel({ color: 0x2a2834, bands: 2, tint: 0x413c58 }),
    label: cel({ color: 0xc45a6a, bands: 2, tint: 0x6f6790 }),
    metal: cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 }),
  };
}

/** Open crate with a few record sleeves standing in it. */
function makeRecordCrate(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const W = 0.58, D = 0.4, H = 0.32;
  g.add(box(W, 0.04, D, m.woodDark, 0, 0.02, 0));
  for (const s of [-1, 1]) {
    g.add(box(W, H, 0.03, m.wood, 0, H / 2, (s * D) / 2));
    g.add(box(0.03, H, D, m.wood, (s * W) / 2, H / 2, 0));
  }
  const colors = [0xc45a6a, 0x3f7fbf, 0xe25a4a, 0x4f9d6a, 0xd8b05a];
  for (let i = 0; i < 5; i++) {
    const sleeve = box(0.02, 0.28, 0.28,
      cel({ color: colors[i], bands: 2, tint: 0x6f6790 }),
      -0.18 + i * 0.09, 0.2, 0);
    sleeve.rotation.y = (i - 2) * 0.04;
    sleeve.castShadow = true;
    g.add(sleeve);
  }
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Vinyl disc on a small stand. */
function makeVinylDisc(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  g.add(box(0.08, 0.55, 0.08, m.woodDark, 0, 0.28, 0));
  g.add(box(0.22, 0.04, 0.14, m.wood, 0, 0.56, 0));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), m.vinyl);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0.62, 0.02);
  disc.castShadow = true;
  g.add(disc);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.022, 16), m.label);
  label.rotation.x = Math.PI / 2;
  label.position.set(0, 0.62, 0.02);
  g.add(label);
  // spindle hole
  g.add(cyl(0.012, 0.012, 0.03, 8, flat({ color: 0x1a1820 }), 0, 0.62, 0.02));
  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Projecting 晴天唱片 blade for the shopping street. */
function makeQingtianHang(o = {}) {
  const m = mats();
  const g = new THREE.Group();
  const art = shopBlade('record');
  const face = flat({ color: 0xfff2d8, map: art, cache: false });
  const side = flat({ color: 0x3a3744 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.05, 0.42),
    [side, side, side, side, face, face],
  );
  board.castShadow = true;
  g.add(board);
  hullOutline(board, { thickness: 0.003 });
  g.add(box(0.28, 0.06, 0.06, m.metal, -0.22, 0.36, 0));
  g.add(box(0.28, 0.06, 0.06, m.metal, -0.22, -0.36, 0));
  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

function makeEmaPlaque(o = {}) {
  const g = new THREE.Group();
  const wood = cel({ color: PAL.ema, bands: 2, tint: 0x8a7f9c });
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.32, 0.04),
    [wood, wood, wood, wood,
      flat({ color: 0xffffff, map: emaQingTianTex(), cache: false }), wood],
  );
  plaque.castShadow = true;
  g.add(plaque);
  g.add(cyl(0.012, 0.012, 0.5, 6, cel({ color: 0x6a5240, bands: 2 }), 0, 0.4, 0));
  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/**
 * Place Jay-themed props at the five stops.  Authored in flat space so the
 * planet bake seats them with the rest of the town.
 */
export function buildJayTheme(ctx) {
  const yStreet = (z) => groundY(z);

  /* ---- 唱片小巷 (stop ~22, 28.5): crates, vinyl, hanging sign, song board ---- */
  {
    const y = yStreet(28.6) + 0.12;
    // East footway of the shopping street, in the stop's view cone.
    ctx.add(makeRecordCrate({ x: 21.15, z: 27.35, y, ry: -0.15 }));
    ctx.add(makeRecordCrate({ x: 21.15, z: 27.9, y, ry: 0.2 }));
    ctx.add(makeVinylDisc({ x: 21.45, z: 28.55, y, ry: 0.55 }));
    ctx.add(makeCrates({ x: 21.05, z: 29.15, y, n: 3, seed: 7701, ry: 0.25 }));
    ctx.add(makeQingtianHang({ x: 21.55, z: 26.85, y: y + 2.15, ry: Math.PI / 2 }));
    ctx.add(makeNoticeBoard({
      x: 23.35, z: 28.2, y, ry: -Math.PI / 2, w: 1.4, h: 1.6, y0: 0.5,
      sheets: [
        { map: songPosterTex(), x: 0, y: 0.02, w: 0.78, h: 1.05, tilt: 0.01 },
      ],
    }));
    ctx.collide(20.85, 27.1, 21.7, 29.4, y + 1.25);
    ctx.collide(23.0, 27.85, 23.7, 28.55, y + 2.2);
  }

  /* ---- 晴天广场: shrine ema mentioning 晴天 ---- */
  {
    const y = yStreet(31.5);
    ctx.add(makeEmaPlaque({ x: -24.8, z: 30.6, y: y + 1.15, ry: Math.PI / 2 }));
    ctx.add(makeEmaPlaque({ x: -24.8, z: 31.1, y: y + 1.05, ry: Math.PI / 2 + 0.08 }));
  }

  /* ---- 花海车站: departure board under the canopy area ---- */
  {
    const H = 0.98;
    const zb = -5.62;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.0, 0.08),
      [
        cel({ color: 0x2a3040, bands: 2 }),
        cel({ color: 0x2a3040, bands: 2 }),
        cel({ color: 0x2a3040, bands: 2 }),
        cel({ color: 0x2a3040, bands: 2 }),
        flat({ color: 0xffffff, map: departureBoardTex(), cache: false }),
        cel({ color: 0x2a3040, bands: 2 }),
      ],
    );
    board.position.set(24.6, H + 1.55, zb + 0.55);
    board.castShadow = true;
    ctx.add(board);
    hullOutline(board, { thickness: 0.003 });
    ctx.add(box(0.08, 1.7, 0.08, cel({ color: PAL.metalDark, bands: 3 }), 24.0, H + 0.85, zb + 0.55));
    ctx.add(box(0.08, 1.7, 0.08, cel({ color: PAL.metalDark, bands: 3 }), 25.2, H + 0.85, zb + 0.55));
  }

  /* ---- 七里香河堤: canal-side 七里香用水 sign ---- */
  {
    const z = -28.6;
    const y = yStreet(z);
    ctx.add(makeSignPost({
      x: 5.6, z, y, ry: -0.2, h: 2.05,
      plates: [{ map: canalUseTex(), w: 0.9, h: 0.45, y: 1.55, double: true }],
    }));
  }

  /* ---- 樱花街口: small vinyl leaning by the crossing fence ---- */
  {
    const y = yStreet(12.8) + 0.05;
    ctx.add(makeVinylDisc({ x: -3.4, z: 12.2, y, ry: 0.9 }));
  }
}
