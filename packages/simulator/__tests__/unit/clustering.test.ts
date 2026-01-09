import { sodertaljeCoordinates } from '../fixtures'

const {
  calculateCenter,
  calculateBoundingBox,
  createSpatialChunks,
} = require('../../lib/clustering')

describe('Clustering Functions', () => {
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

    it('should handle single booking', () => {
      const bookings = [
        { pickup: { position: { lat: 59.3293, lng: 18.0686 } } },
      ]
      const center = calculateCenter(bookings)

      expect(center.lat).toBeCloseTo(59.3293, 4)
      expect(center.lng).toBeCloseTo(18.0686, 4)
    })

    it('should handle alternative coordinate formats', () => {
      const bookings = [
        { Lat: 59.0, Lng: 18.0 },
        { pickup: { position: { lat: 59.2, lon: 18.2 } } },
        { pickup: { position: { lat: 59.4, lng: 18.4 } } },
      ]

      const center = calculateCenter(bookings)

      expect(center.lat).toBeCloseTo(59.2, 1)
      expect(center.lng).toBeCloseTo(18.2, 1)
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

    it('should handle single point', () => {
      const bookings = [
        { pickup: { position: { lat: 59.3293, lng: 18.0686 } } },
      ]

      const bounds = calculateBoundingBox(bookings)

      expect(bounds.minLat).toBe(59.3293)
      expect(bounds.maxLat).toBe(59.3293)
      expect(bounds.minLng).toBe(18.0686)
      expect(bounds.maxLng).toBe(18.0686)
    })
  })

  describe('createSpatialChunks (DBSCAN)', () => {
    it('should cluster nearby Centrum bookings together', async () => {
      const bookings = [
        {
          id: 's1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
          recyclingType: 'plastic',
        },
        {
          id: 's2',
          pickup: { position: sodertaljeCoordinates.centrum2 },
          recyclingType: 'paper',
        },
        {
          id: 's3',
          pickup: { position: sodertaljeCoordinates.centrum3 },
          recyclingType: 'glass',
        },
        {
          id: 's4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
          recyclingType: 'metal',
        },
        {
          id: 's5',
          pickup: { position: sodertaljeCoordinates.centrum2 },
          recyclingType: 'plastic',
        },
      ]

      const chunks = await createSpatialChunks(bookings)

      expect(chunks.length).toBeGreaterThan(0)

      const totalBookingsInClusters = chunks.reduce(
        (sum: number, c: any) => sum + c.bookings.length,
        0
      )
      expect(totalBookingsInClusters).toBe(bookings.length)
    })

    it('should separate distant clusters (Centrum, Ronna, Weda)', async () => {
      const bookings = [
        {
          id: 's1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
          recyclingType: 'plastic',
        },
        {
          id: 's2',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: 's3',
          pickup: { position: sodertaljeCoordinates.centrum3 },
        },
        {
          id: 's4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's5',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: 'k1',
          pickup: { position: sodertaljeCoordinates.ronna1 },
        },
        {
          id: 'k2',
          pickup: { position: sodertaljeCoordinates.ronna2 },
        },
        {
          id: 'k3',
          pickup: { position: sodertaljeCoordinates.ronna3 },
        },
        {
          id: 'k4',
          pickup: { position: sodertaljeCoordinates.ronna1 },
        },
        {
          id: 'k5',
          pickup: { position: sodertaljeCoordinates.ronna2 },
        },
        {
          id: 'o1',
          pickup: { position: sodertaljeCoordinates.weda1 },
        },
        {
          id: 'o2',
          pickup: { position: sodertaljeCoordinates.weda2 },
        },
        {
          id: 'o3',
          pickup: { position: sodertaljeCoordinates.weda3 },
        },
        {
          id: 'o4',
          pickup: { position: sodertaljeCoordinates.weda1 },
        },
        {
          id: 'o5',
          pickup: { position: sodertaljeCoordinates.weda2 },
        },
      ]

      const chunks = await createSpatialChunks(bookings)

      expect(chunks.length).toBeGreaterThanOrEqual(1)

      const totalBookings = chunks.reduce(
        (sum: number, c: any) => sum + c.bookings.length,
        0
      )
      expect(totalBookings).toBe(bookings.length)

      chunks.forEach((chunk: any) => {
        expect(chunk).toHaveProperty('id')
        expect(chunk).toHaveProperty('bookings')
        expect(chunk).toHaveProperty('center')
        expect(chunk).toHaveProperty('boundingBox')
        expect(chunk).toHaveProperty('polygon')
        expect(chunk).toHaveProperty('count')
        expect(chunk).toHaveProperty('recyclingTypes')
        expect(chunk.count).toBe(chunk.bookings.length)
      })
    })

    it('should handle empty bookings array', async () => {
      const bookings: any[] = []
      const chunks = await createSpatialChunks(bookings)

      expect(chunks).toEqual([])
    })

    it('should extract recycling types from clustered bookings', async () => {
      const bookings = [
        {
          id: '1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
          recyclingType: 'plastic',
        },
        {
          id: '2',
          pickup: { position: sodertaljeCoordinates.centrum2 },
          recyclingType: 'paper',
        },
        {
          id: '3',
          pickup: { position: sodertaljeCoordinates.centrum3 },
          recyclingType: 'glass',
        },
        {
          id: '4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
          recyclingType: 'metal',
        },
        {
          id: '5',
          pickup: { position: sodertaljeCoordinates.centrum2 },
          recyclingType: 'cardboard',
        },
      ]

      const chunks = await createSpatialChunks(bookings)

      expect(chunks.length).toBeGreaterThan(0)

      const firstCluster = chunks[0]
      expect(firstCluster.recyclingTypes.length).toBeGreaterThan(0)
      expect(firstCluster.recyclingTypes.length).toBeGreaterThanOrEqual(3)
    })

    it('should create truck-specific partition IDs when truckId is provided', async () => {
      const bookings = [
        {
          id: '1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: '2',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: '3',
          pickup: { position: sodertaljeCoordinates.centrum3 },
        },
        {
          id: '4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: '5',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
      ]

      const chunks = await createSpatialChunks(bookings, undefined, 'truck-42')

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].id).toMatch(/^truck-truck-42-area-\d+$/)
    })

    it('should handle noise points (isolated bookings)', async () => {
      const bookings = [
        {
          id: 's1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's2',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: 's3',
          pickup: { position: sodertaljeCoordinates.centrum3 },
        },
        {
          id: 's4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's5',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: 'noise',
          pickup: { position: sodertaljeCoordinates.trosa },
        },
      ]

      const chunks = await createSpatialChunks(bookings)

      expect(chunks.length).toBeGreaterThan(0)

      const properClusters = chunks.filter((c: any) => c.bookings.length >= 5)
      expect(properClusters.length).toBeGreaterThanOrEqual(1)
    })

    it('should calculate correct center for clustered bookings', async () => {
      const bookings = [
        {
          id: 's1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's2',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: 's3',
          pickup: { position: sodertaljeCoordinates.centrum3 },
        },
        {
          id: 's4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's5',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
      ]

      const chunks = await createSpatialChunks(bookings)

      expect(chunks.length).toBeGreaterThan(0)

      const firstChunk = chunks[0]
      expect(firstChunk.center).toHaveProperty('lat')
      expect(firstChunk.center).toHaveProperty('lng')

      expect(firstChunk.center.lat).toBeCloseTo(59.1995, 2)
      expect(firstChunk.center.lng).toBeCloseTo(17.631, 2)
    })

    it('should create proper bounding boxes for clusters', async () => {
      const bookings = [
        {
          id: 's1',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's2',
          pickup: { position: sodertaljeCoordinates.centrum3 },
        },
        {
          id: 's3',
          pickup: { position: sodertaljeCoordinates.centrum2 },
        },
        {
          id: 's4',
          pickup: { position: sodertaljeCoordinates.centrum1 },
        },
        {
          id: 's5',
          pickup: { position: sodertaljeCoordinates.centrum3 },
        },
      ]

      const chunks = await createSpatialChunks(bookings)

      expect(chunks.length).toBeGreaterThan(0)

      const firstChunk = chunks[0]
      expect(firstChunk.boundingBox).toHaveProperty('minLat')
      expect(firstChunk.boundingBox).toHaveProperty('maxLat')
      expect(firstChunk.boundingBox).toHaveProperty('minLng')
      expect(firstChunk.boundingBox).toHaveProperty('maxLng')

      expect(firstChunk.boundingBox.minLat).toBeLessThanOrEqual(
        sodertaljeCoordinates.centrum3.lat
      )
      expect(firstChunk.boundingBox.maxLat).toBeGreaterThanOrEqual(
        sodertaljeCoordinates.centrum1.lat
      )
    })
  })
})

export {}
