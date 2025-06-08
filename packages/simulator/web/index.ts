import 'dotenv/config'

import { env } from 'process'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import routes from './routes'
import apiRouter from './api'
import { search } from '../lib/elastic'
import { Client } from '@elastic/elasticsearch'
import { safeId } from '../lib/id'
import { elasticsearchService } from './services/ElasticsearchService'

const port = env.PORT || 4000
const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
})

const app = express()
app.use(cors())
app.use(express.json())

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
      experimentHits?.map((hit: any) => {
        const source = hit._source
        return {
          id: source.id,
          startDate: source.startDate,
          fixedRoute: source.fixedRoute,
          emitters: source.emitters,
          fleets: source.fleets,
          sourceDatasetId: source.sourceDatasetId,
          datasetName: source.datasetName,
          routeDataSource: source.routeDataSource,
          simulationStatus: source.simulationStatus,
          experimentType: source.experimentType,
          vehicleCount: vehicleCounts.get(source.id) || 0,
          documentId: hit._id,
        }
      }) || []

    res.json({ success: true, data: experiments })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.get('/api/experiments/:experimentId', async (req, res) => {
  try {
    const { experimentId } = req.params
    const searchResult = await search({
      index: 'experiments',
      body: {
        query: {
          term: { _id: experimentId },
        },
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      const hit = searchResult.body.hits.hits[0]
      const experimentData = {
        ...hit._source,
        documentId: hit._id,
      }
      res.json({ success: true, data: experimentData })
    } else {
      res.status(404).json({ success: false, error: 'Experiment not found' })
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.get('/api/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params
    const searchResult = await search({
      index: 'route-datasets',
      body: {
        query: {
          term: { _id: datasetId },
        },
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      const datasetData = searchResult.body.hits.hits[0]._source
      res.json({ success: true, data: datasetData })
    } else {
      res.status(404).json({ success: false, error: 'Dataset not found' })
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
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
    }

    await client.index({
      index: 'route-datasets',
      id: datasetId,
      body: routeDataset,
    })

    await client.indices.refresh({ index: 'route-datasets' })

    res.json({
      success: true,
      datasetId,
      dataset: routeDataset,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/datasets', async (req, res) => {
  try {
    const response = await client.search({
      index: 'route-datasets',
      body: {
        query: { match_all: {} },
        sort: [{ uploadTimestamp: { order: 'desc' } }],
        size: 100,
      },
    })

    const datasets = response.body.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }))

    res.json({ success: true, data: datasets })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
})

app.delete('/api/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params

    await client.delete({
      index: 'route-datasets',
      id: datasetId,
    })

    await client.indices.refresh({ index: 'route-datasets' })

    res.json({
      success: true,
      datasetId,
    })
  } catch (error) {
    console.error('Error deleting route dataset:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.post('/api/simulation/start-from-dataset', async (req, res) => {
  try {
    const { datasetId, datasetName, parameters = {} } = req.body

    if (!datasetId) {
      return res.status(400).json({
        success: false,
        error: 'Dataset ID is required',
      })
    }

    const defaultParameters = {
      id: null,
      startDate: new Date().toISOString(),
      fixedRoute: 100,
      emitters: ['bookings', 'cars'],
      initMapState: {
        latitude: 65.0964472642777,
        longitude: 17.112050188704504,
        zoom: 5,
      },
    }

    const simulationData = {
      sourceDatasetId: datasetId,
      datasetName: datasetName || 'Unknown Dataset',
    }

    const fullParameters = {
      ...defaultParameters,
      ...parameters,
      routeDataSource: 'elasticsearch',
    }

    res.json({
      success: true,
      data: {
        simulationData,
        parameters: fullParameters,
        message: 'Use socket startSimulation with provided data',
      },
    })
  } catch (error) {
    console.error('Error preparing simulation start:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/datasets/:datasetId/bookings', async (req, res) => {
  try {
    const { datasetId } = req.params
    const searchResult = await search({
      index: 'route-datasets',
      body: {
        query: {
          term: { _id: datasetId },
        },
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      const dataset = searchResult.body.hits.hits[0]._source
      res.json({ success: true, data: dataset.routeData || [] })
    } else {
      res.status(404).json({ success: false, error: 'Dataset not found' })
    }
  } catch (error) {
    console.error('Error fetching original bookings:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.get('/api/experiments/:experimentId/vroom-plan', async (req, res) => {
  try {
    const { experimentId } = req.params
    const searchResult = await search({
      index: 'vroom-truck-plans',
      body: {
        query: {
          term: { 'experiment.keyword': experimentId },
        },
        size: 100,
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      const truckPlans = searchResult.body.hits.hits.map(
        (hit: any) => hit._source
      )

      const consolidatedPlan = {
        code: 0,
        summary: {
          cost: 0,
          routes: truckPlans.length,
          unassigned: 0,
          delivery: [0],
          amount: [0],
          pickup: [0],
          setup: 0,
          service: 0,
          duration: 0,
          waiting_time: 0,
          priority: 0,
          violations: [],
          computing_times: {
            loading: 0,
            solving: 0,
          },
        },
        routes: truckPlans.map((plan: any) => ({
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
        })),
      }

      consolidatedPlan.routes.forEach((route: any) => {
        consolidatedPlan.summary.delivery[0] += route.delivery
        consolidatedPlan.summary.pickup[0] += route.pickup
      })

      res.json({ success: true, data: consolidatedPlan })
    } else {
      res
        .status(404)
        .json({ success: false, error: 'VROOM plan not found for experiment' })
    }
  } catch (error) {
    console.error('Error fetching VROOM plan:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.post('/api/simulation/prepare-replay', async (req, res) => {
  try {
    const { experimentId } = req.body
    const experimentResponse = await client.get({
      index: 'experiments',
      id: experimentId,
    })

    if (!experimentResponse.body._source) {
      return res
        .status(404)
        .json({ success: false, error: 'Experiment to replay not found' })
    }

    const sessionId = safeId()

    const parameters = {
      id: experimentId,
      startDate: new Date().toISOString(),
      fixedRoute: 100,
      emitters: ['bookings', 'cars'],
      initMapState: {
        latitude: 65.0964472642777,
        longitude: 17.112050188704504,
        zoom: 5,
      },
    }

    res.json({ success: true, data: { sessionId, parameters } })
  } catch (error) {
    console.error('Error preparing replay session:', error)
    res.status(500).json({ success: false, error: 'Failed to prepare replay' })
  }
})

app.post('/api/simulation/prepare-sequential', async (req, res) => {
  try {
    const { datasetId } = req.body
    const datasetResponse = await client.get({
      index: 'route-datasets',
      id: datasetId,
    })

    if (!datasetResponse.body._source) {
      return res
        .status(404)
        .json({ success: false, error: 'Dataset not found' })
    }
    const dataset = datasetResponse.body._source
    const sessionId = safeId()

    const parameters = {
      sourceDatasetId: datasetId,
      datasetName: dataset.name,
      isReplay: false,
      experimentType: 'sequential',
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

    res.json({ success: true, data: { sessionId, parameters } })
  } catch (error) {
    console.error('Error preparing sequential session:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to prepare sequential session' })
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

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

routes.register(io)
