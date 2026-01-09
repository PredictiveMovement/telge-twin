export const toLonLatArray = (
  p: { lon?: number; lng?: number; lat: number } | [number, number]
): [number, number] =>
  Array.isArray(p) ? (p as [number, number]) : [p.lon ?? p.lng ?? 0, p.lat]
