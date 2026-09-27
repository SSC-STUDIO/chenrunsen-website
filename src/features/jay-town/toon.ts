import * as THREE from 'three'

function ramp(levels: number[]) {
  const canvas = document.createElement('canvas')
  canvas.width = levels.length
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  levels.forEach((level, index) => {
    const byte = Math.round(level * 255)
    ctx.fillStyle = `rgb(${byte},${byte},${byte})`
    ctx.fillRect(index, 0, 1, 1)
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

const celRamp = ramp([0.38, 0.56, 0.8, 1])
const softRamp = ramp([0.74, 0.88, 0.97, 1])

function tintShadows(material: THREE.MeshToonMaterial, strength: number) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
      `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
      float litLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
      float baseLuma = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.045);
      float shadeMix = smoothstep(0.97, 0.4, litLuma / baseLuma);
      outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.64, 0.73, 1.14) + diffuseColor.rgb * vec3(0.05, 0.045, 0.15), shadeMix * ${strength.toFixed(2)});`,
    )
  }
  material.customProgramCacheKey = () => `cel-shadow-${strength}`
}

export function toonMaterial(options: {
  map?: THREE.Texture | null
  color?: THREE.ColorRepresentation
  transparent?: boolean
  opacity?: number
  alphaTest?: number
  side?: THREE.Side
  depthWrite?: boolean
  polygonOffset?: boolean
  polygonOffsetFactor?: number
  soft?: boolean
} = {}) {
  const material = new THREE.MeshToonMaterial({
    color: options.color ?? '#ffffff',
    map: options.map ?? null,
    gradientMap: options.soft ? softRamp : celRamp,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? !options.transparent,
    polygonOffset: options.polygonOffset ?? false,
    polygonOffsetFactor: options.polygonOffsetFactor ?? 0,
  })
  tintShadows(material, options.soft ? 0.28 : 0.8)
  return material
}

export type CelInk = {
  render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

/** Desktop-only ink from the second difference of depth. Phones render the scene directly. */
export function createCelInk(enabled: boolean): CelInk {
  if (!enabled) {
    return {
      render: (renderer, scene, camera) => renderer.render(scene, camera),
      resize() {},
      dispose() {},
    }
  }

  const target = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true })
  target.depthTexture = new THREE.DepthTexture(2, 2)
  target.texture.colorSpace = THREE.NoColorSpace
  const resolution = new THREE.Vector2(2, 2)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      resolution: { value: resolution },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 640 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float cameraNear;
      uniform float cameraFar;
      float linearDepth(vec2 uv){
        float z = texture2D(tDepth, uv).x;
        return (2.0 * cameraNear) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
      }
      void main(){
        vec2 texel = 1.0 / resolution;
        float d = linearDepth(vUv);
        float dx = linearDepth(vUv + vec2(texel.x, 0.0)) + linearDepth(vUv - vec2(texel.x, 0.0)) - 2.0 * d;
        float dy = linearDepth(vUv + vec2(0.0, texel.y)) + linearDepth(vUv - vec2(0.0, texel.y)) - 2.0 * d;
        float curve = abs(dx) + abs(dy);
        float ink = smoothstep(0.00035, 0.0032, curve);
        ink *= 1.0 - smoothstep(0.035, 0.22, d);
        vec3 color = texture2D(tColor, vUv).rgb;
        color = mix(color, color * vec3(0.16, 0.18, 0.26), clamp(ink, 0.0, 1.0) * 0.62);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  const inkScene = new THREE.Scene()
  inkScene.add(quad)
  const inkCamera = new THREE.Camera()

  return {
    render(renderer, scene, camera) {
      material.uniforms.cameraNear.value = camera.near
      material.uniforms.cameraFar.value = camera.far
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(inkScene, inkCamera)
    },
    resize(width, height) {
      const w = Math.max(2, width)
      const h = Math.max(2, height)
      target.setSize(w, h)
      resolution.set(w, h)
    },
    dispose() {
      target.dispose()
      target.depthTexture?.dispose()
      material.dispose()
      quad.geometry.dispose()
    },
  }
}
