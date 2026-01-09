import inside from 'point-in-polygon'

export interface Coordinate {
  lon: number
  lat: number
}

export function isInsideCoordinates(
  { lon, lat }: Coordinate,
  coordinates: number[][][]
): boolean {
  return coordinates.some((polygon) => inside([lon, lat], polygon as any))
}

export default { isInsideCoordinates }

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = { isInsideCoordinates }
}
