import * as THREE from 'three'

/** Camera-facing micro-blossoms give the crowns volume without visible crossed cards. */
export function softenCanopies(scene: THREE.Scene) {
  const source = scene.getObjectByName('Dense blossom canopy') as THREE.InstancedMesh | undefined
  if (!source) return { update(_night:number,_pixel:number) {}, dispose() {} }
  // Retain the small flower cards only for their dappled shadows. The visible
  // crown uses round micro-blossoms, so no crossed rectangles face the camera.
  const sourceMaterial = source.material as THREE.MeshToonMaterial
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  const flowerDepth = new THREE.MeshDepthMaterial({
    map: sourceMaterial.map, alphaTest: .5, depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  })
  source.material = shadowOnly
  source.customDepthMaterial = flowerDepth
  source.castShadow = true
  const copies = 8
  const count = source.count * copies
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const matrix = new THREE.Matrix4(), origin = new THREE.Vector3(), tint = new THREE.Color()
  const rand = (value:number) => { const n=Math.sin(value*127.1)*43758.5453123; return n-Math.floor(n) }
  for(let i=0;i<source.count;i++) {
    source.getMatrixAt(i,matrix)
    origin.setFromMatrixPosition(matrix)
    source.getColorAt(i,tint)
    for(let j=0;j<copies;j++) {
      const n=i*copies+j, k=i*17+j*3.7
      const x=origin.x+(rand(k+1)-.5)*.28
      const y=origin.y+(rand(k+2)-.5)*.24
      const z=origin.z+(rand(k+3)-.5)*.28
      positions.set([x,y,z],n*3)
      const volume = Math.sin(x * 1.6 + Math.sin(z * 1.4)) * Math.cos(y * 2.3 + z * .8)
      const shade=.41+THREE.MathUtils.clamp((y-2.5)/4,0,1)*.37+rand(k+7)*.10+volume*.12
      colors.set([tint.r*shade,tint.g*shade*.77,tint.b*shade*.93],n*3)
      sizes[n]=.11+rand(k+9)*.08
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
  geometry.setAttribute('blossomSize',new THREE.BufferAttribute(sizes,1))
  const material=new THREE.ShaderMaterial({
    uniforms:{pixel:{value:600},night:{value:0},haze:{value:new THREE.Color(0xd4e8e7)}},
    vertexColors:true, transparent:false, depthWrite:true,
    vertexShader:`
      attribute float blossomSize; uniform float pixel; varying vec3 flowerColor; varying float seed; varying float depth;
      void main(){ flowerColor=color; seed=fract(sin(dot(position,vec3(12.9,78.2,34.1)))*43758.5);
        vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; depth=-mv.z;
        gl_PointSize=clamp(blossomSize*pixel/-mv.z,1.5,110.);
      }`,
    fragmentShader:`
      varying vec3 flowerColor; varying float seed; varying float depth; uniform float night; uniform vec3 haze;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 p=gl_PointCoord*2.-1.; float r=length(p); float a=atan(p.y,p.x);
        float edge=.87+sin(a*5.+seed*30.)*.07+sin(a*11.)*.045;
        float grain=hash(floor(gl_PointCoord*20.+seed*50.));
        if(r>edge+(grain-.5)*.13) discard;
        float light=1.+(.15-.19*r)+(.5-grain)*.20;
        vec3 c=flowerColor*light;
        c=mix(c,c*vec3(.28,.35,.53),night);
        c=mix(c,haze,smoothstep(85.,260.,depth));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const flowers=new THREE.Points(geometry,material)
  flowers.name='Soft volumetric cherry blossoms'
  flowers.frustumCulled=false
  scene.add(flowers)
  return {
    update(night:number,pixel:number){material.uniforms.night.value=night;material.uniforms.pixel.value=pixel;material.uniforms.haze.value.copy((scene.fog as THREE.Fog).color)},
    dispose(){
      scene.remove(flowers); geometry.dispose(); material.dispose()
      source.material=sourceMaterial; source.customDepthMaterial=undefined
      shadowOnly.dispose(); flowerDepth.dispose()
    },
  }
}
