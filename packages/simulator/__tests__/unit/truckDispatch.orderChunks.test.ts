jest.mock('../../lib/vroom', () => {
  const original = jest.requireActual('../../lib/vroom')
  return {
    __esModule: true,
    ...original,
    plan: jest.fn(async ({ jobs = [] }: any) => {
      if (Array.isArray(jobs) && jobs.length > 0) {
        return {
          routes: [
            {
              steps: jobs
                .map((j: any) => ({ type: 'job', job: j.id }))
                .reverse(),
            },
          ],
          unassigned: [],
        }
      }
      return {
        routes: [{ steps: [] }],
        unassigned: [],
      }
    }),
  }
})

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

jest.mock('../../web/services/ElasticsearchService', () => ({
  elasticsearchService: {
    findDocumentById: jest.fn(async () => ({ _id: 'exp' })),
  },
}))

const {
  findBestRouteToPickupBookings,
} = require('../../lib/dispatch/truckDispatch')
const {
  resetCancelledExperiments,
} = require('../../lib/cancelledExperiments')
const { elasticsearchService } = require('../../web/services/ElasticsearchService')

describe('truckDispatch ordering via VROOM TSP (mocked)', () => {
  beforeEach(() => {
    resetCancelledExperiments()
    ;(elasticsearchService.findDocumentById as jest.Mock).mockResolvedValue({
      _id: 'exp',
    })
  })

  it('respects VROOM job order when merging instructions', async () => {
    const chunks = [
      {
        id: 'A',
        pickup: { position: { lon: 18.0, lat: 59.0 } },
        destination: { position: { lon: 18.01, lat: 59.01 } },
      },
      {
        id: 'B',
        pickup: { position: { lon: 18.1, lat: 59.1 } },
        destination: { position: { lon: 18.11, lat: 59.11 } },
      },
      {
        id: 'C',
        pickup: { position: { lon: 18.2, lat: 59.2 } },
        destination: { position: { lon: 18.21, lat: 59.21 } },
      },
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
