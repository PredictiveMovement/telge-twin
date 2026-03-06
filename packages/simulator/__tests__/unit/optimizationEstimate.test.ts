jest.mock('../../lib/osrm', () => ({
  __esModule: true,
  default: {
    route: jest.fn(),
    routeMultiWaypoint: jest.fn(),
  },
}))

jest.mock('../../lib/dispatch/truckDispatch', () => ({
  findBestRouteToPickupBookings: jest.fn(
    async (_experimentId: string | undefined, _truck: any, bookings: any[]) =>
      bookings.map((booking) => ({
        action: 'pickup',
        arrival: 0,
        departure: 0,
        booking,
      }))
  ),
}))

import Booking from '../../lib/models/booking'
import Position from '../../lib/models/position'
import osrm from '../../lib/osrm'
import { createCompartments } from '../../lib/capacity'
import { CLUSTERING_CONFIG } from '../../lib/config'
import {
  estimateOptimizationFeasibility,
  estimateTruckRuntime,
} from '../../lib/optimizationEstimate'
import { findBestRouteToPickupBookings } from '../../lib/dispatch/truckDispatch'

const mockedRoute = osrm.route as jest.MockedFunction<typeof osrm.route>
const mockedRouteMultiWaypoint = osrm.routeMultiWaypoint as jest.MockedFunction<
  typeof osrm.routeMultiWaypoint
>
const mockedFindBestRouteToPickupBookings =
  findBestRouteToPickupBookings as jest.MockedFunction<
    typeof findBestRouteToPickupBookings
  >

const startMs = Date.parse('2024-01-15T08:00:00.000Z')
const alignedStartDateIso = new Date('2024-01-15T08:00:00').toISOString()
const baseDepot = new Position({ lat: 59.135449, lng: 17.571239 })

function createBooking(id: string, latOffset: number): Booking {
  return new Booking({
    id,
    bookingId: id,
    recyclingType: 'REST',
    sender: 'TELGE',
    pickup: {
      position: new Position({
        lat: 59.135449 + latOffset,
        lng: 17.571239 + latOffset,
      }),
      name: `Pickup ${id}`,
      departureTime: '08:00:00',
    },
    destination: {
      position: new Position({
        lat: 59.135449,
        lng: 17.571239,
      }),
      name: 'Depot',
      arrivalTime: '17:00:00',
    },
    carId: 'truck-1',
    turordningsnr: 1,
  })
}

function createTruck(settings: Record<string, unknown> = {}) {
  return {
    id: 'truck-1',
    position: baseDepot,
    startPosition: baseDepot,
    destination: baseDepot,
    parcelCapacity: 250,
    cargo: [],
    compartments: createCompartments(),
    fleet: {
      name: 'Testflotta',
      settings,
    },
    virtualTime: {
      now: () => startMs,
      getWorkdayBounds: () => ({
        startMs,
        endMs: startMs + 8 * 60 * 60 * 1000,
      }),
    },
  }
}

describe('optimizationEstimate dry-run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRoute.mockResolvedValue({
      duration: 60,
      distance: 1000,
      geometry: '',
    } as any)
    mockedRouteMultiWaypoint.mockImplementation(async (coordinates: [number, number][]) => {
      const legCount = Math.max(0, coordinates.length - 1)
      return {
        duration: legCount * 60,
        distance: legCount * 1000,
        legs: Array.from({ length: legCount }, () => ({
          duration: 60,
          distance: 1000,
        })),
      } as any
    })
    mockedFindBestRouteToPickupBookings.mockImplementation(
      async (_experimentId: string | undefined, _truck: any, bookings: any[]) =>
        bookings.map((booking) => ({
          action: 'pickup',
          arrival: 0,
          departure: 0,
          booking,
        }))
    )
  })

  it('returns pickup sequence plus one final depot return for end_of_route', async () => {
    const bookingA = createBooking('A', 0.001)
    const bookingB = createBooking('B', 0.002)
    const truck = createTruck({
      deliveryStrategy: 'end_of_route',
      pickupsBeforeDelivery: 99,
    })

    const result = await estimateTruckRuntime(
      truck as any,
      [{ booking: bookingA }, { booking: bookingB }],
      [],
      startMs + 8 * 60 * 60 * 1000,
      truck.fleet.settings
    )

    expect(result.durationSeconds).toBe(
      3 * 60 + 2 * CLUSTERING_CONFIG.SERVICE_TIME_PER_STOP_SECONDS
    )
    expect(result.distanceMeters).toBe(3000)
    expect(result.unreachableStopCount).toBe(0)
    expect(mockedRouteMultiWaypoint).toHaveBeenCalledTimes(1)
    expect(mockedRoute).not.toHaveBeenCalled()
  })

  it('adds depot trips during the route for capacity_based delivery', async () => {
    const bookingA = createBooking('A', 0.001)
    const bookingB = createBooking('B', 0.002)
    const truck = createTruck({
      deliveryStrategy: 'capacity_based',
      pickupsBeforeDelivery: 1,
    })

    const result = await estimateTruckRuntime(
      truck as any,
      [{ booking: bookingA }, { booking: bookingB }],
      [],
      startMs + 8 * 60 * 60 * 1000,
      truck.fleet.settings
    )

    expect(result.durationSeconds).toBe(
      4 * 60 + 2 * CLUSTERING_CONFIG.SERVICE_TIME_PER_STOP_SECONDS
    )
    expect(result.distanceMeters).toBe(4000)
    expect(result.unreachableStopCount).toBe(0)
    expect(mockedRouteMultiWaypoint).toHaveBeenCalledTimes(2)
    expect(mockedRoute).not.toHaveBeenCalled()
  })

  it('includes configured breaks in the optimization estimate', async () => {
    const result = await estimateOptimizationFeasibility({
      startDate: alignedStartDateIso,
      originalSettings: {
        deliveryStrategy: 'end_of_route',
        pickupsBeforeDelivery: 99,
      },
      optimizationSettings: {
        workingHours: { start: '08:00', end: '08:30' },
        breaks: [{ id: 'lunch', desiredTime: '08:01', duration: 15 }],
      },
      fleetConfiguration: [
        {
          name: 'Testflotta',
          vehicles: [{ originalId: 'truck-1', parcelCapacity: 250 }],
          preAssignedBookings: {
            'truck-1': [
              {
                id: 'A',
                recyclingType: 'REST',
                pickup: { lat: 59.136449, lng: 17.572239 },
                destination: { lat: 59.135449, lng: 17.571239 },
                originalTurordningsnr: 1,
              },
              {
                id: 'B',
                recyclingType: 'REST',
                pickup: { lat: 59.137449, lng: 17.573239 },
                destination: { lat: 59.135449, lng: 17.571239 },
                originalTurordningsnr: 2,
              },
            ],
          },
        },
      ],
    })

    expect(result.estimates).toHaveLength(1)
    expect(result.estimates[0]).toMatchObject({
      vehicleId: 'truck-1',
      stopCount: 2,
      unreachableStopCount: 0,
      durationSeconds:
        3 * 60 + 2 * CLUSTERING_CONFIG.SERVICE_TIME_PER_STOP_SECONDS + 15 * 60,
    })
    expect(mockedFindBestRouteToPickupBookings).toHaveBeenCalledWith(
      undefined,
      expect.any(Object),
      expect.any(Array),
      undefined,
      { skipExperimentValidation: true }
    )
  })

  it('marks stops as unreachable when the workday ends before the route completes', async () => {
    const result = await estimateOptimizationFeasibility({
      startDate: alignedStartDateIso,
      originalSettings: {
        deliveryStrategy: 'end_of_route',
        pickupsBeforeDelivery: 99,
      },
      optimizationSettings: {
        workingHours: { start: '08:00', end: '08:02' },
      },
      fleetConfiguration: [
        {
          name: 'Testflotta',
          vehicles: [{ originalId: 'truck-1', parcelCapacity: 250 }],
          preAssignedBookings: {
            'truck-1': [
              {
                id: 'A',
                recyclingType: 'REST',
                pickup: { lat: 59.136449, lng: 17.572239 },
                destination: { lat: 59.135449, lng: 17.571239 },
                originalTurordningsnr: 1,
              },
              {
                id: 'B',
                recyclingType: 'REST',
                pickup: { lat: 59.137449, lng: 17.573239 },
                destination: { lat: 59.135449, lng: 17.571239 },
                originalTurordningsnr: 2,
              },
            ],
          },
        },
      ],
    })

    expect(result.estimates).toHaveLength(1)
    expect(result.estimates[0]).toMatchObject({
      vehicleId: 'truck-1',
      stopCount: 2,
      unreachableStopCount: 1,
      durationSeconds: 3 * 60 + CLUSTERING_CONFIG.SERVICE_TIME_PER_STOP_SECONDS,
    })
  })
})
