// Camera flyover controller for DeckGL/Mapbox viewState

export type ViewState = {
  latitude: number
  longitude: number
  zoom: number
  bearing: number
  pitch: number
}

export type FlyoverOptions = {
  hopDurationMs?: number
  dwellMs?: number
  baseZoom?: number
  basePitch?: number
  bearingFollow?: boolean
  loop?: boolean
  zoomInDelta?: number
  durationJitterPct?: number
  speedBurstProbability?: number
  speedBurstFactor?: number
  autoFollow?: boolean
  autoFollowIntervalMs?: number
  autoFollowDurationMs?: number
  minFollowSpeedMps?: number
  followZoom?: number | null
  followPitch?: number | null
}

type CreateFlyoverArgs = {
  getWaypoints: () => [number, number][] // [lon, lat]
  getCurrentViewState: () => ViewState
  setViewState: (vs: ViewState) => void
  options?: FlyoverOptions
  getVehicles?: () => { id: string; position: [number, number] }[]
}

export function createCameraFlyover({
  getWaypoints,
  getCurrentViewState,
  setViewState,
  options,
  getVehicles,
}: CreateFlyoverArgs) {
  let isRunning = false
  let rafId: number | null = null
  // Follow mode
  let inFollow = false
  let followEndTime = 0
  let followGetPosition: (() => [number, number]) | null = null
  let lastFollowPos: [number, number] | null = null
  let autoFollowIntervalId: number | null = null
  // Chase-cam state (persistent until toggled off)
  let chaseVehicleId: string | null = null
  let chaseIndex: number = -1
  const chaseSmoothingAlpha = 0.002
  const chaseBearingAlpha = 0.005
  let lastChaseBearing: number | null = null

  const {
    hopDurationMs = 10000,
    dwellMs = 0,
    baseZoom: baseZoomInit = 12,
    basePitch: basePitchInit = 58,
    bearingFollow = true,
    loop = true,
    zoomInDelta = 0.3,
    durationJitterPct = 0.02,
    speedBurstProbability = 0,
    speedBurstFactor = 1,
    autoFollow = true,
    autoFollowIntervalMs = 20000,
    autoFollowDurationMs = 8000,
    minFollowSpeedMps = 0.6,
    followZoom = null,
    followPitch = null,
  } = options || {}

  // Mutable base camera parameters (allow runtime tweaks like follow overrides)
  let baseZoom = baseZoomInit
  let basePitch = basePitchInit

  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

  const lngLatLerp = (
    from: [number, number],
    to: [number, number],
    t: number
  ): [number, number] => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
  ]

  const bearingBetween = (from: [number, number], to: [number, number]) => {
    const dy = to[1] - from[1]
    const dx = to[0] - from[0]
    const rad = Math.atan2(dy, dx)
    const deg = (rad * 180) / Math.PI
    return (deg + 360) % 360
  }

  const shortestAngleDiff = (fromDeg: number, toDeg: number) => {
    const diff = ((toDeg - fromDeg + 540) % 360) - 180
    return diff
  }

  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isRunning = false
    inFollow = false
    followGetPosition = null
    lastFollowPos = null
    if (autoFollowIntervalId) {
      clearInterval(autoFollowIntervalId)
      autoFollowIntervalId = null
    }
    chaseVehicleId = null
    chaseIndex = -1
    lastChaseBearing = null
  }

  const animateSegments = (waypoints: [number, number][], startIdx = 0) => {
    if (!isRunning || waypoints.length < 1) {
      cancel()
      return
    }

    let idx = startIdx

    const step = () => {
      if (!isRunning) return
      // Chase mode: smooth-follow a selected vehicle when set
      if (chaseVehicleId && getVehicles) {
        const vehicles = getVehicles() || []
        const v = vehicles.find((x) => x.id === chaseVehicleId)
        const vs = getCurrentViewState()
        const target: [number, number] = v
          ? v.position
          : [vs.longitude, vs.latitude]
        const lon =
          vs.longitude + (target[0] - vs.longitude) * chaseSmoothingAlpha
        const lat =
          vs.latitude + (target[1] - vs.latitude) * chaseSmoothingAlpha
        const targetBearing = bearingBetween(
          [vs.longitude, vs.latitude],
          [lon, lat]
        )
        if (lastChaseBearing == null) lastChaseBearing = vs.bearing
        const delta = shortestAngleDiff(lastChaseBearing, targetBearing)
        const bearing =
          (((lastChaseBearing + delta * chaseBearingAlpha) % 360) + 360) % 360
        lastChaseBearing = bearing
        setViewState({
          latitude: lat,
          longitude: lon,
          zoom: baseZoom,
          bearing,
          pitch: basePitch,
        })
        rafId = requestAnimationFrame(step)
        return
      }
      if (inFollow && followGetPosition) {
        const now = performance.now()
        const pos = followGetPosition()
        if (!lastFollowPos) lastFollowPos = pos
        const bearing = bearingBetween(lastFollowPos, pos)
        lastFollowPos = pos
        setViewState({
          latitude: pos[1],
          longitude: pos[0],
          zoom: baseZoom,
          bearing,
          pitch: basePitch,
        })
        if (now < followEndTime) {
          rafId = requestAnimationFrame(step)
          return
        } else {
          inFollow = false
          lastFollowPos = null
        }
      }

      const liveVs = getCurrentViewState()
      const from: [number, number] = [liveVs.longitude, liveVs.latitude]
      const to = waypoints[idx]
      const startTime = performance.now()
      const startBearing = liveVs.bearing
      const targetBearing = bearingFollow
        ? bearingBetween(from, to)
        : startBearing
      const deltaBearing = shortestAngleDiff(startBearing, targetBearing)

      // Compute segment duration once to avoid per-frame jitter causing shaking
      const baseDuration = Math.max(
        300,
        hopDurationMs * (1 + durationJitterPct * (Math.random() * 2 - 1))
      )
      const useBurst = Math.random() < speedBurstProbability
      const effectiveDuration = Math.max(
        200,
        useBurst ? baseDuration * speedBurstFactor : baseDuration
      )

      const tick = () => {
        if (!isRunning) return
        if (inFollow && followGetPosition) {
          // If follow gets triggered externally mid-segment, switch immediately
          rafId = requestAnimationFrame(step)
          return
        }
        const now = performance.now()
        const t = Math.min(1, (now - startTime) / effectiveDuration)
        const k = easeInOut(t)
        const [lon, lat] = lngLatLerp(from, to, k)
        const bearing = (startBearing + deltaBearing * k + 360) % 360
        const zoom =
          baseZoom + (zoomInDelta > 0 ? zoomInDelta * Math.sin(Math.PI * k) : 0)
        setViewState({
          latitude: lat,
          longitude: lon,
          zoom,
          bearing,
          pitch: basePitch,
        })
        if (t < 1) {
          rafId = requestAnimationFrame(tick)
        } else {
          // Slight dwell to never be perfectly still (can be zero)
          const pause = Math.max(0, Math.min(200, dwellMs))
          window.setTimeout(() => {
            idx += 1
            if (idx >= waypoints.length) {
              if (loop) {
                idx = 0
                animateSegments(waypoints, idx)
              } else {
                cancel()
              }
            } else {
              animateSegments(waypoints, idx)
            }
          }, pause)
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    step()
  }

  const start = () => {
    if (isRunning) return
    const waypoints = getWaypoints()
    if (!waypoints || waypoints.length === 0) return
    isRunning = true
    animateSegments(waypoints, 0)
    if (autoFollow && getVehicles && !autoFollowIntervalId) {
      const lastById = new Map<string, { pos: [number, number]; ts: number }>()
      const haversine = (a: [number, number], b: [number, number]) => {
        const toRad = (d: number) => (d * Math.PI) / 180
        const R = 6371000
        const dLat = toRad(b[1] - a[1])
        const dLon = toRad(b[0] - a[0])
        const lat1 = toRad(a[1])
        const lat2 = toRad(b[1])
        const h =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
      }
      autoFollowIntervalId = window.setInterval(() => {
        if (!isRunning || inFollow) return
        const vehicles = getVehicles() || []
        const moving: { id: string; speed: number }[] = []
        const now = performance.now()
        vehicles.forEach((v) => {
          const prev = lastById.get(v.id)
          if (prev) {
            const dt = Math.max(1, now - prev.ts) / 1000
            const dist = haversine(prev.pos, v.position)
            const speed = dist / dt
            if (speed >= minFollowSpeedMps) moving.push({ id: v.id, speed })
          }
          lastById.set(v.id, { pos: v.position, ts: now })
        })
        if (moving.length) {
          const pick = moving[Math.floor(Math.random() * moving.length)]
          const pickId = pick.id
          follow(
            () => {
              const vs = getVehicles() || []
              const m = vs.find((x) => x.id === pickId)
              return m
                ? m.position
                : [
                    getCurrentViewState().longitude,
                    getCurrentViewState().latitude,
                  ]
            },
            {
              durationMs: autoFollowDurationMs,
              zoom: followZoom ?? baseZoom + 0.6,
              pitch: followPitch ?? basePitch + 5,
            }
          )
        }
      }, Math.max(5000, autoFollowIntervalMs))
    }
  }

  const stop = () => cancel()

  const getIsRunning = () => isRunning

  const follow = (
    getPosition: () => [number, number],
    opts?: { durationMs?: number; zoom?: number | null; pitch?: number | null }
  ) => {
    if (!isRunning) return
    // Disable chase when explicit follow requested
    chaseVehicleId = null
    chaseIndex = -1
    followGetPosition = getPosition
    inFollow = true
    followEndTime = performance.now() + Math.max(1000, opts?.durationMs || 4000)
    if (opts?.zoom != null) baseZoom = opts.zoom as number
    if (opts?.pitch != null) basePitch = opts.pitch as number
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      lastFollowPos = null
      // kick into step loop which detects follow mode
      animateSegments(getWaypoints(), 0)
    })
  }

  const setChaseVehicle = (vehicleId: string | null) => {
    inFollow = false
    followGetPosition = null
    lastFollowPos = null
    chaseVehicleId = vehicleId
    lastChaseBearing = null
    if (isRunning) {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        animateSegments(getWaypoints(), 0)
      })
    }
  }

  const cycleChaseVehicle = () => {
    if (!getVehicles) return
    const list = getVehicles() || []
    if (!list.length) {
      setChaseVehicle(null)
      return
    }
    // Next index; -1 means none → first. After last → none.
    if (chaseVehicleId) {
      const currentIdx = list.findIndex((v) => v.id === chaseVehicleId)
      chaseIndex = currentIdx >= 0 ? currentIdx + 1 : 0
    } else {
      chaseIndex = 0
    }
    if (chaseIndex >= list.length) {
      setChaseVehicle(null)
    } else {
      setChaseVehicle(list[chaseIndex].id)
    }
  }

  return {
    start,
    stop,
    isRunning: getIsRunning,
    follow,
    setChaseVehicle,
    cycleChaseVehicle,
  }
}
