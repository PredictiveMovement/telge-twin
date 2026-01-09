import { buildBreakSchedule } from '../../lib/vehicles/breaks'

describe('Breaks (Unit Tests)', () => {
  const MS_PER_MINUTE = 60 * 1000
  const baseDate = new Date('2024-01-15T00:00:00Z')
  const dayStartMs = baseDate.getTime() + 6 * 60 * MS_PER_MINUTE // 06:00
  const dayEndMs = baseDate.getTime() + 15 * 60 * MS_PER_MINUTE // 15:00

  const mockVirtualTime = {
    now: () => dayStartMs,
    getWorkdayBounds: () => ({
      startMs: dayStartMs,
      endMs: dayEndMs,
    }),
  }

  describe('buildBreakSchedule', () => {
    it('should return empty array when no breaks provided', () => {
      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks: [],
      })

      expect(result).toEqual([])
    })

    it('should return empty array when breaks is null', () => {
      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks: null,
      })

      expect(result).toEqual([])
    })

    it('should parse startMinutes from breaks array', () => {
      const breaks = [
        {
          id: 'lunch',
          startMinutes: 720, // 12:00
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('lunch')
      expect(result[0].durationMs).toBe(30 * MS_PER_MINUTE)
    })

    it('should parse desiredTime string (HH:MM format)', () => {
      const breaks = [
        {
          id: 'morning-break',
          desiredTime: '09:00',
          duration: 15,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('morning-break')
      expect(result[0].durationMs).toBe(15 * MS_PER_MINUTE)
    })

    it('should parse durationMinutes from breaks', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: 45,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].durationMs).toBe(45 * MS_PER_MINUTE)
    })

    it('should parse duration from breaks (alternative field)', () => {
      const breaks = [
        {
          desiredTime: '12:00',
          duration: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].durationMs).toBe(30 * MS_PER_MINUTE)
    })

    it('should convert to absolute timestamps (startMs, durationMs)', () => {
      const breaks = [
        {
          startMinutes: 720, // 12:00 (from midnight)
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      const expectedStartMs = baseDate.getTime() + 720 * MS_PER_MINUTE
      expect(result[0].startMs).toBeGreaterThanOrEqual(dayStartMs)
      expect(result[0].startMs).toBeLessThan(dayEndMs)
      expect(result[0].durationMs).toBe(30 * MS_PER_MINUTE)
      expect(result[0].taken).toBe(false)
    })

    it('should use workday bounds from virtualTime', () => {
      const breaks = [
        {
          startMinutes: 720, // 12:00
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].startMs).toBeGreaterThanOrEqual(dayStartMs)
      expect(result[0].startMs).toBeLessThan(dayEndMs)
    })

    it('should fall back to workdaySettings start/end', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: 30,
        },
      ]
      const workdaySettings = {
        startMinutes: 360, // 06:00
        endMinutes: 900, // 15:00
      }

      const result = buildBreakSchedule({
        virtualTime: null,
        breaks,
        workdaySettings,
      })

      expect(result).toHaveLength(1)
    })

    it('should fall back to optimizationSettings workingHours', () => {
      const breaks = [
        {
          desiredTime: '12:00',
          duration: 30,
        },
      ]
      const optimizationSettings = {
        workingHours: {
          start: '06:00',
          end: '15:00',
        },
      }

      const result = buildBreakSchedule({
        virtualTime: null,
        breaks,
        optimizationSettings,
      })

      expect(result).toHaveLength(1)
    })

    it('should clamp breaks within workday bounds', () => {
      const breaks = [
        {
          startMinutes: 300, // 05:00 - before workday start
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].startMs).toBe(dayStartMs)
    })

    it('should filter breaks outside workday', () => {
      const breaks = [
        {
          startMinutes: 960, // 16:00 - after workday end (15:00 = 900 minutes)
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(0)
    })

    it('should sort breaks by startMs', () => {
      const breaks = [
        {
          id: 'lunch',
          startMinutes: 720, // 12:00
          durationMinutes: 30,
        },
        {
          id: 'morning',
          startMinutes: 540, // 09:00
          durationMinutes: 15,
        },
        {
          id: 'afternoon',
          startMinutes: 840, // 14:00
          durationMinutes: 15,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('morning')
      expect(result[1].id).toBe('lunch')
      expect(result[2].id).toBe('afternoon')
    })

    it('should generate unique IDs for breaks when missing', () => {
      const breaks = [
        {
          startMinutes: 540,
          durationMinutes: 15,
        },
        {
          startMinutes: 720,
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].id).toBe('break-0')
      expect(result[1].id).toBe('break-1')
    })

    it('should keep provided IDs', () => {
      const breaks = [
        {
          id: 'custom-break',
          startMinutes: 720,
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].id).toBe('custom-break')
    })

    it('should ignore breaks with invalid time formats', () => {
      const breaks = [
        {
          desiredTime: 'invalid',
          duration: 30,
        },
        {
          desiredTime: '25:00', // Invalid hour
          duration: 30,
        },
        {
          desiredTime: '12:60', // Invalid minutes
          duration: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(0)
    })

    it('should filter out breaks with negative durations', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: -30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(0)
    })

    it('should filter out breaks with zero duration', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: 0,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(0)
    })

    it('should filter out break after workday end', () => {
      const breaks = [
        {
          startMinutes: 1020, // 17:00 - clearly after 15:00 end
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(0)
    })

    it('should handle multiple breaks on same day', () => {
      const breaks = [
        {
          id: 'morning',
          startMinutes: 540, // 09:00
          durationMinutes: 15,
        },
        {
          id: 'lunch',
          startMinutes: 720, // 12:00
          durationMinutes: 30,
        },
        {
          id: 'afternoon',
          startMinutes: 840, // 14:00
          durationMinutes: 15,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(3)
      result.forEach((breakItem) => {
        expect(breakItem.taken).toBe(false)
        expect(breakItem.startMs).toBeGreaterThanOrEqual(dayStartMs)
        expect(breakItem.startMs).toBeLessThan(dayEndMs)
      })
    })

    it('should handle breaks without virtualTime', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: 30,
        },
      ]
      const workdaySettings = {
        start: '06:00',
        end: '15:00',
      }

      const result = buildBreakSchedule({
        virtualTime: null,
        breaks,
        workdaySettings,
      })

      expect(result).toHaveLength(1)
      expect(result[0].durationMs).toBe(30 * MS_PER_MINUTE)
    })

    it('should handle mixed time format inputs', () => {
      const breaks = [
        {
          id: 'numeric',
          startMinutes: 540,
          durationMinutes: 15,
        },
        {
          id: 'string',
          desiredTime: '12:00',
          duration: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('numeric')
      expect(result[1].id).toBe('string')
    })

    it('should handle breaks array with null/undefined entries', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: 30,
        },
        null,
        undefined,
        {
          desiredTime: '14:00',
          duration: 15,
        },
      ] as any

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result).toHaveLength(2)
    })

    it('should prioritize explicit startMinutes over desiredTime', () => {
      const breaks = [
        {
          startMinutes: 540, // 09:00 from midnight - should use this
          desiredTime: '12:00', // Not this
          durationMinutes: 30,
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].startMs).toBeGreaterThanOrEqual(dayStartMs)
      expect(result[0].startMs).toBeLessThan(dayEndMs)
    })

    it('should prioritize explicit durationMinutes over duration', () => {
      const breaks = [
        {
          startMinutes: 720,
          durationMinutes: 45, // Should use this
          duration: 30, // Not this
        },
      ]

      const result = buildBreakSchedule({
        virtualTime: mockVirtualTime,
        breaks,
      })

      expect(result[0].durationMs).toBe(45 * MS_PER_MINUTE)
    })
  })
})

export {}
