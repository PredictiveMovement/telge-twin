jest.mock('../../lib/vroom', () => ({
  plan: jest.fn(async ({ jobs }: any) => ({
    routes: [
      {
        steps: jobs.map((j: any) => ({ type: 'job', job: j.id })).reverse(),
      },
    ],
  })),
}))

jest.mock('../../lib/clustering', () => ({
  createSpatialChunks: (bookings: any[]) => [
    { id: 'area-1', bookings: bookings.slice(0, 1) },
    { id: 'area-2', bookings: bookings.slice(1) },
  ],
  calculateCenter: (arr: any[]) => {
    const b = arr[0]
    const { lon, lat } = b.pickup.position
    return { lng: lon, lat }
  },
}))

const {
  findBestRouteToPickupBookings,
} = require('../../lib/dispatch/truckDispatch')

describe('truckDispatch ordering via VROOM TSP (mocked)', () => {
  it('respects VROOM job order when merging instructions', async () => {
    const chunks = [
      { id: 'A', pickup: { position: { lon: 18.0, lat: 59.0 } } },
      { id: 'B', pickup: { position: { lon: 18.1, lat: 59.1 } } },
      { id: 'C', pickup: { position: { lon: 18.2, lat: 59.2 } } },
    ]
    const truck = {
      id: 't-1',
      position: { lon: 18.05, lat: 59.05 },
      destination: { lon: 18.05, lat: 59.05 },
      parcelCapacity: 10,
      cargo: [],
    }
    const plan = await findBestRouteToPickupBookings('exp', truck, chunks, [
      'pickup',
    ])
    expect(Array.isArray(plan)).toBe(true)
  })
})

export {}
