export const BOOKING_COLORS = {
  paper: [0, 100, 0],
  plastic: [255, 255, 0],
  glass: [0, 0, 255],
  metal: [192, 192, 192],
  organic: [139, 69, 19],
  DELIVERED: [128, 128, 128],
  PICKED_UP: [255, 165, 0],
  UNREACHABLE: [255, 140, 0],
  ASSIGNED: [100, 150, 255],
  QUEUED: [200, 100, 255],
  default: [254, 254, 254],
} as const

export const RECYCLING_TYPE_LABELS = {
  paper: 'Papper',
  plastic: 'Plast',
  glass: 'Glas',
  metal: 'Metall',
  organic: 'Organiskt',
} as const

export const STATUS_LABELS = {
  Delivered: 'Levererad',
  'Picked up': 'Upphämtad',
  Assigned: 'Tilldelad',
  Queued: 'I kö',
  Unreachable: 'Ej utförd',
} as const

export const DEFAULT_FILTERS = {
  recyclingTypes: new Set(['paper', 'plastic', 'glass', 'metal', 'organic']),
  statuses: new Set([
    'Assigned',
    'Queued',
    'Picked up',
    'Delivered',
    'Unreachable',
  ]),
  showAll: true,
}
