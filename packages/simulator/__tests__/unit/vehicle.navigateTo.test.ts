const Vehicle = require('../../lib/vehicles/vehicle').default
const Position = require('../../lib/models/position')
const { VirtualTime } = require('../../lib/virtualTime')

describe('Vehicle.navigateTo', () => {
  let virtualTime: any
  let subscription: any

  beforeEach(() => {
    virtualTime = new VirtualTime(40, 6, 15)
    subscription = virtualTime.getTimeInMilliseconds().subscribe(() => {})
  })

  afterEach(() => {
    subscription?.unsubscribe?.()
  })

  it('uses precomputed route from instruction and sets route.started', async () => {
    const precomputedRoute = {
      geometry: {
        coordinates: [
          { lat: 59.135449, lon: 17.571239 },
          { lat: 59.145449, lon: 17.581239 },
        ],
      },
      duration: 60,
      distance: 1000,
      legs: [{ annotation: { duration: [60], distance: [1000] } }],
    }

    const vehicle = new Vehicle({
      id: 'vehicle-1',
      position: new Position({ lat: 59.135449, lon: 17.571239 }),
      startPosition: new Position({ lat: 59.135449, lon: 17.571239 }),
      virtualTime,
    })

    vehicle.instruction = { route: precomputedRoute }
    vehicle.simulate = jest.fn()

    const start = virtualTime.now()

    vehicle.navigateTo(
      new Position({ lat: 59.145449, lon: 17.581239 })
    )

    expect(vehicle.route).toBe(precomputedRoute)
    expect(vehicle.route.started - start).toBeLessThan(100)
    expect(vehicle.simulate).toHaveBeenCalledWith(precomputedRoute)
  })

  it('calls stopped() when destination is close', () => {
    const vehicle = new Vehicle({
      id: 'vehicle-2',
      position: new Position({ lat: 59.135449, lon: 17.571239 }),
      virtualTime,
    })

    vehicle.stopped = jest.fn()

    const dest = new Position({ lat: 59.135449, lon: 17.571239 })
    const result = vehicle.navigateTo(dest)

    expect(result).toBe(dest)
    expect(vehicle.stopped).toHaveBeenCalled()
  })
})
