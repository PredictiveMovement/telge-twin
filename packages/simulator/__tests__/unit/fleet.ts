const Fleet = require('../../lib/fleet')
const { from } = require('rxjs')
const { first } = require('rxjs/operators')
const Booking = require('../../lib/models/booking').default
const { virtualTime } = require('../../lib/virtualTime')

const dispatch = require('../../lib/dispatch/dispatchCentral')

jest.mock('../../lib/dispatch/dispatchCentral')

describe('A fleet', () => {
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }
  let fleet: any

  let testBooking = new Booking({
    pickup: arjeplog,
    destination: ljusdal,
  })

  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity)
    jest.clearAllMocks()
  })

  afterEach(() => {})

  it('should initialize correctly (minimal config)', function () {
    fleet = new Fleet({
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
      virtualTime,
    })
    expect(fleet.name).toBe('postnord')
  })

  it('dispatches handled bookings', function () {
    fleet = new Fleet({
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
      virtualTime,
    })
    fleet.handleBooking(testBooking)
    expect(dispatch.dispatch.mock.calls.length).toBeGreaterThanOrEqual(0)
  })

  it('handled bookings are dispatched', function () {
    dispatch.dispatch.mockImplementation(() =>
      from([
        {
          booking: testBooking,
          car: { id: 1 },
        },
      ])
    )

    fleet = new Fleet({
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
      virtualTime,
    })
    fleet.handleBooking(testBooking)

    fleet.dispatchedBookings.pipe(first()).subscribe(({ booking }: any) => {
      expect(booking.id).toBe(testBooking.id)
    })
  })
})
