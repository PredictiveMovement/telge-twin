import { Router } from 'express'
import { elasticsearchService } from '../../services/ElasticsearchService'
import { safeId } from '../../../lib/id'
import { extractOriginalData } from '../../../lib/types/originalBookingData'
import { handleError, successResponse } from './helpers'

const router = Router()

router.get('/experiments', async (req, res) => {
  try {
    const experimentHits = await elasticsearchService.getAllExperiments()

    const experiments = experimentHits?.map((hit: any) => {
      const vroomTruckPlanIds = hit._source.vroomTruckPlanIds || []
      return {
        ...hit._source,
        vehicleCount: vroomTruckPlanIds.length,
        documentId: hit._id,
      }
    }) || []

    const filtered = experiments.filter(
      (exp: any) =>
        exp.experimentType === 'vroom' || (exp.vehicleCount || 0) > 0
    )

    res.json(successResponse(filtered))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.get('/experiments/:experimentId', async (req, res) => {
  try {
    const { experimentId } = req.params
    const hit = await elasticsearchService.findDocumentById('experiments', experimentId)

    if (!hit) {
      return res.status(404).json(handleError(null, 'Experiment not found'))
    }

    res.json(successResponse({ ...hit._source, documentId: hit._id }))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.delete('/experiments/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params

    const hit = await elasticsearchService.findDocumentById('experiments', documentId)
    if (!hit) {
      return res.status(404).json(handleError(null, 'Experiment not found'))
    }

    await elasticsearchService.deleteExperiment(documentId)
    res.json(successResponse(null, 'Experiment deleted successfully'))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.get('/experiments/:experimentId/statistics', async (req, res) => {
  try {
    const { experimentId } = req.params

    const hit = await elasticsearchService.findDocumentById('experiments', experimentId)
    if (!hit) {
      return res.status(404).json(handleError(null, 'Experiment not found'))
    }

    const experiment = hit._source as any
    if (experiment.experimentType !== 'vroom') {
      return res
        .status(400)
        .json(
          handleError(
            null,
            'Statistics are only available for VROOM optimisation experiments'
          )
        )
    }

    const vroomTruckPlanIds = experiment.vroomTruckPlanIds || []

    const [planStats, baselineStats] = await Promise.all([
      elasticsearchService.getStatisticsForPlans(vroomTruckPlanIds),
      elasticsearchService.getBaselineStatisticsForExperiment(experimentId),
    ])

    const clusterCount = Array.isArray(experiment.areaPartitions)
      ? experiment.areaPartitions.length
      : 0

    return res.json(
      successResponse({
        experimentId,
        totalDistanceKm: planStats.totalDistanceKm,
        totalCo2Kg: planStats.totalCo2Kg,
        vehicleCount: vroomTruckPlanIds.length,
        bookingCount: planStats.bookingCount,
        clusterCount,
        baseline: baselineStats
          ? {
              totalDistanceKm: baselineStats.totalDistanceKm,
              totalCo2Kg: baselineStats.totalCo2Kg,
              bookingCount: baselineStats.bookingCount,
            }
          : null,
      })
    )
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.get('/experiments/:experimentId/vroom-plan', async (req, res) => {
  try {
    const { experimentId } = req.params

    const experiment = await elasticsearchService.getExperiment(experimentId)
    const vroomTruckPlanIds = experiment?.vroomTruckPlanIds || []

    const truckPlans = await elasticsearchService.getVroomPlansByIds(vroomTruckPlanIds)
    if (!truckPlans?.length) {
      return res
        .status(404)
        .json(handleError(null, 'VROOM plan not found for experiment'))
    }

    const routes = truckPlans.map((plan: any) => ({
      vehicle: plan.truckId,
      fleet: plan.fleet,
      steps: plan.completePlan || [],
      cost: 0,
      setup: 0,
      service: 0,
      duration: 0,
      waiting_time: 0,
      priority: 0,
      delivery: plan.bookingMetadata?.length || 0,
      pickup: plan.bookingMetadata?.length || 0,
      violations: [],
    }))

    const consolidatedPlan = {
      code: 0,
      summary: {
        cost: 0,
        routes: routes.length,
        unassigned: 0,
        delivery: [routes.reduce((sum: number, r: any) => sum + r.delivery, 0)],
        amount: [0],
        pickup: [routes.reduce((sum: number, r: any) => sum + r.pickup, 0)],
        setup: 0,
        service: 0,
        duration: 0,
        waiting_time: 0,
        priority: 0,
        violations: [],
        computing_times: { loading: 0, solving: 0 },
      },
      routes,
    }

    res.json(successResponse(consolidatedPlan))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

const extractVroomBookingData = (
  instruction: any,
  plan: any,
  stepIndex: number
) => {
  const booking = instruction.booking
  const originalData = booking.originalData || extractOriginalData(booking)

  const turid =
    originalData.originalTurid || originalData.originalRouteRecord?.Turid
  const kundnr =
    originalData.originalKundnr || originalData.originalRouteRecord?.Kundnr || 0
  const hsnr =
    originalData.originalHsnr || originalData.originalRouteRecord?.Hsnr || 0
  const tjnr =
    originalData.originalTjnr || originalData.originalRouteRecord?.Tjnr || 0

  return {
    id: `${turid}-${kundnr}-${hsnr}-${tjnr}`,
    turid,
    ordning: stepIndex + 1,
    arrayIndex: stepIndex + 1,
    recyclingType: booking.recyclingType,
    position: booking.pickup
      ? [booking.pickup.lon || booking.pickup.lng, booking.pickup.lat]
      : [],
    truckId: plan.truckId,
    vehicleId:
      originalData.originalBil || originalData.originalRouteRecord?.Bil,
    serviceType:
      originalData.originalTjtyp || originalData.originalRouteRecord?.Tjtyp,
    datum:
      originalData.originalDatum || originalData.originalRouteRecord?.Datum,
  }
}

router.get(
  '/experiments/:experimentId/original-bookings',
  async (req, res) => {
    try {
      const { experimentId } = req.params
      const { routeData } = await elasticsearchService.getExperimentWithDataset(experimentId)

      const originalBookings = routeData.map((route: any, index: number) => ({
        id: `${route.Turid}-${route.Kundnr}-${route.Hsnr}-${route.Tjnr}`,
        turid: route.Turid,
        ordning: route.Turordningsnr,
        arrayIndex: index + 1,
        originalOrderNumber: route.Turordningsnr,
        recyclingType: route.Avftyp,
        position: [route.Lng, route.Lat],
        vehicleId: route.Bil,
        serviceType: route.Tjtyp,
        datum: route.Datum,
      }))

      res.json(successResponse(originalBookings))
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes('not found')
          ? 404
          : 500
      res.status(status).json(handleError(error))
    }
  }
)

router.get('/experiments/:experimentId/vroom-bookings', async (req, res) => {
  try {
    const { experimentId } = req.params

    const experiment = await elasticsearchService.getExperiment(experimentId)
    const vroomTruckPlanIds = experiment?.vroomTruckPlanIds || []

    const truckPlans = await elasticsearchService.getVroomPlansByIds(vroomTruckPlanIds)
    if (!truckPlans?.length) {
      return res.json(successResponse([]))
    }

    const vroomBookings: any[] = []

    truckPlans.forEach((plan: any) => {
      if (plan.completePlan?.length) {
        plan.completePlan.forEach((instruction: any, stepIndex: number) => {
          if (instruction.action === 'pickup' && instruction.booking) {
            vroomBookings.push(
              extractVroomBookingData(instruction, plan, stepIndex)
            )
          }
        })
      }
    })

    res.json(successResponse(vroomBookings))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.post('/experiments/:experimentId/copy', async (req, res) => {
  try {
    const { experimentId } = req.params
    const { name, description, optimizationSettings } = req.body

    const sourceExperiment = await elasticsearchService.getExperiment(experimentId)
    if (!sourceExperiment) {
      return res.status(404).json(handleError(null, 'Source experiment not found'))
    }

    const vroomTruckPlanIds = sourceExperiment.vroomTruckPlanIds || []
    const newExperimentId = safeId()

    const workingHours = optimizationSettings?.workingHours ||
                         sourceExperiment.optimizationSettings?.workingHours
    const workdayStart = workingHours?.start || sourceExperiment.workdayStart || '06:00'

    const newExperiment = {
      id: newExperimentId,
      createdAt: new Date().toISOString(),
      startDate: sourceExperiment.startDate,
      workdayStart: workdayStart,
      fixedRoute: sourceExperiment.fixedRoute,
      emitters: sourceExperiment.emitters,
      sourceDatasetId: sourceExperiment.sourceDatasetId,
      datasetName: sourceExperiment.datasetName,
      routeDataSource: sourceExperiment.routeDataSource,
      simulationStatus: 'completed',
      experimentType: sourceExperiment.experimentType,
      initMapState: sourceExperiment.initMapState,
      baselineStatistics: sourceExperiment.baselineStatistics,
      fleets: sourceExperiment.fleets,
      vroomTruckPlanIds: vroomTruckPlanIds,
      name: name || sourceExperiment.name || sourceExperiment.datasetName,
      description: description || sourceExperiment.description || null,
      optimizationSettings: optimizationSettings || sourceExperiment.optimizationSettings,
    }

    await elasticsearchService.saveExperiment(newExperimentId, newExperiment)

    res.json(successResponse({
      experimentId: newExperimentId,
      experiment: newExperiment,
    }))
  } catch (error) {
    res.status(500).json(handleError(error, 'Failed to create experiment'))
  }
})

router.put(
  '/experiments/:experimentId/trucks/:truckId/route-order',
  async (req, res) => {
    try {
      const { experimentId, truckId } = req.params
      const { completePlan } = req.body

      if (!completePlan || !Array.isArray(completePlan)) {
        return res
          .status(400)
          .json(handleError(null, 'completePlan array is required'))
      }

      const sourceExperiment = await elasticsearchService.getExperiment(experimentId)
      if (!sourceExperiment) {
        return res.status(404).json(handleError(null, 'Experiment not found'))
      }

      const sourcePlanIds = sourceExperiment.vroomTruckPlanIds || []
      if (!sourcePlanIds.length) {
        return res.status(404).json(handleError(null, 'No truck plans found for experiment'))
      }

      const newExperimentId = safeId()

      const newPlanIds = await elasticsearchService.copyTruckPlansToExperiment(
        sourcePlanIds,
        newExperimentId
      )

      const newPlans = await elasticsearchService.getVroomPlansByIds(newPlanIds)
      const truckPlan = newPlans.find((p: any) => p.truckId === truckId)
      if (!truckPlan) {
        return res.status(404).json(handleError(null, 'Truck plan not found'))
      }

      await elasticsearchService.updateTruckPlan(truckPlan._id, completePlan)

      const newExperiment = {
        ...sourceExperiment,
        id: newExperimentId,
        createdAt: new Date().toISOString(),
        vroomTruckPlanIds: newPlanIds,
      }

      await elasticsearchService.saveExperiment(newExperimentId, newExperiment)

      res.json(successResponse({
        success: true,
        experimentId: newExperimentId,
        experiment: newExperiment,
      }))
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes('not found')
          ? 404
          : 500
      res.status(status).json(handleError(error))
    }
  }
)

export default router
