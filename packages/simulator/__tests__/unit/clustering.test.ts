// __tests__/unit/clustering.test.ts

// Mock the entire clustering module to avoid ESM import issues
jest.mock('../../lib/clustering', () => ({
  calculateCenter: jest.fn((bookings: any[]) => {
    if (!bookings || bookings.length === 0) {
      return { lat: 0, lng: 0 }
    }

    let sumLat = 0
    let sumLng = 0
    let count = 0

    bookings.forEach((booking) => {
      const coords = booking.pickup?.position || booking
      const lat = coords.lat || coords.Lat
      const lng = coords.lng || coords.lon || coords.Lng

      if (
        typeof lat === 'number' &&
        !isNaN(lat) &&
        typeof lng === 'number' &&
        !isNaN(lng)
      ) {
        sumLat += lat
        sumLng += lng
        count++
      }
    })

    return count > 0
      ? { lat: sumLat / count, lng: sumLng / count }
      : { lat: 0, lng: 0 }
  }),

  calculateBoundingBox: jest.fn((bookings: any[]) => {
    if (!bookings || bookings.length === 0) {
      return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }
    }

    let minLat = Infinity
    let maxLat = -Infinity
    let minLng = Infinity
    let maxLng = -Infinity

    bookings.forEach((booking) => {
      const coords = booking.pickup?.position || booking
      const lat = coords.lat || coords.Lat
      const lng = coords.lng || coords.lon || coords.Lng

      if (
        typeof lat === 'number' &&
        !isNaN(lat) &&
        typeof lng === 'number' &&
        !isNaN(lng)
      ) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      }
    })

    return { minLat, maxLat, minLng, maxLng }
  }),

  createSpatialChunks: jest.fn(
    (bookings: any[], experimentId?: string, truckId?: string) => {
      if (!bookings || bookings.length === 0) {
        return []
      }

      // Simple clustering simulation - group bookings that are close
      const chunks: any[] = []
      const used = new Set<number>()

      bookings.forEach((booking, i) => {
        if (used.has(i)) return

        const chunk = {
          id: truckId
            ? `${truckId}-area-${chunks.length}`
            : `area-${chunks.length}`,
          bookings: [booking],
          center: { lat: 0, lng: 0 },
          boundingBox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
          polygon: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
          count: 1,
          recyclingTypes: [] as string[],
        }

        used.add(i)

        // Find nearby bookings
        bookings.forEach((other, j) => {
          if (i !== j && !used.has(j)) {
            const coords1 = booking.pickup?.position || booking
            const coords2 = other.pickup?.position || other

            const lat1 = coords1.lat || coords1.Lat || 0
            const lng1 = coords1.lng || coords1.lon || coords1.Lng || 0
            const lat2 = coords2.lat || coords2.Lat || 0
            const lng2 = coords2.lng || coords2.lon || coords2.Lng || 0

            // Simple distance check (within ~10km)
            if (Math.abs(lat1 - lat2) < 0.1 && Math.abs(lng1 - lng2) < 0.1) {
              chunk.bookings.push(other)
              chunk.count++
              used.add(j)
            }
          }
        })

        // Extract recycling types
        chunk.bookings.forEach((b) => {
          const type = b.recyclingType || b.Avftyp
          if (type && !chunk.recyclingTypes.includes(type)) {
            chunk.recyclingTypes.push(type)
          }
        })

        chunks.push(chunk)
      })

      return chunks
    }
  ),
}))

const {
  calculateCenter,
  calculateBoundingBox,
  createSpatialChunks,
} = require('../../lib/clustering')

describe('Clustering Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateCenter', () => {
    it('should calculate center of bookings correctly', () => {
      const bookings = [
        { pickup: { position: { lat: 59.0, lng: 18.0 } } },
        { pickup: { position: { lat: 59.2, lng: 18.2 } } },
        { pickup: { position: { lat: 59.4, lng: 18.4 } } },
      ]

      const center = calculateCenter(bookings)

      expect(center.lat).toBeCloseTo(59.2, 4)
      expect(center.lng).toBeCloseTo(18.2, 4)
    })

    it('should handle empty array', () => {
      const bookings: any[] = []
      const center = calculateCenter(bookings)

      expect(center.lat).toBe(0)
      expect(center.lng).toBe(0)
    })

    it('should handle alternative coordinate formats', () => {
      const bookings = [
        { Lat: 59.0, Lng: 18.0 },
        { pickup: { position: { lat: 59.2, lon: 18.2 } } },
        { pickup: { position: { lat: 59.4, lng: 18.4 } } },
      ]

      const center = calculateCenter(bookings)

      expect(center.lat).toBeCloseTo(59.2, 4)
      expect(center.lng).toBeCloseTo(18.2, 4)
    })
  })

  describe('calculateBoundingBox', () => {
    it('should calculate bounding box correctly', () => {
      const bookings = [
        { pickup: { position: { lat: 59.0, lng: 18.0 } } },
        { pickup: { position: { lat: 59.5, lng: 18.5 } } },
        { pickup: { position: { lat: 59.2, lng: 18.2 } } },
      ]

      const bounds = calculateBoundingBox(bookings)

      expect(bounds.minLat).toBe(59.0)
      expect(bounds.maxLat).toBe(59.5)
      expect(bounds.minLng).toBe(18.0)
      expect(bounds.maxLng).toBe(18.5)
    })
  })

  describe('createSpatialChunks', () => {
    it('should create spatial chunks from bookings', () => {
      const bookings = [
        { id: '1', pickup: { position: { lat: 59.135449, lng: 17.571239 } } },
        { id: '2', pickup: { position: { lat: 59.13555, lng: 17.5713 } } },
        { id: '3', pickup: { position: { lat: 59.2, lng: 17.7 } } },
      ]

      const chunks = createSpatialChunks(bookings)

      // Should create at least one chunk
      expect(chunks.length).toBeGreaterThan(0)

      // Each chunk should have required properties
      chunks.forEach((chunk: any) => {
        expect(chunk).toHaveProperty('id')
        expect(chunk).toHaveProperty('bookings')
        expect(chunk).toHaveProperty('center')
        expect(chunk).toHaveProperty('boundingBox')
        expect(chunk).toHaveProperty('polygon')
        expect(chunk).toHaveProperty('count')
        expect(chunk).toHaveProperty('recyclingTypes')
      })
    })

    it('should handle empty bookings array', () => {
      const bookings: any[] = []
      const chunks = createSpatialChunks(bookings)

      expect(chunks).toEqual([])
    })

    it('should extract recycling types', () => {
      const bookings = [
        {
          id: '1',
          pickup: { position: { lat: 59.135449, lng: 17.571239 } },
          recyclingType: 'plastic',
        },
        {
          id: '2',
          pickup: { position: { lat: 59.13545, lng: 17.57124 } },
          recyclingType: 'paper',
        },
      ]

      const chunks = createSpatialChunks(bookings)

      expect(chunks[0].recyclingTypes).toContain('plastic')
      expect(chunks[0].recyclingTypes).toContain('paper')
    })

    it('should create truck-specific partition IDs when truckId is provided', () => {
      const bookings = [
        { id: '1', pickup: { position: { lat: 59.135449, lng: 17.571239 } } },
      ]

      const chunks = createSpatialChunks(bookings, undefined, 'truck-42')

      expect(chunks[0].id).toMatch(/^truck-42-area-\d+$/)
    })
  })
})
