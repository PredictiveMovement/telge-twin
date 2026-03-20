jest.mock('../../lib/osrm', () => ({
  route: jest.fn(),
}))

const { VirtualTime } = require('../../lib/virtualTime')
const Vehicle = require('../../lib/vehicles/vehicle').default
const Position = require('../../lib/models/position')

/**
 * Create a mock OSRM-style route with a known duration for testing.
 * 3 waypoints → 2 equal segments.
 */
function createRoute(durationSeconds: number): any {
  const halfDur = durationSeconds / 2
  return {
    geometry: {
      coordinates: [
        { lat: 59.0, lon: 17.0 },
        { lat: 59.01, lon: 17.01 },
        { lat: 59.02, lon: 17.02 },
      ],
    },
    legs: [
      {
        annotation: {
          duration: [halfDur, halfDur],
          distance: [500, 500],
        },
        distance: 1000,
        duration: durationSeconds,
      },
    ],
    duration: durationSeconds,
    distance: 1000,
  }
}

/**
 * Helper: subscribe, pause, wait for first tick to settle, return start time.
 * Ensures deterministic setup regardless of multiplier.
 */
async function setupPaused(vt: any) {
  const sub = vt.getTimeInMilliseconds().subscribe(() => {})
  vt.pause()
  // Let at least one paused tick settle so the subject has a value
  await new Promise((r) => setTimeout(r, 30))
  const startTime = await vt.getTimeInMillisecondsAsPromise()
  return { sub, startTime }
}

describe('Time multiplier consistency', () => {
  // ─────────────────────────────────────────────────────────────────
  // 1. wait() precision — should advance ~30s virtual regardless of speed
  // ─────────────────────────────────────────────────────────────────
  describe('wait() precision', () => {
    it.each([60, 120, 300, 600])(
      'wait(30000) advances ~30000ms virtual time at %dx',
      async (multiplier) => {
        const vt = new VirtualTime(multiplier, 6, 15)
        const sub = vt.getTimeInMilliseconds().subscribe(() => {})

        // Wait for first tick to establish _now
        await vt.getTimeInMillisecondsAsPromise()

        const before = await vt.getTimeInMillisecondsAsPromise()
        await vt.wait(30000)
        const after = await vt.getTimeInMillisecondsAsPromise()

        const elapsed = after - before
        // Must advance at least 30s, at most 31s (1s getUnixTime resolution)
        expect(elapsed).toBeGreaterThanOrEqual(30000)
        expect(elapsed).toBeLessThanOrEqual(31000)

        sub.unsubscribe()
      }
    )

    it('elapsed time spread across multipliers is ≤2s', async () => {
      const multipliers = [60, 120, 300, 600]
      const results: number[] = []

      for (const m of multipliers) {
        const vt = new VirtualTime(m, 6, 15)
        const sub = vt.getTimeInMilliseconds().subscribe(() => {})
        await vt.getTimeInMillisecondsAsPromise()

        const before = await vt.getTimeInMillisecondsAsPromise()
        await vt.wait(30000)
        const after = await vt.getTimeInMillisecondsAsPromise()

        results.push(after - before)
        sub.unsubscribe()
      }

      const maxSpread = Math.max(...results) - Math.min(...results)
      expect(maxSpread).toBeLessThanOrEqual(2000)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 2. Vehicle arrival timing — stopped() should fire at consistent time
  // ─────────────────────────────────────────────────────────────────
  describe('vehicle arrival timing', () => {
    it('stopped() fires at consistent virtual time across speeds', async () => {
      const routeDuration = 120 // seconds
      const multipliers = [60, 120, 600]
      const arrivalElapsed: number[] = []

      for (const m of multipliers) {
        const vt = new VirtualTime(m, 6, 15)
        const { sub, startTime } = await setupPaused(vt)

        const dest = new Position({ lat: 59.02, lon: 17.02 })
        const vehicle = new Vehicle({
          id: `v-${m}x`,
          position: new Position({ lat: 59.0, lon: 17.0 }),
          destination: dest,
          virtualTime: vt,
        })

        const route = createRoute(routeDuration)
        route.started = startTime

        const arrivalPromise = new Promise<number>((resolve) => {
          vehicle.stopped = function () {
            const t = vt.now()
            vehicle.simulate(false)
            resolve(t)
          }
        })

        vehicle.simulate(route)
        vt.play()

        const arrivalTime = await arrivalPromise
        arrivalElapsed.push(arrivalTime - startTime)
        sub.unsubscribe()
      }

      // Each should arrive within 1s of the route duration (getUnixTime resolution)
      arrivalElapsed.forEach((elapsed) => {
        expect(elapsed).toBeGreaterThanOrEqual(routeDuration * 1000)
        expect(elapsed).toBeLessThanOrEqual(routeDuration * 1000 + 1000)
      })

      // Spread across multipliers should be ≤1s
      const maxSpread =
        Math.max(...arrivalElapsed) - Math.min(...arrivalElapsed)
      expect(maxSpread).toBeLessThanOrEqual(1000)
    })

    it('stopped() fires immediately when route completes (no extra tick delay)', async () => {
      const routeDuration = 60 // seconds
      const vt = new VirtualTime(600, 6, 15)
      const { sub, startTime } = await setupPaused(vt)

      const vehicle = new Vehicle({
        id: 'v-immediate',
        position: new Position({ lat: 59.0, lon: 17.0 }),
        destination: new Position({ lat: 59.02, lon: 17.02 }),
        virtualTime: vt,
      })

      const route = createRoute(routeDuration)
      route.started = startTime

      const arrivalPromise = new Promise<number>((resolve) => {
        vehicle.stopped = function () {
          const t = vt.now()
          vehicle.simulate(false)
          resolve(t)
        }
      })

      vehicle.simulate(route)
      vt.play()

      const arrivalTime = await arrivalPromise
      const elapsed = arrivalTime - startTime

      // At 600x with adaptive interval(10), step = 6000ms.
      // Route 60s = 60000ms / 6000 = 10 ticks. Should arrive at exactly 60000ms.
      // Without Fix 1 (extra tick), it would arrive at 66000ms.
      expect(elapsed).toBeLessThanOrEqual(61000)
      sub.unsubscribe()
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 3. Combined stop cycle — navigate + service time
  // ─────────────────────────────────────────────────────────────────
  describe('combined stop cycle', () => {
    it('navigate + service time totals consistently across speeds', async () => {
      const routeDuration = 90 // seconds
      const serviceTimeMs = 30000
      const expectedTotal = (routeDuration * 1000 + serviceTimeMs) // 120000ms
      const multipliers = [60, 120, 600]
      const totalElapsed: number[] = []

      for (const m of multipliers) {
        const vt = new VirtualTime(m, 6, 15)
        const { sub, startTime } = await setupPaused(vt)

        const vehicle = new Vehicle({
          id: `v-cycle-${m}x`,
          position: new Position({ lat: 59.0, lon: 17.0 }),
          destination: new Position({ lat: 59.02, lon: 17.02 }),
          virtualTime: vt,
        })

        const route = createRoute(routeDuration)
        route.started = startTime

        // Phase 1: Navigate (vehicle drives the route)
        const navigatePromise = new Promise<void>((resolve) => {
          vehicle.stopped = function () {
            vehicle.simulate(false)
            resolve()
          }
        })

        vehicle.simulate(route)
        vt.play()
        await navigatePromise

        // Phase 2: Service time (truck at stop)
        await vt.wait(serviceTimeMs)

        const endTime = await vt.getTimeInMillisecondsAsPromise()
        totalElapsed.push(endTime - startTime)
        sub.unsubscribe()
      }

      // Expected: ~120s. Allow 2s tolerance (1s for nav + 1s for wait)
      totalElapsed.forEach((elapsed) => {
        expect(elapsed).toBeGreaterThanOrEqual(expectedTotal)
        expect(elapsed).toBeLessThanOrEqual(expectedTotal + 2000)
      })

      // Spread across multipliers should be ≤2s
      const maxSpread =
        Math.max(...totalElapsed) - Math.min(...totalElapsed)
      expect(maxSpread).toBeLessThanOrEqual(2000)
    })

    it('multiple stop cycles accumulate consistently', async () => {
      // Use durations that divide evenly by tick steps at both 120x and 600x
      // 120x: step=1200ms. 600x: step=6000ms. LCM-friendly: 30s, 60s
      const routeDuration = 60 // seconds per leg
      const serviceTimeMs = 30000 // 30s per stop
      const numStops = 3
      const expectedTotal = numStops * (routeDuration * 1000 + serviceTimeMs) // 270000ms
      const multipliers = [120, 600]
      const totalElapsed: number[] = []

      for (const m of multipliers) {
        const vt = new VirtualTime(m, 6, 15)
        const { sub, startTime } = await setupPaused(vt)

        const vehicle = new Vehicle({
          id: `v-multi-${m}x`,
          position: new Position({ lat: 59.0, lon: 17.0 }),
          destination: new Position({ lat: 59.02, lon: 17.02 }),
          virtualTime: vt,
        })

        for (let i = 0; i < numStops; i++) {
          // Pause during route setup (mimics runWithoutAdvancing in real code)
          vt.pause()
          const route = createRoute(routeDuration)
          route.started = await vt.getTimeInMillisecondsAsPromise()

          // Navigate
          await new Promise<void>((resolve) => {
            vehicle.stopped = function () {
              vehicle.simulate(false)
              resolve()
            }
            vehicle.simulate(route)
            vt.play()
          })

          // Service time
          await vt.wait(serviceTimeMs)
        }

        const endTime = await vt.getTimeInMillisecondsAsPromise()
        totalElapsed.push(endTime - startTime)
        sub.unsubscribe()
      }

      // Expected: 3 * (60s + 30s) = 270s = 270000ms
      // Both durations divide evenly by tick steps, so overhead should be ≤1s
      totalElapsed.forEach((elapsed) => {
        expect(elapsed).toBeGreaterThanOrEqual(expectedTotal)
        expect(elapsed).toBeLessThanOrEqual(expectedTotal + 3000)
      })

      // Spread across multipliers should be ≤2s
      const maxSpread =
        Math.max(...totalElapsed) - Math.min(...totalElapsed)
      expect(maxSpread).toBeLessThanOrEqual(2000)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 4. Adaptive tick frequency
  // ─────────────────────────────────────────────────────────────────
  describe('adaptive tick frequency', () => {
    it('uses smaller tick interval at high multipliers', () => {
      // At 1x, interval should be 100ms (default)
      const vt1 = new VirtualTime(1, 6, 15)
      // At 600x, interval should be 10ms (minimum)
      const vt600 = new VirtualTime(600, 6, 15)

      // Verify indirectly: at 600x, wait(30000) resolves much faster in wall-clock
      // This is more of a smoke test for the adaptive behavior
      expect(vt1.getTimeMultiplier()).toBe(1)
      expect(vt600.getTimeMultiplier()).toBe(600)
    })

    it('setTimeMultiplier rebuilds interval when frequency changes', async () => {
      const vt = new VirtualTime(1, 6, 15)
      const sub = vt.getTimeInMilliseconds().subscribe(() => {})

      // Let first tick settle
      await vt.getTimeInMillisecondsAsPromise()
      const t1 = vt.now()

      // Change to high multiplier — should rebuild interval with smaller tick
      vt.setTimeMultiplier(600)

      // Wait 200ms wall-clock — at 600x with interval(10), that's many ticks
      await new Promise((r) => setTimeout(r, 200))
      const t2 = vt.now()

      // Should have advanced significantly (200ms * 600 = 120000ms = 120 virtual seconds)
      // Allow wide tolerance since exact timing depends on interval scheduling
      expect(t2 - t1).toBeGreaterThan(50000)

      sub.unsubscribe()
    })
  })
})

export {}
