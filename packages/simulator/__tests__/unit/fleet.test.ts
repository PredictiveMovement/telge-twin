const FleetClass = require('../../lib/fleet')
const { from } = require('rxjs')
const { first } = require('rxjs/operators')
const BookingClass = require('../../lib/models/booking').default
const { virtualTime: vTime } = require('../../lib/virtualTime')

const dispatchModule = require('../../lib/dispatch/dispatchCentral')

jest.mock('../../lib/dispatch/dispatchCentral')

describe('A fleet', () => {
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }
  let fleet: any

  let testBooking = new BookingClass({
    pickup: arjeplog,
    destination: ljusdal,
  })

  beforeEach(() => {
    vTime.setTimeMultiplier(Infinity)
    jest.clearAllMocks()
  })

  afterEach(() => {})

  it('should initialize correctly (minimal config)', function () {
    fleet = new FleetClass({
      id: '1',
      experimentId: 'exp',
      name: 'postnord',
      hub: arjeplog,
      type: 'truck',
      municipality: 'test',
      vehicles: [],
      recyclingTypes: [],
      settings: {},
      preAssignedBookings: {},
      experimentType: 'vroom',
      virtualTime: vTime,
    })
    expect(fleet.name).toBe('postnord')
  })

  it('dispatches handled bookings', function () {
    fleet = new FleetClass({
      id: '1',
      experimentId: 'exp',
      name: 'postnord',
      hub: arjeplog,
      type: 'truck',
      municipality: 'test',
      vehicles: [],
      recyclingTypes: [],
      settings: {},
      preAssignedBookings: {},
      experimentType: 'vroom',
      virtualTime: vTime,
    })
    fleet.handleBooking(testBooking)
    expect(dispatchModule.dispatch.mock.calls.length).toBeGreaterThanOrEqual(0)
  })

  it('handled bookings are dispatched', function () {
    dispatchModule.dispatch.mockImplementation(() =>
      from([
        {
          booking: testBooking,
          car: { id: 1 },
        },
      ])
    )

    fleet = new FleetClass({
      id: '1',
      experimentId: 'exp',
      name: 'postnord',
      hub: arjeplog,
      type: 'truck',
      municipality: 'test',
      vehicles: [],
      recyclingTypes: [],
      settings: {},
      preAssignedBookings: {},
      experimentType: 'vroom',
      virtualTime: vTime,
    })
    fleet.handleBooking(testBooking)

    fleet.dispatchedBookings.pipe(first()).subscribe(({ booking }: any) => {
      expect(booking.id).toBe(testBooking.id)
    })
  })
})

export {}
