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

      float hash3( vec3 p ) {
        return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 );
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

      /* Cloud noise on the *sphere*, interpolated trilinearly.
       *
       * Sampling this on a 2D plane was the bug that made the sky a ring.  The
       * old cloudField built  uv = dir.xz / max( 0.18, dir.y + 0.42 )  -- a
       * gnomonic projection, which is singular at the zenith -- and then added
       * a "lobe": a radial falloff from a single point in that UV space.  A
       * radial function about one point, viewed on a dome, *is* a circle: the
       * sky got one flat pale disc centred overhead and nothing else.
       *
       * 3D noise has no singular point and no preferred centre, so the cells
       * land wherever the direction happens to fall.  The domain is scaled down
       * in y before sampling, which flattens each cell into a bank lying across
       * the sky rather than a ball. */
      float cloudNoise( vec3 dir, float scale ) {
        vec3 p = dir * scale;
        p.y *= 0.42;
        vec3 i = floor( p );
        vec3 f = fract( p );
        vec3 u = f * f * ( 3.0 - 2.0 * f );
        float a = hash3( i );
        float b = hash3( i + vec3( 1.0, 0.0, 0.0 ) );
        float c = hash3( i + vec3( 0.0, 1.0, 0.0 ) );
        float d = hash3( i + vec3( 1.0, 1.0, 0.0 ) );
        float e = hash3( i + vec3( 0.0, 0.0, 1.0 ) );
        float g = hash3( i + vec3( 1.0, 0.0, 1.0 ) );
        float k = hash3( i + vec3( 0.0, 1.0, 1.0 ) );
        float m = hash3( i + vec3( 1.0, 1.0, 1.0 ) );
        float x0 = mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
        float x1 = mix( mix( e, g, u.x ), mix( k, m, u.x ), u.y );
        return mix( x0, x1, u.z );
      }

      /* Two octaves, remapped so the field actually reaches its extremes.
       *
       * Averaging two octaves concentrates the result around 0.5 and never gets
       * near 0 or 1, so a threshold against it produces a soft wash rather than
       * the hard-edged cel masses this scene wants.  Subtracting the midpoint
       * from the *total* weight is what puts the bottom of the range back at 0;
       * without it the lit-top threshold below never quite fires and there are
       * no lit tops at all. */
      float cloudField( vec3 dir ) {
        float n = cloudNoise( dir, 0.85 ) * 0.62
                + cloudNoise( dir, 2.30 ) * 0.38;
        n = ( n - 0.34 ) / 0.66;
        return clamp( n * 0.68 + 0.10, 0.0, 1.0 );
      }

      /* Broken cover, not an overcast: the shapes have to be big enough to hold
       * three flat tone bands, because that tercile split is what draws the lit
       * top and the shadowed underside a cel cloud is made of. */
      float cloudShape( float n ) {
        return smoothstep( 0.30, 0.62, n );
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

        /* --- cel clouds ---
         *
         * Three flat tones out of one value: the field is divided into terciles
         * and each one gets a colour, so a cloud is a lit top, a mid body and a
         * shaded underside with no gradient anywhere.  That split is the whole
         * reason this reads as anime rather than as fog.
         *
         * The height window is applied to the *shape* and only where the cloud
         * is already solid, so it thins the cover toward the horizon instead of
         * multiplying a thresholded field -- which is what produced a hard rim
         * of white all the way round the sky. */
        float shape = cloudShape( cloudField( dir ) );
        float lift = dir.y * 1.25 + 0.10;
        float cover = shape * smoothstep( -0.02, 0.26, lift ) * ( 0.55 + 0.45 * smoothstep( 0.9, 0.12, dir.y ) );
        float lit = smoothstep( 0.56, 0.74, cover );
        float mid = smoothstep( 0.34, 0.52, cover ) * ( 1.0 - lit );
        float shade = cover * ( 1.0 - lit ) * ( 1.0 - mid );
        vec3 cloudCol = mix( mix( uCloudShade, uCloud, 0.62 ), uCloud, lit );
        cloudCol += uSunGlow * lit * 0.16 * max( 0.0, dot( dir, normalize( uSunDir ) ) );
        // day: opaque masses; night: quieter, darker silhouettes
        float cloudOp = mix( 0.92, 0.24, uNight );
        col = mix( col, mix( cloudCol, cloudCol * 0.45, uNight ), cover * cloudOp );

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
          col += vec3( 0.85, 0.9, 1.0 ) * spark * tw * uNight * ( 1.0 - cover * 0.85 );
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
