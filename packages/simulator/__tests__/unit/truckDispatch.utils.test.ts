const {
  simpleGeographicSplit,
  combineSubResults,
} = require('../../lib/dispatch/truckDispatch')

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
})

export {}
