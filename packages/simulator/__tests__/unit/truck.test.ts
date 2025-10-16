const Truck = require('../../lib/vehicles/truck')
const Position = require('../../lib/models/position')
const log = require('../../lib/log')
const { VirtualTime } = require('../../lib/virtualTime')

import {
  sodertaljeCoordinates,
  testSettings,
  createTestBooking,
} from '../fixtures'

jest.mock('../../lib/osrm', () => ({
  route: jest.fn((from, to) =>
    Promise.resolve({
      geometry: {
        coordinates: [
          { lat: from.lat, lon: from.lon },
          { lat: to.lat, lon: to.lon },
        ],
      },
      duration: 60,
      distance: 1000,
      legs: [
        {
          steps: [],
          distance: 1000,
          duration: 60,
        },
      ],
    })
  ),
  nearest: jest.fn(() =>
    Promise.resolve({
      waypoints: [{ location: [18.0, 59.0] }],
    })
  ),
}))

describe('Truck Behavior', () => {
  let truck: any
  let virtualTime: any
  let warnSpy: jest.SpyInstance
  let consoleLogSpy: jest.SpyInstance

  const createVirtualTime = () => {
    const vt = new VirtualTime(Infinity, 6, 15) // Instant time, 06:00 - 15:00
    return vt
  }

  beforeEach(() => {
    warnSpy = jest.spyOn(log, 'warn').mockImplementation(() => {})
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    virtualTime = createVirtualTime()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    warnSpy.mockRestore()
    if (truck && typeof truck.dispose === 'function') {
      truck.dispose()
    }
  })

  describe('Status Transitions', () => {
    it('should start in parked status when created at startPosition', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      expect(truck.status).toBe('ready')
      expect(truck.position).toBeTruthy()
    })

    it('should transition from parked to toPickup when booking assigned', async () => {
      const mockFleet = {
        settings: {
          experimentType: 'sequential',
        },
      }

      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: mockFleet,
      })

      const originalNavigateTo = truck.navigateTo.bind(truck)
      truck.navigateTo = jest.fn((dest) => {
        truck.destination = dest
        truck.status = 'toPickup'
        return Promise.resolve()
      })

      const booking = createTestBooking({
        pickup: { position: new Position(sodertaljeCoordinates.centrum1) },
      })

      await truck.handleStandardBooking(booking)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      expect(truck.status).toBe('toPickup')
    })

    it('should set status to pickup when reaching pickup location', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking = createTestBooking()
      booking.pickedUp = jest.fn()
      truck.booking = booking
      truck.status = 'toPickup'

      await truck.pickup()

      expect(booking.pickedUp).toHaveBeenCalled()
      expect(truck.cargo).toContain(booking)
    })

    it('should set status to delivery when compartment full', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: [
          {
            fackNumber: 1,
            volym: 0.112, // 112 liters
            vikt: 20, // 20 kg - very small
            avfallstyper: [{ avftyp: 'HUSHSORT' }],
          },
        ],
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()

      truck.booking = booking
      truck.status = 'toPickup'

      await truck.pickup()

      expect(truck.plan.some((inst: any) => inst.action === 'delivery')).toBe(
        true
      )
    })

    it('should set status to returning when all work done', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        truck.status = 'returning'
        return Promise.resolve()
      })

      truck.queue = []
      truck.plan = []
      truck.cargo = []
      truck.instruction = undefined

      await truck.handlePostStop()

      expect(truck.navigateTo).toHaveBeenCalledWith(truck.startPosition)
    })

    it('should set status to parked when back at depot with no work', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.queue = []
      truck.plan = []
      truck.cargo = []
      truck.instruction = undefined
      truck.status = 'end'

      await truck.handlePostStop()

      expect(truck.status).toBe('parked')
    })
  })

  describe('Position & Navigation', () => {
    it('should start at startPosition when parked', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      expect(truck.position.lat).toBeCloseTo(
        sodertaljeCoordinates.depot1.lat,
        4
      )
      expect(truck.position.lng).toBeCloseTo(
        sodertaljeCoordinates.depot1.lng,
        4
      )
    })

    it('should navigate to booking pickup location', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      const pickupCoords = sodertaljeCoordinates.centrum1
      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking = createTestBooking({
        id: 'b1',
        pickup: { position: pickupCoords },
      })
      truck.queue = [booking]
      truck.plan = [{ action: 'pickup', booking }]

      await truck.pickNextInstructionFromPlan()

      expect(truck.navigateTo).toHaveBeenCalled()
      const callArg = truck.navigateTo.mock.calls[0][0]
      expect(callArg.lat).toBeCloseTo(pickupCoords.lat, 4)
      expect(callArg.lng || callArg.lon).toBeCloseTo(pickupCoords.lng, 4)
    })

    it('should navigate to delivery location (startPosition)', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      truck.instruction = { action: 'delivery', booking: null }
      await truck.pickNextInstructionFromPlan()

      expect(truck.navigateTo).toHaveBeenCalledWith(truck.startPosition)
    })

    it('should return to startPosition when finished', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      truck.queue = []
      truck.plan = []
      truck.cargo = []

      await truck.handlePostStop()

      expect(truck.navigateTo).toHaveBeenCalledWith(truck.startPosition)
    })
  })

  describe('Cargo Management', () => {
    it('should have empty cargo initially', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      expect(truck.cargo).toEqual([])
    })

    it('should add booking to cargo after pickup', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking = createTestBooking()
      booking.pickedUp = jest.fn()

      truck.booking = booking
      truck.status = 'toPickup'

      expect(truck.cargo).toHaveLength(0)
      await truck.pickup()
      expect(truck.cargo).toHaveLength(1)
      expect(truck.cargo[0]).toBe(booking)
    })

    it('should handle multiple bookings in cargo', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })
      booking1.pickedUp = jest.fn()
      booking2.pickedUp = jest.fn()

      truck.booking = booking1
      await truck.pickup()

      truck.booking = booking2
      await truck.pickup()

      expect(truck.cargo).toHaveLength(2)
      expect(truck.cargo).toContain(booking1)
      expect(truck.cargo).toContain(booking2)
    })

    it('should clear cargo after delivery', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: testSettings },
      })

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })
      booking1.delivered = jest.fn()
      booking2.delivered = jest.fn()

      truck.cargo = [booking1, booking2]
      truck.booking = null // No specific booking = deliver all

      await truck.dropOff()

      expect(truck.cargo).toEqual([])
      expect(booking1.delivered).toHaveBeenCalled()
      expect(booking2.delivered).toHaveBeenCalled()
    })

    it('should filter queue after delivery in sequential mode', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: {
          settings: { ...testSettings, experimentType: 'sequential' },
          experimentType: 'sequential',
        },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })
      booking1.delivered = jest.fn()
      booking2.delivered = jest.fn()

      truck.cargo = [booking1]
      truck.queue = [booking1, booking2]
      truck.booking = null

      await truck.dropOff()

      expect(truck.queue).not.toContain(booking1)
      expect(truck.queue).toContain(booking2)
    })
  })

  describe('Compartments (Fack)', () => {
    it('should create compartments from fackDetails', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: testSettings.bilar[0].FACK,
        virtualTime,
      })

      expect(truck.compartments).toBeDefined()
      expect(truck.compartments.length).toBeGreaterThan(0)
    })

    it('should select correct compartment for waste type', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: testSettings.bilar[0].FACK,
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()

      truck.booking = booking
      await truck.pickup()

      expect(booking.assignedFack).toBeDefined()
      expect(booking.loadEstimate).toBeDefined()
    })

    it('should increase fill levels on pickup (volumeLiters)', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: testSettings.bilar[0].FACK,
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const initialFill = truck.compartments[0].fillLiters

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()

      truck.booking = booking
      await truck.pickup()

      expect(truck.compartments[0].fillLiters).toBeGreaterThan(initialFill)
    })

    it('should increase fill levels on pickup (weightKg)', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: testSettings.bilar[0].FACK,
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const initialFill = truck.compartments[0].fillKg

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()

      truck.booking = booking
      await truck.pickup()

      expect(truck.compartments[0].fillKg).toBeGreaterThan(initialFill)
    })

    it('should decrease fill levels on delivery', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: testSettings.bilar[0].FACK,
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()
      booking.delivered = jest.fn()

      truck.booking = booking
      await truck.pickup()

      const fillAfterPickup = truck.compartments[0].fillLiters
      const compartmentNumber = booking.assignedFack

      truck.cargo = [booking]
      truck.booking = null
      await truck.dropOff()

      const compartment = truck.compartments.find(
        (c: any) => c.fackNumber === compartmentNumber
      )
      expect(compartment.fillLiters).toBeLessThan(fillAfterPickup)
    })

    it('should trigger delivery when compartment is full', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: [
          {
            fackNumber: 1,
            volym: 0.112, // 112 liters - tiny
            vikt: 20, // 20 kg
            avfallstyper: [{ avftyp: 'HUSHSORT' }],
          },
        ],
        virtualTime,
        fleet: { settings: testSettings },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()

      truck.booking = booking
      truck.plan = []
      await truck.pickup()

      expect(truck.plan.some((inst: any) => inst.action === 'delivery')).toBe(
        true
      )
    })
  })

  describe('Plan Execution', () => {
    it('should execute sequential plan: start → pickups → delivery → end', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: testSettings, experimentType: 'sequential' },
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })

      truck.queue = [booking1, booking2]
      truck.plan = truck.buildSequentialPlanFromQueue()

      expect(truck.plan[0].action).toBe('start')
      expect(truck.plan[1].action).toBe('pickup')
      expect(truck.plan[2].action).toBe('pickup')
      expect(truck.plan[3].action).toBe('delivery')
      expect(truck.plan[4].action).toBe('end')
    })

    it('should skip unreachable bookings in plan', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })
      booking2.status = 'Unreachable'

      truck.queue = [booking1, booking2]
      truck.queue = [booking1, booking2]
      truck.plan = [
        { action: 'pickup', booking: booking1 },
        { action: 'pickup', booking: booking2 },
      ]

      await truck.pickNextInstructionFromPlan()

      expect(truck.instruction.booking).toBe(booking1)
    })

    it('should skip bookings already in cargo', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking1 = createTestBooking({ id: 'b1' })
      truck.cargo = [booking1]
      truck.queue = [booking1]
      truck.plan = [{ action: 'pickup', booking: booking1 }]

      await truck.pickNextInstructionFromPlan()

      expect(truck.instruction).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty plan', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())
      truck.plan = []
      truck.queue = []
      truck.cargo = []

      await truck.handlePostStop()

      expect(truck.status).toBe('parked')
    })

    it('should handle no reachable bookings', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })
      booking1.status = 'Unreachable'
      booking2.status = 'Unreachable'

      truck.queue = [booking1, booking2]
      truck.plan = []
      truck.cargo = []

      await truck.handlePostStop()

      expect(truck.navigateTo).toHaveBeenCalledWith(truck.startPosition)
      expect(truck.status).toBe('returning')
    })

    it('should not pickup if booking is null', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      truck.booking = null
      const cargoLengthBefore = truck.cargo.length

      await truck.pickup()

      expect(truck.cargo.length).toBe(cargoLengthBefore)
    })

    it('should not pickup if booking already in cargo', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
      })

      const booking = createTestBooking({ id: 'b1' })
      truck.cargo = [booking]
      truck.booking = booking

      const cargoLengthBefore = truck.cargo.length

      await truck.pickup()

      expect(truck.cargo.length).toBe(cargoLengthBefore)
    })
  })
})

export {}
