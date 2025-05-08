import { haversine } from '../distance'
import { PositionLike } from '../distance'

function convertPosition(pos: PositionLike | [number, number]): {
  lon: number
  lat: number
} {
  return {
    lon:
      (pos as any).longitude ??
      (pos as any).lon ??
      (pos as any).lng ??
      (pos as any)[0],
    lat: (pos as any).latitude ?? (pos as any).lat ?? (pos as any)[1],
  }
}

export class Position {
  lon: number
  lat: number

  constructor(pos: PositionLike | [number, number]) {
    const { lon, lat } = convertPosition(pos)
    this.lon = Number(lon)
    this.lat = Number(lat)
  }

  isValid(): boolean {
    if (this.lon === undefined || this.lat === undefined) return false
    if (this.lon < -180 || this.lon > 180) return false
    if (this.lat < -90 || this.lat > 90) return false
    if (isNaN(this.lon) || isNaN(this.lat)) return false
    return true
  }

  distanceTo(position: PositionLike | Position): number {
    return haversine(this, position as any)
  }

  toObject() {
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
if (typeof module !== 'undefined') module.exports = Position
