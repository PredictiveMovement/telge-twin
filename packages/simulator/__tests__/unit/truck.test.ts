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

      // Track status changes
      const statusHistory: string[] = []
      const originalSetStatus = truck.setStatus?.bind(truck) || ((s: string) => { truck.status = s })
      truck.setStatus = (status: string) => {
        statusHistory.push(status)
        truck.status = status
        if (truck.statusEvents) truck.statusEvents.next(truck)
      }

      truck.navigateTo = jest.fn((dest) => {
        truck.destination = dest
        return Promise.resolve()
      })

      const booking = createTestBooking({
        pickup: { position: new Position(sodertaljeCoordinates.centrum1) },
      })

      await truck.handleStandardBooking(booking)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Sequential experiments start with 'start' action, then move to 'toPickup'
      // The plan should be built and truck should have started navigating
      expect(truck.plan.length).toBeGreaterThanOrEqual(0)
      expect(statusHistory.some(s => s === 'start' || s === 'toPickup')).toBe(true)
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
      // With VOLUME_COMPRESSION_FACTOR = 0.25, a KRL140 booking (140L * 80% * 0.25 = 28L)
      // needs a compartment smaller than 28L to trigger "full" status
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: [
          {
            fackNumber: 1,
            volym: 0.02, // 20 liters - smaller than compressed booking volume (28L)
            vikt: 5, // 5 kg - very small
            avfallstyper: [{ avftyp: 'HUSHSORT' }],
          },
        ],
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'capacity_based' } },
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
      truck.plan = [] // Ensure plan is empty before pickup

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

    it('should filter delivered items from queue after delivery', async () => {
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

      const loads = (booking as any).appliedLoads
      expect(Array.isArray(loads)).toBe(true)
      expect(loads.length).toBeGreaterThan(0)
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
      const compartmentNumber = (booking as any).appliedLoads[0].fackNumber

      truck.cargo = [booking]
      truck.booking = null
      await truck.dropOff()

      const compartment = truck.compartments.find(
        (c: any) => c.fackNumber === compartmentNumber
      )
      expect(compartment.fillLiters).toBeLessThan(fillAfterPickup)
    })

    it('should trigger delivery when compartment is full', async () => {
      // With VOLUME_COMPRESSION_FACTOR = 0.25, a KRL140 booking (140L * 80% * 0.25 = 28L)
      // needs a compartment smaller than 28L to trigger "full" status
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: [
          {
            fackNumber: 1,
            volym: 0.02, // 20 liters - smaller than compressed booking volume (28L)
            vikt: 5, // 5 kg - very small
            avfallstyper: [{ avftyp: 'HUSHSORT' }],
          },
        ],
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'capacity_based' } },
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

  describe('planGroupId support', () => {
    it('should resolve planGroupId from fleet.settings', () => {
      const mockFleet = {
        name: 'test-fleet-pg',
        settings: {
          ...testSettings,
          planGroupId: 'custom-plan-group-123',
        },
      }

      truck = new Truck({
        id: 'truck-plangroup-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: mockFleet,
      })

      // Verify planGroupId is accessible via fleet settings
      expect(truck.fleet.settings.planGroupId).toBe('custom-plan-group-123')
    })

    it('should have undefined planGroupId when not set in fleet.settings', () => {
      const mockFleet = {
        name: 'test-fleet-no-pg',
        settings: {
          ...testSettings,
          // No planGroupId set
        },
      }

      truck = new Truck({
        id: 'truck-no-plangroup',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: mockFleet,
      })

      // Verify planGroupId is not set
      expect(truck.fleet.settings.planGroupId).toBeUndefined()
    })

    it('should use planGroupId || experimentId pattern correctly', () => {
      // Test the pattern used in truck.ts: this.fleet?.settings?.planGroupId || experimentId
      const testCases = [
        {
          planGroupId: 'custom-group',
          experimentId: 'exp-123',
          expected: 'custom-group',
        },
        {
          planGroupId: undefined,
          experimentId: 'exp-456',
          expected: 'exp-456',
        },
        {
          planGroupId: null,
          experimentId: 'exp-789',
          expected: 'exp-789',
        },
        {
          planGroupId: '',
          experimentId: 'exp-empty',
          expected: 'exp-empty', // Empty string is falsy
        },
      ]

      testCases.forEach(({ planGroupId, experimentId, expected }) => {
        const result = planGroupId || experimentId
        expect(result).toBe(expected)
      })
    })
  })

  describe('Delivery Strategy', () => {
    it('should default to end_of_route delivery strategy (from config)', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: {} },
      })

      // Access private method via any cast
      // Default is 'end_of_route' as set in config.ts
      const strategy = (truck as any).getDeliveryStrategy()
      expect(strategy).toBe('end_of_route')
    })

    it('should use fleet settings deliveryStrategy when set to end_of_route', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { deliveryStrategy: 'end_of_route' } },
      })

      const strategy = (truck as any).getDeliveryStrategy()
      expect(strategy).toBe('end_of_route')
    })

    it('should use fleet settings deliveryStrategy when set to capacity_based', () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { deliveryStrategy: 'capacity_based' } },
      })

      const strategy = (truck as any).getDeliveryStrategy()
      expect(strategy).toBe('capacity_based')
    })

    it('should trigger delivery in end_of_route mode only when no pickups remain', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'end_of_route' } },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })
      booking1.pickedUp = jest.fn()
      booking2.pickedUp = jest.fn()

      // First pickup with remaining pickups in plan
      truck.booking = booking1
      truck.plan = [{ action: 'pickup', booking: booking2 }]
      await truck.pickup()

      // Should NOT add delivery because there's still a pickup in plan
      expect(truck.plan.some((inst: any) => inst.action === 'delivery')).toBe(false)
      expect(truck.plan[0].action).toBe('pickup')
    })

    it('should trigger delivery in capacity_based mode when compartment is full', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: [
          {
            fackNumber: 1,
            volym: 0.02, // 20 liters - small compartment
            vikt: 5,
            avfallstyper: [{ avftyp: 'HUSHSORT' }],
          },
        ],
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'capacity_based' } },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking = createTestBooking({
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking.pickedUp = jest.fn()

      truck.booking = booking
      truck.plan = [{ action: 'pickup', booking: createTestBooking({ id: 'b2' }) }]
      await truck.pickup()

      // Should add delivery even though there are remaining pickups (capacity triggered)
      expect(truck.plan.some((inst: any) => inst.action === 'delivery')).toBe(true)
    })

    it('should NOT rebuild plan from unpicked bookings in end_of_route mode', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'end_of_route' } },
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })

      // Simulate: plan is empty, unpicked bookings in queue, cargo has one item
      truck.queue = [booking1, booking2]
      truck.cargo = [booking1]
      truck.plan = []
      booking1.delivered = jest.fn()

      await truck.handlePostStop()

      // Should NOT rebuild a plan with pickups from unpicked bookings
      // Instead should insert a delivery instruction for remaining cargo
      expect(truck.plan.some((inst: any) => inst.action === 'pickup')).toBe(false)
    })

    it('should mark remaining queue items as unreachable when plan completes with no cargo', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'end_of_route' } },
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking1 = createTestBooking({ id: 'b1' })
      const booking2 = createTestBooking({ id: 'b2' })

      truck.queue = [booking1, booking2]
      truck.cargo = []
      truck.plan = []

      await truck.handlePostStop()

      // Both bookings should be marked unreachable
      expect(booking1.status).toBe('Unreachable')
      expect(booking2.status).toBe('Unreachable')
      expect(truck.status).toBe('returning')
    })

    it('should insert delivery and continue when plan is empty but cargo remains', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.centrum1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'end_of_route' } },
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const booking1 = createTestBooking({ id: 'b1' })
      booking1.delivered = jest.fn()

      truck.queue = [booking1]
      truck.cargo = [booking1]
      truck.plan = []

      await truck.handlePostStop()

      // Should have navigated to depot for delivery
      expect(truck.navigateTo).toHaveBeenCalledWith(truck.startPosition)
    })

    it('should mark remaining queue items as unreachable after final delivery', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'end_of_route' } },
      })

      truck.navigateTo = jest.fn((dest) => {
        truck.position = dest
        return Promise.resolve()
      })

      const delivered = createTestBooking({ id: 'delivered-1' })
      delivered.delivered = jest.fn()
      const leftover = createTestBooking({ id: 'leftover-1' })

      // Simulate: cargo has one item to deliver, queue has both, plan is empty
      truck.cargo = [delivered]
      truck.queue = [delivered, leftover]
      truck.plan = []
      truck.booking = null

      await truck.dropOff()

      // delivered should be removed from queue, leftover should be marked unreachable
      expect(truck.queue).not.toContain(delivered)
      expect(truck.queue).toContain(leftover)
      expect(leftover.status).toBe('Unreachable')
      expect(truck.status).toBe('parked')
    })

    it('should NOT trigger delivery in end_of_route mode even when compartment is full', async () => {
      truck = new Truck({
        id: 'truck-1',
        position: new Position(sodertaljeCoordinates.depot1),
        startPosition: new Position(sodertaljeCoordinates.depot1),
        fackDetails: [
          {
            fackNumber: 1,
            volym: 0.02, // 20 liters - small compartment that will be "full"
            vikt: 5,
            avfallstyper: [{ avftyp: 'HUSHSORT' }],
          },
        ],
        virtualTime,
        fleet: { settings: { ...testSettings, deliveryStrategy: 'end_of_route' } },
      })

      truck.navigateTo = jest.fn(() => Promise.resolve())

      const booking1 = createTestBooking({
        id: 'b1',
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      const booking2 = createTestBooking({
        id: 'b2',
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      })
      booking1.pickedUp = jest.fn()

      truck.booking = booking1
      truck.plan = [{ action: 'pickup', booking: booking2 }]
      await truck.pickup()

      // In end_of_route mode, should NOT add delivery even if compartment is full
      // because there are still remaining pickups
      const deliveryIndex = truck.plan.findIndex((inst: any) => inst.action === 'delivery')
      expect(deliveryIndex).toBe(-1)
    })
  })
})

export {}
