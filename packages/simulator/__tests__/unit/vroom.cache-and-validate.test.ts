jest.mock('node-fetch', () => jest.fn())

const fetchMock = require('node-fetch') as jest.Mock
const vroomLib = require('../../lib/vroom')

describe('VROOM cache normalization', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, routes: [{ steps: [] }], unassigned: [] }),
      text: async () => '',
    })
  })

  afterEach(() => {
    fetchMock.mockReset()
  })

  it('normalizes time windows in cache key so identical geo problems hit cache', async () => {
    const jobs: any[] = []
    const shipments = [
      {
        id: 1,
        amount: [1],
        pickup: { id: 10, location: [18.0, 59.0], time_windows: [[100, 200]] },
        delivery: {
          id: 11,
          location: [18.1, 59.1],
          time_windows: [[150, 250]],
        },
        service: 30,
      },
    ]
    const vehicles = [
      {
        id: 1,
        time_window: [0, 3600],
        capacity: [10],
        start: [18.0, 59.0],
        end: [18.0, 59.0],
      },
    ]

    // Spy on cache
    const cache = require('../../lib/cache')
    const getSpy = jest.spyOn(cache, 'getFromCache')
    const updSpy = jest
      .spyOn(cache, 'updateCache')
      .mockResolvedValue({ code: 0 })

    await vroomLib.plan({ jobs, shipments, vehicles })
    expect(getSpy).toHaveBeenCalled()

    const shipments2 = [
      {
        ...shipments[0],
        pickup: { ...shipments[0].pickup, time_windows: [[300, 400]] },
        delivery: { ...shipments[0].delivery, time_windows: [[350, 450]] },
      },
    ]
    await vroomLib.plan({ jobs, shipments: shipments2, vehicles })

    expect(getSpy).toHaveBeenCalledTimes(2)

    updSpy.mockRestore()
  })
})

export {}
