/** Shared street measurements so shops, sidewalks and collision stay aligned. */

export function hash01(value: number) {
  const result = Math.sin(value * 127.1) * 43758.5453
  return result - Math.floor(result)
}

/** Asphalt runs from -ROAD_HALF to ROAD_HALF. Total width is 12m. */
export const ROAD_HALF = 6
export const SIDEWALK_X = 7.65
export const POLE_X = 9.2
export const TREE_X = 9.55

export type ShopSpot = {
  index: number
  side: number
  z: number
  width: number
  height: number
  depth: number
  x: number
  towardStreet: number
  record: boolean
}

/** The same shop row the storefronts and the building meshes both walk. */
export function eachShop(visit: (spot: ShopSpot) => void) {
  let index = 0
  for (const side of [-1, 1]) {
    for (let z = 19; z > -76; z -= 9.2) {
      if (z < -22 && z > -40) continue
      if (z < -43 && z > -69) continue
      if (z < -69 && z > -78) continue
      const record = index === 2
      const width = record ? 4.4 : 5.4 + hash01(index * 13.1 + 2) * 2.9
      const height = record ? 7.6 : 4.9 + hash01(index * 19.7 + 4) * 3.6
      const depth = record ? 6.8 : 5.0 + hash01(index * 29.3 + 1) * 2.1
      const x = side * ((record ? 16.2 : 15.15) + hash01(index * 7.7) * (record ? 0.2 : 1.2))
      const towardStreet = x - side * (depth / 2 + 0.03)
      visit({ index, side, z, width, height, depth, x, towardStreet, record })
      index++
    }
  }
}

export function insideDistrict(x: number, z: number) {
  const spine = Math.abs(x) <= 8.8 && z <= 28.5 && z >= -142
  const plaza = Math.abs(z + 31.5) <= 3.8 && Math.abs(x) <= 31.5
  const station = Math.abs(z + 47) <= 3.5 && Math.abs(x) <= 27.5
  return spine || plaza || station
}
