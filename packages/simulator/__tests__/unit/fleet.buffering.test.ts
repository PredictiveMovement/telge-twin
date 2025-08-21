const Fleet = require('../../lib/fleet')
const Booking = require('../../lib/models/booking')
const { virtualTime } = require('../../lib/virtualTime')
const Position = require('../../lib/models/position')

jest.useFakeTimers()

describe('Fleet buffering and dispatch start', () => {
  const center = { lon: 18.0, lat: 59.0 }

  it('buffers unhandled bookings and starts dispatcher (no throw)', () => {
    const fleet = new Fleet({
      id: '1',
      experimentId: 'exp',
      name: 'postnord',
      hub: center,
      type: 'truck',
      municipality: 'test',
      vehicles: [],
      recyclingTypes: [],
      settings: {},
      preAssignedBookings: {},
      experimentType: 'vroom',
      virtualTime,
    })

    // push a booking and ensure no errors
    const b = new Booking({
      id: 'b1',
      pickup: { position: new Position(center) },
    })
    fleet.handleBooking(b)

    // advance fake timers to pass buffer window
    jest.advanceTimersByTime(1500)
  })
})
