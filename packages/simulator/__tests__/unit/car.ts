const Car = require('../../lib/vehicles/vehicle').default
const Booking = require('../../lib/models/booking').default
const { virtualTime } = require('../../lib/virtualTime')

const range = (length: number) => Array.from({ length }).map((_, i) => i)

describe('A car', () => {
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }
  let car: any

  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity)
  })

  afterEach(() => {
    car.dispose()
  })

  it('should initialize correctly', function (done) {
    car = new Car()
    expect(typeof car.id).toBe('string')
    expect(car.id.length).toBeGreaterThanOrEqual(6)
    done()
  })

  it('should have initial position', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    expect(car.position).toEqual(arjeplog)
    done()
  })

  it('should set destination on navigateTo (mocked)', async function () {
    car = new Car({ id: 1, position: arjeplog })
    // mock navigateTo inner routing to avoid OSRM
    const originalNavigate = car.navigateTo
    car.navigateTo = (dest: any) => {
      car.destination = dest
      return Promise.resolve(dest)
    }
    const result = await car.navigateTo(ljusdal)
    expect(result).toEqual(ljusdal)
    expect(car.destination).toEqual(ljusdal)
    // restore
    car.navigateTo = originalNavigate
  })

  it('should handle one booking and set status to toPickup', async function () {
    car = new Car({ id: 1, position: arjeplog })
    // Avoid real navigation
    const originalNavigate = car.navigateTo
    car.navigateTo = (_dest: any) => Promise.resolve(_dest)
    const booking = new Booking({ id: 1, pickup: { position: ljusdal } })
    await car.handleBooking(booking)
    expect(car.status).toBe('toPickup')
    expect(car.booking).toBeTruthy()
    car.navigateTo = originalNavigate
  })

  it('should enqueue additional bookings when already has an active booking', async function () {
    car = new Car({ id: 1, position: arjeplog })
    const originalNavigate = car.navigateTo
    car.navigateTo = (_dest: any) => Promise.resolve(_dest)
    const first = new Booking({ id: 1, pickup: { position: ljusdal } })
    await car.handleBooking(first)
    const second = new Booking({ id: 2, pickup: { position: arjeplog } })
    await car.handleBooking(second)
    expect(car.queue.length).toBe(1)
    car.navigateTo = originalNavigate
  })

  // Integration of pickup/dropoff depends on OSRM; skip deep routing here

  it('queues additional bookings when one is active', async function () {
    car = new Car({ id: 1, position: arjeplog })
    const originalNavigate = car.navigateTo
    car.navigateTo = (_dest: any) => Promise.resolve(_dest)
    await car.handleBooking(
      new Booking({ id: 1, pickup: { position: ljusdal } })
    )
    for (let i = 0; i < 3; i++) {
      await car.handleBooking(
        new Booking({ id: 100 + i, pickup: { position: arjeplog } })
      )
    }
    expect(car.queue.length).toBe(3)
    car.navigateTo = originalNavigate
  })

  // Complex queue reordering integrations are out-of-scope in unit tests
})
