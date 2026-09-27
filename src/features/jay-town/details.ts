import * as THREE from 'three'
import { makeSurfaceTextures } from './textures'
import { POLE_X } from './layout'
import { toonMaterial } from './toon'

/** Street-level detail: textured surfaces, small shop displays and irregular planting. */
export function addTownDetails(scene: THREE.Scene) {
  const textures = makeSurfaceTextures()
  const group = new THREE.Group()
  group.name = 'Street textures and lived-in details'
  scene.add(group)
  const resources: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(value: T) => { resources.push(value); return value }
  const cube = keep(new THREE.BoxGeometry(1, 1, 1))
  const plane = keep(new THREE.PlaneGeometry(1, 1))
  const sphere = keep(new THREE.SphereGeometry(1, 9, 7))
  const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 10))
  const white = keep(toonMaterial())
  const woody = keep(toonMaterial({ map: textures.wood }))
  const asphalt = keep(toonMaterial({ map: textures.asphalt }))
  let hazard: THREE.MeshToonMaterial
  const carpet = keep(toonMaterial({ map: textures.blossomCarpet, soft: true, transparent: true, alphaTest: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
  textures.asphalt.repeat.set(3, 32)
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; items: {p:number[];s:number[];color:THREE.Color;ry:number;rx:number}[] }>()
  function part(type: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, ry = 0, rx = 0) {
    const geometry = type === 'sphere' ? sphere : type === 'cylinder' || type === 'hazard' ? cylinder : cube
    const material = type === 'wood' ? woody : type === 'hazard' ? hazard : white
    if (!batches.has(type)) batches.set(type, { geometry, material, items: [] })
    batches.get(type)!.items.push({ p:[x,y,z], s:[sx,sy,sz], color:new THREE.Color(color), ry, rx })
  }
  function flat(material: THREE.Material, x: number, y: number, z: number, width: number, depth: number, angle = 0) {
    const mesh = new THREE.Mesh(plane, material)
    mesh.rotation.set(-Math.PI / 2, 0, angle)
    mesh.position.set(x,y,z)
    mesh.scale.set(width,depth,1)
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }
  const mapCanvas = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    draw(canvas.getContext('2d')!)
    const texture = keep(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }
  const hazardTexture = mapCanvas(256,512,ctx => {
    ctx.fillStyle='#e7bf4d';ctx.fillRect(0,0,256,512)
    ctx.strokeStyle='#333a3e';ctx.lineWidth=72
    for(let y=-260;y<810;y+=150) {
      ctx.beginPath();ctx.moveTo(-90,y);ctx.lineTo(350,y+185);ctx.stroke()
    }
    ctx.fillStyle='rgba(255,242,179,.14)';ctx.fillRect(0,0,25,512)
  })
  hazard=keep(toonMaterial({map:hazardTexture}))
  const petalPatch = mapCanvas(1024, 1024, ctx => {
    ctx.drawImage(textures.blossomCarpet.image, 0, 0, 1024, 1024)
    const image = ctx.getImageData(0, 0, 1024, 1024)
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
      const nx = (x - 512) / 512, ny = (y - 512) / 512
      const angle = Math.atan2(ny, nx)
      const radius = Math.hypot(nx, ny)
      const edge = .79 + Math.sin(angle * 3) * .10 + Math.sin(angle * 7 + 1.4) * .055
      const fade = THREE.MathUtils.clamp((edge - radius) / .22, 0, 1)
      image.data[(y * 1024 + x) * 4 + 3] *= fade * fade * (3 - 2 * fade)
    }
    ctx.putImageData(image, 0, 0)
  })
  carpet.map = petalPatch
  carpet.alphaTest = .08
  carpet.opacity = .92

  // Material grain keeps large painted surfaces from reading as untextured boxes.
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    if (object.name === 'Buildings, road, props and shopfronts') {
      const material = object.material as THREE.MeshToonMaterial
      material.map = textures.stucco; material.needsUpdate = true
    }
    if (object.name === 'Branches, lamps and utility lines') {
      const material = object.material as THREE.MeshToonMaterial
      material.map = textures.bark; material.needsUpdate = true
    }
  })

  for (const [start,end] of [[27,-22],[-40,-50.8],[-57,-78],[-98,-137]]) {
    flat(asphalt,0,.081,(start+end)/2,11.7,start-end)
  }
  const markings = keep(new THREE.MeshBasicMaterial({ color: '#e7e4d9', transparent: true, opacity: .88, depthWrite:false }))
  const yellow = keep(toonMaterial({ color: '#dba639' }))
  for (let z=26; z>-77; z-=5.8) {
    if (z < -22 && z > -40 || z < -50 && z > -57) continue
    flat(z > 0 ? yellow : markings,0,.09,z,.085,z>0?5.8:2.1)
  }
  for (let z=-98; z>-137; z-=5.8) flat(markings,0,.09,z,.085,2.1)
  for (const x of [-6.05,6.05]) flat(markings,x,.093,-24,.10,103)
  for (const x of [-6.05,6.05]) flat(markings,x,.093,-117.5,.10,39)
  for (const z of [-19.5,-47.5,-73,-104,-123]) {
    for (let x=-5.4;x<5.6;x+=.75) flat(markings,x,.098,z,.4,2.4)
    flat(markings,0,.098,z+2.2,11.2,.22)
  }
  const roadText = mapCanvas(256,512,ctx => {
    ctx.clearRect(0,0,256,512)
    ctx.fillStyle = '#eeebe1'; ctx.font='bold 120px "Yu Gothic","Microsoft YaHei",sans-serif';ctx.textAlign='center'
    ;['止','ま','れ'].forEach((text,i)=>ctx.fillText(text,128,135+i*155))
  })
  const roadPaint = keep(new THREE.MeshBasicMaterial({ map:roadText, transparent:true, opacity:.72, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 }))
  flat(roadPaint,-1.55,.1,-13,1.1,4.5,Math.PI)
  flat(roadPaint,1.55,.1,-68,1.1,4.5)
  const bikeMark = mapCanvas(256,512,ctx=>{
    ctx.fillStyle='#376786';ctx.fillRect(0,0,256,512)
    ctx.strokeStyle='#e1e9e4';ctx.lineWidth=8
    ctx.beginPath();ctx.arc(65,260,36,0,Math.PI*2);ctx.arc(192,260,36,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.moveTo(65,260);ctx.lineTo(117,190);ctx.lineTo(192,260);ctx.lineTo(65,260);ctx.moveTo(192,260);ctx.lineTo(164,157);ctx.lineTo(188,157);ctx.stroke()
    ctx.beginPath();ctx.moveTo(88,420);ctx.lineTo(128,380);ctx.lineTo(168,420);ctx.stroke()
  })
  const bikeMat=keep(toonMaterial({map:bikeMark,transparent:true,opacity:.72}))
  for(const z of [17,-8,-43,-67,-101,-119]) flat(bikeMat,4.4,.104,z,.55,1.1)

  // Large irregular patches of thousands of tiny petals, with clear asphalt between them.
  for (let i=0;i<40;i++) {
    const z=24-i*2.7
    if(z<-50&&z>-57) continue
    const x=Math.sin(i*2.73)*4.6
    flat(carpet,x,.112,z,3.1+(i%3)*.45,3.2+(i%2)*.45,i*1.7)
  }
    for(const side of [-1,1]) {
    for(let z=25;z>-77;z-=7.8) flat(carpet,side*7.7,.126,z,1.5,4.4,z)
    // Individual paving joints, a tactile strip and grated drainage channels.
    for(let z=27;z>-78;z-=.62) {
      if(z<-50&&z>-57) continue
      part('box',side*7.95,.124,z,2.04,.01,.016,'#b1b8b4')
    }
    for(const x of [6.9,7.44,7.98,8.52]) part('box',side*x,.125,-25,.014,.01,102,'#b6bdb7')
    for(let z=27;z>-78;z-=.42) {
      if(z<-50&&z>-57) continue
      part('box',side*7.05,.135,z,.28,.02,.38,'#d7b84c')
      for(const dx of [-.08,0,.08]) part('box',side*7.05+dx,.15,z,.018,.012,.30,'#ebcc64')
    }
    for(let z=23;z>-78;z-=9.4) {
      part('box',side*6.45,.137,z,.22,.01,.7,'#55636a')
      for(let k=-.28;k<.3;k+=.08) part('box',side*6.45,.143,z+k,.24,.01,.02,'#8b9798')
    }
  }
  for(const side of [-1,1]) {
    for(let z=-98;z>-137;z-=7.8) flat(carpet,side*7.7,.126,z,1.5,4.4,z)
    for(let z=-98;z>-137;z-=.62) {
      part('box',side*7.95,.124,z,2.04,.01,.016,'#b1b8b4')
    }
    for(let z=-99;z>-137;z-=.42) {
      part('box',side*7.05,.135,z,.28,.02,.38,'#d7b84c')
      for(const dx of [-.08,0,.08]) part('box',side*7.05+dx,.15,z,.018,.012,.30,'#ebcc64')
    }
    for(let z=-99;z>-137;z-=9.4) {
      part('box',side*6.45,.137,z,.22,.01,.7,'#55636a')
      for(let k=-.28;k<.3;k+=.08) part('box',side*6.45,.143,z+k,.24,.01,.02,'#8b9798')
    }
  }

  // The existing utility poles get protective street-level sleeves.
  for(const side of [-1,1]) for(let z=21;z>-136;z-=17.5) {
    const x=side*POLE_X
    part('hazard',x,.54,z,.155,.92,.155,'#ffffff')
    part('cylinder',x,.99,z,.165,.045,.165,'#48565a')
    part('cylinder',x,.09,z,.17,.075,.17,'#4a5557')
  }

  // Short curb rails frame the shops while leaving the crossings open.
  for(const [side,from,to] of [[-1,-1,-9],[1,-5,-14],[-1,-37,-44]]) {
    const x=side*6.4, middle=(from+to)/2, length=from-to
    const sections=Math.ceil(length/1.35)
    for(let i=0;i<=sections;i++) {
      const z=from-length*i/sections
      part('cylinder',x,.57,z,.025,1.08,.025,'#647776')
      part('sphere',x,1.13,z,.042,.042,.042,'#a4b4ad')
    }
    for(const y of [.53,1.02]) part('box',x,y,middle,.034,.032,length,'#738887')
  }

  function sign(label: string, sub: string, x: number, y: number, z: number, width: number, height: number, color: string, rotate = 0) {
    const texture=mapCanvas(256,768,ctx=>{
      ctx.fillStyle='#f6eee1';ctx.fillRect(0,0,256,768)
      ctx.strokeStyle=color;ctx.lineWidth=12;ctx.strokeRect(9,9,238,750)
      ctx.strokeStyle='#cdbfab';ctx.lineWidth=2;ctx.strokeRect(25,25,206,718)
      ctx.fillStyle=color
      for(let i=0;i<5;i++) {
        const a=i*Math.PI*2/5
        ctx.beginPath();ctx.ellipse(128+Math.cos(a)*15,74+Math.sin(a)*15,11,18,a-Math.PI/2,0,Math.PI*2);ctx.fill()
      }
      ctx.fillStyle='#d8a2a7';ctx.beginPath();ctx.arc(128,74,8,0,Math.PI*2);ctx.fill()
      ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 79px "Yu Mincho","KaiTi",serif'
      const chars=[...label], start=150+(4-chars.length)*62
      chars.forEach((ch,i)=>ctx.fillText(ch,128,start+i*120))
      ctx.fillStyle='#a28175';ctx.fillRect(45,646,166,3)
      ctx.fillStyle=color;ctx.font='19px Arial,"Microsoft YaHei",sans-serif';ctx.fillText(sub,128,700)
    })
    const mat=keep(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}))
    const mesh=new THREE.Mesh(plane,mat)
    mesh.position.set(x,y,z);mesh.scale.set(width,height,1);mesh.rotation.y=rotate
    group.add(mesh)
    part('wood',x,y,z-.04,width+.1,height+.09,.08,'#9b947f',rotate)
    const side=Math.sign(x)
    part('box',x+side*.42,y+height*.43,z,.84,.05,.07,'#657875')
    part('box',x+side*.83,y+height*.43,z,.06,.14,.11,'#657875')
  }
  sign('晴天唱片','VINYL / COFFEE',-12.05,3.95,11.7,.65,2.15,'#344f55')
  sign('七里香','花と音楽',12.2,3.55,1.6,.56,2.05,'#8a5066')
  sign('珈琲','SINCE 2000',12.25,3.75,-8.5,.56,1.8,'#72544b')
  sign('和菓子','小さな春',-12.3,3.6,-17,.6,2.0,'#697862')
  sign('写真館','MEMORIES',14.6,4.1,-26.2,.6,2.05,'#665a71')
  sign('夜風茶屋','TEA / 18:00',-12.15,3.6,-107,.58,1.95,'#6b6d84')
  sign('河岸写真館','RIVER SIDE',12.2,3.76,-119,.58,1.95,'#697d73')

  function pot(x:number,z:number,color:string,flowers=false,base=0,seed=0) {
    part('cylinder',x,base+.19,z,.18,.34,.18,color)
    part('cylinder',x,base+.365,z,.205,.055,.205,color)
    part('cylinder',x,base+.397,z,.17,.02,.17,'#554737')
    for(let i=0;i<6;i++) {
      const angle=i*2.4+seed
      const lx=x+Math.sin(angle)*.16,lz=z+Math.cos(angle)*.16
      part('cylinder',lx,base+.58,lz,.012,.4,.012,'#6c8a4b')
      part('sphere',lx+.055,base+.56,lz,.10,.04,.06,'#638a4a',angle,-.35)
      part('sphere',lx-.05,base+.65,lz,.09,.035,.05,'#8aa45a',angle,.35)
      if(flowers) {
        const bloom=['#df95ac','#e8c271','#b1a4d5','#e9e1d2'][seed%4]
        for(let j=0;j<5;j++) part('sphere',lx+Math.cos(j*1.257)*.045,base+.77,lz+Math.sin(j*1.257)*.045,.043,.028,.045,bloom)
        part('sphere',lx,base+.79,lz,.024,.022,.024,'#d1b960')
      } else part('sphere',lx,base+.78,lz,.12,.22,.12,i%2?'#85a05e':'#557e4d')
    }
  }
  for(const [side,z] of [[1,17],[-1,12],[1,-8],[-1,-16],[1,-42],[-1,-66]]) {
    const x=side*11.15
    // A wood flower display with multiple levels and slender supports.
    for(const level of [0,.52]) {
      part('wood',x,level+.35,z,.75,.075,1.85,'#cab394')
      for(let i=0;i<4;i++) pot(x,z-.66+i*.44,['#ac735f','#d3c7ad','#797c6c'][i%3],true,level+.39,i+Math.round(Math.abs(z)))
    }
    for(const dx of [-.3,.3]) for(const dz of [-.82,.82]) part('wood',x+dx,.49,z+dz,.055,.93,.055,'#a88c6e')
    pot(x-side*.48,z+1.35,'#c3b3a1',false,0,3)
  }

  // Small A-frame menus face people coming down the street.
  for(const [x,z] of [[8.5,14],[-8.5,-10],[8.6,-43]]) {
    const texture=mapCanvas(256,384,ctx=>{
      ctx.fillStyle='#38554f';ctx.fillRect(0,0,256,384)
      ctx.strokeStyle='#ddc5a3';ctx.lineWidth=16;ctx.strokeRect(8,8,240,368)
      ctx.fillStyle='#f2e7ce';ctx.textAlign='center';ctx.font='32px Georgia';ctx.fillText('OPEN',128,64)
      ctx.font='20px "Microsoft YaHei"';ctx.fillText('今日のおすすめ',128,107)
      ctx.font='17px Georgia';['COFFEE','VINYL & FLOWERS','11:00 — 19:00'].forEach((s,i)=>ctx.fillText(s,128,164+i*40))
      ctx.beginPath();ctx.arc(128,313,21,0,Math.PI*2);ctx.strokeStyle='#eee0cb';ctx.lineWidth=2;ctx.stroke()
    })
    const mat=keep(toonMaterial({map:texture,side:THREE.DoubleSide}))
    const mesh=new THREE.Mesh(plane,mat);mesh.position.set(x,.77,z);mesh.scale.set(.62,.92,1);mesh.rotation.x=-.08;group.add(mesh)
    for(const dx of [-.35,.35]) part('wood',x+dx,.69,z,.055,1.18,.06,'#ad9375',0,-.1)
  }

  function vending(x:number,z:number,shade:string) {
    part('box',x,1.16,z,.95,2.18,.68,shade)
    part('box',x,2.29,z,1.0,.11,.74,'#e4e6db')
    const front=z+.352
    part('box',x-.12,1.52,front,.61,1.07,.045,'#d8e4e1')
    part('box',x+.33,1.25,front,.14,.69,.035,'#4c666d')
    part('box',x, .42, front,.7,.22,.035,'#3c4f55')
    for(let row=0;row<3;row++) for(let col=0;col<4;col++) {
      const px=x-.345+col*.15,py=1.21+row*.31
      part('cylinder',px,py,front+.02,.045,.18,.045,['#d6a1aa','#bfcb92','#f1dba6','#c3d6de'][col])
      part('box',px,py-.13,front+.05,.085,.025,.018,'#87ba9a')
    }
  }
  vending(-10.7,-6,'#8ea7a4')
  vending(10.8,-44.5,'#b48d8b')
  vending(-10.7,-112.5,'#899da7')
  vending(16.4,-28.6,'#7f9a78')

  // Low garden walls and fine leaves break the hard edge of the streetscape.
  for(const [side,z,length] of [[1,3,5],[-1,-23,4],[1,-65,7]]) {
    part('box',side*11.4,.38,z,.7,.59,length,'#c1c4b4')
    part('box',side*11.4,.71,z,.79,.08,length+.12,'#a6ad9d')
    for(let k=0;k<length*14;k++) {
      const px=side*11.4+Math.sin(k*13.7)*.25,pz=z-length/2+(k/(length*14))*length
      part('sphere',px,1.04+Math.sin(k)*.10,pz,.28,.36,.28,k%3?'#83a36a':'#62915e')
    }
  }

  // A readable bus front: windscreens, route label, lamps and a license plate.
  part('box',-8.7,1.8,11.33,1.75,.87,.025,'#a9c3cb')
  for(const x of [-9.53,-8.7,-7.87]) part('box',x,1.82,11.36,.04,.90,.03,'#e0ded6')
  part('box',-8.7,2.48,11.36,1.65,.24,.035,'#53616a')
  part('box',-8.7,.8,11.37,.51,.26,.03,'#d7bd69')
  for(const x of [-9.45,-7.95]) part('box',x,1.05,11.37,.30,.19,.045,'#efe6cf')
  part('box',-8.7,.61,11.35,1.92,.10,.10,'#5e6972')

  const transform=new THREE.Object3D()
  for(const [name,batch] of batches) {
    const mesh=keep(new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length))
    batch.items.forEach((item,i)=>{
      transform.position.set(item.p[0],item.p[1],item.p[2]);transform.scale.set(item.s[0],item.s[1],item.s[2]);transform.rotation.set(item.rx,item.ry,0);transform.updateMatrix()
      mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,item.color)
    })
    mesh.name=`Street detail ${name}`;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true
    mesh.castShadow=name!=='sphere';mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh)
  }
  return { dispose() { scene.remove(group);resources.forEach(resource=>resource.dispose());textures.dispose() } }
}
