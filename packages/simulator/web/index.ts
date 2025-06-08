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
    const searchResult = await search({
      index: 'experiments',
      body: {
        query: {
          match_all: {},
        },
        sort: [
          {
            startDate: {
              order: 'desc',
            },
          },
        ],
        size: 100,
      },
    })

    const experimentIds =
      searchResult?.body?.hits?.hits
        ?.map((hit: any) => hit._source.id)
        .filter(Boolean) || []

    const vehicleCounts = new Map()
    if (experimentIds.length > 0) {
      const vehicleCountResult = await search({
        index: 'vroom-truck-plans',
        body: {
          query: {
            terms: { 'experiment.keyword': experimentIds },
          },
          aggs: {
            vehicles_per_experiment: {
              terms: { field: 'experiment.keyword', size: 1000 },
              aggs: {
                unique_vehicles: {
                  cardinality: { field: 'truckId' },
                },
              },
            },
          },
          size: 0,
        },
      })

      vehicleCountResult?.body?.aggregations?.vehicles_per_experiment?.buckets?.forEach(
        (bucket: any) => {
          vehicleCounts.set(bucket.key, bucket.unique_vehicles.value)
        }
      )
    }

    const experiments =
      searchResult?.body?.hits?.hits?.map((hit: any) => {
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
    console.error('Error fetching experiments:', error)
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
          term: { 'id.keyword': experimentId },
        },
      },
    })

    if (searchResult?.body?.hits?.hits?.length > 0) {
      const experimentData = searchResult.body.hits.hits[0]._source
      res.json({ success: true, data: experimentData })
    } else {
      res.status(404).json({ success: false, error: 'Experiment not found' })
    }
  } catch (error) {
    console.error('Error fetching experiment by ID:', error)
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
    console.error('Error fetching dataset by ID:', error)
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
    console.error('Error saving route dataset:', error)
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
    console.error('Error fetching route datasets:', error)
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

app.post('/api/simulation/prepare-replay', async (req, res) => {
  try {
    const { experimentId } = req.body

    if (!experimentId) {
      return res.status(400).json({
        success: false,
        error: 'Experiment ID is required',
      })
    }

    const experimentResult = await search({
      index: 'experiments',
      body: {
        query: {
          term: { 'id.keyword': experimentId },
        },
      },
    })

    if (!experimentResult?.body?.hits?.hits?.length) {
      return res.status(404).json({
        success: false,
        error: `Experiment ${experimentId} not found`,
      })
    }

    const experimentData = experimentResult.body.hits.hits[0]._source
    const sourceDatasetId = experimentData.sourceDatasetId

    if (!sourceDatasetId) {
      return res.status(400).json({
        success: false,
        error: `No sourceDatasetId found for experiment ${experimentId}`,
      })
    }

    const datasetResult = await search({
      index: 'route-datasets',
      body: {
        query: {
          term: { _id: sourceDatasetId },
        },
      },
    })

    if (!datasetResult?.body?.hits?.hits?.length) {
      return res.status(404).json({
        success: false,
        error: `Dataset ${sourceDatasetId} not found`,
      })
    }

    const dataset = datasetResult.body.hits.hits[0]._source
    const datasetFleetConfig = dataset.fleetConfiguration || []

    const { createFleetConfigFromDataset } = require('../lib/fleet-utils')
    const fleetConfig = createFleetConfigFromDataset(
      datasetFleetConfig,
      experimentId
    )

    const replayParameters = {
      ...experimentData,
      id: `replay_${experimentId}_${Date.now()}`,
      isReplay: true,
      fleets: fleetConfig,
    }

    res.json({
      success: true,
      data: {
        experimentId,
        sessionId: `session_${Date.now()}`,
        parameters: replayParameters,
      },
    })
  } catch (error) {
    console.error('Error preparing replay:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
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
