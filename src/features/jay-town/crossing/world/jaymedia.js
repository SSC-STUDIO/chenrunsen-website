import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { box, cyl, shadowify } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { MEDIA, mediaUrl, thumbUrl, ZONE_LABELS } from '../../media.js';

/* ------------------------------------------------------------------ *
 * 素材装置：把 `public/jay-town/media/` 里的每一件东西挂进小镇。
 *
 * 用户的诉求很直接 —— 「里面的所有素材必须要放到场景里面去，每一个素材都要」。
 * 所以这一层的职责不是「装饰」，而是**把 media.ts 那张表铺满**：表里有几条，
 * 场景里就该有几块，`scripts/verify-jay-town-media.mjs` 数的就是这个。
 *
 * ## 两类东西，两套做法
 *
 *  - **照片/唱片封面**（`kind: 'poster'`）：一块画框 + 一张贴图。
 *    平面在 authoring 空间里是平的，交给 `bakeToPlanet` 连框带画一起弯到球面上，
 *    然后被 `batchStatic` 并进共享 buffer —— 十一块牌子几乎不花 draw call。
 *
 *  - **视频**（`kind: 'video'`）：画框照样批处理，但画面必须是一块**自己的**
 *    `VideoTexture` 平面，所以那块挂在一个 `planetRigid` 的组下面：
 *    bake 会把这个组原样吸附到球面、几何留在局部空间，贴图才是正的。
 *    这类组同时要 `noBatch`，理由和栖鸟一样（batchStatic 会把会动的组清空）。
 *
 * ## 为什么视频不是 DOM 叠层
 *
 * `screens/media-portal.ts` 那条路（`<video>` 浮在 canvas 上做投影）是给
 * 「别人家的播放器」用的：它有播放器 UI、要点一下才醒、一次只能活一个。
 * 这四段是用户自己拍的素材，要的是**墙上一直在放**，所以用 `VideoTexture`
 * 真贴在几何上 —— 没有叠层、没有遮挡计算、走过去就能看。
 * 代价是同时解码四个视频，所以按距离开关：近了才播。
 * ------------------------------------------------------------------ */

/** 贴图缓存：同一张图只 decode 一次。 */
const texCache = new Map();

function loadTexture(file, { srgb = true } = {}) {
  const key = file + (srgb ? '|srgb' : '');
  if (texCache.has(key)) return texCache.get(key);
  const tex = new THREE.TextureLoader().load(mediaUrl(file));
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  /* 墙面大多是斜着看的，mipmap 掉了会闪；贴图放大时也要线性。 */
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  texCache.set(key, tex);
  return tex;
}

/* 视频按距离播放：近了才播，省解码。 */
const PLAY_NEAR = 16;
const PLAY_FAR = 30;

const VIDEOS = [];

/** 玩家在哪。`world.setPlayer` 每帧灌一次；没有就当作在远处（不播）。 */
let playerX = Infinity;
let playerZ = Infinity;

export function setMediaPlayerPosition(x, z) {
  playerX = x;
  playerZ = z;
}

function makeVideoPlane(spec, w, h) {
  const video = document.createElement('video');
  video.src = mediaUrl(spec.file);
  /* **不要设 `crossOrigin`。**
   *
   * 素材是同源的，同源取像素本来就不受 CORS 限制；一旦给视频挂上
   * `crossOrigin='anonymous'`，浏览器就改用 CORS 模式去取它，而这个静态
   * 服务器（以及大多数静态托管）不给 `Access-Control-Allow-Origin`，
   * 于是 `texImage2D` 直接抛 SecurityError —— 屏幕永远是黑的，控制台里
   * 一句「The video element contains cross-origin data, and may not be loaded」。
   * 这是第一版把它们拍成黑板的真正原因。 */
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  /* `auto` 而不是 `metadata`：这台屏幕是要一直放的，元数据那一档在
   * 「走到跟前才播」的时序里太慢 —— 验收里出现过 readyState 还是 0、
   * 播放被静默拒绝的情况。四段里最大的 36 MB，但按距离开关，只会在
   * 观众真的站到跟前时拉流。 */
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  /* 静音 + playsInline 的自动播放是允许的；被拒绝也只是停在第一帧，
   * 不影响画面（贴图仍在，只是不动）。
   *
   * 每个可能「已经可以播了」的事件都挂一遍：浏览器缓存命中时
   * `canplay` 可能在监听器挂上之前就烧掉了，只挂 once 的那版会漏掉，
   * 屏幕就永远停在第一帧 —— 这正是验收里 school-life 那块的表现。 */
  const tryPlay = () => {
    if (video.readyState < 2 || !video.paused) return;
    video.play().catch(() => { /* 等下一次用户手势 */ });
  };
  for (const ev of ['loadeddata', 'canplay', 'canplaythrough']) {
    video.addEventListener(ev, tryPlay);
  }
  video.load();

  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  /* `flat()` 而不是 `cel()`：屏幕是自发光的，让阳光在它上面打出色阶反而假。 */
  const mat = flat({ color: 0xffffff, map: tex, cache: false, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  /* 平面自己的描边壳会 z-fight，也不该有 —— 和屏幕窗帘同一个处理。 */
  mesh.userData.noOutline = true;
  mesh.userData.noBatch = true;
  mesh.renderOrder = 1;

  VIDEOS.push({ video, tex, tryPlay, mesh, flat: { x: spec.x, z: spec.z } });
  return mesh;
}

/** 一块牌子：框 + 画 + 底下的名牌。 */
function makeBoard(spec, { w, h }) {
  const g = new THREE.Group();
  g.name = `jayMedia:${spec.id}`;

  const isVideo = spec.kind === 'video';
  const frameMat = isVideo
    ? cel({ color: 0x2c2f3c, bands: 2, tint: 0x4a4468 })
    : cel({ color: 0x8a6f52, bands: 3, tint: 0x5c5680 });
  const plateMat = cel({ color: 0x3a5346, bands: 2, tint: 0x5c5680 });

  const t = 0.07;
  const depth = isVideo ? 0.1 : 0.06;
  /* 画布向内缩一点，框才看得见；缩进量跟着尺寸走，小牌子不至于被框吃掉。 */
  const inset = Math.min(0.05, w * 0.035);

  if (isVideo) {
    /* 视频组：整块牌子是一个 rigid 装置，画面在局部空间里是正的。 */
    g.userData.planetRigid = true;
    g.userData.noBatch = true;

    const surround = new THREE.Group();
    for (const [bw, bh, bx, by] of [
      [w + t * 2, t, 0, h / 2 + t / 2],
      [w + t * 2, t, 0, -h / 2 - t / 2],
      [t, h, -w / 2 - t / 2, 0],
      [t, h, w / 2 + t / 2, 0],
    ]) {
      const bar = box(bw, bh, depth, frameMat, bx, by, 0);
      bar.castShadow = true;
      surround.add(bar);
    }
    g.add(surround);
    g.add(box(w + t * 2, t * 0.6, depth * 0.6, plateMat, 0, -h / 2 - t - 0.05, 0));

    const screen = makeVideoPlane(spec, w, h);
    g.add(screen);
    g.userData.screen = screen;
  } else {
    const tex = loadTexture(spec.file);
    const picture = new THREE.Mesh(
      new THREE.PlaneGeometry(w - inset * 2, h - inset * 2),
      flat({ color: 0xffffff, map: tex, cache: false }),
    );
    picture.position.z = 0.031;
    picture.userData.noOutline = true;
    picture.receiveShadow = false;
    g.add(picture);

    const backing = box(w, h, 0.035, frameMat, 0, 0, 0);
    backing.castShadow = true;
    g.add(backing);

    /* 四边框条。刻意只有 4 个 box：整块牌子会被 batchStatic 并掉，
     * 数量在这里不心疼，但也没必要堆。 */
    for (const [bw, bh, bx, by] of [
      [w + t * 2, t, 0, h / 2 + t / 2],
      [w + t * 2, t, 0, -h / 2 - t / 2],
      [t, h, -w / 2 - t / 2, 0],
      [t, h, w / 2 + t / 2, 0],
    ]) {
      const bar = box(bw, bh, 0.05, frameMat, bx, by, -0.01);
      bar.castShadow = true;
      g.add(bar);
    }
  }

  g.userData.media = spec;
  return g;
}

/**
 * 建所有素材装置，外加每站一块「本站在展什么」的导航板。
 *
 * `gotoStop` 由 `scene.ts` 注入：站在导航板前面点一下，镜头就带到那一站。
 * 页面上的缩略图导航（表层导航）走的是同一个函数，所以「场景里的板子」
 * 和「界面上的导航条」指向的是同一批坐标。
 */
export function buildJayMedia(ctx, { gotoStop = null } = {}) {
  const groups = [];

  for (const spec of MEDIA) {
    const h = spec.w / spec.aspect;
    const board = makeBoard(spec, { w: spec.w, h });
    /* **牌子挂在墙上，不是嵌在墙里。**
     *
     * `media.ts` 里每一块牌子的坐标，都是 `place-media.cjs` 在站点视线锥里
     * 打中一面墙得到的**墙点**。而一块画框是有厚度的：把组直接放在墙点上，
     * 背板就有一半埋进墙体，画面前面就是墙皮 —— 用户看到的「MV 悬空 /
     * 看不见」里，有一部分其实是「牌子刚好齐平嵌进墙面」。
     *
     * 所以沿 face（墙指向观者的方向）把它推出来 9 cm：够让背板贴住墙面，
     * 又不会像悬在空中。 */
    const WALL_OFFSET = 0.09;
    const bx = spec.x + Math.sin(spec.face) * WALL_OFFSET;
    const bz = spec.z + Math.cos(spec.face) * WALL_OFFSET;
    const y = ctx.groundAt(spec.x, spec.z) + spec.y + h / 2;
    board.position.set(bx, y, bz);
    board.rotation.y = spec.face;
    ctx.add(board);
    shadowify(board, true, false);
    groups.push(board);

    /* 每一块牌子都能点：点一下把镜头带到它这一站。
     *
     * `interact` 收的是**命中盒网格**（`player.pick` 用 raycaster 打的就是它），
     * 所以这里放一块看不见的盒子，摆在画面正前方一点点 —— 摆在画面里的话
     * 射线会先打到它，牌子本身反而永远点不到。
     * 同一站的几块牌子指向同一个 zone，重叠了也无所谓。 */
    if (gotoStop) {
      const reach = 0.7;
      const hx = bx + Math.sin(spec.face) * reach;
      const hz = bz + Math.cos(spec.face) * reach;
      const hit = box(spec.w + 0.3, h + 0.3, 0.3, flat({ color: 0xff0000, cache: false }), hx, y, hz);
      hit.visible = false;
      hit.rotation.y = spec.face;
      hit.userData.noOutline = true;
      ctx.add(hit);
      ctx.interact({
        hitbox: hit,
        label: `${spec.title} ・ ${spec.caption}  ·  带我去 0${spec.target + 1}`,
        action: () => gotoStop(spec.target),
      });
    }

    /* 视频牌前面不要站人：站上去就穿模，而且屏幕会怼脸。 */
    if (spec.kind === 'video') {
      ctx.collide(spec.x - 0.5, spec.z - 0.5, spec.x + 0.5, spec.z + 0.5, y + h / 2 + 0.2);
    }
  }

  const boards = buildGuideBoards(ctx, gotoStop);
  groups.push(...boards);

  /* 视频按玩家距离开关。放在一个 update 里而不是每帧搜场景：
   * 只有四台，直接遍历列表最省事。 */
  /* 视频按玩家距离开关。
   *
   * **距离必须在同一个坐标系里算。** 第一版拿屏幕网格的 `getWorldPosition`
   * 去减 `player.pos`（平面坐标），近处看着没问题，远一点就完全对不上 ——
   * 站在唱片小巷（22, 28.5）时教室那块牌子的球面世界坐标算出来是 ~24.6，
   * 差 4 米就把一台在播的屏幕判成「太远」按了暂停。所以这里用牌子自己的
   * authoring 平面坐标，和 `player.pos` 同一套。
   *
   * 半秒一次的「再推一把」是给自动播放被拒的情况留的：`play()` 被 reject
   * 之后不会再有事件来救场，没有这个重试，屏幕就停在第一帧，看起来和
   * 「视频坏了」一模一样。 */
  let retry = 0;
  ctx.update((dt) => {
    retry += dt;
    const again = retry > 0.5;
    if (again) retry = 0;
    for (const v of VIDEOS) {
      const d = Math.hypot(v.flat.x - playerX, v.flat.z - playerZ);
      if (d < PLAY_NEAR) {
        if (v.video.paused && (again || v.video.readyState >= 2)) v.tryPlay();
      } else if (d > PLAY_FAR && !v.video.paused) {
        v.video.pause();
      }
    }
  });

  return { groups, videos: VIDEOS };
}

/* ------------------------------------------------------------------ *
 * 站牌：每一站一块「本站在展什么」。
 *
 * 这是用户说的「在表层用来做个导航，导航到各个图片」在地上的那一半：
 * 牌子上列本站的素材，站在前面点一下把镜头带到它跟前；界面上的缩略图条
 * 是另一半，两边读同一张表。
 * ------------------------------------------------------------------ */
function guideBoardTex(zone, items) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 448;
  const c = cv.getContext('2d');
  const JP = `'Yu Gothic', 'Yu Gothic UI', 'Meiryo', 'Noto Sans SC', 'Microsoft YaHei', sans-serif`;

  c.fillStyle = '#f3ece0';
  c.fillRect(0, 0, 512, 448);
  c.fillStyle = '#2f6f68';
  c.fillRect(0, 0, 512, 72);
  c.fillStyle = '#fff8ed';
  c.font = `bold 34px ${JP}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`0${zone + 1}  ${ZONE_LABELS[zone] ?? ''}`, 256, 37);

  c.fillStyle = '#5a4038';
  c.font = `600 22px ${JP}`;
  c.textAlign = 'left';
  c.fillText('本站在展', 30, 104);

  const rows = items.length ? items : [null];
  rows.slice(0, 4).forEach((m, i) => {
    const y = 146 + i * 62;
    c.fillStyle = i % 2 ? '#e7dfd0' : '#f7f2e8';
    c.fillRect(24, y - 20, 464, 54);
    c.fillStyle = '#3a3348';
    c.font = `bold 23px ${JP}`;
    c.fillText(m ? m.title : '（本站在整修）', 40, y - 4);
    /* **原始文件名。** 展示用的文件名是后来起的，命名这件事本身就可能出错，
     * 所以原始名字一路带到板子上：对一眼就知道哪件素材摆在了哪。 */
    if (m) {
      c.fillStyle = '#8a8276';
      c.font = `500 13px ${JP}`;
      c.fillText(`原始文件：${m.source}`.slice(0, 42), 40, y + 18);
    }
    if (m) {
      c.fillStyle = '#8a7350';
      c.font = `600 17px ${JP}`;
      c.textAlign = 'right';
      c.fillText(m.kind === 'video' ? '影像' : '唱片', 468, y - 4);
      c.textAlign = 'left';
    }
  });
  if (items.length > 4) {
    c.fillStyle = '#9a8f82';
    c.font = `600 15px ${JP}`;
    c.fillText(`另有 ${items.length - 4} 件在站内`, 40, 146 + 4 * 62 - 4);
  }

  c.fillStyle = '#9a8f82';
  c.font = `600 17px ${JP}`;
  c.textAlign = 'center';
  c.fillText('走近按 E ・ 或点界面上的缩略图', 256, 430);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 每站一块站牌，立在车站月台与街道之间的空地上。 */
const GUIDE_SPOTS = [
  { zone: 0, x: 3.3, z: 12.0, face: -Math.PI / 2 },
  { zone: 1, x: 21.3, z: 30.2, face: Math.PI / 2 },
  { zone: 2, x: -29.2, z: 32.6, face: Math.PI / 2 },
  { zone: 3, x: 23.4, z: -5.2, face: -Math.PI / 2 },
  { zone: 4, x: 3.3, z: -29.6, face: Math.PI },
];

function buildGuideBoards(ctx, gotoStop) {
  const out = [];
  const frameMat = cel({ color: 0x6a5240, bands: 3, tint: 0x554e74 });
  const postMat = cel({ color: PAL.metalDark, bands: 3, tint: 0x5c5680 });

  for (const spot of GUIDE_SPOTS) {
    const items = MEDIA.filter((m) => m.zone === spot.zone);
    const g = new THREE.Group();
    g.name = `jayMediaGuide:${spot.zone}`;

    const W = 1.15;
    const H = W * 0.75;
    const baseY = ctx.groundAt(spot.x, spot.z);
    /* 立牌是 rigid 装置：交互要能拿到它在世界里的位置，而 bake 之后
     * 只有 rigid 的容器还留着有意义的矩阵。 */
    g.userData.planetRigid = true;
    g.userData.noBatch = true;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, 0.05),
      [frameMat, frameMat, frameMat, frameMat,
        flat({ color: 0xffffff, map: guideBoardTex(spot.zone, items), cache: false }), frameMat],
    );
    board.position.y = H / 2 + 1.05;
    board.castShadow = true;
    board.userData.noOutline = true;
    g.add(board);
    g.add(box(W + 0.1, 0.05, 0.09, frameMat, 0, H + 1.05, 0));

    for (const s of [-1, 1]) {
      const post = cyl(0.05, 0.06, 1.12, 8, postMat, s * (W / 2 - 0.12), 0.56, 0);
      post.castShadow = true;
      g.add(post);
    }
    g.add(box(W + 0.1, 0.06, 0.16, postMat, 0, 0.03, 0));

    g.position.set(spot.x, baseY, spot.z);
    g.rotation.y = spot.face;
    ctx.add(g);
    out.push(g);

    ctx.collide(spot.x - 0.5, spot.z - 0.5, spot.x + 0.5, spot.z + 0.5, baseY + 2.1);

    if (gotoStop) {
      /* 站牌自己也能点：站在跟前点一下，镜头带到这一站。
       * 命中盒是一块看不见的盒子，摆在牌子正前方而不是牌子里 —— 放进牌子里
       * 射线会先打到它，牌子上的画面反而永远点不到。 */
      const reach = 0.85;
      const fx = spot.x + Math.sin(spot.face) * reach;
      const fz = spot.z + Math.cos(spot.face) * reach;
      const hit = box(W + 0.5, H + 0.4, 0.35, flat({ color: 0xff0000, cache: false }), fx, baseY + H / 2 + 1.05, fz);
      hit.visible = false;
      hit.rotation.y = spot.face;
      hit.userData.noOutline = true;
      ctx.add(hit);
      ctx.interact({
        hitbox: hit,
        label: `导览牌 0${spot.zone + 1} ・ ${ZONE_LABELS[spot.zone] ?? ''}  ·  待在这里看看`,
        action: () => gotoStop(spot.zone),
      });
    }
  }
  return out;
}

/** 页面上的缩略图条要用的一份精简数据。 */
export const mediaIndex = () => MEDIA.map((m) => ({
  id: m.id,
  title: m.title,
  caption: m.caption,
  kind: m.kind,
  zone: m.zone,
  target: m.target,
  src: mediaUrl(m.file),
  thumb: thumbUrl(m.file),
  source: m.source,
  where: m.on,
}));

/**
 * 每件素材的落位（含坐标），给验收脚本取景用。
 *
 * `mediaIndex()` 是给界面用的（只关心显示什么），这一份是给工具用的：
 * 要知道牌子立在哪、朝哪、多大，才能站到它正面拍一张。放在这里而不是
 * 让脚本猜，是因为坐标只有一处真相 —— `media.ts`。
 */
export const mediaPlacements = () => MEDIA.map((m) => ({
  id: m.id,
  kind: m.kind,
  zone: m.zone,
  x: m.x,
  z: m.z,
  face: m.face,
  y: m.y,
  w: m.w,
  h: m.w / m.aspect,
}));
