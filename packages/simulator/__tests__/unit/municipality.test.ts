const Municipality = require('../../lib/municipality')
const { from } = require('rxjs')
const { first } = require('rxjs/operators')
const { virtualTime } = require('../../lib/virtualTime')

describe('A municipality', () => {
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const squares = from([])
  let fleets: any
  let municipality: any

  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity)
    fleets = [
      {
        name: 'postnord',
        recyclingTypes: [],
        vehicles: [],
        preAssignedBookings: {},
      },
    ]
    jest.clearAllMocks()
  })

  afterEach(() => {})

  it('should initialize correctly', function (done) {
    municipality = new Municipality({
      name: 'stockholm',
      squares,
      fleetsConfig: fleets,
      geometry: {},
      center: arjeplog,
      settings: { experimentType: 'vroom' },
      experimentId: 'exp',
      virtualTime,
    })
    expect(municipality.name).toBe('stockholm')
    done()
  })

  it('exposes dispatchedBookings stream', function () {
    municipality = new Municipality({
      name: 'stockholm',
      squares,
      fleetsConfig: fleets,
      geometry: {},
      center: arjeplog,
      settings: { experimentType: 'vroom' },
      experimentId: 'exp',
      virtualTime,
    })
    expect(typeof municipality.dispatchedBookings.subscribe).toBe('function')
  })

  it('creates fleets stream with provided config', function (done) {
    municipality = new Municipality({
      name: 'stockholm',
      squares,
      fleetsConfig: fleets,
      geometry: {},
      center: arjeplog,
      settings: { experimentType: 'vroom' },
      experimentId: 'exp',
      virtualTime,
    })
    municipality.fleets.pipe(first()).subscribe((fleet: any) => {
      expect(fleet.name).toBe('postnord')
      done()
    })
  })
})

export {}
