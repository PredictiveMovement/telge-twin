export const PELIAS_URL = (
  import.meta as unknown as { env: { VITE_PELIAS_URL?: string } }
).env.VITE_PELIAS_URL || 'https://pelias.telge.iteam.pub'
