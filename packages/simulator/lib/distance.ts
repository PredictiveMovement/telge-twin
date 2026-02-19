export interface PositionLike {
  lon?: number
  lat?: number
  lng?: number
  longitude?: number
  latitude?: number
  0?: number
  1?: number
}

function isTuple(
  pos: PositionLike | [number, number]
): pos is [number, number] {
  return Array.isArray(pos)
}

export function convertPosition(pos: PositionLike | [number, number]): {
  lon: number
  lat: number
} {
  let lon: number | undefined
  let lat: number | undefined

  if (isTuple(pos)) {
    ;[lon, lat] = pos
  } else {
    // Object-like
    lon = pos.longitude ?? pos.lon ?? pos.lng
    lat = pos.latitude ?? pos.lat
  }

  // Fallback to 0 if still undefined to avoid NaN later (should not happen in valid data)
  return {
    lon: Number(lon ?? 0),
    lat: Number(lat ?? 0),
  }
}

function pythagoras(fromInput: PositionLike, toInput: PositionLike): number {
  const from = convertPosition(fromInput)
  const to = convertPosition(toInput)
  return Math.hypot(from.lat - to.lat, from.lon - to.lon)
}

function rad(x: number): number {
  return (x * Math.PI) / 180
}

// Haversine distance in meters
export function haversine(
  p1Input: PositionLike,
  p2Input: PositionLike
): number {
  const p1 = convertPosition(p1Input)
  const p2 = convertPosition(p2Input)

  const R = 6371000
  const dLat = rad(p2.lat - p1.lat)
  const dLong = rad(p2.lon - p1.lon)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(p1.lat)) *
      Math.cos(rad(p2.lat)) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c) || 0
}

export function bearing(p1Input: PositionLike, p2Input: PositionLike): number {
  const p1 = convertPosition(p1Input)
  const p2 = convertPosition(p2Input)
  return Math.round(
    (Math.atan2(
      Math.cos(p1.lat) * Math.sin(p2.lat) -
        Math.sin(p1.lat) * Math.cos(p2.lat) * Math.cos(p2.lon - p1.lon),
      Math.sin(p2.lon - p1.lon) * Math.cos(p2.lat)
    ) *
      180) /
      Math.PI
  )
}

// Add meters dx (x east) dy (y north) to a position
export function addMeters(
  posInput: PositionLike,
  { x, y }: { x: number; y: number }
): { lon: number; lat: number } {
  const pos = convertPosition(posInput)
  const R = 6371000 // Earth radius in meters

  const lat = pos.lat + (y / R) * (180 / Math.PI)
  const lon =
    pos.lon + ((x / R) * (180 / Math.PI)) / Math.cos((pos.lat * Math.PI) / 180)

  return { lon, lat }
}

export default {
  pythagoras,
  haversine,
  bearing,
  convertPosition,
  addMeters,
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = {
    pythagoras,
    haversine,
    bearing,
    convertPosition,
    addMeters,
  }
}
