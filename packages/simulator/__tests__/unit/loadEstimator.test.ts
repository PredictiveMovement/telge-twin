import {
  estimateBookingLoad,
  getCapacityDimensions,
} from '../../lib/loadEstimator'
import { testSettings } from '../fixtures'

describe('Load Estimator (Unit Tests)', () => {
  describe('estimateBookingLoad', () => {
    it('should use service type volume from settings', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(112)
    })

    it('should use fill percentage (FYLLNADSGRAD) from settings', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL240' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(204)
    })

    it('should calculate volumeLiters = baseVolume * fillPercent / 100', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL370' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(333)
    })

    it('should use waste type density (VOLYMVIKT) for weight', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.weightKg).toBeCloseTo(16.8, 1)
    })

    it('should calculate weightKg = (volumeLiters / 1000) * density', () => {
      const booking = {
        recyclingType: 'MATAVF',
        originalRecord: { Tjtyp: 'KRL240' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.weightKg).toBeCloseTo(81.6, 1)
    })

    it('should fall back to defaults when no settings', () => {
      const booking = {
        recyclingType: 'UNKNOWN',
        originalRecord: { Tjtyp: 'UNKNOWN' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(140)
    })

    it('should return null weightKg when no density', () => {
      const booking = {
        recyclingType: 'UNKNOWN', // No density in settings
        originalRecord: { Tjtyp: 'KRL140' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(112)
      expect(result.weightKg).toBeNull()
    })

    it('should resolve service type from originalData', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalData: { originalTjtyp: 'KRL370' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(333)
    })

    it('should resolve service type from originalRecord', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL240' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(204)
    })

    it('should prioritize originalData over originalRecord', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalData: { originalTjtyp: 'KRL370' },
        originalRecord: { Tjtyp: 'KRL140' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.volumeLiters).toBe(333)
    })

    it('should handle missing tjtyper in settings', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      }
      const emptySettings = { tjtyper: [], avftyper: [] }

      const result = estimateBookingLoad(booking, emptySettings)

      // Fallback values
      expect(result.volumeLiters).toBe(140)
      expect(result.weightKg).toBeNull()
    })

    it('should handle missing avftyper in settings', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      }
      const settingsWithoutWaste = {
        tjtyper: testSettings.tjtyper,
        avftyper: [],
      }

      const result = estimateBookingLoad(booking, settingsWithoutWaste)

      expect(result.volumeLiters).toBe(112)
      expect(result.weightKg).toBeNull()
    })

    it('should handle high density waste (glass)', () => {
      const booking = {
        recyclingType: 'GLOF',
        originalRecord: { Tjtyp: 'KRL140' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.weightKg).toBeCloseTo(56, 1)
    })

    it('should handle low density waste (plastic)', () => {
      const booking = {
        recyclingType: 'PLASTFÖRP',
        originalRecord: { Tjtyp: 'KRL240' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(result.weightKg).toBeCloseTo(6.12, 1)
    })

    it('should ensure minimum volume of 1 liter', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL140' },
      }
      const settingsWithZeroFill = {
        tjtyper: [{ ID: 'KRL140', VOLYM: 140, FYLLNADSGRAD: 0 }],
        avftyper: testSettings.avftyper,
      }

      const result = estimateBookingLoad(booking, settingsWithZeroFill)

      expect(result.volumeLiters).toBeGreaterThanOrEqual(1)
    })

    it('should round volume to nearest integer', () => {
      const booking = {
        recyclingType: 'HUSHSORT',
        originalRecord: { Tjtyp: 'KRL370' },
      }

      const result = estimateBookingLoad(booking, testSettings)

      expect(Number.isInteger(result.volumeLiters)).toBe(true)
    })
  })

  describe('getCapacityDimensions', () => {
    it('should sum remaining volume across compartments', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 3000,
            capacityKg: null,
            fillKg: 0,
          },
          {
            capacityLiters: 8000,
            fillLiters: 2000,
            capacityKg: null,
            fillKg: 0,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('volumeLiters')
      expect(result.values[result.keys.indexOf('volumeLiters')]).toBe(13000)
    })

    it('should sum remaining weight across compartments', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: null,
            fillLiters: 0,
            capacityKg: 3000,
            fillKg: 1000,
          },
          {
            capacityLiters: null,
            fillLiters: 0,
            capacityKg: 2000,
            fillKg: 500,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('weightKg')
      expect(result.values[result.keys.indexOf('weightKg')]).toBe(3500)
    })

    it('should subtract current fill from capacity', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 7500,
            capacityKg: 2000,
            fillKg: 1500,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.values[result.keys.indexOf('volumeLiters')]).toBe(2500)
      expect(result.values[result.keys.indexOf('weightKg')]).toBe(500)
    })

    it('should return volumeLiters key when capacities defined', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 3000,
            capacityKg: null,
            fillKg: 0,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('volumeLiters')
      expect(result.keys).not.toContain('weightKg')
    })

    it('should return weightKg key when capacities defined', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: null,
            fillLiters: 0,
            capacityKg: 2000,
            fillKg: 500,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('weightKg')
      expect(result.keys).not.toContain('volumeLiters')
    })

    it('should fall back to count (parcelCapacity - cargo.length)', () => {
      const truck = {
        parcelCapacity: 50,
        cargo: [{}, {}, {}], // 3 items
        compartments: [
          {
            capacityLiters: null,
            fillLiters: 0,
            capacityKg: null,
            fillKg: 0,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('count')
      expect(result.values[result.keys.indexOf('count')]).toBe(47)
    })

    it('should handle compartments with null capacities', () => {
      const truck = {
        parcelCapacity: 30,
        cargo: [],
        compartments: [
          {
            capacityLiters: null,
            fillLiters: 5000,
            capacityKg: null,
            fillKg: 1000,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      // Should fall back to count
      expect(result.keys).toEqual(['count'])
      expect(result.values).toEqual([30])
    })

    it('should return multiple keys [volumeLiters, weightKg] when both defined', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 3000,
            capacityKg: 2000,
            fillKg: 500,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('volumeLiters')
      expect(result.keys).toContain('weightKg')
      expect(result.values[result.keys.indexOf('volumeLiters')]).toBe(7000)
      expect(result.values[result.keys.indexOf('weightKg')]).toBe(1500)
    })

    it('should handle empty compartments array', () => {
      const truck = {
        parcelCapacity: 25,
        cargo: [{}, {}],
        compartments: [],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toEqual(['count'])
      expect(result.values).toEqual([23])
    })

    it('should handle missing compartments field', () => {
      const truck = {
        parcelCapacity: 20,
        cargo: [],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toEqual(['count'])
      expect(result.values).toEqual([20])
    })

    it('should handle multiple compartments with mixed capacities', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 3000,
            capacityKg: 2000,
            fillKg: 500,
          },
          {
            capacityLiters: 8000,
            fillLiters: 2000,
            capacityKg: null,
            fillKg: 0,
          },
          {
            capacityLiters: null,
            fillLiters: 0,
            capacityKg: 1500,
            fillKg: 300,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toContain('volumeLiters')
      expect(result.keys).toContain('weightKg')
      expect(result.values[result.keys.indexOf('volumeLiters')]).toBe(13000)
      expect(result.values[result.keys.indexOf('weightKg')]).toBe(2700)
    })

    it('should not allow negative remaining capacity', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 12000, // Overfilled
            capacityKg: 2000,
            fillKg: 2500, // Overfilled
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(result.values[result.keys.indexOf('volumeLiters')]).toBe(0)
      expect(result.values[result.keys.indexOf('weightKg')]).toBe(0)
    })

    it('should floor values to integers', () => {
      const truck = {
        compartments: [
          {
            capacityLiters: 10000,
            fillLiters: 3333.7,
            capacityKg: 2000,
            fillKg: 666.9,
          },
        ],
      }

      const result = getCapacityDimensions(truck)

      expect(
        Number.isInteger(result.values[result.keys.indexOf('volumeLiters')])
      ).toBe(true)
      expect(
        Number.isInteger(result.values[result.keys.indexOf('weightKg')])
      ).toBe(true)
    })

    it('should handle zero cargo length', () => {
      const truck = {
        parcelCapacity: 30,
        cargo: [],
        compartments: [],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toEqual(['count'])
      expect(result.values).toEqual([30])
    })

    it('should handle missing cargo field', () => {
      const truck = {
        parcelCapacity: 30,
        compartments: [],
      }

      const result = getCapacityDimensions(truck)

      expect(result.keys).toEqual(['count'])
      expect(result.values).toEqual([30])
    })
  })
})

export {}
