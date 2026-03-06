import { Router } from 'express'
import {
  estimateOptimizationFeasibility,
  OptimizationEstimateRequest,
} from '../../../lib/optimizationEstimate'
import { handleError, successResponse } from './helpers'

const router = Router()

router.post('/optimization/estimate', async (req, res) => {
  try {
    const payload = req.body as OptimizationEstimateRequest

    if (
      !Array.isArray(payload?.fleetConfiguration) ||
      payload.fleetConfiguration.length === 0
    ) {
      return res
        .status(400)
        .json(handleError(null, 'fleetConfiguration is required'))
    }

    const result = await estimateOptimizationFeasibility(payload)
    return res.json(successResponse(result))
  } catch (error) {
    console.error('optimization/estimate error:', error)
    return res.status(500).json(handleError(error))
  }
})

export default router
