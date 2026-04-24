import { Router } from 'express'
import { fetchRouteData, exportRouteData } from '../../services/TelgeApiService'
import { elasticsearchService } from '../../services/ElasticsearchService'
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

    const data = await fetchRouteData(from, to)
    return res.json(successResponse(data))
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : ''
    const status = raw.startsWith('VALIDATION:')
      ? 400
      : raw.startsWith('CONFIG:')
        ? 500
        : 502
    const message = raw.startsWith('UPSTREAM:') || !raw
      ? 'Kunde inte hämta ruttdata'
      : raw
    return res.status(status).json(handleError(error, message))
  }
})

router.post('/telge/export', async (req, res) => {
  try {
    const { experimentId, vehicleId } = req.body

    if (!experimentId) {
      return res
        .status(400)
        .json(handleError(null, 'Experiment-ID saknas'))
    }

    const experiment = await elasticsearchService.getExperiment(experimentId)
    if (!experiment) {
      return res.status(404).json(handleError(null, 'Experimentet hittades inte'))
    }

    const tourName = experiment.name

    const planIds = experiment.vroomTruckPlanIds || []
    if (!planIds.length) {
      return res
        .status(404)
        .json(handleError(null, 'Inga körplaner hittades för experimentet'))
    }

    const truckPlans = await elasticsearchService.getVroomPlansByIds(planIds)
    const plansToExport = vehicleId
      ? truckPlans.filter((p: any) => p.truckId === vehicleId)
      : truckPlans

    if (!plansToExport.length) {
      return res
        .status(404)
        .json(handleError(null, 'Inga matchande körplaner hittades'))
    }

    const results: { tourName: string; truckId: string; exportedRows: number }[] = []

    for (const plan of plansToExport) {
      const steps = plan.completePlan || []
      const rows: any[] = []
      let orderIndex = 0

      for (const step of steps) {
        const record = step.booking?.originalRouteRecord
        if (!record) continue

        rows.push({
          ...record,
          Turid: plansToExport.length === 1
            ? tourName
            : `${tourName} - Bil ${plan.truckId}`,
          Turordningsnr: ++orderIndex,
        })
      }

      if (!rows.length) continue

      await exportRouteData(rows)
      results.push({
        tourName: rows[0].Turid,
        truckId: plan.truckId,
        exportedRows: rows.length,
      })
    }

    if (!results.length) {
      return res
        .status(400)
        .json(handleError(null, 'Ingen exporterbar ruttdata hittades i experimentet'))
    }

    return res.json(successResponse({ tours: results }))
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : ''
    const status = raw.startsWith('VALIDATION:')
      ? 400
      : raw.startsWith('CONFIG:')
        ? 500
        : 502
    const message = raw.startsWith('UPSTREAM:') || !raw
      ? 'Kunde inte exportera ruttdata'
      : raw
    return res.status(status).json(handleError(error, message))
  }
})

export default router
