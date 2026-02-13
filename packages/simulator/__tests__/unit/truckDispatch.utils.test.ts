const {
  simpleGeographicSplit,
  combineSubResults,
  saveCompletePlanForReplay,
  calculatePlanStatistics,
} = require('../../lib/dispatch/truckDispatch')

// Mock elastic module
jest.mock('../../lib/elastic', () => ({
  save: jest.fn().mockResolvedValue({}),
  search: jest.fn(),
}))

// Mock ElasticsearchService
jest.mock('../../web/services/ElasticsearchService', () => ({
  elasticsearchService: {
    addPlanIdToExperiment: jest.fn().mockResolvedValue(undefined),
    getExperiment: jest.fn().mockResolvedValue({ sourceDatasetId: 'test-dataset' }),
  },
}))

// Mock SocketController
jest.mock('../../web/controllers/SocketController', () => ({
  socketController: {
    emitPlanSaved: jest.fn(),
  },
}))

const { save } = require('../../lib/elastic')
const { elasticsearchService } = require('../../web/services/ElasticsearchService')

describe('truckDispatch utils', () => {
  describe('simpleGeographicSplit', () => {
    it('returns one array when bookings <= maxSize', () => {
      const bookings = Array.from({ length: 3 }).map((_, i) => ({
        id: i + 1,
        pickup: { position: { lat: 59.0 + i * 0.001, lng: 18.0 + i * 0.001 } },
      }))
      const result = simpleGeographicSplit(bookings, 5)
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveLength(3)
    })

    it('splits into multiple arrays when bookings > maxSize', () => {
      const bookings = Array.from({ length: 6 }).map((_, i) => ({
        id: i + 1,
        pickup: { position: { lat: 59.0 + i * 0.001, lng: 18.0 + i * 0.001 } },
      }))
      const result = simpleGeographicSplit(bookings, 2)
      // recursive split in half → produces arrays of size <= 2, total items preserved
      expect(result.flat().length).toBe(6)
      result.forEach((sub: any[]) => expect(sub.length).toBeLessThanOrEqual(2))
    })
  })

  describe('combineSubResults', () => {
    it('combines steps and shifts ids to avoid collisions', () => {
      const subResults = [
        {
          routes: [
            {
              steps: [
                { id: 0, type: 'pickup', arrival: 1, departure: 2 },
                { id: 1, type: 'pickup', arrival: 3, departure: 4 },
              ],
            },
          ],
          idToBooking: { 0: { id: 'A' }, 1: { id: 'B' } },
        },
        {
          routes: [
            {
              steps: [
                { id: 0, type: 'pickup', arrival: 5, departure: 6 },
                { id: 1, type: 'pickup', arrival: 7, departure: 8 },
              ],
            },
          ],
          idToBooking: { 0: { id: 'C' }, 1: { id: 'D' } },
        },
      ]
      const combined = combineSubResults(subResults, [])
      const steps = combined.routes[0].steps
      expect(steps).toHaveLength(4)
      // ensure id shifting happened (no duplicate 0/1)
      const ids = steps.map((s: any) => s.id)
      expect(new Set(ids).size).toBe(4)
      // ensure mapping preserved
      expect(combined.idToBooking[0]).toEqual({ id: 'A' })
      expect(combined.idToBooking[1]).toEqual({ id: 'B' })
      expect(combined.idToBooking[2]).toEqual({ id: 'C' })
      expect(combined.idToBooking[3]).toEqual({ id: 'D' })
    })
  })

  describe('saveCompletePlanForReplay', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('returns undefined when createReplay is false', async () => {
      const result = await saveCompletePlanForReplay(
        'exp-123',
        'truck-1',
        'fleet-1',
        [],
        [],
        false // createReplay = false
      )

      expect(result).toBeUndefined()
      expect(save).not.toHaveBeenCalled()
    })

    it('generates deterministic planId from experimentId and truckId', async () => {
      const completePlan = [
        {
          action: 'pickup',
          arrival: 0,
          departure: 100,
          booking: {
            bookingId: 'b1',
            id: 'b1',
            recyclingType: 'HUSHSORT',
            pickup: { position: { lat: 59.0, lon: 18.0 }, postalcode: '12345' },
            destination: { position: { lat: 59.1, lon: 18.1 } },
          },
        },
      ]

      const bookings = [
        {
          bookingId: 'b1',
          id: 'b1',
          recyclingType: 'HUSHSORT',
          pickup: { position: { lat: 59.0, lon: 18.0 }, postalcode: '12345' },
        },
      ]

      const result = await saveCompletePlanForReplay(
        'experiment-abc',
        'truck-xyz',
        'fleet-1',
        completePlan,
        bookings,
        true
      )

      // Should return deterministic planId
      expect(result).toBe('experiment-abc-truck-xyz')

      // Verify save was called with correct planId
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'experiment-abc-truck-xyz',
          experimentId: 'experiment-abc',
          truckId: 'truck-xyz',
        }),
        'experiment-abc-truck-xyz',
        'truck-plans'
      )
    })

    it('calls addPlanIdToExperiment with the generated planId', async () => {
      const completePlan: any[] = []
      const bookings: any[] = []

      await saveCompletePlanForReplay(
        'exp-999',
        'truck-5',
        'fleet-A',
        completePlan,
        bookings,
        true
      )

      expect(elasticsearchService.addPlanIdToExperiment).toHaveBeenCalledWith(
        'exp-999',
        'exp-999-truck-5'
      )
    })

    it('saves plan statistics (distance, CO2, booking count)', async () => {
      const completePlan = [
        {
          action: 'pickup',
          arrival: 0,
          departure: 100,
          booking: {
            bookingId: 'b1',
            id: 'b1',
            recyclingType: 'HUSHSORT',
            pickup: { position: { lat: 59.0, lon: 18.0 } },
            destination: { position: { lat: 59.1, lon: 18.1 } },
          },
        },
        {
          action: 'pickup',
          arrival: 200,
          departure: 300,
          booking: {
            bookingId: 'b2',
            id: 'b2',
            recyclingType: 'MATAVF',
            pickup: { position: { lat: 59.05, lon: 18.05 } },
            destination: { position: { lat: 59.15, lon: 18.15 } },
          },
        },
      ]

      await saveCompletePlanForReplay(
        'exp-with-stats',
        'truck-1',
        'fleet-1',
        completePlan,
        [],
        true
      )

      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalDistanceKm: expect.any(Number),
          totalCo2Kg: expect.any(Number),
          bookingCount: expect.any(Number),
        }),
        expect.any(String),
        'truck-plans'
      )
    })

    it('returns undefined on save error', async () => {
      save.mockRejectedValueOnce(new Error('ES connection failed'))

      const result = await saveCompletePlanForReplay(
        'exp-fail',
        'truck-fail',
        'fleet-fail',
        [],
        [],
        true
      )

      expect(result).toBeUndefined()
    })
  })

  describe('calculatePlanStatistics', () => {
    it('calculates distance from pickup positions', () => {
      const completePlan = [
        {
          action: 'pickup',
          arrival: 0,
          departure: 100,
          booking: {
            pickup: { position: { lat: 59.0, lon: 18.0 } },
          },
        },
        {
          action: 'pickup',
          arrival: 200,
          departure: 300,
          booking: {
            pickup: { position: { lat: 59.1, lon: 18.1 } },
          },
        },
      ]

      const stats = calculatePlanStatistics(completePlan)

      expect(stats.bookingCount).toBe(2)
      expect(stats.totalDistanceKm).toBeGreaterThan(0)
      expect(stats.totalCo2Kg).toBeGreaterThan(0)
    })

    it('returns zero for empty plan', () => {
      const stats = calculatePlanStatistics([])

      expect(stats.totalDistanceKm).toBe(0)
      expect(stats.totalCo2Kg).toBe(0)
      expect(stats.bookingCount).toBe(0)
    })

    it('ignores non-pickup actions', () => {
      const completePlan = [
        {
          action: 'start',
          arrival: 0,
          departure: 0,
          booking: null,
        },
        {
          action: 'pickup',
          arrival: 100,
          departure: 200,
          booking: {
            pickup: { position: { lat: 59.0, lon: 18.0 } },
          },
        },
        {
          action: 'delivery',
          arrival: 300,
          departure: 400,
          booking: null,
        },
      ]

      const stats = calculatePlanStatistics(completePlan)

      expect(stats.bookingCount).toBe(1)
    })
  })
})

export {}
