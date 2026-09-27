/** Per-shop street props so each facade reads a different neighborhood role. */
import * as THREE from 'three'
import { eachShop, type ShopSpot } from '../layout'
import { toonMaterial } from '../toon'

type Role = 'flower' | 'bakery' | 'cafe' | 'bookshop' | 'general'

const ROLES: Role[] = ['flower', 'bakery', 'cafe', 'bookshop', 'general']
const UP = new THREE.Vector3(0, 1, 0)

type Inst = {
  position: THREE.Vector3
  scale: THREE.Vector3
  color: THREE.Color
  rotation: THREE.Quaternion
}

function canvasSign(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  paint(ctx, w, h)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

export function addShopVariety(scene: THREE.Scene): {
  update?: (time: number, night: number) => void
  dispose: () => void
} {
  const group = new THREE.Group()
  group.name = 'Shop variety'
  scene.add(group)

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const meshes: THREE.Object3D[] = []
  const keepGeo = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g)
  const keepMat = <T extends THREE.Material>(m: T) => (materials.push(m), m)
  const keepTex = <T extends THREE.Texture>(t: T) => (textures.push(t), t)

  const boxGeo = keepGeo(new THREE.BoxGeometry(1, 1, 1))
  const cylGeo = keepGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 10))
  const sphereGeo = keepGeo(new THREE.SphereGeometry(0.5, 10, 8))
  const planeGeo = keepGeo(new THREE.PlaneGeometry(1, 1))
  const toon = keepMat(toonMaterial())
  const soft = keepMat(toonMaterial({ soft: true }))

  const crates: Inst[] = []
  const pots: Inst[] = []
  const blooms: Inst[] = []
  const woods: Inst[] = []
  const fabrics: Inst[] = []
  const metals: Inst[] = []
  const dummy = new THREE.Object3D()
  const identity = new THREE.Quaternion()

  const push = (
    list: Inst[],
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    color: string,
    rotation = identity,
  ) => {
    list.push({
      position: new THREE.Vector3(x, y, z),
      scale: new THREE.Vector3(sx, sy, sz),
      color: new THREE.Color(color),
      rotation: rotation.clone(),
    })
  }

  const faceQuat = (side: number) =>
    new THREE.Quaternion().setFromAxisAngle(UP, -side * Math.PI / 2)

  /** Street-side offset from the facade; stays clear of the |x|<5.5 lane. */
  const streetX = (towardStreet: number, side: number, meters: number) =>
    towardStreet - side * meters

  const cafeBoards: THREE.MeshBasicMaterial[] = []

  let roleCursor = 0
  let plantShelfPlaced = false

  eachShop((spot: ShopSpot) => {
    if (spot.index === 2 || spot.record) return
    const role = ROLES[roleCursor % ROLES.length]
    roleCursor++
    const { side, z, width, height, towardStreet, index } = spot
    const face = faceQuat(side)
    const edge = width * 0.5
    // Varied blade-sign hang heights so the street rhythm is not flat.
    const signY = 2.55 + (index % 5) * 0.28 + (side > 0 ? 0.12 : 0)

    // Small projecting blade sign unique to this module (canvas face).
    {
      const label =
        role === 'flower' ? '花' :
        role === 'bakery' ? 'パン' :
        role === 'cafe' ? '珈琲' :
        role === 'bookshop' ? '本' : '雑貨'
      const tint =
        role === 'flower' ? '#f0d4dc' :
        role === 'bakery' ? '#f3e2c4' :
        role === 'cafe' ? '#d9e4d6' :
        role === 'bookshop' ? '#d7e0ea' : '#e8dcc8'
      const tex = keepTex(canvasSign(256, 256, (ctx, w, h) => {
        ctx.fillStyle = tint
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#3a4a52'
        ctx.lineWidth = 10
        ctx.strokeRect(12, 12, w - 24, h - 24)
        ctx.fillStyle = '#2a3a42'
        ctx.font = 'bold 92px "Noto Sans SC","Microsoft YaHei",sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, w / 2, h / 2 + 4)
      }))
      const mat = keepMat(new THREE.MeshBasicMaterial({
        map: tex, side: THREE.DoubleSide, toneMapped: false,
      }))
      const board = new THREE.Mesh(planeGeo, mat)
      const bx = streetX(towardStreet, side, 1.05)
      const bz = z + edge - 0.55
      board.position.set(bx, signY, bz)
      board.scale.set(0.58, 0.58, 1)
      board.quaternion.copy(face)
      group.add(board)
      meshes.push(board)
      push(metals, streetX(towardStreet, side, 0.55), signY, bz, 0.5, 0.04, 0.04, '#6a7a7e')
      push(woods, streetX(towardStreet, side, 0.78), signY, bz, 0.04, 0.62, 0.04, '#8a7260')
    }

    if (role === 'flower') {
      const base = streetX(towardStreet, side, 1.15)
      for (let i = 0; i < 3; i++) {
        const pz = z - 0.7 + i * 0.55
        push(pots, base, 0.28, pz, 0.38, 0.42, 0.38, i % 2 ? '#8b6a55' : '#6f7f6a')
        push(blooms, base, 0.62, pz, 0.42, 0.36, 0.42, i % 3 ? '#e8a0b4' : '#f2d48a')
        push(blooms, base + side * 0.08, 0.72, pz + 0.06, 0.28, 0.26, 0.28, '#7fa876')
      }
      // Wrapping-paper roll on a low stand.
      const rollZ = z + edge - 0.9
      push(woods, streetX(towardStreet, side, 0.95), 0.35, rollZ, 0.35, 0.08, 0.55, '#c4a88a')
      const rollAxis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
      push(fabrics, streetX(towardStreet, side, 0.95), 0.55, rollZ, 0.42, 0.42, 0.55, '#f2c9d4', rollAxis)
      push(metals, streetX(towardStreet, side, 0.95), 0.55, rollZ, 0.12, 0.12, 0.58, '#d8d2c4', rollAxis)
    }

    if (role === 'bakery') {
      const trayX = streetX(towardStreet, side, 1.05)
      push(woods, trayX, 0.55, z, 0.55, 0.08, width * 0.42, '#b8956e')
      push(woods, trayX, 0.28, z - width * 0.12, 0.06, 0.5, 0.06, '#9a7a58')
      push(woods, trayX, 0.28, z + width * 0.12, 0.06, 0.5, 0.06, '#9a7a58')
      // Checkered cloth draped over the tray.
      const cloth = keepTex(canvasSign(128, 128, (ctx, w, h) => {
        const cell = 16
        for (let y = 0; y < h; y += cell) {
          for (let x = 0; x < w; x += cell) {
            ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? '#f4efe6' : '#c45c5c'
            ctx.fillRect(x, y, cell, cell)
          }
        }
      }))
      const clothMat = keepMat(toonMaterial({ map: cloth, side: THREE.DoubleSide, soft: true }))
      const clothMesh = new THREE.Mesh(planeGeo, clothMat)
      clothMesh.position.set(trayX, 0.6, z)
      clothMesh.scale.set(0.52, width * 0.4, 1)
      clothMesh.rotation.x = -Math.PI / 2
      clothMesh.rotation.z = -side * Math.PI / 2
      group.add(clothMesh)
      meshes.push(clothMesh)
      for (let i = -2; i <= 2; i++) {
        push(woods, trayX - side * 0.05, 0.72, z + i * 0.22, 0.22, 0.14, 0.16, i % 2 ? '#e8c99a' : '#d4a86a')
      }
    }

    if (role === 'cafe') {
      const seatX = streetX(towardStreet, side, 1.25)
      for (const dz of [-0.55, 0.55]) {
        const cz = z + dz
        push(woods, seatX, 0.28, cz, 0.32, 0.05, 0.32, '#7a5e48')
        push(woods, seatX - 0.1, 0.14, cz - 0.1, 0.04, 0.26, 0.04, '#6a5040')
        push(woods, seatX + 0.1, 0.14, cz - 0.1, 0.04, 0.26, 0.04, '#6a5040')
        push(woods, seatX - 0.1, 0.14, cz + 0.1, 0.04, 0.26, 0.04, '#6a5040')
        push(woods, seatX + 0.1, 0.14, cz + 0.1, 0.04, 0.26, 0.04, '#6a5040')
        push(woods, seatX, 0.48, cz - 0.12, 0.3, 0.28, 0.04, '#8a6e58')
      }
      const boardTex = keepTex(canvasSign(256, 384, (ctx, w, h) => {
        ctx.fillStyle = '#3d524c'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#e8d5b0'
        ctx.lineWidth = 14
        ctx.strokeRect(10, 10, w - 20, h - 20)
        ctx.fillStyle = '#f3e8d0'
        ctx.textAlign = 'center'
        ctx.font = 'bold 72px "Noto Sans SC","Microsoft YaHei",sans-serif'
        ctx.fillText('珈琲', w / 2, h * 0.38)
        ctx.font = '28px Georgia,"Noto Sans SC",sans-serif'
        ctx.fillText('COFFEE', w / 2, h * 0.58)
        ctx.font = '22px Georgia'
        ctx.fillText('11:00 — 20:00', w / 2, h * 0.74)
      }))
      const boardMat = keepMat(new THREE.MeshBasicMaterial({
        map: boardTex, side: THREE.DoubleSide, toneMapped: false,
      }))
      cafeBoards.push(boardMat)
      const board = new THREE.Mesh(planeGeo, boardMat)
      const boardX = streetX(towardStreet, side, 0.95)
      board.position.set(boardX, 0.85, z + edge - 0.7)
      board.scale.set(0.48, 0.72, 1)
      board.quaternion.copy(face)
      board.rotation.x -= 0.08
      group.add(board)
      meshes.push(board)
      push(woods, boardX, 0.42, z + edge - 0.7, 0.05, 0.8, 0.05, '#6a5648')
    }

    if (role === 'bookshop') {
      const cartX = streetX(towardStreet, side, 1.2)
      const cartZ = z - 0.15
      push(woods, cartX, 0.55, cartZ, 0.7, 0.08, 1.15, '#8b6f52')
      push(woods, cartX, 0.95, cartZ, 0.65, 0.06, 1.05, '#9a7d5c')
      push(woods, cartX, 0.28, cartZ - 0.45, 0.06, 0.5, 0.06, '#6e5640')
      push(woods, cartX, 0.28, cartZ + 0.45, 0.06, 0.5, 0.06, '#6e5640')
      push(metals, cartX - side * 0.28, 0.12, cartZ - 0.48, 0.14, 0.14, 0.05, '#4a555a')
      push(metals, cartX - side * 0.28, 0.12, cartZ + 0.48, 0.14, 0.14, 0.05, '#4a555a')
      const spines = ['#c45c5c', '#4a6f8a', '#6a8a5a', '#b8894a', '#7a5a8a', '#d4c4a0']
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 5; i++) {
          push(
            woods,
            cartX - side * (0.05 + row * 0.08),
            0.68 + row * 0.38,
            cartZ - 0.4 + i * 0.2,
            0.12, 0.28, 0.16,
            spines[(i + row + index) % spines.length],
          )
        }
      }
    }

    if (role === 'general') {
      const crateX = streetX(towardStreet, side, 1.1)
      for (let i = 0; i < 3; i++) {
        const pz = z - 0.5 + i * 0.48
        const stacked = i === 1
        push(crates, crateX, stacked ? 0.55 : 0.28, pz, 0.48, 0.38, 0.48, i % 2 ? '#a88462' : '#8f7052')
        if (stacked) push(crates, crateX, 0.22, pz, 0.5, 0.36, 0.5, '#7d6248')
      }
      // Noren strips hanging just ahead of the doorway.
      const norenTex = keepTex(canvasSign(512, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        const panels = 4
        const pw = w / panels
        for (let i = 0; i < panels; i++) {
          ctx.fillStyle = i % 2 ? '#2f4a56' : '#3d5c4a'
          ctx.fillRect(i * pw + 4, 0, pw - 8, h)
          ctx.fillStyle = '#e8d9b8'
          ctx.font = 'bold 64px "Noto Sans SC","Microsoft YaHei",sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('開', i * pw + pw / 2, h * 0.55)
        }
      }))
      const norenMat = keepMat(toonMaterial({
        map: norenTex, transparent: true, alphaTest: 0.15,
        side: THREE.DoubleSide, soft: true, depthWrite: false,
      }))
      const noren = new THREE.Mesh(planeGeo, norenMat)
      noren.position.set(streetX(towardStreet, side, 0.85), 2.15, z)
      noren.scale.set(Math.min(width - 1.2, 2.4), 1.15, 1)
      noren.quaternion.copy(face)
      group.add(noren)
      meshes.push(noren)
      push(woods, streetX(towardStreet, side, 0.82), 2.78, z, 0.06, 0.06, Math.min(width - 1.1, 2.5), '#5a4a3a')
    }

    // One far-side (side === 1) shop gets a second-floor plant shelf.
    if (side === 1 && !plantShelfPlaced && height > 6.5) {
      plantShelfPlaced = true
      const shelfY = Math.min(height - 1.6, 5.2)
      const shelfX = streetX(towardStreet, side, 0.9)
      push(woods, shelfX, shelfY, z, 0.45, 0.08, width * 0.55, '#8a7260')
      push(metals, shelfX, shelfY - 0.35, z - width * 0.18, 0.04, 0.7, 0.04, '#6a7a72')
      push(metals, shelfX, shelfY - 0.35, z + width * 0.18, 0.04, 0.7, 0.04, '#6a7a72')
      for (let i = -2; i <= 2; i++) {
        const pz = z + i * 0.35
        push(pots, shelfX, shelfY + 0.18, pz, 0.28, 0.26, 0.28, i % 2 ? '#9a7a62' : '#7a8a6a')
        push(blooms, shelfX, shelfY + 0.42, pz, 0.32, 0.28, 0.32, i % 2 ? '#6f9a72' : '#e8b0bc')
      }
    }
  })

  const flush = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    list: Inst[],
  ) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(geometry, material, list.length)
    list.forEach((entry, i) => {
      dummy.position.copy(entry.position)
      dummy.quaternion.copy(entry.rotation)
      dummy.scale.copy(entry.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, entry.color)
    })
    mesh.name = name
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    group.add(mesh)
    meshes.push(mesh)
  }

  flush('Shop variety crates', boxGeo, toon, crates)
  flush('Shop variety pots', cylGeo, toon, pots)
  flush('Shop variety blooms', sphereGeo, soft, blooms)
  flush('Shop variety wood', boxGeo, toon, woods)
  flush('Shop variety fabric', cylGeo, soft, fabrics)
  flush('Shop variety metal', boxGeo, toon, metals)

  return {
    update(_time: number, night: number) {
      for (const mat of cafeBoards) {
        mat.color.setRGB(1, 1 - night * 0.08, 1 - night * 0.15)
      }
    },
    dispose() {
      scene.remove(group)
      for (const mesh of meshes) {
        if (mesh instanceof THREE.InstancedMesh) mesh.dispose()
        group.remove(mesh)
      }
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}
