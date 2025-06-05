export const toLonLatArray = (p: any) =>
  Array.isArray(p) ? p : [p.lon ?? p.lng, p.lat]
