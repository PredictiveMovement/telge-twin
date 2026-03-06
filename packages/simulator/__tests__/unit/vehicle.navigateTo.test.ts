jest.mock('../../lib/osrm', () => ({
  route: jest.fn(),
}))

const Vehicle = require('../../lib/vehicles/vehicle').default
const Position = require('../../lib/models/position')
const { VirtualTime } = require('../../lib/virtualTime')
const osrm = require('../../lib/osrm')

describe('Vehicle.navigateTo', () => {
  let virtualTime: any
  let subscription: any

  beforeEach(() => {
    jest.clearAllMocks()
    virtualTime = new VirtualTime(40, 6, 15)
    subscription = virtualTime.getTimeInMilliseconds().subscribe(() => {})
  })

  afterEach(() => {
    subscription?.unsubscribe?.()
  })

  it('does not consume virtual workday time while waiting for OSRM', async () => {
    osrm.route.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                geometry: {
                  coordinates: [
                    { lat: 59.135449, lon: 17.571239 },
                    { lat: 59.145449, lon: 17.581239 },
                  ],
                },
                duration: 60,
                distance: 1000,
                legs: [{ steps: [], distance: 1000, duration: 60 }],
              }),
            250
          )
        )
    )

    const vehicle = new Vehicle({
      id: 'vehicle-1',
      position: new Position({ lat: 59.135449, lon: 17.571239 }),
      startPosition: new Position({ lat: 59.135449, lon: 17.571239 }),
      virtualTime,
    })

    vehicle.simulate = jest.fn()

    const start = await virtualTime.getTimeInMillisecondsAsPromise()

    await vehicle.navigateTo(
      new Position({ lat: 59.145449, lon: 17.581239 })
    )

    expect(vehicle.route.started - start).toBeLessThan(1000)
    expect(vehicle.simulate).toHaveBeenCalled()
  })
})
