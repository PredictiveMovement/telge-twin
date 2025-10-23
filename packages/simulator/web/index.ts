import 'dotenv/config'

import { env } from 'process'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import routes from './routes'
import apiRouter from './api'
import { elasticsearchService } from './services/ElasticsearchService'
import { fetchTelgeRouteData } from './services/TelgeApiService'
import { safeId } from '../lib/id'
import { extractOriginalData } from '../lib/types/originalBookingData'

// Constants and configuration
const PORT = env.PORT || 4000
const BODY_LIMIT = '50mb'

// Common error handler
const handleError = (
  error: unknown,
  defaultMessage = 'Unknown error occurred'
) => ({
  success: false,
  error: error instanceof Error ? error.message : defaultMessage,
})

// Common success response
const successResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
})

// Common function to find document by ID
const findDocumentById = async (index: string, id: string) =>
  elasticsearchService.findDocumentById(index, id)

// Default simulation parameters
const DEFAULT_SIM_PARAMS = {
  startDate: () => new Date().toISOString(),
  fixedRoute: 100,
  emitters: ['bookings', 'cars'],
  initMapState: {
    latitude: 65.0964472642777,
    longitude: 17.112050188704504,
    zoom: 5,
  },
}

// Helper function to get experiment and its dataset
const getExperimentWithDataset = async (experimentId: string) =>
  elasticsearchService.getExperimentWithDataset(experimentId)

// Helper function to extract booking data from VROOM instruction
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

const app = express()
app.use(cors())
app.use(express.json({ limit: BODY_LIMIT }))
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }))

app.use('/api', apiRouter)

app.get('/', (_req, res) => {
  res.status(200).send('PM Digital Twin Engine. Status: OK')
})

app.get('/api/experiments', async (req, res) => {
  try {
    const experimentHits = await elasticsearchService.getAllExperiments()
    const experimentIds = experimentHits
      .map((hit: any) => hit._source.id)
      .filter(Boolean)

    const vehicleCounts = await elasticsearchService.getVehicleCounts(
      experimentIds
    )

    const experiments =
      experimentHits?.map((hit: any) => ({
        ...hit._source,
        vehicleCount: vehicleCounts.get(hit._source.id) || 0,
        documentId: hit._id,
      })) || []

    // Only include optimized (VROOM) experiments in the list.
    // Heuristic: keep experiments explicitly marked as 'vroom' OR those that have VROOM truck plans (vehicleCount > 0)
    const filtered = experiments.filter(
      (exp: any) =>
        exp.experimentType === 'vroom' || (exp.vehicleCount || 0) > 0
    )

    res.json(successResponse(filtered))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.get('/api/telge/routedata', async (req, res) => {
  try {
    const date = String(req.query.date || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json(handleError(null, 'Invalid or missing date (YYYY-MM-DD)'))
    }

    const data = await fetchTelgeRouteData(date)
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

app.get('/api/experiments/:experimentId', async (req, res) => {
  try {
    const { experimentId } = req.params
    const hit = await findDocumentById('experiments', experimentId)

    if (!hit) {
      return res.status(404).json(handleError(null, 'Experiment not found'))
    }

    res.json(successResponse({ ...hit._source, documentId: hit._id }))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.delete('/api/experiments/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params

    // Check if experiment exists first
    const hit = await findDocumentById('experiments', documentId)
    if (!hit) {
      return res.status(404).json(handleError(null, 'Experiment not found'))
    }

    await elasticsearchService.deleteExperiment(documentId)
    res.json(successResponse(null, 'Experiment deleted successfully'))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.get('/api/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params
    const hit = await findDocumentById('route-datasets', datasetId)

    if (!hit) {
      return res.status(404).json(handleError(null, 'Dataset not found'))
    }

    res.json(successResponse(hit._source))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.post('/api/datasets', async (req, res) => {
  try {
    const datasetData = req.body
    const datasetId = safeId()

    const routeDataset = {
      datasetId,
      name: datasetData.name,
      description: datasetData.description || '',
      uploadTimestamp: new Date().toISOString(),
      originalFilename: datasetData.originalFilename,
      filterCriteria: datasetData.filterCriteria,
      recordCount: datasetData.routeData.length,
      originalRecordCount: datasetData.originalRecordCount,
      routeData: datasetData.routeData,
      status: 'ready',
      associatedExperiments: [],
      fleetConfiguration: datasetData.fleetConfiguration || null,
      originalSettings: datasetData.originalSettings || null,
      optimizationSettings: datasetData.optimizationSettings || null,
    }

    await elasticsearchService.saveDataset(datasetId, routeDataset)

    res.json(successResponse({ datasetId, dataset: routeDataset }))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.get('/api/datasets', async (req, res) => {
  try {
    const datasets = await elasticsearchService.listDatasets()

    res.json(successResponse(datasets))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.delete('/api/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params

    await elasticsearchService.deleteDataset(datasetId)

    res.json(successResponse({ datasetId }))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.post('/api/simulation/start-from-dataset', async (req, res) => {
  try {
    const { datasetId, datasetName, parameters = {} } = req.body

    if (!datasetId) {
      return res.status(400).json(handleError(null, 'Dataset ID is required'))
    }

    const simulationData = {
      sourceDatasetId: datasetId,
      datasetName: datasetName || 'Unknown Dataset',
    }

    const fullParameters = {
      id: null,
      startDate: DEFAULT_SIM_PARAMS.startDate(),
      fixedRoute: DEFAULT_SIM_PARAMS.fixedRoute,
      emitters: DEFAULT_SIM_PARAMS.emitters,
      initMapState: DEFAULT_SIM_PARAMS.initMapState,
      ...parameters,
      routeDataSource: 'elasticsearch',
    }

    res.json(
      successResponse({
        simulationData,
        parameters: fullParameters,
        message: 'Use socket startSimulation with provided data',
      })
    )
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.get('/api/datasets/:datasetId/bookings', async (req, res) => {
  try {
    const { datasetId } = req.params
    const hit = await findDocumentById('route-datasets', datasetId)

    if (!hit) {
      return res.status(404).json(handleError(null, 'Dataset not found'))
    }

    res.json(successResponse(hit._source.routeData || []))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

app.get('/api/experiments/:experimentId/vroom-plan', async (req, res) => {
  try {
    const { experimentId } = req.params
    const truckPlans = await elasticsearchService.getVroomPlansForExperiment(
      experimentId
    )
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

app.get(
  '/api/experiments/:experimentId/original-bookings',
  async (req, res) => {
    try {
      const { experimentId } = req.params
      const { routeData } = await getExperimentWithDataset(experimentId)

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

app.get('/api/experiments/:experimentId/vroom-bookings', async (req, res) => {
  try {
    const { experimentId } = req.params
    const truckPlans = await elasticsearchService.getVroomPlansForExperiment(
      experimentId
    )
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

app.post('/api/simulation/prepare-replay', async (req, res) => {
  try {
    const { experimentId } = req.body
    const experimentResponse = await elasticsearchService.getExperiment(
      experimentId
    )

    if (!experimentResponse) {
      return res
        .status(404)
        .json(handleError(null, 'Experiment to replay not found'))
    }

    const sessionId = safeId()
    const parameters = {
      id: experimentId,
      startDate: DEFAULT_SIM_PARAMS.startDate(),
      fixedRoute: DEFAULT_SIM_PARAMS.fixedRoute,
      emitters: DEFAULT_SIM_PARAMS.emitters,
      initMapState: DEFAULT_SIM_PARAMS.initMapState,
    }

    res.json(successResponse({ sessionId, parameters }))
  } catch (error) {
    res.status(500).json(handleError(error, 'Failed to prepare replay'))
  }
})

app.post('/api/simulation/prepare-sequential', async (req, res) => {
  try {
    const { datasetId } = req.body
    const datasetResponse = await elasticsearchService.getDataset(datasetId)

    if (!datasetResponse) {
      return res.status(404).json(handleError(null, 'Dataset not found'))
    }

    const dataset = datasetResponse
    const sessionId = safeId()
    const parameters = {
      sourceDatasetId: datasetId,
      datasetName: dataset.name,
      isReplay: false,
      experimentType: 'sequential',
      optimizationSettings: dataset.optimizationSettings,
      fleets: {
        'Södertälje kommun': {
          settings: {
            ...dataset.originalSettings,
            experimentType: 'sequential',
          },
          fleets: dataset.fleetConfiguration || [],
        },
      },
    }

    res.json(successResponse({ sessionId, parameters }))
  } catch (error) {
    res
      .status(500)
      .json(handleError(error, 'Failed to prepare sequential session'))
  }
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
  },
})

server.listen(PORT, () => {
  // Server started
})

routes.register(io)
