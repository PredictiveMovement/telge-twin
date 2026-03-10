import { Router } from 'express'
import {
  estimateOptimizationFeasibility,
  OptimizationEstimateRequest,
} from '../../../lib/optimizationEstimate'
import { error as logError } from '../../../lib/log'
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
        .json(handleError('fleetConfiguration is required'))
    }

    const result = await estimateOptimizationFeasibility(payload)
    return res.json(successResponse(result))
  } catch (err) {
    logError('optimization/estimate error:', err)
    return res.status(500).json(handleError(err))
  }
})

export default router
