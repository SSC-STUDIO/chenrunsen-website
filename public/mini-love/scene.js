/**
 * 一座从白天走到星夜的方块小岛：奶油童话的花园、日系的樱花河、中式的灯笼水乡、星空下的浮岛。
 * three 按需从站内模块加载；失败时页面照常显示信纸。镜头随阅读进度前进，不接受拖拽。
 */

const THREE_URL = './vendor/three.module.min.js';

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hexRGB = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/* 四段天色（显示色）：奶油晨光、清透白天、灯笼黄昏、星夜 */
const SKY = [
  { z: [0.35, 0.6, 0.83], m: [0.59, 0.76, 0.91], h: [0.82, 0.84, 0.88], sun: [1.0, 0.95, 0.9], sunI: 1.35, hs: [0.86, 0.91, 1.0], hg: [0.85, 0.9, 0.74], hI: 1.05, fog: 0.018 },
  { z: [0.33, 0.6, 0.93], m: [0.62, 0.8, 0.97], h: [0.88, 0.94, 0.99], sun: [1.0, 1.0, 0.97], sunI: 1.55, hs: [0.8, 0.88, 1.0], hg: [0.66, 0.78, 0.56], hI: 1.0, fog: 0.016 },
  { z: [0.08, 0.16, 0.35], m: [0.27, 0.32, 0.58], h: [0.48, 0.45, 0.66], sun: [1.0, 0.7, 0.5], sunI: 1.0, hs: [0.63, 0.65, 0.82], hg: [0.34, 0.34, 0.42], hI: 0.75, fog: 0.022 },
  { z: [0.006, 0.018, 0.09], m: [0.02, 0.07, 0.22], h: [0.06, 0.15, 0.33], sun: [0.7, 0.84, 1.0], sunI: 0.5, hs: [0.18, 0.32, 0.64], hg: [0.05, 0.08, 0.19], hI: 0.62, fog: 0.02 },
];
const skyAt = (phase) => {
  const p = Math.min(2.999, Math.max(0, phase));
  const i = Math.floor(p);
  const t = p - i;
  const a = SKY[i];
  const b = SKY[i + 1];
  return {
    z: mix3(a.z, b.z, t), m: mix3(a.m, b.m, t), h: mix3(a.h, b.h, t),
    sun: mix3(a.sun, b.sun, t), sunI: mix(a.sunI, b.sunI, t),
    hs: mix3(a.hs, b.hs, t), hg: mix3(a.hg, b.hg, t), hI: mix(a.hI, b.hI, t),
    fog: mix(a.fog, b.fog, t),
  };
};

/* 阅读进度 s：0 封面，1–5 对应五个乐章开头，6 读完。
   镜头先去北岸的校园（军训的合唱台、开学第二周的校门、体育课的跑道），
   再一路向南穿过花园、樱花河、灯笼水乡，最后停在星空浮岛上说那句话。 */
const PATH = [
  { s: 0, p: [2.0, 6.2, 13.8], l: [1.4, 3.3, -1.2], ph: 0.05 },
  { s: 0.45, p: [2.4, 6.6, 11.6], l: [1.4, 3.0, -3.4], ph: 0.14 },
  { s: 0.75, p: [-4.4, 12.4, 5.2], l: [0.8, 2.4, 12.0], ph: 0.24 },
  { s: 1, p: [1.0, 8.2, 8.0], l: [0.5, 1.7, 20.8], ph: 0.35 },
  { s: 1.7, p: [0.6, 5.0, 14.4], l: [0.4, 1.9, 21.2], ph: 0.5 },
  { s: 1.85, p: [7.2, 6.6, 18.6], l: [1.0, 2.0, 24.0], ph: 0.55 },
  { s: 2, p: [6.6, 6.8, 20.4], l: [0.4, 2.4, 32.5], ph: 0.6 },
  { s: 2.7, p: [4.6, 7.4, 33.4], l: [0.4, 1.4, 40.5], ph: 0.75 },
  { s: 2.9, p: [8.0, 11.0, 22.0], l: [2.2, 2.4, 5.0], ph: 1.1 },
  { s: 3, p: [8.4, 5.8, 6.2], l: [1.2, 1.8, -1.6], ph: 1.35 },
  { s: 3.4, p: [8.8, 6.0, -3.6], l: [0.6, 1.5, -14.6], ph: 1.7 },
  { s: 3.7, p: [8.6, 6.6, -17.6], l: [0.3, 1.9, -28.8], ph: 2.15 },
  { s: 4, p: [8.4, 6.9, -31.8], l: [0.2, 3.6, -44.8], ph: 2.75 },
  { s: 4.7, p: [7.2, 6.8, -35.6], l: [0.1, 3.7, -45.4], ph: 2.95 },
  { s: 5, p: [6.6, 6.6, -36.8], l: [0.05, 3.6, -45.2], ph: 3.0 },
  { s: 5.7, p: [3.4, 5.8, -34.6], l: [0.0, 3.55, -45.8], ph: 3.0 },
  { s: 6, p: [2.2, 7.8, -30.2], l: [0.0, 4.1, -48.2], ph: 3.0 },
];
const YES_SHOT = { p: [4.8, 5.5, -37.0], l: [0.15, 4.05, -45.4] };
const MOON_POS = [10, 24, -75];

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
const segmentOf = (s) => {
  const n = PATH.length;
  if (s <= PATH[0].s) return [0, 0];
  if (s >= PATH[n - 1].s) return [n - 2, 1];
  let k = 0;
  while (k < n - 2 && s > PATH[k + 1].s) k++;
  return [k, (s - PATH[k].s) / (PATH[k + 1].s - PATH[k].s)];
};
const along = (s, key) => {
  const n = PATH.length;
  const [k, t] = segmentOf(s);
  const P = (i) => PATH[Math.max(0, Math.min(n - 1, i))][key];
  return [0, 1, 2].map((c) => catmull(P(k - 1)[c], P(k)[c], P(k + 1)[c], P(k + 2)[c], t));
};
const phaseAlong = (s) => {
  const [k, t] = segmentOf(s);
  return mix(PATH[k].ph, PATH[k + 1].ph, smooth(0, 1, t));
};

/* ── 后期管线 ──
   先渲染到离屏缓冲，再用三个全屏 pass 收尾：
     1) 墨线  —— 线性深度的二阶差分：凸边着墨、凹边轻描，远景随雾淡出
     2) 柔光  —— 亮部阈值 + 半分辨率两次可分离高斯，加回灯笼/水晶/月亮/烟花
     3) 分级  —— 分离色调 + 饱和度 + 高光软膝 + 暗角
   缓冲是显示空间（sRGB）的 8 位纹理，所以老的自定义 shader 输出色一个都不用改；
   渲染进 RT 时 three 不再给内置材质做 tone mapping，高光改由分级的软膝接住。 */

const FS_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const INK_GLSL = `
  #include <packing>
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uNear, uFar;
  uniform vec3 uInk;
  uniform float uThickness, uSens, uConcave, uConcaveAmount;
  uniform float uFadeStart, uFadeEnd, uStrength, uSkyDepth, uInkOn;

  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return -perspectiveDepthToViewZ(d, uNear, uFar);
  }

  /* 线性深度的二阶差分：凸边着墨、凹边轻描，远景随雾淡出 */
  vec3 applyInk(vec3 col, vec2 uv) {
    if (uInkOn < 0.5) return col;
    vec2 t = uTexel * uThickness;
    float dc = linearDepth(uv);
    if (dc > uSkyDepth) return col;
    float dl = linearDepth(uv - vec2(t.x, 0.0));
    float dr = linearDepth(uv + vec2(t.x, 0.0));
    float du = linearDepth(uv + vec2(0.0, t.y));
    float dd = linearDepth(uv - vec2(0.0, t.y));
    float sx = (dl + dr - 2.0 * dc) / dc;
    float sy = (du + dd - 2.0 * dc) / dc;
    float convex = max(0.0, sx) + max(0.0, sy);
    float concave = max(0.0, -sx) + max(0.0, -sy);
    float edge = smoothstep(uSens * 0.32, uSens, convex);
    edge = max(edge, smoothstep(uConcave, uConcave * 3.4, concave) * uConcaveAmount);
    edge *= 1.0 - smoothstep(uFadeStart, uFadeEnd, dc);
    edge *= uStrength;
    vec3 line = mix(uInk, col * 0.42, 0.22);
    return mix(col, line, clamp(edge, 0.0, 1.0));
  }
`;

const BRIGHT_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uThreshold, uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = (texture2D(tDiffuse, vUv + vec2(-uTexel.x, -uTexel.y)).rgb
            + texture2D(tDiffuse, vUv + vec2( uTexel.x, -uTexel.y)).rgb
            + texture2D(tDiffuse, vUv + vec2(-uTexel.x,  uTexel.y)).rgb
            + texture2D(tDiffuse, vUv + vec2( uTexel.x,  uTexel.y)).rgb) * 0.25;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + uKnee, l), 1.0);
  }
`;

const BLUR_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;
    sum += (texture2D(tDiffuse, vUv + uDir * 1.3846).rgb + texture2D(tDiffuse, vUv - uDir * 1.3846).rgb) * 0.3162162;
    sum += (texture2D(tDiffuse, vUv + uDir * 3.2308).rgb + texture2D(tDiffuse, vUv - uDir * 3.2308).rgb) * 0.0702702;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const GRADE_FRAG = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tBloom;
  uniform vec3 uShadowTint, uLightTint;
  uniform float uSaturation, uLift, uVignette, uWarmth, uBloom, uKnee, uRoll;
  varying vec2 vUv;
  ${INK_GLSL}

  vec3 softKnee(vec3 c, float knee, float roll) {
    vec3 over = max(c - vec3(knee), vec3(0.0));
    return min(c, vec3(knee)) + over / (1.0 + over * roll);
  }

  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    c = applyInk(c, vUv);
    c += texture2D(tBloom, vUv).rgb * uBloom;

    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(0.02, 0.55, l);
    c *= mix(uShadowTint, uLightTint, k);
    c += vec3(uWarmth, uWarmth * 0.45, 0.0) * l * 0.35;
    c += uLift * (1.0 - k);
    c = mix(vec3(l), c, uSaturation);
    c = softKnee(c, uKnee, uRoll);

    float r = length(vUv - 0.5) * 1.42;
    c *= 1.0 - uVignette * pow(clamp(r, 0.0, 1.0), 2.6);
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

function createPipeline(THREE, renderer, scene, camera, { pixelBudget = 4.6e6, quality = 1 } = {}) {
  const rtOpts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    colorSpace: THREE.SRGBColorSpace,
  };
  const noDepth = { ...rtOpts, depthBuffer: false };

  const rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  rtScene.depthTexture = new THREE.DepthTexture(2, 2);
  rtScene.depthTexture.format = THREE.DepthFormat;
  rtScene.depthTexture.type = THREE.UnsignedIntType;
  rtScene.depthTexture.minFilter = THREE.NearestFilter;
  rtScene.depthTexture.magFilter = THREE.NearestFilter;

  const halfOpts = { ...noDepth };
  const rtHalfA = new THREE.WebGLRenderTarget(2, 2, halfOpts);
  const rtHalfB = new THREE.WebGLRenderTarget(2, 2, halfOpts);

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quad.frustumCulled = false;
  quadScene.add(quad);

  const pass = (frag, uniforms) => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  });

  const inkUniforms = {
    tDepth: { value: rtScene.depthTexture },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: camera.near },
    uFar: { value: camera.far },
    uInk: { value: new THREE.Color(0x33304a) },
    uThickness: { value: 1.3 },
    uSens: { value: 0.0052 },
    uConcave: { value: 0.03 },
    uConcaveAmount: { value: 0.3 },
    uFadeStart: { value: 46 },
    uFadeEnd: { value: 150 },
    uStrength: { value: 0.72 },
    uSkyDepth: { value: 420 },
    uInkOn: { value: 1 },
  };
  const brightMat = pass(BRIGHT_FRAG, {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 0.8 },
    uKnee: { value: 0.24 },
  });
  const blurMat = pass(BLUR_FRAG, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });
  const gradeMat = pass(GRADE_FRAG, {
    tDiffuse: { value: null },
    tBloom: { value: rtHalfA.texture },
    ...inkUniforms,
    uShadowTint: { value: new THREE.Color(0.955, 0.95, 1.005) },
    uLightTint: { value: new THREE.Color(1.0, 0.995, 0.985) },
    uSaturation: { value: 0.95 },
    uLift: { value: 0.008 },
    uVignette: { value: 0.11 },
    uWarmth: { value: 0.02 },
    uBloom: { value: 0.5 },
    uKnee: { value: 0.86 },
    uRoll: { value: 2.6 },
  });

  const state = { ink: true, bloom: true, scale: 1, width: 2, height: 2 };

  const draw = (material, target) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  };

  const setSize = (w, h) => {
    const dpr = window.devicePixelRatio || 1;
    let scale = quality < 1 ? 1 : (dpr < 1.5 ? 1.5 : Math.min(dpr, 2));
    if (w * h * scale * scale > pixelBudget) scale = Math.max(0.85, Math.sqrt(pixelBudget / (w * h)));
    state.scale = scale;
    const rw = Math.max(2, Math.floor(w * scale));
    const rh = Math.max(2, Math.floor(h * scale));
    state.width = rw;
    state.height = rh;

    // 画布按 CSS 像素渲染，重建在更高分辨率上做，浏览器缩回去就顺带抗了锯齿
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    rtScene.setSize(rw, rh);
    rtHalfA.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));
    rtHalfB.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));

    inkUniforms.uTexel.value.set(1 / rw, 1 / rh);
    brightMat.uniforms.uTexel.value.set(2 / rw, 2 / rh);
    inkUniforms.uNear.value = camera.near;
    inkUniforms.uFar.value = camera.far;
    inkUniforms.uThickness.value = 1.05 + 0.45 * scale;
  };

  const render = () => {
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);

    if (state.bloom) {
      const hx = 1 / Math.max(2, state.width >> 1);
      const hy = 1 / Math.max(2, state.height >> 1);
      brightMat.uniforms.tDiffuse.value = rtScene.texture;
      draw(brightMat, rtHalfA);
      blurMat.uniforms.tDiffuse.value = rtHalfA.texture;
      blurMat.uniforms.uDir.value.set(hx, 0);
      draw(blurMat, rtHalfB);
      blurMat.uniforms.tDiffuse.value = rtHalfB.texture;
      blurMat.uniforms.uDir.value.set(0, hy);
      draw(blurMat, rtHalfA);
    }
    inkUniforms.uInkOn.value = state.ink ? 1 : 0;
    gradeMat.uniforms.tDiffuse.value = rtScene.texture;
    gradeMat.uniforms.uBloom.value = state.bloom ? 0.5 : 0;
    draw(gradeMat, null);
    renderer.setRenderTarget(null);
  };

  const dispose = () => {
    [rtScene, rtHalfA, rtHalfB].forEach((rt) => rt.dispose());
    [brightMat, blurMat, gradeMat].forEach((m) => m.dispose());
    quad.geometry.dispose();
  };

  return { state, gradeMat, brightMat, inkUniforms, setSize, render, dispose };
}

export async function mountIsland(canvas, { reduced = false } = {}) {
  if (!canvas) return null;
  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch {
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const mobile = window.matchMedia?.('(pointer: coarse)').matches
    || window.innerWidth < 600
    || /Android|HarmonyOS/i.test(navigator.userAgent || '');
  const lite = reduced
    || mobile
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  /* 三条随机流，互不干扰：
     rng  —— 布局：地形、房子、摆件。lite 与 full 必须逐块一致，否则手机和电脑是两个世界。
     detailRng —— 细节：星屑、花瓣、萤火，可以按机型少画一点，不影响世界本身。
     localRng(x,z) —— 一棵树/一座浮岛自己的流，改它的密度不会挪动别的树。 */
  const rng = mulberry32(20260925);
  const detailRng = mulberry32(0x5eed1a7e);
  let activeRng = rng;
  const R = (a, b) => a + (b - a) * activeRng();
  const pick = (list) => list[Math.floor(activeRng() * list.length)];
  const localRng = (x, z, salt = 0) => {
    let h = (Math.imul(Math.round(x * 64) | 0, 0x27d4eb2d)
      ^ Math.imul(Math.round(z * 64) | 0, 0x165667b1)
      ^ Math.imul(salt | 0, 0x9e3779b1)) | 0;
    return () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xffffff, 0.018);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 620);

  /* 离屏管线；构造失败就退回直画布，画面照旧只是没有墨线与柔光 */
  let pipeline = null;
  try {
    pipeline = createPipeline(THREE, renderer, scene, camera, {
      pixelBudget: lite ? 2.2e6 : 4.6e6,
      quality: lite ? 1 : 1.5,
    });
    pipeline.state.ink = !reduced;
    pipeline.state.bloom = !lite && !reduced;
    renderer.toneMapping = THREE.NoToneMapping;
  } catch {
    pipeline = null;
    renderer.toneMapping = THREE.NeutralToneMapping;
  }
  const renderFrame = () => {
    if (pipeline) pipeline.render();
    else renderer.render(scene, camera);
  };
  const display = (rgb, target = new THREE.Color()) => target.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);

  /* ── 收集方块，最后一次性做成实例网格 ── */
  const lit = [];
  const glow = { warm: [], magic: [] };
  const halos = [];
  const hotspots = [];
  const petalTrees = [];
  const box = (x, y, z, sx, sy, sz, color, j = 0.06) => lit.push([x, y, z, sx, sy, sz, color, j]);
  const gbox = (group, x, y, z, sx, sy, sz, color) => glow[group].push([x, y, z, sx, sy, sz, color, 0]);
  /* group：0 常亮，1 灯笼（翻磁带时按 order 依次亮），2 水晶与紫树（按住音符、告白时变亮） */
  const halo = (x, y, z, w, h, color, k = 1, night = 1, group = 0, order = 0) => halos.push([x, y, z, w, h, color, k, night, group, order]);
  const hot = (type, x, y, z, rx, ry, rz, data = {}) => hotspots.push({
    type,
    x, y, z,
    data,
    box: new THREE.Box3(new THREE.Vector3(x - rx, y - ry, z - rz), new THREE.Vector3(x + rx, y + ry, z + rz)),
  });

  /* ── 地形：一条从花园延伸到湖边的长岛，河道和运河是地面上的缺口 ── */
  const TILE = 0.5;
  const STREAM = [[-5.4, -2.3], [-4.0, -0.6], [-3.0, 1.2], [-3.3, 3.0], [-2.4, 4.6], [-1.4, 6.4]];
  const distToLine = (x, z, pts) => {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  };
  const isWater = (x, z) => {
    if (z > -6) return distToLine(x, z, STREAM) < 0.8;
    if (z > -20) return Math.abs(z + 14) < 1.05;
    if (z > -35) return Math.abs(x) < 1.25 && z < -21.5;
    return z < -36.2 && !(Math.abs(x) < 1.6 && z > -37.6);
  };
  const zoneOf = (z) => (z > -6 ? 0 : z > -20 ? 1 : z > -34.5 ? 2 : 3);
  const GRASS = [
    ['#c2e39c', '#b3dc8e', '#cbe8a8', '#bde09a'],
    ['#93cc6e', '#82bf62', '#a0d67c', '#8cc76a'],
    ['#7aa35a', '#6d9650', '#86ad62', '#739d55'],
    ['#35584a', '#2e5042', '#3d6352', '#325547'],
  ];
  const BANK = [['#ece6da', '#e0d8ca'], ['#aeaea8', '#9b9c96'], ['#6f6b65', '#5f5c57'], ['#5a5670', '#4c4862']];
  const PAVE = ['#9a968f', '#8a8680', '#a8a49c', '#7e7a74'];
  const blocked = [];
  const block = (x0, z0, x1, z1) => blocked.push([x0, z0, x1, z1]);
  const isBlocked = (x, z) => blocked.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);

  box(0, -0.65, -15, 16.6, 1.7, 44, '#6b5040', 0.02);
  for (let x = -8; x <= 8.001; x += TILE) {
    for (let z = -36.5; z <= 6.5001; z += TILE) {
      if (isWater(x, z)) continue;
      const zone = zoneOf(z);
      const nearWater = isWater(x + TILE, z) || isWater(x - TILE, z) || isWater(x, z + TILE) || isWater(x, z - TILE);
      let color;
      let top = 0.5;
      if (nearWater) {
        color = pick(BANK[zone]);
        top = 0.56;
      } else if (zone === 2 && (Math.abs(x) < 3.6 || Math.sin(x * 1.7 + z * 0.9) > 0.1)) {
        color = pick(PAVE);
      } else if (zone === 3 && Math.abs(x) < 1.8) {
        color = pick(BANK[2]);
      } else {
        color = pick(GRASS[zone]);
      }
      const edge = Math.abs(x) - 6.6;
      if (edge > 0 && zone < 2) top += edge * 0.55 + Math.max(0, Math.sin(z * 0.8 + x) * 0.25);
      const h = top - 0.2;
      box(x, 0.2 + h / 2, z, TILE, h, TILE, color, 0.1);
    }
  }

  /* ── 通用零件 ── */
  const PINK_CREAM = { main: ['#f7b9c4', '#f5a9b9', '#fbcad3', '#f09db1'], deep: '#e5899f', light: '#fde6ec' };
  const PINK_JP = { main: ['#f4a6c6', '#f8bdd5', '#fbd3e2', '#ec95ba'], deep: '#de7fa8', light: '#fde6ef' };
  const sakura = (x, z, size, palette, baseY = 0.5) => {
    const trunkH = 1.25 * size;
    for (let i = 0; i < 4; i++) {
      box(x + (i === 3 ? 0.06 : 0), baseY + trunkH * (i + 0.5) / 4, z, 0.26 * size, trunkH / 4 + 0.02, 0.26 * size, i % 2 ? '#7c5538' : '#6e4a31');
    }
    box(x + 0.34 * size, baseY + trunkH * 0.86, z, 0.5 * size, 0.14 * size, 0.14 * size, '#6e4a31');
    box(x - 0.3 * size, baseY + trunkH * 0.96, z + 0.1, 0.42 * size, 0.12 * size, 0.12 * size, '#7c5538');
    const cy = baseY + trunkH + 0.55 * size;
    const lr = localRng(x, z, 11);
    const lR = (a, b) => a + (b - a) * lr();
    const lpick = (list) => list[Math.floor(lr() * list.length)];
    const n = Math.round(48 * size * size);
    for (let i = 0; i < n; i++) {
      let u;
      let v;
      let w;
      do {
        u = lR(-1, 1);
        v = lR(-1, 1);
        w = lR(-1, 1);
      } while (u * u + v * v + w * w > 1);
      const s = lR(0.32, 0.5) * size;
      const roll = lr();
      const color = roll < 0.14 ? palette.light : roll < 0.26 ? palette.deep : lpick(palette.main);
      /* lite 只少画花簇，不动随机流，树形与位置和桌面完全一致 */
      if (lite && i % 3 === 2) continue;
      box(x + u * 1.25 * size, cy + v * 0.72 * size, z + w * 1.25 * size, s, s * 0.9, s, color, 0.05);
    }
    hot('tree', x, cy, z, 1.3 * size, 0.95 * size, 1.3 * size, { tint: [1, 0.72, 0.8] });
    petalTrees.push([x, cy, z, size]);
    block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  };

  const flowerKinds = [
    { petal: '#fbfbf5', center: '#f6d96a' },
    { petal: '#c8a8e8', center: '#f3e3ff' },
    { petal: '#f7b6c8', center: '#fff0c4' },
    { petal: '#f9e08a', center: '#f5b84a' },
  ];
  const flowerCluster = (x, z, kind, baseY = 0.5) => {
    box(x, baseY + 0.08, z, 0.32, 0.16, 0.32, pick(['#98c86c', '#8cbf62', '#a4d27a']), 0.08);
    for (let i = 0; i < 3; i++) {
      const fx = x + R(-0.14, 0.14);
      const fz = z + R(-0.14, 0.14);
      box(fx, baseY + 0.22, fz, 0.14, 0.1, 0.14, kind.petal, 0.04);
      box(fx, baseY + 0.28, fz, 0.06, 0.03, 0.06, kind.center, 0);
    }
  };

  const fence = (x0, z0, x1, z1, color = '#cfa877') => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 0.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      box(x0 + (x1 - x0) * t, 0.78, z0 + (z1 - z0) * t, 0.1, 0.56, 0.1, color, 0.04);
    }
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    box(cx, 0.72, cz, alongX ? len : 0.06, 0.06, alongX ? 0.06 : len, color, 0.03);
    box(cx, 0.92, cz, alongX ? len : 0.06, 0.06, alongX ? 0.06 : len, color, 0.03);
  };

  const steppingStones = (pts, colors) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 0.55));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t + R(-0.05, 0.05);
        const z = az + (bz - az) * t + R(-0.05, 0.05);
        box(x, 0.53, z, 0.44, 0.07, 0.44, pick(colors), 0.03);
        block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
      }
    }
  };
  const cobbles = (pts, width = 0.9) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 0.26));
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        for (let w = -1; w <= 1; w++) {
          const off = w * width * 0.33 + R(-0.04, 0.04);
          const x = ax + (bx - ax) * t + nx * off;
          const z = az + (bz - az) * t + nz * off;
          box(x, 0.525, z, 0.24, 0.06, 0.24, pick(['#b9b8b2', '#a7a6a0', '#c6c4bd', '#9c9b95']), 0.05);
        }
        block(ax + (bx - ax) * t - 0.45, az + (bz - az) * t - 0.45, ax + (bx - ax) * t + 0.45, az + (bz - az) * t + 0.45);
      }
    }
  };

  const creamLamp = (x, z, baseY = 0.5) => {
    box(x, baseY + 0.45, z, 0.18, 0.9, 0.18, '#efe4cc', 0.03);
    box(x, baseY + 0.95, z, 0.3, 0.08, 0.3, '#e6d6b6', 0.03);
    gbox('warm', x, baseY + 1.1, z, 0.2, 0.2, 0.2, '#ffe6a8');
    box(x, baseY + 1.26, z, 0.32, 0.1, 0.32, '#f0e2c6', 0.03);
    halo(x, baseY + 1.1, z, 1.1, 1.1, '#ffd98a', 0.85, 0.6, 0);
    hot('lantern', x, baseY + 1.1, z, 0.24, 0.28, 0.24);
  };
  let lanternOrder = 0;
  const redLantern = (x, y, z, reflectX = null) => {
    const order = lanternOrder++;
    box(x, y + 0.14, z, 0.03, 0.28, 0.03, '#2a1c16', 0);
    box(x, y - 0.02, z, 0.2, 0.05, 0.2, '#d9a441', 0.03);
    gbox('warm', x, y - 0.21, z, 0.27, 0.32, 0.27, '#ff4a36');
    box(x, y - 0.4, z, 0.18, 0.05, 0.18, '#d9a441', 0.03);
    box(x, y - 0.5, z, 0.04, 0.14, 0.04, '#e8b44a', 0);
    halo(x, y - 0.21, z, 1.5, 1.5, '#ff6a3c', 1.0, 1.0, 1, order);
    if (reflectX !== null) halo(reflectX, 0.36, z, 0.55, 1.9, '#ff7a48', 0.42, 1.0, 1, order);
    hot('lantern', x, y - 0.2, z, 0.26, 0.32, 0.26);
  };
  const stoneLamp = (x, z, reflect = false) => {
    const order = lanternOrder++;
    box(x, 0.75, z, 0.22, 0.5, 0.22, '#7c7872', 0.05);
    box(x, 1.04, z, 0.36, 0.08, 0.36, '#6a6660', 0.04);
    gbox('warm', x, 1.2, z, 0.2, 0.22, 0.2, '#ffc978');
    box(x, 1.37, z, 0.38, 0.1, 0.38, '#5f5b56', 0.04);
    halo(x, 1.2, z, 1.25, 1.25, '#ffb760', 0.95, 1.0, 1, order);
    if (reflect) halo(x * 0.55, 0.36, z, 0.5, 1.7, '#ffb760', 0.38, 1.0, 1, order);
    hot('lantern', x, 1.2, z, 0.26, 0.32, 0.26);
  };
  const toro = (x, z) => {
    box(x, 0.62, z, 0.36, 0.24, 0.36, '#9d9c96', 0.05);
    box(x, 0.9, z, 0.16, 0.34, 0.16, '#a9a8a2', 0.05);
    box(x, 1.12, z, 0.34, 0.1, 0.34, '#96958f', 0.05);
    gbox('warm', x, 1.27, z, 0.2, 0.2, 0.2, '#ffe0a0');
    box(x, 1.45, z, 0.46, 0.12, 0.46, '#8d8c86', 0.05);
    box(x, 1.56, z, 0.14, 0.1, 0.14, '#8d8c86', 0.05);
    halo(x, 1.27, z, 1.0, 1.0, '#ffd48a', 0.7, 0.7, 0);
    hot('lantern', x, 1.27, z, 0.26, 0.3, 0.26);
  };
  const glowWindow = (x, y, z, w, h, facingX = false) => {
    gbox('warm', x, y, z, facingX ? 0.05 : w, h, facingX ? w : 0.05, '#ffd27a');
    halo(x + (facingX ? 0.15 : 0), y, z + (facingX ? 0 : 0.15), w * 2.2, h * 2.2, '#ffcf7a', 0.55, 0.85, 0);
  };

  /* ── 甲 · 奶油童话花园 ── */
  const cottage = (cx, cz) => {
    const w = 3.0;
    const d = 2.4;
    const hgt = 1.8;
    const y0 = 0.5;
    block(cx - w / 2 - 0.3, cz - d / 2 - 0.3, cx + w / 2 + 0.3, cz + d / 2 + 0.6);
    box(cx, y0 + 0.08, cz, w + 0.24, 0.16, d + 0.24, '#e3d5bc', 0.03);
    box(cx, y0 + 0.16 + hgt / 2, cz, w, hgt, d, '#f6ecd8', 0.02);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(cx + sx * w / 2, y0 + 0.16 + hgt / 2, cz + sz * d / 2, 0.14, hgt, 0.14, '#ead9ba', 0.02));
    const front = cz + d / 2 + 0.03;
    box(cx - 0.2, y0 + 0.16 + 0.56, front, 0.62, 1.12, 0.06, '#c58b5a', 0.03);
    box(cx - 0.2, y0 + 0.16 + 0.56, front + 0.01, 0.06, 1.0, 0.06, '#a8703f', 0);
    gbox('warm', cx + 0.2, y0 + 1.25, front + 0.06, 0.1, 0.14, 0.1, '#ffe2a0');
    halo(cx + 0.2, y0 + 1.25, front + 0.3, 0.8, 0.8, '#ffe2a0', 0.8, 0.6, 0);
    const window = (wx, wy, wz, facingX) => {
      glowWindow(wx, wy, wz, 0.42, 0.42, facingX);
      if (facingX) {
        box(wx, wy, wz - 0.3, 0.05, 0.46, 0.16, '#c7a9dc', 0.03);
        box(wx, wy, wz + 0.3, 0.05, 0.46, 0.16, '#c7a9dc', 0.03);
      } else {
        box(wx - 0.3, wy, wz, 0.16, 0.46, 0.05, '#c7a9dc', 0.03);
        box(wx + 0.3, wy, wz, 0.16, 0.46, 0.05, '#c7a9dc', 0.03);
        box(wx, wy - 0.3, wz + 0.07, 0.52, 0.08, 0.16, '#d9c4a6', 0.03);
        for (let k = 0; k < 4; k++) box(wx - 0.18 + k * 0.12, wy - 0.22, wz + 0.1, 0.08, 0.08, 0.08, pick(['#f7b6c8', '#fbfbf5', '#c8a8e8', '#f9e08a']), 0);
      }
    };
    window(cx + 0.9, y0 + 1.15, front, false);
    window(cx - 1.05, y0 + 1.15, front, false);
    window(cx + w / 2 + 0.03, y0 + 1.15, cz, true);
    const ry = y0 + 0.16 + hgt;
    for (let i = 0; i < 5; i++) {
      const depth = d + 0.56 - i * 0.58;
      if (depth <= 0.2) break;
      box(cx, ry + 0.13 + i * 0.26, cz, w + 0.52, 0.26, depth, i % 2 ? '#f3a9a9' : '#ee9c9e', 0.05);
      box(cx - w / 2 - 0.02, ry + 0.13 + i * 0.26, cz, 0.08, 0.26, Math.max(0.1, d - i * 0.58), '#f6ecd8', 0.02);
      box(cx + w / 2 + 0.02, ry + 0.13 + i * 0.26, cz, 0.08, 0.26, Math.max(0.1, d - i * 0.58), '#f6ecd8', 0.02);
    }
    box(cx, ry + 1.4, cz, w + 0.32, 0.14, 0.34, '#e88f93', 0.03);
    box(cx + 0.9, ry + 1.2, cz - 0.55, 0.36, 0.9, 0.36, '#eadbc2', 0.03);
    box(cx + 0.9, ry + 1.7, cz - 0.55, 0.44, 0.12, 0.44, '#f0a6a6', 0.03);
    box(cx - 0.2, y0 + 0.05, cz + d / 2 + 0.32, 0.86, 0.1, 0.42, '#efe4cf', 0.02);
    for (let i = 0; i < 7; i++) box(cx - w / 2 + 0.2 + i * 0.44, y0 + 0.18, cz + d / 2 + 0.2, 0.34, 0.26, 0.24, pick(['#9ccc72', '#8cbf62', '#a8d680']), 0.08);
    hot('house', cx, y0 + 1.3, cz, w / 2, 1.4, d / 2);
    return [cx + 0.9, ry + 1.85, cz - 0.55];
  };
  const creamChimney = cottage(2.6, -2.3);

  for (let x = -7.6; x <= -4.6; x += TILE) {
    for (let z = -4.6; z <= -2.6; z += TILE) {
      if (isWater(x, z)) continue;
      const h = 1.6 + (z < -3.5 ? 1.2 : 0.4) + Math.sin(x * 2.3) * 0.3;
      box(x, 0.5 + h / 2, z, TILE, h, TILE, pick(['#d8d2c6', '#cfc8bb', '#e0dace']), 0.06);
      box(x, 0.5 + h + 0.08, z, TILE, 0.16, TILE, pick(GRASS[0]), 0.08);
    }
  }
  block(-7.8, -4.8, -4.4, -2.4);
  sakura(5.2, -0.6, 1.25, PINK_CREAM);
  sakura(-6.2, 2.4, 1.1, PINK_CREAM);
  sakura(4.6, 4.0, 0.95, PINK_CREAM);
  sakura(-0.8, -3.6, 1.05, PINK_CREAM);
  sakura(6.6, -4.6, 0.9, PINK_CREAM);
  const PASTEL = ['#f2c4cc', '#f3e6cf', '#d8c4e6', '#e2ddd8', '#f6d7c4'];
  steppingStones([[0.6, 6.2], [1.0, 4.0], [1.6, 2.0], [2.4, 0.3], [2.4, -0.7]], PASTEL);
  steppingStones([[1.3, 3.0], [0.0, 2.2], [-1.2, 1.4], [-1.7, 1.2]], PASTEL);
  steppingStones([[-4.4, 1.2], [-5.3, 1.6]], PASTEL);
  fence(5.8, 0.4, 5.8, 5.6);
  fence(3.2, 0.1, 4.6, 0.1);
  fence(0.9, 0.1, 1.8, 0.1);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = -4.2 + 2.4 * t;
    const h = 0.56 + Math.sin(Math.PI * t) * 0.5;
    box(x, h, 1.2, 0.32, 0.12, 1.0, pick(['#f1e6cf', '#eadcc2', '#f5ecd9']), 0.03);
    box(x, h + 0.2, 0.74, 0.3, 0.26, 0.1, '#e8d9bc', 0.03);
    box(x, h + 0.2, 1.66, 0.3, 0.26, 0.1, '#e8d9bc', 0.03);
    if (t < 0.15 || t > 0.85) box(x, 0.35 + h / 2, 1.2, 0.32, h, 1.0, '#e6d8c0', 0.03);
  }
  creamLamp(-4.35, 0.62);
  creamLamp(-4.35, 1.78);
  creamLamp(-1.65, 0.62);
  creamLamp(-1.65, 1.78);
  creamLamp(1.9, 4.3);
  creamLamp(3.2, 0.7);
  for (let i = 0; i < 46; i++) {
    const x = R(-7.2, 7.2);
    const z = R(-5.5, 6.2);
    if (isWater(x, z) || isBlocked(x, z) || (x > 0.8 && x < 4.4 && z > -3.8 && z < -0.6)) continue;
    if (x < -4.4 && z < -2.2) continue;
    flowerCluster(x, z, pick(flowerKinds));
  }
  for (let i = 0; i < 26; i++) {
    const x = R(-7.4, 7.4);
    const z = R(-5.8, 6.2);
    if (isWater(x, z) || isBlocked(x, z)) continue;
    box(x, 0.58, z, 0.3, 0.16, 0.3, pick(['#a8d680', '#9ccc72']), 0.1);
  }

  /* ── 乙 · 日系樱花河 ── */
  const jpHouse = (cx, cz) => {
    const w = 3.2;
    const d = 2.4;
    const y0 = 0.5;
    block(cx - w / 2 - 0.3, cz - d / 2 - 0.3, cx + w / 2 + 0.3, cz + d / 2 + 0.7);
    box(cx, y0 + 0.12, cz, w + 0.3, 0.24, d + 0.3, '#9c9a93', 0.04);
    box(cx, y0 + 0.24 + 0.8, cz, w, 1.6, d, '#f4f1ea', 0.02);
    for (let i = 0; i <= 4; i++) box(cx - w / 2 + i * (w / 4), y0 + 1.04, cz + d / 2 + 0.02, 0.1, 1.6, 0.06, '#7a5236', 0.03);
    box(cx, y0 + 0.95, cz + d / 2 + 0.03, w, 0.1, 0.06, '#7a5236', 0.03);
    box(cx, y0 + 1.8, cz + d / 2 + 0.03, w, 0.1, 0.06, '#7a5236', 0.03);
    glowWindow(cx - 0.8, y0 + 1.35, cz + d / 2 + 0.04, 0.6, 0.5);
    glowWindow(cx + 0.8, y0 + 1.35, cz + d / 2 + 0.04, 0.6, 0.5);
    box(cx, y0 + 0.62, cz + d / 2 + 0.05, 0.7, 0.9, 0.05, '#b38b5c', 0.03);
    box(cx, y0 + 0.3, cz + d / 2 + 0.45, w + 0.2, 0.12, 0.7, '#b8905c', 0.04);
    for (let i = 0; i < 3; i++) {
      const width = w + 1.0 - i * 0.7;
      const depth = d + 1.0 - i * 0.7;
      box(cx, y0 + 1.95 + i * 0.28, cz, width, 0.24, depth, i % 2 ? '#c9a06a' : '#b88d57', 0.05);
    }
    box(cx, y0 + 2.8, cz, w - 0.9, 0.2, 0.34, '#8a6440', 0.03);
    box(cx - w / 2 + 0.4, y0 + 2.2, cz + d / 2 + 0.6, 0.08, 0.5, 0.08, '#7a5236', 0);
    halo(cx - w / 2 + 0.4, y0 + 1.9, cz + d / 2 + 0.6, 0.8, 0.8, '#ffd48a', 0.7, 0.8, 0);
    gbox('warm', cx - w / 2 + 0.4, y0 + 1.9, cz + d / 2 + 0.6, 0.18, 0.24, 0.18, '#ffe0a0');
    hot('house', cx, y0 + 1.4, cz, w / 2, 1.5, d / 2);
  };
  jpHouse(-3.2, -17.8);
  const bridgeB = { x0: 0.9, x1: 2.1 };
  for (let z = -15.5; z <= -12.5; z += 0.28) {
    box((bridgeB.x0 + bridgeB.x1) / 2, 0.66, z, 1.3, 0.1, 0.24, pick(['#b08455', '#a47a4c', '#bb8f5e']), 0.04);
  }
  for (const x of [bridgeB.x0 - 0.05, bridgeB.x1 + 0.05]) {
    box(x, 0.95, -14, 0.08, 0.08, 3.1, '#8f6a42', 0.03);
    for (let z = -15.4; z <= -12.6; z += 0.7) box(x, 0.82, z, 0.1, 0.36, 0.1, '#8f6a42', 0.03);
  }
  cobbles([[1.5, -12.3], [1.4, -10.0], [1.0, -7.0]]);
  cobbles([[1.5, -15.7], [0.4, -16.0], [-1.2, -16.2], [-2.2, -16.1]]);
  sakura(-6.2, -12.2, 1.2, PINK_JP);
  sakura(-3.0, -11.6, 1.0, PINK_JP);
  sakura(4.4, -11.5, 1.15, PINK_JP);
  sakura(6.4, -16.4, 1.05, PINK_JP);
  sakura(3.2, -18.6, 1.1, PINK_JP);
  sakura(-6.6, -17.6, 0.95, PINK_JP);
  sakura(0.4, -19.4, 0.9, PINK_JP);
  toro(0.4, -12.2);
  toro(2.6, -15.9);
  for (let i = 0; i < 9; i++) {
    const x = -5.9 + R(-0.5, 0.5);
    const z = -19.6 + R(-0.5, 0.5);
    const h = R(1.4, 2.4);
    box(x, 0.5 + h / 2, z, 0.1, h, 0.1, pick(['#7fb04e', '#6f9f44', '#8cbd58']), 0.05);
    box(x + 0.12, 0.5 + h - 0.2, z, 0.26, 0.06, 0.06, '#9ccc68', 0.05);
  }
  for (let i = 0; i < 30; i++) {
    const x = R(-7.4, 7.4);
    const z = R(-19.8, -6.4);
    if (isWater(x, z) || isBlocked(x, z)) continue;
    if (rng() < 0.5) flowerCluster(x, z, pick([flowerKinds[0], flowerKinds[2]]));
    else box(x, 0.6, z, 0.22, 0.2, 0.22, pick(['#6fae52', '#80bd60']), 0.1);
  }

  /* ── 丙 · 中式灯笼水乡 ── */
  const huiHouse = (cx, cz, w, d, floors, facing) => {
    const y0 = 0.5;
    const hgt = floors * 1.35;
    block(cx - w / 2 - 0.4, cz - d / 2 - 0.3, cx + w / 2 + 0.4, cz + d / 2 + 0.3);
    box(cx, y0 + 0.12, cz, w + 0.24, 0.24, d + 0.24, '#6b6760', 0.05);
    box(cx, y0 + 0.24 + hgt / 2, cz, w, hgt, d, '#ecebe6', 0.02);
    const top = y0 + 0.24 + hgt;
    for (const sz of [-1, 1]) {
      const gz = cz + sz * (d / 2 + 0.05);
      box(cx, top + 0.34, gz, w + 0.12, 0.68, 0.14, '#ecebe6', 0.02);
      box(cx, top + 0.84, gz, w * 0.56, 0.34, 0.14, '#ecebe6', 0.02);
      box(cx, top + 1.04, gz, w * 0.56 + 0.2, 0.08, 0.3, '#2f333a', 0.03);
      box(cx - w * 0.38, top + 0.72, gz, w * 0.24 + 0.18, 0.08, 0.3, '#2f333a', 0.03);
      box(cx + w * 0.38, top + 0.72, gz, w * 0.24 + 0.18, 0.08, 0.3, '#2f333a', 0.03);
    }
    for (let i = 0; i < 4; i++) {
      const width = w + 0.72 - i * 0.62;
      if (width < 0.3) break;
      box(cx, top + 0.1 + i * 0.22, cz, width, 0.2, d + 0.2, i % 2 ? '#3b4048' : '#33373e', 0.05);
    }
    box(cx, top + 0.98, cz, 0.3, 0.14, d + 0.36, '#2a2d33', 0.03);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(cx + sx * (w / 2 + 0.34), top + 0.22, cz + sz * (d / 2 + 0.06), 0.22, 0.14, 0.22, '#2a2d33', 0.03);
    const fx = cx + facing * (w / 2 + 0.03);
    box(fx, y0 + 0.24 + 0.62, cz, 0.06, 1.24, 0.94, '#5e2f1c', 0.03);
    gbox('warm', fx + facing * 0.01, y0 + 0.24 + 0.62, cz, 0.05, 1.06, 0.72, '#ffb65c');
    halo(fx + facing * 0.25, y0 + 0.9, cz, 1.2, 1.4, '#ffb65c', 0.55, 1.0, 0);
    for (let f = 0; f < floors; f++) {
      for (const oz of [-d * 0.32, d * 0.32]) {
        const wy = y0 + 0.24 + (f === 0 ? 1.0 : 1.35 * f + 0.75);
        if (f === 0 && Math.abs(oz) < 0.6) continue;
        box(fx, wy, cz + oz, 0.07, 0.54, 0.52, '#6d3a22', 0.03);
        gbox('warm', fx + facing * 0.015, wy, cz + oz, 0.05, 0.4, 0.38, '#ffc27a');
      }
    }
    if (floors > 1) {
      box(fx + facing * 0.3, y0 + 0.24 + 1.35, cz, 0.5, 0.08, d * 0.9, '#6d3a22', 0.04);
      box(fx + facing * 0.52, y0 + 0.24 + 1.58, cz, 0.06, 0.34, d * 0.9, '#7a4428', 0.04);
    }
    const eave = top - 0.02;
    const lanternX = cx + facing * (w / 2 + 0.36);
    redLantern(lanternX, eave, cz - d * 0.3, Math.abs(lanternX) < 3.2 ? lanternX * 0.45 : null);
    redLantern(lanternX, eave, cz + d * 0.3, Math.abs(lanternX) < 3.2 ? lanternX * 0.45 : null);
    hot('house', cx, y0 + hgt / 2 + 0.4, cz, w / 2, hgt / 2 + 0.5, d / 2);
  };
  huiHouse(-4.4, -26.0, 2.8, 3.0, 1, 1);
  huiHouse(4.2, -30.6, 3.0, 3.2, 2, -1);
  huiHouse(-4.7, -32.4, 2.8, 2.8, 1, 1);
  huiHouse(4.4, -24.2, 2.6, 2.6, 1, -1);
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = -2.5 + 5.0 * t;
    const h = 0.6 + Math.sin(Math.PI * t) * 0.95;
    box(x, h, -28.4, 0.38, 0.16, 1.3, pick(['#6b6660', '#77726b', '#5f5b56']), 0.05);
    box(x, h + 0.2, -29.02, 0.36, 0.26, 0.1, '#5a5650', 0.04);
    box(x, h + 0.2, -27.78, 0.36, 0.26, 0.1, '#5a5650', 0.04);
    if (t < 0.2 || t > 0.8) box(x, 0.3 + h / 2, -28.4, 0.38, h, 1.3, '#66615b', 0.05);
    else box(x, h - 0.3, -28.4, 0.38, 0.28, 1.3, '#57534e', 0.05);
  }
  const willow = (x, z) => {
    for (let i = 0; i < 5; i++) box(x, 0.5 + 0.32 * (i + 0.5), z, 0.3, 0.34, 0.3, '#5a4530', 0.05);
    const cy = 2.35;
    for (let i = 0; i < 40; i++) {
      const a = R(0, Math.PI * 2);
      const r = Math.sqrt(rng()) * 1.35;
      box(x + Math.cos(a) * r, cy + R(-0.25, 0.3), z + Math.sin(a) * r, R(0.3, 0.44), 0.26, R(0.3, 0.44), pick(['#9fb84a', '#8aa63c', '#b3c85c', '#a6bf52']), 0.05);
    }
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + R(-0.1, 0.1);
      const r = R(0.95, 1.4);
      const hx = x + Math.cos(a) * r;
      const hz = z + Math.sin(a) * r;
      const len = Math.floor(R(4, 8));
      for (let k = 0; k < len; k++) box(hx, cy - 0.22 - k * 0.2, hz, 0.1, 0.2, 0.1, k % 2 ? '#a9c24e' : '#93ad3e', 0.08);
    }
    hot('willow', x, 2.0, z, 1.45, 1.2, 1.45);
    block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  };
  willow(-2.3, -23.2);
  willow(2.4, -26.6);
  willow(-2.2, -34.0);
  for (const z of [-22.8, -26.2, -31.0, -34.2]) {
    stoneLamp(-1.75, z, true);
    stoneLamp(1.75, z, true);
  }
  box(0, 2.5, -24.3, 5.8, 0.03, 0.03, '#2a1c16', 0);
  for (let i = 0; i < 5; i++) redLantern(-2.2 + i * 1.1, 2.46 - Math.sin((i / 4) * Math.PI) * 0.18, -24.3, -2.2 + i * 1.1);
  const pads = [[-0.5, -23.6], [0.6, -25.6], [-0.3, -30.6], [0.5, -32.6], [-0.6, -34.0], [0.2, -22.3]];
  const lotusPads = pads;
  pads.forEach(([x, z], i) => {
    box(x, 0.35, z, 0.5, 0.04, 0.5, pick(['#4f8a4a', '#5a9650', '#467e42']), 0.05);
    if (i % 2 === 0) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        box(x + Math.cos(a) * 0.1, 0.46, z + Math.sin(a) * 0.1, 0.1, 0.14, 0.1, pick(['#f3a7c0', '#f6bfd0', '#ee96b4']), 0.04);
      }
      box(x, 0.47, z, 0.08, 0.06, 0.08, '#f6d96a', 0);
      halo(x, 0.55, z, 0.7, 0.7, '#ffb0c8', 0.35, 1.0, 2);
    }
  });

  /* ── 丁 · 星空浮岛 ── */
  for (let x = -1.6; x <= 1.6; x += TILE) box(x, 0.35, -37.2, TILE, 0.3, 1.2, pick(BANK[2]), 0.06);
  const islandTop = 2.9;
  const floatIsland = (cx, cy, cz, r, main = false) => {
    for (let x = -r; x <= r + 0.001; x += TILE) {
      for (let z = -r; z <= r + 0.001; z += TILE) {
        const radius = Math.hypot(x, z);
        if (radius > r + R(-0.2, 0.2)) continue;
        const edge = radius > r - 0.48;
        const scale = edge ? R(0.92, 1.04) : 1;
        const driftX = edge ? R(-0.045, 0.045) : 0;
        const driftZ = edge ? R(-0.045, 0.045) : 0;
        box(cx + x + driftX, cy - 0.12, cz + z + driftZ, TILE * scale, 0.24, TILE * scale, pick(GRASS[3]), 0.1);
        if (rng() < 0.05) gbox('magic', cx + x + R(-0.15, 0.15), cy + 0.05, cz + z + R(-0.15, 0.15), 0.06, 0.06, 0.06, pick(['#7fffd4', '#b98cff']));
      }
    }
    const layers = Math.max(3, Math.round(r * 1.5));
    for (let k = 1; k <= layers; k++) {
      const rk = r * (1 - k / (layers + 0.8));
      const y = cy - 0.24 - k * 0.42 + 0.21;
      const shade = ['#3d3a54', '#36334c', '#2f2c44', '#29263c'][Math.min(3, Math.floor((k / layers) * 4))];
      for (let x = -rk; x <= rk + 0.001; x += TILE) {
        for (let z = -rk; z <= rk + 0.001; z += TILE) {
          const radius = Math.hypot(x, z);
          if (radius > rk + R(-0.25, 0.1)) continue;
          const edge = radius > rk - 0.42;
          const scale = edge ? R(0.9, 1.05) : 1;
          const driftX = edge ? R(-0.05, 0.05) : 0;
          const driftZ = edge ? R(-0.05, 0.05) : 0;
          const layerHeight = 0.38 + R(-0.025, 0.055);
          box(cx + x + driftX, y, cz + z + driftZ, TILE * scale, layerHeight, TILE * scale, shade, 0.08);
        }
      }
    }
    const roots = main ? 16 : Math.round(r * 3);
    for (let i = 0; i < roots; i++) {
      const a = R(0, Math.PI * 2);
      const rr = R(0.2, r * 0.6);
      const x = cx + Math.cos(a) * rr;
      const z = cz + Math.sin(a) * rr;
      const startY = cy - 0.24 - layers * 0.42 * (rr / r < 0.3 ? 1 : 0.7);
      const len = Math.floor(R(2, 5));
      for (let k = 0; k < len; k++) box(x, startY - k * 0.2, z, 0.08, 0.2, 0.08, '#4a3c2a', 0.08);
      if (rng() < 0.6) gbox('magic', x, startY - len * 0.2, z, 0.08, 0.1, 0.08, '#7ae8ff');
    }
  };
  floatIsland(0, islandTop, -45, 4.0, true);
  const purpleTree = (x, y, z, size) => {
    for (let i = 0; i < 6; i++) box(x + (i > 3 ? 0.08 : 0), y + 0.4 * (i + 0.5), z, 0.5 * size, 0.42, 0.5 * size, i % 2 ? '#3b2a3a' : '#33243a', 0.05);
    box(x + 0.6, y + 2.0, z, 0.9, 0.18, 0.18, '#3b2a3a', 0.04);
    box(x - 0.55, y + 2.2, z + 0.2, 0.8, 0.16, 0.16, '#33243a', 0.04);
    const cy = y + 2.8 * size;
    const lr = localRng(x, z, 23);
    const lR = (a, b) => a + (b - a) * lr();
    const lpick = (list) => list[Math.floor(lr() * list.length)];
    const n = Math.round(112 * size * 0.85);
    for (let i = 0; i < n; i++) {
      let u;
      let v;
      let w;
      do {
        u = lR(-1, 1);
        v = lR(-1, 1);
        w = lR(-1, 1);
      } while (u * u + v * v + w * w > 1);
      const radial = Math.min(1, Math.hypot(u, w));
      const density = 0.55 + (1 - radial) * 0.45;
      const keep = lr() <= density;
      const s = lR(0.22, 0.4) * size * (1.04 - radial * 0.2);
      const px = x + u * 1.8 * size;
      const py = cy + v * 0.95 * size;
      const pz = z + w * 1.8 * size;
      const magic = lr() < 0.2;
      const magicColor = lpick(['#c090ff', '#d6a8ff', '#a878f0']);
      const leafColor = lpick(['#8a4fd6', '#9e62e6', '#b07af0', '#6f3cc0']);
      if (!keep) continue;
      if (lite && i % 3 === 2) continue;
      if (magic) gbox('magic', px, py, pz, s, s * 0.9, s, magicColor);
      else box(px, py, pz, s, s * 0.9, s, leafColor, 0.05);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + R(-0.2, 0.2);
      const r = R(0.8, 1.6) * size;
      const hx = x + Math.cos(a) * r;
      const hz = z + Math.sin(a) * r;
      const topY = cy - 0.7 * size;
      const len = R(0.4, 1.0);
      box(hx, topY - len / 2, hz, 0.025, len, 0.025, '#2a2240', 0);
      gbox('magic', hx, topY - len - 0.1, hz, 0.14, 0.2, 0.14, pick(['#7ae8ff', '#a8f0ff']));
      halo(hx, topY - len - 0.1, hz, 0.9, 0.9, '#8ae8ff', 0.8, 0.9, 2);
    }
    halo(x, cy, z, 5.5, 4.2, '#b98cff', 0.35, 0.9, 2);
    hot('tree', x, cy, z, 1.9 * size, 1.1 * size, 1.9 * size, { tint: [0.78, 0.6, 1.0] });
  };
  purpleTree(-1.4, islandTop, -46.4, 1.3);
  const crystal = (x, y, z, s = 1) => {
    for (let i = 0; i < 5; i++) {
      const h = R(0.35, 0.85) * s;
      gbox('magic', x + R(-0.2, 0.2) * s, y + h / 2, z + R(-0.2, 0.2) * s, 0.12 * s, h, 0.12 * s, pick(['#6fd6ff', '#8ee6ff', '#5ac0f0', '#a8f0ff']));
    }
    halo(x, y + 0.45 * s, z, 1.8 * s, 1.8 * s, '#6fd6ff', 0.85, 0.8, 2);
    hot('crystal', x, y + 0.45 * s, z, 0.45 * s, 0.55 * s, 0.45 * s);
  };
  crystal(-3.0, islandTop, -44.0, 1.1);
  crystal(2.8, islandTop, -43.6, 0.9);
  crystal(-0.8, islandTop, -48.2, 1.0);
  crystal(-2.6, islandTop, -47.6, 0.8);
  const starCottage = (cx, y0, cz) => {
    box(cx, y0 + 0.72, cz, 2.0, 1.44, 1.7, '#57536e', 0.08);
    for (let i = 0; i < 14; i++) box(cx + R(-0.95, 0.95), y0 + R(0.2, 1.3), cz + 0.86, R(0.2, 0.36), R(0.14, 0.22), 0.04, pick(['#4a4660', '#625e7a']), 0.05);
    glowWindow(cx - 0.45, y0 + 0.85, cz + 0.87, 0.52, 0.6);
    glowWindow(cx + 0.5, y0 + 0.85, cz + 0.87, 0.4, 0.5);
    glowWindow(cx + 1.01, y0 + 0.85, cz, 0.5, 0.5, true);
    box(cx - 0.45, y0 + 0.85, cz + 0.9, 0.06, 0.6, 0.04, '#3a3450', 0);
    for (let i = 0; i < 4; i++) {
      const depth = 2.1 - i * 0.5;
      box(cx, y0 + 1.56 + i * 0.24, cz, 2.4, 0.22, depth, i % 2 ? '#2e3352' : '#262a46', 0.05);
    }
    box(cx + 0.6, y0 + 2.4, cz - 0.4, 0.34, 0.8, 0.34, '#4a4660', 0.05);
    gbox('warm', cx + 0.4, y0 + 1.0, cz + 1.05, 0.12, 0.16, 0.12, '#ffd48a');
    halo(cx + 0.4, y0 + 1.0, cz + 1.2, 0.9, 0.9, '#ffd48a', 0.9, 0.8, 0);
    hot('house', cx, y0 + 1.1, cz, 1.0, 1.2, 0.85);
    return [cx + 0.6, y0 + 2.85, cz - 0.4];
  };
  const starChimney = starCottage(2.1, islandTop, -46.6);
  for (let i = 0; i < 22; i++) {
    const a = R(0, Math.PI * 2);
    const r = R(0.8, 3.6);
    const x = Math.cos(a) * r;
    const z = -45 + Math.sin(a) * r;
    if (Math.abs(x + 1.4) < 0.7 && Math.abs(z + 46.4) < 0.7) continue;
    if (x > 1.0 && x < 3.2 && z < -45.6 && z > -47.6) continue;
    box(x, islandTop + 0.06, z, 0.2, 0.12, 0.2, '#3c6a54', 0.1);
    gbox('magic', x, islandTop + 0.18, z, 0.1, 0.1, 0.1, pick(['#c89aff', '#e0b8ff', '#9ad8ff']));
  }
  const ropeFrom = [0, 0.62, -37.6];
  const ropeTo = [0, islandTop + 0.05, -41.2];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const x = mix(ropeFrom[0], ropeTo[0], t);
    const y = mix(ropeFrom[1], ropeTo[1], t) - Math.sin(Math.PI * t) * 0.45;
    const z = mix(ropeFrom[2], ropeTo[2], t);
    box(x, y, z, 1.0, 0.06, 0.16, pick(['#8a6440', '#7a5636', '#94704a']), 0.05);
    box(x - 0.52, y + 0.34, z, 0.03, 0.03, 0.2, '#c9b08a', 0);
    box(x + 0.52, y + 0.34, z, 0.03, 0.03, 0.2, '#c9b08a', 0);
    if (i % 6 === 3) {
      for (const sx of [-0.55, 0.55]) {
        box(sx, y + 0.3, z, 0.08, 0.6, 0.08, '#6a4a30', 0);
        gbox('warm', sx, y + 0.66, z, 0.14, 0.16, 0.14, '#ffc978');
        halo(sx, y + 0.66, z, 1.0, 1.0, '#ffb760', 0.85, 1.0, 0);
      }
    }
  }
  [[-9, 4.8, -48, 1.6], [9.5, 6.2, -51, 1.8], [-5.5, 7.8, -57, 1.3], [6.5, 3.6, -40.5, 1.2], [-12.5, 3.0, -41, 1.4], [13.5, 8.8, -60, 2.0]]
    .forEach(([x, y, z, r], i) => {
      floatIsland(x, y, z, r);
      if (i % 2 === 0) crystal(x + 0.3, y, z - 0.2, 0.7);
      else {
        box(x, y + 0.5, z, 0.22, 1.0, 0.22, '#33243a', 0.05);
        for (let k = 0; k < 18; k++) {
          const s = R(0.3, 0.44);
          const px = x + R(-0.8, 0.8);
          const py = y + 1.25 + R(-0.35, 0.35);
          const pz = z + R(-0.8, 0.8);
          if (k % 4 === 0) gbox('magic', px, py, pz, s, s, s, '#c090ff');
          else box(px, py, pz, s, s, s, pick(['#8a4fd6', '#9e62e6', '#b07af0']), 0.05);
        }
        halo(x, y + 1.3, z, 3.2, 2.6, '#b98cff', 0.3, 0.9, 2);
      }
      gbox('warm', x - 0.4, y + 0.2, z + 0.5, 0.12, 0.14, 0.12, '#ffc978');
      halo(x - 0.4, y + 0.2, z + 0.5, 0.8, 0.8, '#ffb760', 0.7, 1.0, 0);
    });

  /* ── 远处的山丘：白天围着花园和樱花河 ── */
  [[-13, -4, 4.2, 3.6], [13, -2, 3.8, 3.2], [-15, -14, 4.6, 4.2], [14.5, -16, 4.0, 3.8], [-11.5, 8, 3.2, 2.6], [11.5, 7.5, 3.4, 2.8], [-14, -26, 3.8, 3.4], [14, -28, 3.6, 3.0]]
    .forEach(([hx, hz, r, height], idx) => {
      for (let x = -r; x <= r; x += 1) {
        for (let z = -r; z <= r; z += 1) {
          const d = Math.hypot(x, z) / r;
          if (d > 1) continue;
          const h = Math.max(0.6, height * (1 - d * d) + R(-0.3, 0.3));
          const zone = zoneOf(hz + z);
          box(hx + x, h / 2 - 0.1, hz + z, 1, h, 1, pick(['#8f7a60', '#7f6b52']), 0.05);
          box(hx + x, h - 0.05, hz + z, 1, 0.3, 1, pick(GRASS[Math.min(2, zone)]), 0.1);
          if (rng() < 0.12 && d < 0.8) {
            const s = R(0.5, 0.9);
            box(hx + x, h + 0.2 + s / 2, hz + z, s, s, s, idx % 3 === 0 ? pick(PINK_JP.main) : pick(['#5f9a4e', '#6fae58', '#4f8a44']), 0.06);
          }
        }
      }
    });

  /* ── 戊 · 北岸「杨思校园」：军训合唱的操场、开学第二周见的校门、每节体育课一起走的跑道 ──
     这一块放在最后搭，前面的随机流一格没动，小岛还是原来那座小岛。 */
  const CAMPUS = { z0: 16, z1: 46, half: 12, mid: 31, gateZ: 33, stageZ: 21.5, trackZ: 40 };
  const trackR = { x: 8.6, z: 5.6 };
  const trackRing = (x, z) => {
    const d = Math.hypot((x - 0) / trackR.x, (z - CAMPUS.trackZ) / trackR.z);
    return d > 0.74 && d < 1.0;
  };
  /* 泥土底座整块一块，表层按 1 米铺，省下两千个方块 */
  box(0, -0.62, (CAMPUS.z0 + CAMPUS.z1) / 2, 25.5, 1.8, CAMPUS.z1 - CAMPUS.z0 + 1.2, '#6f5544', 0.02);
  const CAMPUS_GRASS = ['#a9d47c', '#9ecb72', '#b2da86', '#a3cf78'];
  const CAMPUS_PAVE = ['#c9c3b6', '#bdb7aa', '#d2ccc0'];
  const TRACK = ['#c8665c', '#bd5d54', '#d07066'];
  const PLAZA = ['#b9b3a6', '#c4beb1', '#aea89c'];
  for (let x = -12; x < 12; x += 1) {
    for (let z = CAMPUS.z0; z < CAMPUS.z1; z += 1) {
      const onTrack = trackRing(x + 0.5, z + 0.5);
      const inField = Math.hypot((x + 0.5) / trackR.x, (z + 0.5 - CAMPUS.trackZ) / trackR.z) <= 0.74;
      const onRoad = Math.abs(x + 0.5) < 2 && z > CAMPUS.gateZ + 1;
      const onPlaza = Math.abs(x + 0.5) < 8 && z > CAMPUS.z0 + 1 && z < CAMPUS.stageZ + 3;
      let color;
      if (onTrack) color = pick(TRACK);
      else if (inField) color = pick(CAMPUS_GRASS);
      else if (onRoad) color = pick(PLAZA);
      else if (onPlaza) color = pick(CAMPUS_PAVE);
      else color = pick(CAMPUS_GRASS);
      const top = 0.5 + ((x * 3 + z * 5) % 3) * 0.012;
      box(x + 0.5, top / 2, z + 0.5, 1, top, 1, color, 0.06);
    }
  }
  /* 跑道白线 */
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const lx = Math.cos(a) * trackR.x * 0.86;
    const lz = CAMPUS.trackZ + Math.sin(a) * trackR.z * 0.86;
    box(lx, 0.53, lz, 0.14, 0.06, 0.14, '#f2ece0', 0);
  }
  /* 与主岛之间的一段木栈道 */
  for (let z = 6.6; z <= CAMPUS.z0; z += 0.62) {
    const sag = Math.sin(((z - 6.6) / (CAMPUS.z0 - 6.6)) * Math.PI) * 0.12;
    box(0.4, 0.62 + sag, z, 3.0, 0.14, 0.52, '#b08a58', 0.03);
    box(0.4, 0.36 + sag, z, 3.0, 0.1, 0.12, '#8f6f46', 0.02);
  }
  for (let z = 7.0; z <= CAMPUS.z0; z += 1.9) {
    box(-1.05, 0.34, z, 0.16, 1.3, 0.16, '#8f6f46', 0.02);
    box(1.85, 0.34, z, 0.16, 1.3, 0.16, '#8f6f46', 0.02);
  }
  /* 校门口：两根门柱 + 横梁 + 校名牌 */
  const textTexture = (lines, opts = {}) => {
    const { w = 640, h = 256, bg = '#f3ece0', color = '#3c4a55', font = '700 120px "Songti SC","Noto Serif SC",serif', frame = '#8a7a62' } = opts;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    if (frame) {
      g.strokeStyle = frame;
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
    }
    g.fillStyle = color;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const step = h / (lines.length + 1);
    lines.forEach((t, i) => g.fillText(t, w / 2, step * (i + 1)));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  const plate = (tex, w, h, x, y, z, rotY = Math.PI) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);
    return mesh;
  };
  const gateX = 3.1;
  [-1, 1].forEach((side) => {
    box(side * gateX, 1.75, CAMPUS.gateZ, 1.1, 3.5, 1.1, '#e6dcc4', 0.04);
    box(side * gateX, 3.62, CAMPUS.gateZ, 1.5, 0.34, 1.5, '#8a755c', 0.04);
    box(side * gateX, 0.3, CAMPUS.gateZ, 1.8, 0.6, 1.8, '#b9a98c', 0.04);
  });
  box(0, 3.42, CAMPUS.gateZ, gateX * 2 + 1.3, 0.62, 0.9, '#cbb896', 0.04);
  box(0, 3.05, CAMPUS.gateZ, gateX * 2 + 1.3, 0.2, 1.05, '#a48c6c', 0.03);
  plate(textTexture(['上海 · 杨思高级中学']), 4.8, 1.1, 0, 2.42, CAMPUS.gateZ - 0.6);
  hot('gate', 0, 2.5, CAMPUS.gateZ, 5.4, 1.6, 0.9);
  /* 合唱台：木台、黑板、麦克风、音箱、台下坐着的一排排同学 */
  const SHIRTS = ['#dfe3ea', '#c9d6c0', '#e6d6c0', '#cfd0e6', '#e2cdd8', '#d5e2e6'];
  const voxelPerson = (x, y, z, shirt, hair = '#2c2622', h = 1.0) => {
    box(x, y + h * 0.16, z, 0.34, h * 0.3, 0.26, '#4a4550', 0.03);
    box(x, y + h * 0.5, z, 0.42, h * 0.42, 0.3, shirt, 0.04);
    box(x, y + h * 0.84, z, 0.32, h * 0.3, 0.3, '#f0d2b6', 0.03);
    box(x, y + h * 0.99, z, 0.36, h * 0.14, 0.34, hair, 0.03);
  };
  box(0.4, 0.68, CAMPUS.stageZ, 10.4, 0.5, 4.6, '#a9835a', 0.03);
  box(0.4, 0.45, CAMPUS.stageZ, 10.8, 0.24, 5.0, '#8b6a48', 0.03);
  box(0.4, 1.5, CAMPUS.stageZ + 2.5, 10.4, 2.0, 0.3, '#8f6f4c', 0.04);
  const boardPlate = plate(textTexture(['说了再见'], { w: 768, h: 320, bg: '#2b3a36', color: '#f4efe2', frame: '#7a6242' }), 5.4, 2.25, 0.4, 2.0, CAMPUS.stageZ + 2.3);
  hot('blackboard', 0.4, 2.0, CAMPUS.stageZ + 2.3, 3.0, 1.3, 0.5);
  [-4.4, 5.2].forEach((x) => {
    box(x, 1.85, CAMPUS.stageZ + 2.1, 1.2, 2.3, 1.0, '#3b3a42', 0.03);
    box(x, 3.15, CAMPUS.stageZ + 2.1, 1.34, 0.24, 1.1, '#2b2a31', 0.03);
  });
  /* 舞台灯：暖光柱，夜里也会亮 */
  [-5.2, 6.0].forEach((x) => {
    box(x, 2.5, CAMPUS.stageZ + 1.2, 0.2, 3.4, 0.2, '#4a4450', 0.02);
    gbox('warm', x, 4.25, CAMPUS.stageZ + 1.0, 0.5, 0.5, 0.5, '#ffe6b0');
    halo(x, 4.25, CAMPUS.stageZ + 1.0, 2.2, 2.2, '#ffd98a', 0.8, 0.7, 0);
  });
  /* 麦克风架：那天他一个人站在这里 */
  box(0.4, 1.3, CAMPUS.stageZ - 0.7, 0.12, 1.3, 0.12, '#3a3742', 0.02);
  box(0.4, 1.98, CAMPUS.stageZ - 0.7, 0.24, 0.26, 0.24, '#c8a0a8', 0.02);
  box(0.4, 0.78, CAMPUS.stageZ - 0.7, 0.7, 0.1, 0.7, '#3a3742', 0.02);
  hot('microphone', 0.4, 1.7, CAMPUS.stageZ - 0.7, 0.5, 0.7, 0.5);
  /* 台下的同学：三排，坐得比站着的人矮一半 */
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) {
      const x = -6.4 + i * 1.6;
      const z = CAMPUS.z0 + 1.6 + row * 1.5;
      if (Math.abs(x - 0.4) < 1.4) continue;
      voxelPerson(x, 0.5, z, pick(SHIRTS), pick(['#2c2622', '#3a2c24', '#241f22']), 0.72);
    }
  }
  /* 操场：看台、单双杠、角落的树 */
  for (let i = 0; i < 4; i++) {
    box(10.4, 0.5 + i * 0.38, CAMPUS.trackZ, 2.6, 0.38, 9.0 - i * 0.4, i % 2 ? '#c9c3b6' : '#d6d0c3', 0.04);
  }
  [-8.6, 8.6].forEach((x) => {
    box(x, 1.0, CAMPUS.trackZ - 6.6, 0.18, 2.0, 0.18, '#cfd3d6', 0.02);
    box(x + 0.9, 0.62, CAMPUS.trackZ - 6.2, 0.18, 1.3, 0.18, '#cfd3d6', 0.02);
    box(x + 0.45, 1.55, CAMPUS.trackZ - 6.4, 1.1, 0.14, 0.16, '#b9bec2', 0.02);
  });
  sakura(-10.6, CAMPUS.z0 + 2.2, 1.15, PINK_CREAM);
  sakura(10.8, CAMPUS.z0 + 3.4, 1.0, PINK_JP);
  sakura(-10.4, CAMPUS.z1 - 3.2, 1.25, PINK_CREAM);
  for (let i = 0; i < 26; i++) {
    const x = R(-11.4, 11.4);
    const z = R(CAMPUS.z0 + 0.6, CAMPUS.z1 - 1.2);
    if (trackRing(x, z) || Math.abs(x) < 2.4) continue;
    if (rng() < 0.5) flowerCluster(x, z, pick(flowerKinds), 0.5);
    else box(x, 0.62, z, 0.3, 0.24, 0.3, pick(['#8fc46a', '#9ed075', '#7fb85e']), 0.06);
  }
  /* 飞过的鸟：一个实例网格，两只翅膀 */
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x5a5468 });
  const birdGeo = new THREE.BoxGeometry(0.55, 0.07, 0.17);
  const birdMesh = new THREE.InstancedMesh(birdGeo, birdMat, 18);
  birdMesh.frustumCulled = false;
  scene.add(birdMesh);

  /* 台上的两个人：他先站着，她按下「一起把这首唱完」才从台下走上来 */
  const actor = (cloth, hair, skirt = false) => {
    const g = new THREE.Group();
    const add = (w, h, d, y, z, c) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
      m.position.set(0, y, z);
      g.add(m);
      return m;
    };
    add(0.42, 0.24, 0.3, 0.12, 0, 0x4a4550);
    add(skirt ? 0.5 : 0.44, 0.5, 0.32, 0.48, 0, cloth);
    add(0.34, 0.34, 0.32, 0.9, 0, 0xf0d2b6);
    add(0.38, 0.16, 0.36, 1.12, 0, hair);
    if (skirt) add(0.3, 0.32, 0.08, 0.84, 0.19, hair);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = !lite; o.receiveShadow = !lite; } });
    scene.add(g);
    return g;
  };
  const stageHim = actor(0x3d4a6a, 0x221c1a);
  stageHim.position.set(0.4, 0.93, CAMPUS.stageZ - 0.7);
  const stageHer = actor(0xf2a7bc, 0x3a2626, true);
  stageHer.position.set(-3.4, 0.5, CAMPUS.z0 + 3.2);
  stageHer.visible = false;
  /* 跑道上的两个人：每节体育课一起走的那两个 */
  const trackHim = actor(0x46587a, 0x2a2320);
  const trackHer = actor(0xe8a8bc, 0x3a2626, true);
  trackHim.visible = false;
  trackHer.visible = false;

  /* 飞过的鸟 */
  const birdCfg = Array.from({ length: 9 }, (_, i) => ({
    phase: (i * 2.17) % (Math.PI * 2),
    r: 14 + (i % 3) * 4.5,
    y: 13 + (i % 4) * 1.4,
    speed: 0.16 + (i % 4) * 0.03,
    cx: i % 2 ? 4 : -3,
    cz: i % 2 ? CAMPUS.z1 - 6 : CAMPUS.z0 + 6,
  }));
  const birdDummy = new THREE.Object3D();
  let birdT = 0;

  /* ── 做成实例网格：共用一张颗粒纹理，局部坐标采样，避免世界缩放拉成条纹 ── */
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 64;
  {
    const g = grainCanvas.getContext('2d');
    const img = g.createImageData(64, 64);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rng() * 255) | 0;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  const grainTex = new THREE.CanvasTexture(grainCanvas);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.magFilter = THREE.LinearFilter;
  grainTex.minFilter = THREE.LinearMipmapLinearFilter;
  grainTex.generateMipmaps = true;
  grainTex.colorSpace = THREE.NoColorSpace;
  grainTex.needsUpdate = true;
  const withGrain = (material, amount = 0.08, faceTone = false) => {
    const vertexVarying = faceTone ? 'varying vec3 vGrainNormal;\n' : '';
    const vertexFace = faceTone ? '\n          vGrainNormal = normal;' : '';
    const fragmentVarying = faceTone ? 'varying vec3 vGrainNormal;\n' : '';
    const fragmentFace = faceTone ? `
          float topFace = max(vGrainNormal.y, 0.0);
          vec3 faceTint = mix(vec3(0.97, 0.98, 1.0), vec3(1.045, 1.025, 0.99), topFace);
          diffuseColor.rgb *= mix(vec3(1.0), faceTint, 0.5);` : '';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGrainAmt = { value: amount };
      shader.vertexShader = `varying vec3 vGrainPos;\n${vertexVarying}${shader.vertexShader}`
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vGrainPos = position;
          #ifdef USE_INSTANCING
            vGrainPos = (instanceMatrix * vec4(position, 1.0)).xyz;
          #endif${vertexFace}`
        );
      shader.fragmentShader = `uniform float uGrainAmt;\n${fragmentVarying}varying vec3 vGrainPos;\n${shader.fragmentShader}`
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 cell = floor(vGrainPos * 3.2);
          vec3 local = fract(vGrainPos * 3.2);
          local = local * local * (3.0 - 2.0 * local);
          float hash0 = fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float hash1 = fract(sin(dot(cell + vec3(1.0, 0.0, 0.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float hash2 = fract(sin(dot(cell + vec3(0.0, 1.0, 0.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float hash3 = fract(sin(dot(cell + vec3(1.0, 1.0, 0.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          float low = mix(mix(hash0, hash1, local.x), mix(hash2, hash3, local.x), local.y);
          float grain = mix(0.965, 1.035, low);
          diffuseColor.rgb *= mix(1.0, grain, uGrainAmt);${fragmentFace}`
        );
    };
    material.customProgramCacheKey = () => `grain-world-${amount}-${faceTone ? 'faces' : 'plain'}`;
    return material;
  };
  const instanced = (list, material) => {
    const mesh = new THREE.InstancedMesh(cube, material, Math.max(1, list.length));
    list.forEach((b, i) => {
      tmpPos.set(b[0], b[1], b[2]);
      tmpScale.set(b[3], b[4], b[5]);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
      tmpColor.set(b[6]);
      if (b[7]) tmpColor.multiplyScalar(1 + (rng() - 0.5) * b[7] * 2);
      mesh.setColorAt(i, tmpColor);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  };
  /* 分区：镜头往往只看着岛的一角，切成四块才能真正剔掉看不见的部分 */
  const REGIONS = ['campus', 'garden', 'town', 'stars'];
  const regionOf = (z) => (z > 8 ? 'campus' : z > -6 ? 'garden' : z > -34.5 ? 'town' : 'stars');
  const litMat = withGrain(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.14, true);
  const litBuckets = { campus: [], garden: [], town: [], stars: [] };
  for (const b of lit) litBuckets[regionOf(b[2])].push(b);
  for (const id of REGIONS) {
    const list = litBuckets[id];
    if (!list.length) continue;
    const mesh = instanced(list, litMat);
    /* InstancedMesh 的包围球按实例算，所以这里可以放心打开剔除 */
    mesh.frustumCulled = true;
    mesh.castShadow = !lite;
    mesh.receiveShadow = !lite;
    mesh.name = `lit-${id}`;
  }
  const warmMat = withGrain(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.06);
  const magicMat = withGrain(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.07);
  instanced(glow.warm, warmMat);
  instanced(glow.magic, magicMat);

  /* ── 天空：渐变、银河、极光、日月 ── */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Vector3() },
        uMid: { value: new THREE.Vector3() },
        uHorizon: { value: new THREE.Vector3() },
        uNight: { value: 0 },
        uDay: { value: 1 },
        uAurora: { value: 0.4 },
        uTime: { value: 0 },
        uMoon: { value: new THREE.Vector3(...MOON_POS).normalize() },
        uSun: { value: new THREE.Vector3(-0.42, 0.3, -0.86).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDir = world.xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith, uMid, uHorizon, uMoon, uSun;
        uniform float uNight, uDay, uAurora, uTime;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        float noise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y * 0.62 + 0.1, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.38, h));
          col = mix(col, uZenith, smoothstep(0.3, 0.95, h));
          float band = exp(-pow((dir.x * 0.32 + dir.y * 0.9 - 0.2) / 0.17, 2.0));
          float n1 = noise(dir * 5.2 + vec3(uTime * 0.01, 0.0, 0.0));
          float n2 = noise(dir * 15.0);
          col += (vec3(0.42, 0.34, 0.8) * (0.25 + 0.75 * n1) + vec3(0.8, 0.5, 0.7) * n2 * 0.25) * band * uNight * 0.9;
          float aBand = smoothstep(0.02, 0.2, dir.y) * (1.0 - smoothstep(0.26, 0.62, dir.y));
          float wave = sin(dir.x * 5.5 + uTime * 0.22 + sin(dir.z * 3.1 + uTime * 0.13) * 2.2);
          float curtain = pow(0.5 + 0.5 * wave, 3.0) * (0.35 + 0.65 * noise(vec3(dir.x * 9.0, dir.y * 2.0 + uTime * 0.08, dir.z * 9.0)));
          vec3 aurora = mix(vec3(0.18, 0.95, 0.72), vec3(0.62, 0.34, 0.98), smoothstep(0.12, 0.5, dir.y));
          col += aurora * aBand * curtain * uNight * uAurora * 0.75;
          float md = max(dot(dir, normalize(uMoon)), 0.0);
          col += vec3(1.0, 0.88, 0.62) * (pow(md, 36.0) * 0.6 + pow(md, 6.0) * 0.12) * uNight;
          float sd = max(dot(dir, normalize(uSun)), 0.0);
          col += vec3(1.0, 0.86, 0.7) * (pow(sd, 18.0) * 0.55 + pow(sd, 3.0) * 0.16) * uDay;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.renderOrder = -2;
  scene.add(sky);

  /* 世界搭完了：从这里开始换成细节流，星屑花瓣的多少不再影响布局 */
  activeRng = detailRng;

  const starCount = 1600;
  const starRng = mulberry32(0x5741a2);
  const starPos = new Float32Array(starCount * 3);
  const starSeed = new Float32Array(starCount * 2);
  for (let i = 0; i < starCount; i++) {
    const theta = starRng() * Math.PI * 2;
    const y = starRng() * 0.95 + 0.04;
    const ring = Math.sqrt(1 - y * y);
    const radius = 150 + starRng() * 30;
    starPos[i * 3] = Math.cos(theta) * ring * radius;
    starPos[i * 3 + 1] = y * radius - 8;
    starPos[i * 3 + 2] = Math.sin(theta) * ring * radius - 30;
    starSeed[i * 2] = starRng() * 6.28;
    starSeed[i * 2 + 1] = starRng() < 0.07 ? 2.6 + starRng() * 1.8 : 0.7 + starRng() * 1.2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 2));
  starGeo.setDrawRange(0, lite ? 700 : starCount);
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uPix: { value: 1 } },
    vertexShader: `
      attribute vec2 aSeed;
      uniform float uTime, uNight, uPix;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.5 + 0.5 * sin(uTime * (0.7 + aSeed.y * 0.2) + aSeed.x);
        vA = (0.35 + 0.65 * tw) * uNight;
        gl_PointSize = aSeed.y * (0.6 + 0.4 * tw) * 2.2 * uPix;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = dot(p, p);
        if (d > 0.25) discard;
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.9), (1.0 - smoothstep(0.0, 0.25, d)) * vA);
      }
    `,
  }));
  stars.renderOrder = -1;
  scene.add(stars);

  const radialTexture = (stops, size = 128) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.55)'], [0.55, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);

  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 256;
  const mg = moonCanvas.getContext('2d');
  mg.fillStyle = '#f7e7c4';
  mg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 2 + rng() * 16;
    mg.fillStyle = `rgba(160,130,90,${0.14 + rng() * 0.3})`;
    mg.beginPath();
    mg.arc(x, y, r, 0, Math.PI * 2);
    mg.fill();
  }
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 40, 40),
    new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false })
  );
  moon.position.set(...MOON_POS);
  scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe6b0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  moonGlow.position.set(...MOON_POS);
  moonGlow.scale.setScalar(34);
  scene.add(moonGlow);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0d8, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sunGlow.position.set(-84, 60, -170);
  sunGlow.scale.setScalar(70);
  scene.add(sunGlow);

  const cloudList = [];
  for (let c = 0; c < 12; c++) {
    const cx = R(-60, 60);
    const cy = R(11, 17);
    const cz = R(-70, 16);
    const n = Math.round(R(8, 16));
    for (let k = 0; k < n; k++) cloudList.push([cx + R(-3, 3), cy + (rng() < 0.3 ? 0.5 : 0), cz + R(-1.6, 1.6), R(1.2, 2.2), 0.55, R(1.0, 1.8), '#ffffff', 0.03]);
  }
  const cloudMat = withGrain(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), 0.08, true);
  const clouds = instanced(cloudList, cloudMat);

  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
  scene.add(hemi);

  /* 桌面给主光一张小阴影贴图：方块之间终于有真实的遮挡关系，手机端直接关掉 */
  if (!lite) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -17;
    sun.shadow.camera.right = 17;
    sun.shadow.camera.top = 17;
    sun.shadow.camera.bottom = -17;
    sun.shadow.bias = -0.0016;
    sun.shadow.normalBias = 0.06;
  }

  /* ── 水面：大到雾里看不见边；细涟漪 + 软高光；四区颜色保留 ── */
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 480, lite ? 1 : 48, lite ? 1 : 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uNight: { value: 0 },
        uLamp: { value: 0 },
        uWaveAmp: { value: lite ? 0 : 0.075 },
        uSky: { value: new THREE.Vector3() },
        uFog: { value: new THREE.Vector3() },
        uFogDensity: { value: 0.02 },
        uGrain: { value: grainTex },
      },
      vertexShader: `
        uniform float uTime, uWaveAmp;
        varying vec3 vWorld;
        varying float vDist;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          /* 起伏：给她看的不是平面照片，水面真的在动 */
          w.y += (sin(w.x * 0.26 + uTime * 1.05) * 0.5
                + sin(w.z * 0.31 - uTime * 0.86) * 0.42
                + sin((w.x + w.z) * 0.55 + uTime * 1.6) * 0.2) * uWaveAmp;
          vWorld = w.xyz;
          vec4 mv = viewMatrix * w;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime, uNight, uLamp, uFogDensity;
        uniform vec3 uSky, uFog;
        uniform sampler2D uGrain;
        varying vec3 vWorld;
        varying float vDist;
        vec3 zoneColor(float z, float k) {
          vec3 a = mix(vec3(0.36, 0.8, 0.78), vec3(0.6, 0.93, 0.89), k);
          vec3 b = mix(vec3(0.24, 0.5, 0.82), vec3(0.46, 0.72, 0.93), k);
          vec3 c = mix(vec3(0.1, 0.14, 0.22), vec3(0.24, 0.3, 0.4), k);
          vec3 d = mix(vec3(0.03, 0.05, 0.16), vec3(0.09, 0.13, 0.32), k);
          float t1 = 1.0 - smoothstep(-8.0, -4.0, z);
          float t2 = 1.0 - smoothstep(-22.0, -18.5, z);
          float t3 = 1.0 - smoothstep(-37.0, -33.0, z);
          return mix(mix(mix(a, b, t1), c, t2), d, t3);
        }
        void main() {
          vec2 xz = vWorld.xz;
          float w1 = sin(xz.x * 3.6 + uTime * 1.25) * sin(xz.y * 2.8 - uTime * 0.95);
          float w2 = sin((xz.x - xz.y) * 7.2 + uTime * 2.1) * 0.45;
          float w3 = sin(xz.x * 11.0 - xz.y * 9.5 + uTime * 2.8) * 0.22;
          float w4 = sin((xz.x + xz.y) * 18.0 + uTime * 3.4) * 0.12;
          float wave = w1 * 0.5 + w2 * 0.28 + w3 * 0.14 + w4 * 0.08;
          float k = 0.5 + 0.42 * wave;
          vec3 col = zoneColor(vWorld.z, k);
          float grain = texture2D(uGrain, xz * 0.045 + vec2(uTime * 0.008, -uTime * 0.006)).r;
          col *= mix(0.92, 1.06, grain);
          col = mix(col, uSky, 0.14 + 0.1 * (1.0 - uNight));
          float dx = cos(xz.x * 3.6 + uTime * 1.25) * sin(xz.y * 2.8 - uTime * 0.95) * 3.6
            + cos((xz.x - xz.y) * 7.2 + uTime * 2.1) * 7.2 * 0.45;
          float dz = sin(xz.x * 3.6 + uTime * 1.25) * cos(xz.y * 2.8 - uTime * 0.95) * 2.8
            - cos((xz.x - xz.y) * 7.2 + uTime * 2.1) * 7.2 * 0.45;
          vec3 nrm = normalize(vec3(-dx * 0.04, 1.0, -dz * 0.04));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          vec3 lightDir = normalize(vec3(0.35, 0.82, 0.28));
          float spec = pow(max(0.0, dot(reflect(-lightDir, nrm), viewDir)), 48.0);
           float streak = pow(max(0.0, 1.0 - abs(nrm.x * 2.2 + nrm.z * 0.6)), 14.0) * (0.55 + 0.45 * wave);
           vec3 spark = mix(vec3(0.92, 0.96, 1.0), vec3(1.0, 0.82, 0.58), uLamp);
           col += spark * (spec * (0.28 + 0.35 * uLamp) + streak * (0.045 + 0.09 * uLamp));
           float glint = pow(max(0.0, wave), 5.0);
           col += glint * spark * (0.05 + 0.08 * uLamp);
          vec2 cell = floor(xz * 6.5);
          float sp = step(0.997, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
          col += vec3(0.85, 0.88, 1.0) * sp * uNight * (0.5 + 0.5 * sin(uTime * 3.0 + cell.x));
          float f = 1.0 - exp(-pow(uFogDensity * vDist, 2.0));
          gl_FragColor = vec4(mix(col, uFog, f), 0.94);
        }
      `,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.32, -40);
  scene.add(water);

  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 2.9, 1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float s = fract(vUv.y * 5.0 + uTime * 1.6 + sin(vUv.x * 18.0) * 0.12);
          vec3 col = mix(vec3(0.46, 0.88, 0.86), vec3(0.95, 1.0, 1.0), smoothstep(0.72, 1.0, s) * 0.7);
          float edge = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
          gl_FragColor = vec4(col, 0.88 * edge);
        }
      `,
    })
  );
  fall.position.set(-5.4, 1.78, -3.3);
  scene.add(fall);

  /* ── 光晕：一张图集搞定所有灯、窗、水晶，以及水里的倒影 ── */
  const quad = new THREE.PlaneGeometry(1, 1);
  const buildBillboards = (count) => {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.instanceCount = count;
    return geo;
  };
  const haloGeo = buildBillboards(halos.length);
  const hPos = new Float32Array(halos.length * 3);
  const hSize = new Float32Array(halos.length * 2);
  const hColor = new Float32Array(halos.length * 3);
  const hMeta = new Float32Array(halos.length * 4);
  const hOrder = new Float32Array(halos.length);
  halos.forEach(([x, y, z, w, h, color, k, night, group, order], i) => {
    hPos.set([x, y, z], i * 3);
    hSize.set([w, h], i * 2);
    hColor.set(hexRGB(color), i * 3);
    hMeta.set([k, rng() * 6.28, night, group], i * 4);
    hOrder[i] = order;
  });
  haloGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(hPos, 3));
  haloGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(hSize, 2));
  haloGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(hColor, 3));
  haloGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(hMeta, 4));
  haloGeo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(hOrder, 1));
  const haloUniforms = {
    uTime: { value: 0 }, uLamp: { value: 0 }, uPulse: { value: 0 }, uHold: { value: 0 },
    uConfess: { value: 0 }, uWave: { value: -99 }, uYes: { value: 0 },
  };
  const halosMesh = new THREE.Mesh(haloGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: haloUniforms,
    vertexShader: `
      attribute vec3 aPos;
      attribute vec2 aSize;
      attribute vec3 aColor;
      attribute vec4 aMeta;
      attribute float aOrder;
      uniform float uTime, uLamp, uPulse, uHold, uConfess, uWave, uYes;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vK;
      void main() {
        vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
        mv.xy += position.xy * aSize;
        mv.z += 0.35;
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vColor = aColor;
        float k = aMeta.x * mix(1.0, uLamp, aMeta.z) * (0.86 + 0.14 * sin(uTime * 2.7 + aMeta.y));
        k *= 1.0 + uPulse * 0.35 + uYes * 0.7;
        if (aMeta.w > 1.5) k *= 1.0 + uHold * 1.8 + uConfess * 0.9;
        if (aMeta.w > 0.5 && aMeta.w < 1.5) {
          float t = (uTime - uWave) * 4.0 - aOrder;
          k += 1.3 * exp(-t * t) * step(0.0, uTime - uWave);
        }
        vK = k;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vK;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.4);
        gl_FragColor = vec4(vColor * vK, a);
      }
    `,
  }));
  halosMesh.frustumCulled = false;
  scene.add(halosMesh);

  /* ── 花瓣：樱花树下飘落、河面漂着、告白时漫天 ── */
  const petalQuad = new THREE.PlaneGeometry(1, 1);
  const petalFrag = `
    uniform vec3 uTint;
    varying vec3 vColor;
    varying float vFade;
    varying vec2 vUv;
    void main() {
      vec2 q = (vUv - 0.5) * vec2(1.0, 1.35);
      float d = length(q);
          float notch = (1.0 - smoothstep(0.0, 0.08, abs(q.x))) * step(0.3, q.y);
      if (d > 0.5 || notch > 0.5) discard;
      gl_FragColor = vec4(vColor * uTint * (0.86 + 0.28 * (0.5 - d)), vFade);
    }
  `;
  const rotHelpers = `
    mat3 rotAxis(vec3 a, float r) {
      float s = sin(r), c = cos(r), o = 1.0 - c;
      return mat3(a.x*a.x*o + c, a.y*a.x*o + a.z*s, a.z*a.x*o - a.y*s,
                  a.x*a.y*o - a.z*s, a.y*a.y*o + c, a.z*a.y*o + a.x*s,
                  a.x*a.z*o + a.y*s, a.y*a.z*o - a.x*s, a.z*a.z*o + c);
    }
  `;
  const PETAL_COLORS = ['#f7b9c4', '#fbd0d8', '#f5a9b9', '#fde6ec', '#f4a6c6'].map(hexRGB);
  const petalMaterial = (vertexMain, extra = {}) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, ...extra },
    vertexShader: rotHelpers + vertexMain,
    fragmentShader: petalFrag,
  });

  const perTree = lite ? 28 : 58;
  const fallCount = petalTrees.length * perTree;
  const fallGeo = buildBillboards(fallCount);
  fallGeo.index = petalQuad.index;
  fallGeo.setAttribute('position', petalQuad.getAttribute('position'));
  const fOrigin = new Float32Array(fallCount * 3);
  const fSeed = new Float32Array(fallCount * 4);
  const fColor = new Float32Array(fallCount * 3);
  petalTrees.forEach(([x, cy, z, size], ti) => {
    for (let k = 0; k < perTree; k++) {
      const i = ti * perTree + k;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 1.5 * size;
      fOrigin.set([x + Math.cos(a) * r, cy, z + Math.sin(a) * r], i * 3);
      fSeed.set([rng(), rng(), rng(), rng()], i * 4);
      fColor.set(PETAL_COLORS[Math.floor(rng() * PETAL_COLORS.length)], i * 3);
    }
  });
  fallGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(fOrigin, 3));
  fallGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fSeed, 4));
  fallGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(fColor, 3));
  const fallMat = petalMaterial(`
    attribute vec3 aOrigin;
    attribute vec4 aSeed;
    attribute vec3 aColor;
    uniform float uTime, uWind;
    varying vec3 vColor;
    varying float vFade;
    varying vec2 vUv;
    void main() {
      float height = aOrigin.y - 0.45;
      float speed = 0.22 + aSeed.x * 0.3 + uWind * 0.35;
      float drop = mod(aSeed.y * height + uTime * speed, height);
      vec3 p = aOrigin;
      p.y -= drop;
      p.x += sin(uTime * (0.6 + aSeed.z) + aSeed.w * 6.28) * 0.35 + drop * 0.35 + uWind * (0.7 + aSeed.z);
      p.z += cos(uTime * (0.5 + aSeed.x) + aSeed.z * 6.28) * 0.3 + uWind * (aSeed.w - 0.4);
      vec3 axis = normalize(vec3(aSeed.z - 0.5, 0.7, aSeed.w - 0.5));
      mat3 r = rotAxis(axis, uTime * (1.2 + aSeed.x * 2.2) + aSeed.y * 6.28);
      vec3 local = r * vec3(position.x * 0.14, position.y * 0.1, 0.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
      vFade = smoothstep(0.0, 0.25, drop) * (1.0 - smoothstep(height - 0.3, height, drop));
      vColor = aColor;
      vUv = uv;
    }
  `, { uWind: { value: 0 } });
  const fallMesh = new THREE.Mesh(fallGeo, fallMat);
  fallMesh.frustumCulled = false;
  scene.add(fallMesh);

  const flows = [];
  for (let i = 0; i < STREAM.length - 1; i++) flows.push([STREAM[i], STREAM[i + 1], 0.3]);
  flows.push([[-8.5, -14.3], [8.5, -14.3], 0.7]);
  flows.push([[8.5, -13.7], [-8.5, -13.7], 0.7]);
  const perFlow = lite ? 16 : 32;
  const drift = buildBillboards(flows.length * perFlow);
  drift.index = petalQuad.index;
  drift.setAttribute('position', petalQuad.getAttribute('position'));
  const dA = new Float32Array(flows.length * perFlow * 3);
  const dB = new Float32Array(flows.length * perFlow * 3);
  const dSeed = new Float32Array(flows.length * perFlow * 4);
  const dColor = new Float32Array(flows.length * perFlow * 3);
  flows.forEach(([a, b, spread], fi) => {
    for (let k = 0; k < perFlow; k++) {
      const i = fi * perFlow + k;
      dA.set([a[0], 0.345, a[1]], i * 3);
      dB.set([b[0], 0.345, b[1]], i * 3);
      dSeed.set([rng(), rng(), (rng() - 0.5) * spread, rng()], i * 4);
      dColor.set(PETAL_COLORS[Math.floor(rng() * PETAL_COLORS.length)], i * 3);
    }
  });
  drift.setAttribute('aA', new THREE.InstancedBufferAttribute(dA, 3));
  drift.setAttribute('aB', new THREE.InstancedBufferAttribute(dB, 3));
  drift.setAttribute('aSeed', new THREE.InstancedBufferAttribute(dSeed, 4));
  drift.setAttribute('aColor', new THREE.InstancedBufferAttribute(dColor, 3));
  const driftMat = petalMaterial(`
    attribute vec3 aA;
    attribute vec3 aB;
    attribute vec4 aSeed;
    attribute vec3 aColor;
    uniform float uTime;
    varying vec3 vColor;
    varying float vFade;
    varying vec2 vUv;
    void main() {
      float t = fract(aSeed.x + uTime * (0.012 + aSeed.y * 0.012));
      vec3 dir = aB - aA;
      vec3 side = normalize(vec3(-dir.z, 0.0, dir.x));
      vec3 p = mix(aA, aB, t) + side * (aSeed.z + sin(uTime * 0.7 + aSeed.w * 6.28) * 0.08);
      mat3 r = rotAxis(vec3(0.0, 1.0, 0.0), uTime * 0.3 + aSeed.w * 6.28);
      vec3 local = r * vec3(position.x * 0.16, 0.0, position.y * 0.12);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
      vFade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.9, 1.0, t)) * 0.95;
      vColor = aColor;
      vUv = uv;
    }
  `);
  const driftMesh = new THREE.Mesh(drift, driftMat);
  driftMesh.frustumCulled = false;
  scene.add(driftMesh);

  const burstCount = lite ? 180 : 360;
  const burst = buildBillboards(burstCount);
  burst.index = petalQuad.index;
  burst.setAttribute('position', petalQuad.getAttribute('position'));
  const bSeed = new Float32Array(burstCount * 4);
  const bColor = new Float32Array(burstCount * 3);
  for (let i = 0; i < burstCount; i++) {
    bSeed.set([rng(), rng(), rng(), rng()], i * 4);
    bColor.set(PETAL_COLORS[Math.floor(rng() * PETAL_COLORS.length)], i * 3);
  }
  burst.setAttribute('aSeed', new THREE.InstancedBufferAttribute(bSeed, 4));
  burst.setAttribute('aColor', new THREE.InstancedBufferAttribute(bColor, 3));
  const burstMat = petalMaterial(`
    attribute vec4 aSeed;
    attribute vec3 aColor;
    uniform float uTime, uStart, uRadius;
    uniform vec3 uCenter;
    varying vec3 vColor;
    varying float vFade;
    varying vec2 vUv;
    void main() {
      float t = uTime - uStart - aSeed.w * 0.6;
      float alive = step(0.0, t) * step(t, 9.0);
      float ang = aSeed.x * 6.2832 + t * (0.5 + aSeed.y * 0.6);
      float rad = (0.25 + aSeed.y * uRadius) * (1.0 - exp(-t * 0.9));
      vec3 p = uCenter + vec3(cos(ang) * rad, (aSeed.z - 0.3) * 2.2 * (1.0 - exp(-t * 0.8)) - t * t * 0.02, sin(ang) * rad);
      vec3 axis = normalize(vec3(aSeed.z - 0.5, 0.6, aSeed.x - 0.5));
      mat3 r = rotAxis(axis, t * (2.0 + aSeed.y * 3.0));
      vec3 local = r * vec3(position.x * 0.16, position.y * 0.12, 0.0) * alive;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
      vFade = alive * smoothstep(0.0, 0.4, t) * (1.0 - smoothstep(6.0, 9.0, t));
      vColor = aColor;
      vUv = uv;
    }
  `, { uStart: { value: -99 }, uCenter: { value: new THREE.Vector3() }, uRadius: { value: 3 } });
  const burstMesh = new THREE.Mesh(burst, burstMat);
  burstMesh.frustumCulled = false;
  scene.add(burstMesh);
  const burstTint = new THREE.Vector3(1, 1, 1);
  const petalBurst = (x, y, z, radius = 3, tint = [1, 1, 1]) => {
    burstMat.uniforms.uStart.value = clock;
    burstMat.uniforms.uCenter.value.set(x, y, z);
    burstMat.uniforms.uRadius.value = radius;
    burstTint.set(...tint);
  };

  /* ── 萤火：黄昏的运河和夜里的浮岛；说「愿意」时聚成一颗心 ── */
  const flyCount = lite ? 90 : 170;
  const flyPos = new Float32Array(flyCount * 3);
  const flyHeart = new Float32Array(flyCount * 3);
  const flySeed = new Float32Array(flyCount * 2);
  for (let i = 0; i < flyCount; i++) {
    const onIsland = i % 2 === 0;
    if (onIsland) flyPos.set([R(-4, 4), islandTop + R(0.3, 2.6), -45 + R(-4, 4)], i * 3);
    else flyPos.set([R(-2.4, 2.4), R(0.6, 2.4), R(-35, -21)], i * 3);
    const t = (i / flyCount) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    flyHeart.set([hx * 0.055, hy * 0.055, R(-0.05, 0.05)], i * 3);
    flySeed.set([rng() * 6.28, rng()], i * 2);
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  flyGeo.setAttribute('aHeart', new THREE.BufferAttribute(flyHeart, 3));
  flyGeo.setAttribute('aSeed', new THREE.BufferAttribute(flySeed, 2));
  const flyUniforms = {
    uTime: { value: 0 }, uLamp: { value: 0 }, uHeart: { value: 0 }, uHold: { value: 0 },
    uCenter: { value: new THREE.Vector3(0, islandTop + 1.7, -43.4) },
    uPixel: { value: 1 },
  };
  const flies = new THREE.Points(flyGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: flyUniforms,
    vertexShader: `
      attribute vec3 aHeart;
      attribute vec2 aSeed;
      uniform float uTime, uLamp, uHeart, uHold, uPixel;
      uniform vec3 uCenter;
      varying float vA;
      varying float vPink;
      void main() {
        vec3 wander = position + vec3(sin(uTime * 0.6 + aSeed.x) * 0.4, sin(uTime * 0.9 + aSeed.x * 2.0) * 0.25 + uHold * 0.9, cos(uTime * 0.5 + aSeed.x) * 0.4);
        vec3 heart = uCenter + aHeart * (1.0 + 0.06 * sin(uTime * 3.2));
        float k = smoothstep(0.0, 1.0, uHeart);
        vec3 p = mix(wander, heart, k);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.55 + 0.45 * sin(uTime * (2.0 + aSeed.y * 3.0) + aSeed.x * 5.0);
        vA = tw * max(uLamp, k) * (0.7 + uHold * 0.6);
        vPink = k;
        gl_PointSize = (0.05 + aSeed.y * 0.09) * (0.6 + tw * 0.6) * uPixel / max(1.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vA;
      varying float vPink;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = dot(p, p);
        if (d > 0.25) discard;
        vec3 col = mix(vec3(1.0, 0.95, 0.6), vec3(1.0, 0.62, 0.78), vPink);
        gl_FragColor = vec4(col, (1.0 - smoothstep(0.0, 0.25, d)) * vA);
      }
    `,
  }));
  flies.frustumCulled = false;
  scene.add(flies);

  const smokeSystem = (origin, count, color) => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set(origin, i * 3);
      seed[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Vector3(...color) }, uAlpha: { value: 0.5 }, uPixel: { value: 1 } },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uPixel;
        varying float vLife;
        void main() {
          float life = fract(uTime * 0.12 + aSeed);
          vec3 p = position + vec3(sin(life * 5.0 + aSeed * 9.0) * 0.25 + life * 0.6, life * 2.6, cos(aSeed * 7.0) * 0.2);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vLife = life;
          gl_PointSize = (0.35 + life * 1.2) * uPixel / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uAlpha;
        varying float vLife;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = dot(p, p);
          if (d > 0.25) discard;
          gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.0, 0.25, d)) * (1.0 - vLife) * smoothstep(0.0, 0.1, vLife) * uAlpha);
        }
      `,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return mat;
  };
  const smokes = [
    smokeSystem(creamChimney, 12, [0.98, 0.96, 0.94]),
    smokeSystem(starChimney, 14, [0.72, 0.7, 0.86]),
  ];

  /* ── 两个人：星空浮岛上，紫树下面 ── */
  const lambert = (color) => new THREE.MeshLambertMaterial({ color });
  const person = (x, z, cloth, hair, skirt = false) => {
    const group = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.16), lambert(0x2e2a36));
    legs.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(skirt ? 0.34 : 0.3, 0.34, 0.2), lambert(cloth));
    body.position.y = 0.37;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.22), lambert(0xf6d6c6));
    head.position.y = 0.68;
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.24), lambert(hair));
    hairTop.position.y = 0.82;
    group.add(legs, body, head, hairTop);
    if (skirt) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), lambert(hair));
      back.position.set(0, 0.66, -0.12);
      group.add(back);
    }
    group.position.set(x, islandTop, z);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = !lite; o.receiveShadow = !lite; } });
    scene.add(group);
    return group;
  };
  const him = person(-0.42, -43.3, 0x3d4a6a, 0x221c1a);
  const her = person(0.42, -43.4, 0xf2a7bc, 0x3a2626, true);
  const spiritMat = (color) => new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const spirits = [spiritMat(0xff9ec0), spiritMat(0xffd98a)].map((mat) => {
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.9);
    scene.add(sprite);
    return sprite;
  });

  /* ── 孔明灯：点灯笼或说愿意时放起来 ── */
  const skyLanterns = [];
  const lanternBody = new THREE.BoxGeometry(0.24, 0.3, 0.24);
  const releaseLantern = (x, y, z) => {
    if (skyLanterns.length > 8) return;
    const mesh = new THREE.Mesh(lanternBody, new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true }));
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowSprite.scale.setScalar(1.6);
    mesh.position.set(x, y, z);
    glowSprite.position.set(x, y, z);
    scene.add(mesh, glowSprite);
    skyLanterns.push({ mesh, glowSprite, born: clock, seed: rng() * 6.28, x, y, z });
  };

  /* ── 尺寸与画质 ── */
  let renderScale = lite ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 58 : 46;
    camera.updateProjectionMatrix();
    if (pipeline) {
      pipeline.setSize(w, h);
      renderScale = pipeline.state.scale;
    } else {
      renderer.setPixelRatio(renderScale);
      renderer.setSize(w, h, false);
    }
    const proj = (h * renderScale) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    flyUniforms.uPixel.value = proj;
    stars.material.uniforms.uPix.value = renderScale;
    smokes.forEach((mat) => { mat.uniforms.uPixel.value = proj; });
  };
  resize();

  /* ── 状态 ── */
  let mode = 'moon';
  let storyTarget = 0;
  let story = 0;
  let phase = 3;
  let hold = 0;
  let holdTarget = 0;
  let pulse = 0;
  let confess = 0;
  let yes = 0;
  let heart = 0;
  let spiritsOn = [0, 0];
  let clock = 0;
  let last = 0;
  let wind = 0;
  let running = !reduced;
  let frame = 0;
  let nextShooting = 3;
  let slowFrames = 0;
  let sampled = 0;
  let harmony = 0;
  let harmonyOn = false;
  let trackOn = false;
  let shotMode = false;
  let walkT = 0;
  let blackboardGlow = 0;
  const camPos = new THREE.Vector3(0, 8, -24);
  const camLook = new THREE.Vector3(...MOON_POS);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const skyColor = new THREE.Color();
  const shooting = [];
  const fireworks = [];

  const applyEnvironment = () => {
    const env = skyAt(phase);
    const u = sky.material.uniforms;
    u.uZenith.value.set(...env.z);
    u.uMid.value.set(...env.m);
    u.uHorizon.value.set(...env.h);
    const night = smooth(2.1, 2.9, phase);
    const lamp = smooth(1.45, 2.15, phase);
    const day = 1 - smooth(1.6, 2.4, phase);
    u.uNight.value = night;
    u.uDay.value = day;
    u.uAurora.value = 0.4 + hold * 1.1 + confess * 0.6 + yes * 0.7;
    stars.material.uniforms.uNight.value = night;
    const fogRGB = mix3(env.h, env.m, 0.35);
    display(fogRGB, scene.fog.color);
    scene.fog.density = env.fog;
    water.material.uniforms.uSky.value.set(...env.m);
    water.material.uniforms.uFog.value.set(...fogRGB);
    water.material.uniforms.uFogDensity.value = env.fog;
    water.material.uniforms.uNight.value = night;
    water.material.uniforms.uLamp.value = lamp;
    display(env.sun, sun.color);
    sun.intensity = env.sunI;
    const nightDir = new THREE.Vector3(...MOON_POS).normalize();
    const dayDir = new THREE.Vector3(-0.5, 0.75, 0.42);
    const duskDir = new THREE.Vector3(-0.6, 0.28, -0.75);
    const dir = phase < 2 ? dayDir.clone().lerp(duskDir, smooth(1.2, 2.0, phase)) : duskDir.clone().lerp(nightDir, smooth(2.0, 2.9, phase));
    dir.normalize();
    sun.position.copy(camLook).addScaledVector(dir, 30);
    sun.target.position.copy(camLook);
    sun.target.updateMatrixWorld();
    /* 天上画的那个太阳，和真正打光的方向必须是同一个 */
    sky.material.uniforms.uSun.value.copy(dir);
    ambient.intensity = 0.16 + day * 0.12 + night * 0.05;
    display(env.hs, hemi.color);
    display(env.hg, hemi.groundColor);
    hemi.intensity = env.hI;
    const cloudTint = phase < 1.6 ? [1, 1, 1] : mix3([1.0, 0.78, 0.74], [0.26, 0.28, 0.46], smooth(2.0, 2.8, phase));
    display(cloudTint, cloudMat.color);
    const portraitCover = smooth(0.15, 0.7, clamp01((0.92 - camera.aspect) / 0.55))
      * (1 - smooth(0.45, 1.0, story));
    cloudMat.opacity = (0.92 - night * 0.62) * (1 - portraitCover * 0.96);
    moon.material.opacity = smooth(1.7, 2.6, phase);
    moonGlow.material.opacity = 0.55 * smooth(1.7, 2.6, phase);
    sunGlow.material.opacity = 0.75 * day;
    warmMat.color.setScalar(0.55 + 1.2 * lamp + pulse * 0.25 + yes * 0.35);
    magicMat.color.setScalar((0.55 + 1.1 * night) * (1 + hold * 0.9 + confess * 0.6 + yes * 0.5));
    haloUniforms.uLamp.value = lamp;
    haloUniforms.uPulse.value = pulse;
    haloUniforms.uHold.value = hold;
    haloUniforms.uConfess.value = confess;
    haloUniforms.uYes.value = yes;
    flyUniforms.uLamp.value = smooth(1.6, 2.4, phase);
    flyUniforms.uHold.value = hold;
    flyUniforms.uHeart.value = heart;
    const light = 1 - night * 0.42;
    const warm = smooth(1.5, 2.2, phase) * (1 - night);
    const tint = [light, light * (1 - warm * 0.12), light * (1 - warm * 0.18) + night * 0.06];
    fallMat.uniforms.uTint.value.set(...tint);
    driftMat.uniforms.uTint.value.set(...tint);
    burstMat.uniforms.uTint.value.set(tint[0] * burstTint.x, tint[1] * burstTint.y, tint[2] * burstTint.z);
    smokes[1].uniforms.uAlpha.value = 0.25 + night * 0.35;
    skyColor.setRGB(...env.h, THREE.SRGBColorSpace);
    renderer.setClearColor(skyColor);
  };

  const pickTarget = () => {
    if (shotMode) return phase;
    if (mode === 'moon') {
      const a = clock * 0.08;
      wantPos.set(Math.sin(a) * 4, 6.6 + Math.sin(clock * 0.25) * 0.3, -26 + Math.cos(a) * 3);
      wantLook.set(...MOON_POS);
      return 3;
    }
    if (mode === 'yes') {
      wantPos.set(...YES_SHOT.p);
      wantLook.set(...YES_SHOT.l);
      return 3;
    }
    wantPos.set(...along(story, 'p'));
    wantLook.set(...along(story, 'l'));
    const portrait = clamp01((0.92 - camera.aspect) / 0.55);
    if (portrait) {
      forward.subVectors(wantLook, wantPos).normalize();
      const shortScreen = clamp01((760 - canvas.clientHeight) / 180);
      const coverFrame = 1 - smooth(0.25, 1.0, story);
      const coverPull = coverFrame * (1.35 + shortScreen * 1.45);
      wantPos.addScaledVector(forward, -portrait * (3.8 + coverPull));
      wantPos.y += portrait * 1.0;
      wantLook.y += portrait * 0.65;
      wantLook.y += portrait * (1 - smooth(0.45, 1.0, story)) * (3.6 + shortScreen * 1.8);
    }
    return phaseAlong(story);
  };

  const step = (now) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    clock += reduced ? 0 : dt;
    story += (storyTarget - story) * (reduced ? 1 : Math.min(1, dt * 2.4));
    const targetPhase = pickTarget();
    phase += (targetPhase - phase) * (reduced ? 1 : Math.min(1, dt * 1.2));
    hold += (holdTarget - hold) * Math.min(1, dt * 3);
    pulse *= Math.exp(-dt * 3.5);
    confess *= Math.exp(-dt * 0.35);
    wind *= Math.exp(-dt * 0.75);
    if (mode === 'yes') {
      yes = Math.min(1, yes + dt * 0.5);
      heart = Math.min(1, heart + dt * 0.35);
    }
    forward.subVectors(wantLook, wantPos).normalize();
    wantPos.y += hold * 0.7;
    wantPos.addScaledVector(forward, hold * 0.35);
    const ease = reduced ? 1 : Math.min(1, dt * 2.2);
    camPos.lerp(wantPos, ease);
    camLook.lerp(wantLook, ease);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    applyEnvironment();
    sky.material.uniforms.uTime.value = clock;
    stars.material.uniforms.uTime.value = clock;
    water.material.uniforms.uTime.value = clock;
    fall.material.uniforms.uTime.value = clock;
    haloUniforms.uTime.value = clock;
    flyUniforms.uTime.value = clock;
    fallMat.uniforms.uTime.value = clock;
    fallMat.uniforms.uWind.value = wind;
    driftMat.uniforms.uTime.value = clock;
    burstMat.uniforms.uTime.value = clock;
    smokes.forEach((mat) => { mat.uniforms.uTime.value = clock; });
    clouds.position.x = clock * 0.12 - 10;

    const yesT = smooth(0, 1, yes);
    him.position.x = -0.42 + yesT * 0.26;
    her.position.x = 0.42 - yesT * 0.26;
    him.rotation.y = yesT * 0.35;
    her.rotation.y = -yesT * 0.35;

    /* 她说「我陪你」：从台下走到麦克风旁边 */
    if (harmonyOn && harmony < 1) {
      harmony = Math.min(1, harmony + dt * 0.34);
      const k = smooth(0, 1, harmony);
      stageHer.visible = true;
      stageHer.position.set(
        mix(-3.4, -0.55, k),
        mix(0.5, 0.93, smooth(0.3, 1, k)),
        mix(CAMPUS.z0 + 3.2, CAMPUS.stageZ - 0.5, k)
      );
    }
    /* 黑板被点到时会亮一下，像有人刚写下那四个字 */
    if (blackboardGlow > 0.001) {
      blackboardGlow *= Math.exp(-dt * 1.3);
      boardPlate.material.color.setScalar(1 + blackboardGlow * 0.85);
    }
    /* 体育课：两个人在跑道上走圈，只有在那一章附近才算 */
    const peActive = trackOn || (mode === 'story' && story > 1.5 && story < 3.05);
    trackHim.visible = peActive;
    trackHer.visible = peActive;
    if (peActive) {
      walkT += dt * 0.15;
      const rx = trackR.x * 0.86;
      const rz = trackR.z * 0.86;
      const px = Math.cos(walkT) * rx;
      const pz = CAMPUS.trackZ + Math.sin(walkT) * rz;
      const px2 = Math.cos(walkT + 0.06) * rx;
      const pz2 = CAMPUS.trackZ + Math.sin(walkT + 0.06) * rz;
      trackHim.position.set(px, 0.53, pz);
      trackHer.position.set(px2 * 0.985, 0.53, CAMPUS.trackZ + (pz2 - CAMPUS.trackZ) * 0.985);
      trackHim.rotation.y = -walkT;
      trackHer.rotation.y = -walkT;
    }
    /* 飞过的鸟 */
    birdT += dt;
    for (let i = 0; i < birdCfg.length; i++) {
      const b = birdCfg[i];
      const a = b.phase + birdT * b.speed;
      const bx = b.cx + Math.cos(a) * b.r;
      const bz = b.cz + Math.sin(a) * b.r;
      const by = b.y + Math.sin(birdT * 0.9 + b.phase) * 0.4;
      const flap = 0.3 + Math.sin(birdT * 6.5 + b.phase) * 0.35;
      for (let w = 0; w < 2; w++) {
        birdDummy.position.set(bx, by, bz + (w ? 0.15 : -0.15));
        birdDummy.rotation.set(0, -a + Math.PI / 2, (w ? 1 : -1) * flap);
        birdDummy.updateMatrix();
        birdMesh.setMatrixAt(i * 2 + w, birdDummy.matrix);
      }
    }
    birdMesh.instanceMatrix.needsUpdate = true;

    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    const center = camPos.clone().addScaledVector(forward, 4.2).addScaledVector(right, 1.25).add(new THREE.Vector3(0, 0.45, 0));
    spirits.forEach((sprite, i) => {
      const a = clock * 1.1 + i * Math.PI;
      const orbit = new THREE.Vector3(Math.cos(a) * 0.32, Math.sin(clock * 1.7 + i) * 0.12, Math.sin(a) * 0.32);
      const home = center.clone().add(orbit);
      const target = i === 0 ? her.position.clone().add(new THREE.Vector3(0, 1.0, 0)) : him.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      sprite.position.copy(home.lerp(target, yesT));
      sprite.material.opacity = spiritsOn[i] * (1 - yesT * 0.85) * (0.75 + 0.25 * Math.sin(clock * 3 + i));
      sprite.scale.setScalar(0.7 + pulse * 0.25);
    });

    if (!reduced && clock > nextShooting && phase > 2.3) {
      const x = R(-40, 40);
      const y = R(24, 40);
      const z = R(-110, -60);
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x + 4, y + 1.2, z)]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff6e0, transparent: true, fog: false }));
      scene.add(line);
      shooting.push({ line, life: 1 });
      nextShooting = clock + R(3, 7);
    }
    for (let i = shooting.length - 1; i >= 0; i--) {
      const s = shooting[i];
      s.life -= dt * 1.3;
      s.line.position.x -= dt * 26;
      s.line.position.y -= dt * 7;
      s.line.material.opacity = Math.max(0, s.life);
      if (s.life <= 0) {
        scene.remove(s.line);
        s.line.geometry.dispose();
        s.line.material.dispose();
        shooting.splice(i, 1);
      }
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const shell = fireworks[i];
      const age = clock - shell.born;
      if (age < 0) continue;
      if (!shell.sparks) {
        const t = Math.min(1, age / shell.rise);
        const y = shell.y0 + (shell.y1 - shell.y0) * (1 - (1 - t) ** 2);
        if (!shell.rocket) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex,
            color: shell.color,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          sprite.scale.setScalar(0.55);
          scene.add(sprite);
          shell.rocket = sprite;
        }
        shell.rocket.position.set(shell.x, y, shell.z);
        shell.rocket.material.opacity = 0.85;
        if (t >= 1) {
          scene.remove(shell.rocket);
          shell.rocket.material.dispose();
          shell.rocket = null;
          burstFirework(shell);
        }
        continue;
      }
      shell.life += dt;
      const { points, velocities, positions } = shell.sparks;
      const fade = 1 - smooth(0.15, 2.1, shell.life);
      for (let k = 0; k < velocities.length; k++) {
        const [vx, vy, vz] = velocities[k];
        const drag = Math.exp(-shell.life * 0.7);
        positions[k * 3] = shell.x + vx * shell.life * drag;
        positions[k * 3 + 1] = shell.y1 + vy * shell.life * drag - shell.life * shell.life * 0.55;
        positions[k * 3 + 2] = shell.z + vz * shell.life * drag;
      }
      points.geometry.attributes.position.needsUpdate = true;
      points.material.opacity = Math.max(0, fade);
      if (shell.life > 2.2) {
        scene.remove(points);
        points.geometry.dispose();
        points.material.dispose();
        fireworks.splice(i, 1);
      }
    }
    for (let i = skyLanterns.length - 1; i >= 0; i--) {
      const l = skyLanterns[i];
      const age = clock - l.born;
      const y = l.y + age * 0.45;
      const x = l.x + Math.sin(age * 0.8 + l.seed) * 0.35;
      l.mesh.position.set(x, y, l.z);
      l.glowSprite.position.set(x, y, l.z);
      const fade = 1 - smooth(10, 16, age);
      l.mesh.material.opacity = fade;
      l.glowSprite.material.opacity = fade * (0.8 + 0.2 * Math.sin(age * 4));
      if (age > 16) {
        scene.remove(l.mesh, l.glowSprite);
        l.mesh.material.dispose();
        l.glowSprite.material.dispose();
        skyLanterns.splice(i, 1);
      }
    }
    renderFrame();

    if (!reduced && sampled < 150 && mode !== 'moon') {
      sampled++;
      if (dt > 0.034) slowFrames++;
      if (sampled === 150 && slowFrames > 60) {
        if (pipeline && pipeline.state.bloom) {
          pipeline.state.bloom = false;
        } else if (pipeline && pipeline.state.ink) {
          pipeline.inkUniforms.uStrength.value *= 0.6;
        } else if (renderScale > 0.9) {
          renderScale = renderScale > 1 ? 1 : 0.85;
          fallGeo.instanceCount = Math.floor(fallCount * 0.55);
          burst.instanceCount = Math.floor(burstCount * 0.6);
        }
        resize();
        sampled = 0;
        slowFrames = 0;
      }
    }
  };

  const loop = (now) => {
    if (!running) return;
    step(now);
    frame = requestAnimationFrame(loop);
  };
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  step(performance.now());
  if (!reduced) frame = requestAnimationFrame(loop);
  const renderStill = () => { if (reduced) step(performance.now()); };

  const stopLoop = () => {
    if (reduced || !running) return;
    running = false;
    cancelAnimationFrame(frame);
  };
  const startLoop = () => {
    if (reduced || running) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(loop);
  };
  const onHide = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };
  document.addEventListener('visibilitychange', onHide);
  const onResize = () => { resize(); if (reduced) renderStill(); };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  /* 滚出屏幕就停：她读信时三维不该占着 GPU */
  if ('IntersectionObserver' in window && canvas.parentElement) {
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) startLoop();
      else stopLoop();
    }, { rootMargin: '120px' }).observe(canvas.parentElement);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitPoint = new THREE.Vector3();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);

  const gust = (amount = 0.8) => { wind = Math.min(2.4, wind + amount); };
  const flourish = {
    arrive: [2.4, 2.1, -1.8, 3.2, [1, 0.84, 0.88]],
    mv1: [-0.4, 1.7, 21.4, 3.0, [1, 0.86, 0.76]],
    mv2: [0, 2.7, 33.0, 3.2, [1, 0.88, 0.92]],
    pe: [0.6, 1.9, 36.0, 3.6, [1, 0.9, 0.78]],
    mv3: [-0.8, 2.3, -3.4, 2.8, [1, 0.78, 0.86]],
    mv4: [0, islandTop + 1.55, -44.2, 5.4, [0.92, 0.72, 1]],
    mv5: [0, islandTop + 1.7, -43.7, 3.0, [0.78, 0.86, 1]],
  };
  const playFlourish = (key) => {
    const shot = flourish[key];
    if (!shot) return;
    petalBurst(shot[0], shot[1], shot[2], shot[3], shot[4]);
    gust(0.7);
    pulse = Math.min(1.4, pulse + 0.45);
  };

  const FW_COLORS = [0xffb7c8, 0xffe0a0, 0xd7c2ff, 0x9adfff, 0xff9a72, 0xfff6ea];
  const launchFirework = (x, z, delay) => {
    fireworks.push({
      x,
      z,
      y0: islandTop + 1.1,
      y1: islandTop + R(6.2, 10.4),
      born: clock + delay,
      rise: R(0.72, 1.05),
      color: pick(FW_COLORS),
      sparks: null,
      life: 0,
    });
  };
  const burstFirework = (shell) => {
    const count = lite ? 36 : 72;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      const theta = R(0, Math.PI * 2);
      const phi = Math.acos(R(-1, 1));
      const speed = R(1.4, 4.2);
      velocities.push([
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.85,
        Math.sin(phi) * Math.sin(theta) * speed,
      ]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: shell.color,
      size: 0.16,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 1,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    shell.sparks = { points, velocities, positions };
    shell.life = 0;
    pulse = 1.2;
  };

  const celebrate = () => {
    if (mode === 'yes') return;
    mode = 'yes';
    petalBurst(0, islandTop + 1.4, -43.8, 4.8, [1, 0.7, 0.82]);
    gust(1.6);
    for (let i = 0; i < 5; i++) releaseLantern(R(-2.5, 2.5), islandTop + R(0.5, 1.5), -44 + R(-2, 2));
    const pattern = [[-2.2, -44.2], [1.6, -45.4], [0.2, -47.2], [-3.4, -46.0], [2.8, -43.6], [-0.8, -44.8], [3.6, -46.8]];
    pattern.forEach(([x, z], i) => launchFirework(x + R(-0.3, 0.3), z + R(-0.3, 0.3), 0.15 + i * 0.42));
  };

  const api = {
    /* 取景用：把镜头放到指定位置渲染一帧，只有带 ?ml=shot 的页面才会拿到这个句柄 */
    shot(pos, look, ph) {
      shotMode = true;
      camPos.set(pos[0], pos[1], pos[2]);
      camLook.set(look[0], look[1], look[2]);
      wantPos.copy(camPos);
      wantLook.copy(camLook);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      if (typeof ph === 'number') phase = ph;
      applyEnvironment();
      renderFrame();
    },
    setBeat(next) {
      if (next === 'moon') mode = 'moon';
      else if (next === 'yes') celebrate();
      else if (next === 'arrive') {
        if (mode === 'moon') mode = 'story';
        playFlourish('arrive');
      } else if (flourish[next]) playFlourish(next);
      renderStill();
    },
    setProgress(s) {
      storyTarget = Math.min(6, Math.max(0, s));
      renderStill();
    },
    setHold(value) {
      holdTarget = clamp01(value);
      if (value > 0.2) gust(0.12);
    },
    pulse() {
      pulse = Math.min(1.4, pulse + 0.5);
    },
    event(name, value) {
      if (name === 'open') {
        playFlourish('arrive');
        petalBurst(2.6, 2.0, -2.2, 2.6, [1, 0.82, 0.88]);
      }
      if (name === 'choir') {
        spiritsOn = [value >= 1 ? 1 : 0, value >= 2 ? 1 : 0];
        gust(0.35 + value * 0.25);
        pulse = Math.min(1.4, pulse + 0.35);
        if (value >= 1) petalBurst(-0.8, 2.2, -3.5, 2.2 + value * 0.6, [1, 0.76, 0.86]);
        if (value >= 2) petalBurst(5.0, 2.4, -0.4, 2.8, [1, 0.8, 0.9]);
      }
      if (name === 'poem') {
        lotusPads.forEach(([x, z], i) => {
          if (i % 2 === 0) petalBurst(x, 0.9, z, 1.6, [1, 0.72, 0.84]);
        });
        confess = Math.max(confess, 0.45);
        gust(0.55);
      }
      if (name === 'tape') {
        haloUniforms.uWave.value = clock;
        releaseLantern(R(-1.6, 1.6), 1.4, R(-32, -24));
        gust(0.4);
        pulse = 1.2;
      }
      if (name === 'world') {
        petalBurst(1.4, 1.6, -16.4, 2.2, [1, 0.74, 0.84]);
        gust(0.5);
      }
      if (name === 'confess') {
        confess = 1;
        playFlourish('mv4');
        petalBurst(-1.4, islandTop + 2.6, -46.2, 4.2, [0.86, 0.64, 1]);
        gust(1.4);
      }
      if (name === 'release') {
        confess = Math.max(confess, Math.min(1, value / 6));
        petalBurst(0, islandTop + 1.2, -43.6, 2.5 + Math.min(3, value * 0.4), [0.8, 0.86, 1]);
        gust(0.3 + Math.min(1.2, value * 0.12));
        for (let i = 0; i < Math.min(4, Math.floor(value / 2)); i++) {
          releaseLantern(R(-2.2, 2.2), islandTop + R(0.4, 1.2), -44 + R(-2, 2));
        }
      }
      if (name === 'harmony') {
        /* 她按下「一起把这首唱完」：从台下走上来，站到他旁边 */
        harmonyOn = true;
        harmony = 0;
        gust(1.1);
        pulse = 1.3;
        petalBurst(0.4, 1.9, CAMPUS.stageZ, 3.2, [1, 0.86, 0.9]);
      }
      if (name === 'blackboard') {
        blackboardGlow = 1;
        petalBurst(0.4, 2.2, CAMPUS.stageZ + 2.2, 2.0, [0.9, 0.94, 1]);
        gust(0.6);
      }
      if (name === 'gate') {
        petalBurst(0, 2.6, CAMPUS.gateZ - 0.6, 3.0, [1, 0.9, 0.86]);
        gust(0.7);
        pulse = 1.2;
      }
      if (name === 'pe') {
        trackOn = true;
        if (typeof value === 'number' && value > 0) walkT = value;
        playFlourish('pe');
        gust(0.6);
      }
      if (name === 'yes') celebrate();
      renderStill();
    },
    tap(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      let best = null;
      let bestD = Infinity;
      for (const spot of hotspots) {
        const p = raycaster.ray.intersectBox(spot.box, hitPoint);
        if (!p) continue;
        const d = p.distanceTo(camera.position);
        if (d < bestD && d < 45) {
          bestD = d;
          best = spot;
        }
      }
      if (best) {
        if (best.type === 'tree') {
          petalBurst(best.x, best.y, best.z, 2.2, best.data.tint || [1, 1, 1]);
          gust(0.85);
        } else if (best.type === 'lantern') {
          releaseLantern(best.x, best.y, best.z);
          pulse = 1.4;
        } else if (best.type === 'crystal') {
          confess = Math.max(confess, 0.8);
          pulse = 1.2;
        } else if (best.type === 'microphone') {
          harmonyOn = true;
          harmony = 0;
          pulse = 1.3;
          petalBurst(best.x, 1.9, best.z, 2.6, [1, 0.86, 0.9]);
        } else if (best.type === 'blackboard') {
          blackboardGlow = 1;
          petalBurst(best.x, 2.1, best.z, 2.0, [0.92, 0.95, 1]);
        } else if (best.type === 'gate') {
          petalBurst(best.x, 2.4, best.z, 2.8, [1, 0.9, 0.86]);
          pulse = 1.2;
        } else {
          pulse = 1.4;
          petalBurst(best.x, best.y + 1.2, best.z, 1.6);
        }
        return true;
      }
      const p = raycaster.ray.intersectPlane(ground, hitPoint);
      if (p && p.distanceTo(camera.position) < 30) {
        petalBurst(p.x, p.y + 0.8, p.z, 1.4);
        return true;
      }
      return false;
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      /* 动态对象（流星、烟花、孔明灯）留在场景里会连着几何一起泄漏，先清干净 */
      shooting.forEach((s) => { scene.remove(s.line); s.line.geometry.dispose(); s.line.material.dispose(); });
      shooting.length = 0;
      fireworks.forEach((f) => {
        if (f.sparks) { scene.remove(f.sparks.points); f.sparks.points.geometry.dispose(); f.sparks.points.material.dispose(); }
      });
      fireworks.length = 0;
      skyLanterns.forEach((l) => {
        scene.remove(l.mesh, l.glowSprite);
        l.mesh.material.dispose();
        l.glowSprite.material.dispose();
      });
      skyLanterns.length = 0;
      renderer.renderLists?.dispose?.();
      if (pipeline) pipeline.dispose();
      renderer.dispose();
    },
  };
  if (location.search.includes('ml=shot')) window.__miniLoveIsland = api;
  return api;
}
