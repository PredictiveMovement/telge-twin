import {
  createCompartments,
  selectBestCompartment,
  isAnyCompartmentFull,
  isCompartmentFull,
  applyLoadToCompartment,
  releaseLoadFromCompartment,
  type Compartment,
  type LoadEstimate,
} from '../../lib/capacity'

describe('Compartments (Unit Tests)', () => {
  describe('createCompartments', () => {
    it('should create single default compartment when no fackDetails', () => {
      const compartments = createCompartments()

      expect(compartments).toHaveLength(1)
      expect(compartments[0]).toEqual({
        fackNumber: 1,
        allowedWasteTypes: ['*'],
        capacityLiters: null,
        capacityKg: null,
        fillLiters: 0,
        fillKg: 0,
      })
    })

    it('should create single default compartment for empty array', () => {
      const compartments = createCompartments([])

      expect(compartments).toHaveLength(1)
      expect(compartments[0].allowedWasteTypes).toEqual(['*'])
    })

    it('should create multiple compartments from fackDetails array', () => {
      const fackDetails = [
        {
          fackNumber: 1,
          volym: 12, // m³
          vikt: 3000, // kg
          avfallstyper: [{ avftyp: 'HUSHSORT' }, { avftyp: 'MATAVF' }],
        },
        {
          fackNumber: 2,
          volym: 8,
          vikt: 2000,
          avfallstyper: [{ avftyp: 'PAPPFÖRP' }],
        },
      ]

      const compartments = createCompartments(fackDetails)

      expect(compartments).toHaveLength(2)
      expect(compartments[0].fackNumber).toBe(1)
      expect(compartments[1].fackNumber).toBe(2)
    })

    it('should extract waste types from avfallstyper', () => {
      const fackDetails = [
        {
          avfallstyper: [{ avftyp: 'HUSHSORT' }, { avftyp: 'MATAVF' }],
        },
      ]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].allowedWasteTypes).toEqual(['HUSHSORT', 'MATAVF'])
    })

    it('should convert capacity from m³ to liters (volym * 1000)', () => {
      const fackDetails = [{ volym: 12 }]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].capacityLiters).toBe(12000)
    })

    it('should use capacity in kg (vikt)', () => {
      const fackDetails = [{ vikt: 3000 }]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].capacityKg).toBe(3000)
    })

    it('should fallback to ALLOW_ALL when no waste types', () => {
      const fackDetails = [{ avfallstyper: [] }]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].allowedWasteTypes).toEqual(['*'])
    })

    it('should have initial fill levels at 0', () => {
      const fackDetails = [{ volym: 10, vikt: 2000 }]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].fillLiters).toBe(0)
      expect(compartments[0].fillKg).toBe(0)
    })

    it('should generate fackNumber from index when missing', () => {
      const fackDetails = [{ volym: 10 }, { volym: 8 }, { volym: 6 }]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].fackNumber).toBe(1)
      expect(compartments[1].fackNumber).toBe(2)
      expect(compartments[2].fackNumber).toBe(3)
    })

    it('should handle null capacities', () => {
      const fackDetails = [{ volym: 0, vikt: 0, avfallstyper: [] }]

      const compartments = createCompartments(fackDetails)

      expect(compartments[0].capacityLiters).toBeNull()
      expect(compartments[0].capacityKg).toBeNull()
    })
  })

  describe('selectBestCompartment', () => {
    it('should return null for empty compartments array', () => {
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment([], 'HUSHSORT', load)

      expect(result).toBeNull()
    })

    it('should return null when no matching waste type', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['MATAVF'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 0,
          fillKg: 0,
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment(compartments, 'HUSHSORT', load)

      expect(result).toBeNull()
    })

    it('should select compartment with ALLOW_ALL wildcard', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['*'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 0,
          fillKg: 0,
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment(compartments, 'HUSHSORT', load)

      expect(result).toBe(compartments[0])
    })

    it('should select compartment with exact waste type match', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT', 'MATAVF'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 0,
          fillKg: 0,
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment(compartments, 'MATAVF', load)

      expect(result).toBe(compartments[0])
    })

    it('should prefer compartment with most remaining capacity', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 5000, // 50% full
          fillKg: 1000,
        },
        {
          fackNumber: 2,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 2000, // 20% full - more space
          fillKg: 500,
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment(compartments, 'HUSHSORT', load)

      expect(result).toBe(compartments[1]) // More capacity remaining
    })

    it('should consider both volume and weight capacity', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 1000,
          fillLiters: 0,
          fillKg: 900, // Nearly full on weight
        },
        {
          fackNumber: 2,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 0,
          fillKg: 500, // More weight capacity
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment(compartments, 'HUSHSORT', load)

      expect(result).toBe(compartments[1]) // Better weight capacity
    })

    it('should handle null weightKg in load', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 0,
          fillKg: 0,
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: null }

      const result = selectBestCompartment(compartments, 'HUSHSORT', load)

      expect(result).toBe(compartments[0])
    })

    it('should handle infinite capacity (null limits)', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: null,
          capacityKg: null,
          fillLiters: 5000,
          fillKg: 1000,
        },
      ]
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      const result = selectBestCompartment(compartments, 'HUSHSORT', load)

      expect(result).toBe(compartments[0])
    })
  })

  describe('isCompartmentFull', () => {
    it('should return false when compartment has space', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }

      expect(isCompartmentFull(compartment)).toBe(false)
    })

    it('should return true when volume capacity reached', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 3000,
        fillLiters: 10000, // Full
        fillKg: 1000,
      }

      expect(isCompartmentFull(compartment)).toBe(true)
    })

    it('should return true when weight capacity reached', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 2000, // Full
      }

      expect(isCompartmentFull(compartment)).toBe(true)
    })

    it('should return false when no capacity limits set (null)', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: null,
        capacityKg: null,
        fillLiters: 5000,
        fillKg: 1000,
      }

      expect(isCompartmentFull(compartment)).toBe(false)
    })

    it('should return true when volume exceeded', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 3000,
        fillLiters: 10500, // Over capacity
        fillKg: 1000,
      }

      expect(isCompartmentFull(compartment)).toBe(true)
    })
  })

  describe('isAnyCompartmentFull', () => {
    it('should return false when all compartments have space', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 5000,
          fillKg: 1000,
        },
        {
          fackNumber: 2,
          allowedWasteTypes: ['MATAVF'],
          capacityLiters: 8000,
          capacityKg: 1500,
          fillLiters: 4000,
          fillKg: 700,
        },
      ]

      expect(isAnyCompartmentFull(compartments)).toBe(false)
    })

    it('should return true when any compartment is full', () => {
      const compartments: Compartment[] = [
        {
          fackNumber: 1,
          allowedWasteTypes: ['HUSHSORT'],
          capacityLiters: 10000,
          capacityKg: 2000,
          fillLiters: 10000, // Full
          fillKg: 1000,
        },
        {
          fackNumber: 2,
          allowedWasteTypes: ['MATAVF'],
          capacityLiters: 8000,
          capacityKg: 1500,
          fillLiters: 4000,
          fillKg: 700,
        },
      ]

      expect(isAnyCompartmentFull(compartments)).toBe(true)
    })
  })

  describe('applyLoadToCompartment', () => {
    it('should increase fillLiters by load.volumeLiters', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      applyLoadToCompartment(compartment, load)

      expect(compartment.fillLiters).toBe(5100)
    })

    it('should increase fillKg by load.weightKg', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      applyLoadToCompartment(compartment, load)

      expect(compartment.fillKg).toBe(1050)
    })

    it('should handle null weightKg gracefully', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: null }

      applyLoadToCompartment(compartment, load)

      expect(compartment.fillLiters).toBe(5100)
      expect(compartment.fillKg).toBe(1000) // Unchanged
    })

    it('should accumulate multiple loads', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 0,
        fillKg: 0,
      }
      const load1: LoadEstimate = { volumeLiters: 100, weightKg: 50 }
      const load2: LoadEstimate = { volumeLiters: 150, weightKg: 75 }

      applyLoadToCompartment(compartment, load1)
      applyLoadToCompartment(compartment, load2)

      expect(compartment.fillLiters).toBe(250)
      expect(compartment.fillKg).toBe(125)
    })
  })

  describe('releaseLoadFromCompartment', () => {
    it('should decrease fillLiters by load.volumeLiters', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      releaseLoadFromCompartment(compartment, load)

      expect(compartment.fillLiters).toBe(4900)
    })

    it('should decrease fillKg by load.weightKg', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      releaseLoadFromCompartment(compartment, load)

      expect(compartment.fillKg).toBe(950)
    })

    it('should never go below 0 for fillLiters', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 50,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      releaseLoadFromCompartment(compartment, load)

      expect(compartment.fillLiters).toBe(0)
    })

    it('should never go below 0 for fillKg', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 25,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: 50 }

      releaseLoadFromCompartment(compartment, load)

      expect(compartment.fillKg).toBe(0)
    })

    it('should handle null weightKg gracefully', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 5000,
        fillKg: 1000,
      }
      const load: LoadEstimate = { volumeLiters: 100, weightKg: null }

      releaseLoadFromCompartment(compartment, load)

      expect(compartment.fillLiters).toBe(4900)
      expect(compartment.fillKg).toBe(1000) // Unchanged
    })

    it('should allow multiple releases to empty compartment', () => {
      const compartment: Compartment = {
        fackNumber: 1,
        allowedWasteTypes: ['HUSHSORT'],
        capacityLiters: 10000,
        capacityKg: 2000,
        fillLiters: 250,
        fillKg: 125,
      }
      const load1: LoadEstimate = { volumeLiters: 100, weightKg: 50 }
      const load2: LoadEstimate = { volumeLiters: 150, weightKg: 75 }

      releaseLoadFromCompartment(compartment, load1)
      releaseLoadFromCompartment(compartment, load2)

      expect(compartment.fillLiters).toBe(0)
      expect(compartment.fillKg).toBe(0)
    })
  })
})

export {}
