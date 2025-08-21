import pip from 'point-in-polygon'
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core'
import { Booking } from '@/types/map'

export const MAP_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  colorful: 'mapbox://styles/mapbox/outdoors-v12',
} as const

export const COLORS = {
  booking: {
    DELIVERED: [128, 128, 128],
    PICKED_UP: [255, 165, 0],
    paper: [0, 100, 0],
    plastic: [255, 255, 0],
    glass: [0, 0, 255],
    metal: [192, 192, 192],
    organic: [139, 69, 19],
    default: [254, 254, 254],
  },
  partition: [
    [255, 140, 0],
    [0, 150, 200],
    [150, 50, 200],
    [200, 50, 100],
    [50, 200, 50],
    [200, 200, 50],
    [200, 100, 50],
    [50, 200, 200],
  ],
  vehicle: {
    active: [0, 200, 0],
    default: [254, 254, 254],
  },
}

export const ICON_MAPPING = {
  ready: { x: 40, y: 0, width: 40, height: 40, mask: false },
  default: { x: 0, y: 0, width: 40, height: 40, mask: false },
}

export const getPartitionColor = (partitionId: string): number[] => {
  const hash = partitionId
    .split('')
    .reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)
  return COLORS.partition[Math.abs(hash) % COLORS.partition.length]
}

export const getVehicleColor = ({ status }: { status: string }): number[] => {
  const opacity = Math.round((4 / 5) * 255)
  const isActive = ['delivery', 'end', 'ready', 'returning'].includes(status)
  return [
    ...(isActive ? COLORS.vehicle.active : COLORS.vehicle.default),
    opacity,
  ]
}

export const getBookingColor = ({
  status,
  recyclingType,
}: Booking): number[] => {
  const opacity =
    status === 'Delivered'
      ? 55
      : status === 'Picked up'
      ? 128
      : Math.round((4 / 5) * 255)

  if (status === 'Delivered') return [...COLORS.booking.DELIVERED, opacity]
  if (status === 'Picked up') return [...COLORS.booking.PICKED_UP, opacity]

  return [
    ...(COLORS.booking[recyclingType as keyof typeof COLORS.booking] ||
      COLORS.booking.default),
    opacity,
  ]
}

export const pointInRect = (pt: [number, number], bb: any) =>
  pt[0] >= bb.minLng &&
  pt[0] <= bb.maxLng &&
  pt[1] >= bb.minLat &&
  pt[1] <= bb.maxLat

export const pointInPoly = (pt: [number, number], poly: number[][]) =>
  Array.isArray(poly) && poly.length >= 3 ? pip([pt[0], pt[1]], poly) : false

// Shared lighting effect
const ambientLight = new AmbientLight({ intensity: 1 })
const dirLight = new DirectionalLight({
  intensity: 1.8,
  direction: [-1, -3, -1],
})
export const lightingEffect = new LightingEffect({ ambientLight, dirLight })

// Terrain/stads­extrusion tas bort – kartan hålls platt.
export const enable3D = (map: any) => {
  if (!map || !map.getStyle) return

  // Lägg endast till 3D-byggnader och himmel – hoppa över terräng så punkter inte svävar.

  // Sky-lager för lite atmosfär
  if (map.getStyle()?.layers && !map.getLayer('sky')) {
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun-intensity': 15,
      },
    })
  }

  // 3D-byggnader från composite source (kräver att stilen har det)
  const labelLayerId = (map.getStyle().layers || []).find(
    (l: any) => l.type === 'symbol' && l.layout?.['text-field']
  )?.id

  if (!map.getLayer('3d-buildings')) {
    try {
      if (!map.getSource('composite')) throw new Error('no composite source')
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', ['get', 'extrude'], 'true'],
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': '#b8c1c9',
            'fill-extrusion-opacity': 0.6,
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13,
              0,
              14,
              ['get', 'height'],
            ],
            'fill-extrusion-base': ['get', 'min_height'],
          },
        },
        labelLayerId
      )
    } catch {
      /* ingen composite-källa – ignorera */
    }
  }
}

export const disable3D = (map: any) => {
  if (!map) return
  try {
    if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings')
  } catch {}
}
