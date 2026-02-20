import { Router } from 'express'
import osrm from '../../../lib/osrm'
import { handleError, successResponse } from './helpers'

const router = Router()

const SERVICE_TIME_PER_STOP_SECONDS = 60

router.post('/routing/estimate', async (req, res) => {
  try {
    const { vehicles } = req.body

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return res
        .status(400)
        .json(handleError(null, 'vehicles array is required'))
    }

    const estimates = await Promise.all(
      vehicles.map(
        async (vehicle: {
          vehicleId: string
          coordinates: [number, number][]
        }) => {
          const { vehicleId, coordinates } = vehicle

          if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return {
              vehicleId,
              durationSeconds: 0,
              distanceMeters: 0,
              stopCount: 0,
            }
          }

          // Stops = all coordinates minus depot at start and end
          const stopCount = Math.max(0, coordinates.length - 2)

          const result = await osrm.routeMultiWaypoint(coordinates)

          // Add service time per stop (60s, matching VROOM)
          const totalDuration =
            result.duration + stopCount * SERVICE_TIME_PER_STOP_SECONDS

          return {
            vehicleId,
            durationSeconds: Math.round(totalDuration),
            distanceMeters: Math.round(result.distance),
            stopCount,
          }
        }
      )
    )

    res.json(successResponse({ estimates }))
  } catch (error) {
    console.error('routing/estimate error:', error)
    res.status(500).json(handleError(error))
  }
})

export default router
