import { sodertaljeCoordinates, telgeCoordinates } from './coordinates'

const Booking = require('../../lib/models/booking').default

export function createTestBooking(overrides: any = {}) {
  return new Booking({
    id: `booking-${Math.random().toString(36).substr(2, 9)}`,
    pickup: { position: sodertaljeCoordinates.centrum1 },
    destination: { position: sodertaljeCoordinates.depot1 },
    recyclingType: 'HUSHSORT',
    ...overrides,
  })
}

export function createBookingsForClustering() {
  return [
    // Centrum cluster
    createTestBooking({
      id: 'b1',
      pickup: { position: sodertaljeCoordinates.centrum1 },
      recyclingType: 'HUSHSORT',
    }),
    createTestBooking({
      id: 'b2',
      pickup: { position: sodertaljeCoordinates.centrum2 },
      recyclingType: 'HUSHSORT',
    }),
    createTestBooking({
      id: 'b3',
      pickup: { position: sodertaljeCoordinates.centrum3 },
      recyclingType: 'MATAVF',
    }),

    // Ronna cluster
    createTestBooking({
      id: 'b4',
      pickup: { position: sodertaljeCoordinates.ronna1 },
      recyclingType: 'PAPPFÖRP',
    }),
    createTestBooking({
      id: 'b5',
      pickup: { position: sodertaljeCoordinates.ronna2 },
      recyclingType: 'PAPPFÖRP',
    }),
    createTestBooking({
      id: 'b6',
      pickup: { position: sodertaljeCoordinates.ronna3 },
      recyclingType: 'PLASTFÖRP',
    }),

    // Weda cluster
    createTestBooking({
      id: 'b7',
      pickup: { position: sodertaljeCoordinates.weda1 },
      recyclingType: 'GLOF',
    }),
    createTestBooking({
      id: 'b8',
      pickup: { position: sodertaljeCoordinates.weda2 },
      recyclingType: 'GLOF',
    }),
    createTestBooking({
      id: 'b9',
      pickup: { position: sodertaljeCoordinates.weda3 },
      recyclingType: 'GLOF',
    }),
  ]
}

export function createBookingWithWasteType(
  wasteType: string,
  position: any = null
) {
  return createTestBooking({
    recyclingType: wasteType,
    pickup: { position: position || sodertaljeCoordinates.centrum1 },
  })
}

export function createBookingsWithServiceType(
  serviceType: string,
  count: number = 3
) {
  const bookings: any[] = []
  for (let i = 0; i < count; i++) {
    bookings.push(
      createTestBooking({
        originalRecord: { Tjtyp: serviceType },
        recyclingType: 'HUSHSORT',
      })
    )
  }
  return bookings
}

export function createTelgeBookings() {
  return [
    createTestBooking({
      id: 'telge-1',
      pickup: { position: telgeCoordinates.pickup1 },
      recyclingType: 'HUSHSORT',
      originalRecord: { Tjtyp: 'KRL140', Avftyp: 'HUSHSORT' },
    }),
    createTestBooking({
      id: 'telge-2',
      pickup: { position: telgeCoordinates.pickup2 },
      recyclingType: 'MATAVF',
      originalRecord: { Tjtyp: 'KRL240', Avftyp: 'MATAVF' },
    }),
    createTestBooking({
      id: 'telge-3',
      pickup: { position: telgeCoordinates.pickup3 },
      recyclingType: 'PAPPFÖRP',
      originalRecord: { Tjtyp: 'KRL370', Avftyp: 'PAPPFÖRP' },
    }),
  ]
}
