import { haversine } from '../distance'
import { PositionLike } from '../distance'

function isTuple(
  pos: PositionLike | [number, number]
): pos is [number, number] {
  return Array.isArray(pos)
}

function convertPosition(pos: PositionLike | [number, number]): {
  lon: number
  lat: number
} {
  let lon: number | undefined
  let lat: number | undefined

  if (isTuple(pos)) {
    ;[lon, lat] = pos
  } else {
    lon = pos.longitude ?? pos.lon ?? pos.lng
    lat = pos.latitude ?? pos.lat
  }

  return { lon: Number(lon ?? 0), lat: Number(lat ?? 0) }
}

export class Position {
  public lat: number
  public lng: number
  public lon: number

  constructor(pos: PositionLike | [number, number]) {
    const { lon, lat } = convertPosition(pos)
    this.lat = Number(lat)
    this.lng = Number(lon)
    this.lon = Number(lon)
  }

  isValid(): boolean {
    if (this.lon === undefined || this.lat === undefined) return false
    if (this.lon < -180 || this.lon > 180) return false
    if (this.lat < -90 || this.lat > 90) return false
    if (isNaN(this.lon) || isNaN(this.lat)) return false
    return true
  }

  distanceTo(position: PositionLike | Position): number {
    return haversine(this, position as PositionLike)
  }

  toObject() {
    return { lon: this.lon, lat: this.lat }
  }

  toJSON() {
    return { lon: this.lon, lat: this.lat }
  }

  toString() {
    return JSON.stringify(this.toObject(), null, 2)
  }
}

export default Position

// CommonJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = Position
  module.exports.Position = Position
}
