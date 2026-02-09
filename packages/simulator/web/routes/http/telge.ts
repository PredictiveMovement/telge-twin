import { Router } from 'express'
import { fetchTelgeRouteData } from '../../services/TelgeApiService'
import { handleError, successResponse } from './helpers'

const router = Router()

router.get('/telge/routedata', async (req, res) => {
  try {
    const from = String(req.query.from || req.query.date || '')
    const to = String(req.query.to || req.query.date || from)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res
        .status(400)
        .json(handleError(null, 'Invalid or missing from date (YYYY-MM-DD)'))
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res
        .status(400)
        .json(handleError(null, 'Invalid or missing to date (YYYY-MM-DD)'))
    }

    const data = await fetchTelgeRouteData(from, to)
    return res.json(successResponse(data))
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed fetching Telge route data'
    const status =
      message.startsWith('VALIDATION:')
        ? 400
        : message.startsWith('CONFIG:')
          ? 500
          : 502
    return res.status(status).json(handleError(error, message))
  }
})

export default router
