import * as THREE from 'three';
import { PAL } from './palette.js';
import { flat } from './toon.js';
import { rngKit } from './util.js';

/**
 * Anime background sky: one BackSide dome shader.
 * Clearer zenith blue, soft fog-matched horizon, a few large cel cloud masses
 * (2–3 hard-ish bands), a readable sun disc by day, deep blue + stars by night.
 * Billboard cloud group is kept empty for scene.ts API compatibility.
 */
export function buildSky(scene, radius = 500) {
  const fogDay = new THREE.Color(PAL.fog);
  const fogNight = new THREE.Color(0x2a3048);

  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: true,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x5a9fe0) },
      uMid: { value: new THREE.Color(0xb8d8f4) },
      uHaze: { value: fogDay.clone() },
      uTopN: { value: new THREE.Color(0x141c38) },
      uMidN: { value: new THREE.Color(0x243050) },
      uHazeN: { value: fogNight.clone() },
      uCloud: { value: new THREE.Color(0xfff8f4) },
      uCloudShade: { value: new THREE.Color(0xd4cce0) },
      uSun: { value: new THREE.Color(0xfff2c8) },
      uSunGlow: { value: new THREE.Color(0xffe0a8) },
      uSunDir: { value: new THREE.Vector3(-52, 62, 56).normalize() },
      uNight: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        // Object-space direction: dome is parented to the camera each frame.
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHaze;
      uniform vec3 uTopN, uMidN, uHazeN;
      uniform vec3 uCloud, uCloudShade, uSun, uSunGlow, uSunDir;
      uniform float uNight;
      varying vec3 vDir;

      float hash( vec2 p ) {
        return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
      }

      float noise( vec2 p ) {
        vec2 i = floor( p );
        vec2 f = fract( p );
        float a = hash( i );
        float b = hash( i + vec2( 1.0, 0.0 ) );
        float c = hash( i + vec2( 0.0, 1.0 ) );
        float d = hash( i + vec2( 1.0, 1.0 ) );
        vec2 u = f * f * ( 3.0 - 2.0 * f );
        return mix( a, b, u.x ) + ( c - a ) * u.y * ( 1.0 - u.x ) + ( d - b ) * u.x * u.y;
      }

      // A few large soft lobes → hard cel bands (not noisy fog).
      float cloudField( vec3 dir ) {
        vec2 uv = dir.xz / max( 0.18, dir.y + 0.42 );
        uv *= 0.55;
        float n = 0.0;
        n += noise( uv * 1.1 + vec2( 0.7, 1.3 ) ) * 0.55;
        n += noise( uv * 2.05 + vec2( -1.9, 0.4 ) ) * 0.32;
        n += noise( uv * 0.45 + vec2( 2.1, -0.8 ) ) * 0.45;
        // squash into elongated masses
        float lobe = 1.0 - smoothstep( 0.15, 0.85, length( uv * vec2( 0.55, 1.15 ) - vec2( 0.1, 0.05 ) ) );
        n = n * 0.72 + lobe * 0.38;
        // height window: sit above horizon, fade near zenith
        float band = smoothstep( -0.02, 0.12, dir.y ) * ( 1.0 - smoothstep( 0.42, 0.78, dir.y ) );
        n *= band;
        return n;
      }

      void main() {
        vec3 dir = normalize( vDir );
        float h = dir.y;

        float t = clamp( h * 1.05 + 0.08, 0.0, 1.0 );
        // faint painted steps — anime bg, not physical sky
        float q = floor( t * 18.0 ) / 18.0;
        t = mix( t, q, 0.28 );

        vec3 dayCol = mix( uHaze, uMid, smoothstep( 0.0, 0.28, t ) );
        dayCol = mix( dayCol, uTop, smoothstep( 0.22, 0.88, t ) );

        vec3 nightCol = mix( uHazeN, uMidN, smoothstep( 0.0, 0.32, t ) );
        nightCol = mix( nightCol, uTopN, smoothstep( 0.18, 0.9, t ) );

        vec3 col = mix( dayCol, nightCol, uNight );

        // --- cel clouds (2–3 value bands) ---
        float c = cloudField( dir );
        float lit = step( 0.52, c );
        float mid = step( 0.40, c ) * ( 1.0 - lit );
        float shade = step( 0.30, c ) * ( 1.0 - lit ) * ( 1.0 - mid );
        float cloudAmt = max( lit, max( mid, shade ) );
        vec3 cloudCol = mix( uCloudShade, uCloud, lit + mid * 0.55 );
        // day: opaque masses; night: quieter, darker silhouettes
        float cloudOp = mix( 0.88, 0.22, uNight );
        col = mix( col, mix( cloudCol, cloudCol * 0.45, uNight ), cloudAmt * cloudOp );

        // --- sun disc + soft glow (day only) ---
        float sunDot = max( 0.0, dot( dir, normalize( uSunDir ) ) );
        float disc = smoothstep( 0.9972, 0.9992, sunDot );
        float glow = pow( sunDot, 48.0 ) * 0.55 + pow( sunDot, 12.0 ) * 0.18;
        float dayVis = 1.0 - uNight;
        col += uSunGlow * glow * dayVis;
        col = mix( col, uSun, disc * dayVis );

        // --- sparse stars at night ---
        if ( uNight > 0.05 && h > 0.08 ) {
          vec3 sp = dir * 180.0;
          vec3 cell = floor( sp );
          float s = hash( cell.xy + cell.z * 17.0 );
          float spark = step( 0.965, s ) * step( 0.12, h );
          float tw = 0.55 + 0.45 * hash( cell.yz + 3.1 );
          col += vec3( 0.85, 0.9, 1.0 ) * spark * tw * uNight * ( 1.0 - cloudAmt * 0.85 );
        }

        gl_FragColor = vec4( col, 1.0 );
      }
    `,
  });

  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  // Empty stand-in so scene.ts can still parent `clouds` to the camera.
  const clouds = new THREE.Group();
  clouds.frustumCulled = false;
  scene.add(clouds);

  function setNight(amt) {
    mat.uniforms.uNight.value = Math.min(1, Math.max(0, amt));
  }

  return { dome, clouds, setNight, material: mat };
}

/**
 * Pale layered ridge lines on the horizon.  Pure silhouette, unlit, so they
 * read as painted background flats.
 */
export function buildDistantHills(scene) {
  const group = new THREE.Group();
  const rng = rngKit(4242);

  const layers = [
    { z: -330, h: 46, color: PAL.hillFar, width: 900, bumps: 9, y: -6 },
    { z: -250, h: 34, color: PAL.hill, width: 760, bumps: 7, y: -4 },
  ];

  for (const L of layers) {
    const pts = [];
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (t - 0.5) * L.width;
      let y = 0;
      for (let b = 1; b <= L.bumps; b++) {
        y += Math.sin(t * Math.PI * b * 1.7 + b * 2.1) * (L.h / (b * 1.25));
      }
      pts.push(new THREE.Vector2(x, Math.max(2, y * 0.55 + L.h * 0.55)));
    }
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, -60);
    pts.forEach((p) => shape.lineTo(p.x, p.y));
    shape.lineTo(pts[pts.length - 1].x, -60);
    shape.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      flat({ color: L.color, fog: false })
    );
    mesh.position.set(rng.range(-30, 30), L.y, L.z);
    mesh.renderOrder = -8;
    group.add(mesh);

    // mirror a copy behind the camera so turning around still reads as a valley
    const back = mesh.clone();
    back.position.set(rng.range(-40, 40), L.y, -L.z * 1.15);
    back.rotation.y = Math.PI;
    group.add(back);
  }
  scene.add(group);
  return group;
}
