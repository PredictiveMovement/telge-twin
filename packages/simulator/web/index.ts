import 'dotenv/config'

import { env } from 'process'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import routes from './routes'
import apiRouter from './api'
import { search } from '../lib/elastic'

const port = env.PORT || 4000

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

    const fleetCounts = new Map()
    if (experimentIds.length > 0) {
      const fleetCountResult = await search({
        index: 'vroom-fleet-plans',
        body: {
          query: {
            terms: { 'experiment.keyword': experimentIds },
          },
          aggs: {
            fleets_per_experiment: {
              terms: { field: 'experiment.keyword', size: 1000 },
              aggs: {
                unique_fleets: {
                  cardinality: { field: 'fleet' },
                },
              },
            },
          },
          size: 0,
        },
      })

      fleetCountResult?.body?.aggregations?.fleets_per_experiment?.buckets?.forEach(
        (bucket: any) => {
          fleetCounts.set(bucket.key, bucket.unique_fleets.value)
        }
      )
    }

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
          fleetCount: fleetCounts.get(source.id) || 0,
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

app.get('/api/experiments/:planId/trucks', async (req, res) => {
  try {
    const { planId } = req.params
    const searchResult = await search({
      index: 'vroom-truck-plans',
      body: {
        query: {
          term: { 'planId.keyword': planId },
        },
        _source: ['planId', 'truckId', 'fleet', 'timestamp'],
        sort: [{ timestamp: { order: 'desc' } }],
      },
    })

    const truckPlans =
      searchResult?.body?.hits?.hits?.map((hit: any) => ({
        planId: hit._source.planId,
        truckId: hit._source.truckId,
        fleet: hit._source.fleet,
        timestamp: hit._source.timestamp,
        documentId: hit._id,
      })) || []

    res.json({ success: true, data: truckPlans })
  } catch (error) {
    console.error('Error fetching truck plans:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.get('/api/simulations', async (req, res) => {
  try {
    const searchResult = await search({
      index: 'vroom-fleet-plans',
      body: {
        query: {
          match_all: {},
        },
        _source: ['planId', 'fleet', 'timestamp'],
        sort: [
          {
            timestamp: {
              order: 'desc',
            },
          },
        ],
        size: 1000,
      },
    })

    const hits = searchResult?.body?.hits?.hits || []

    const simulationsMap = new Map()

    hits.forEach((hit: any) => {
      const { planId, fleet, timestamp } = hit._source

      if (!simulationsMap.has(planId)) {
        simulationsMap.set(planId, {
          planId,
          fleets: new Set(),
          latestTimestamp: timestamp,
          documentsCount: 0,
        })
      }

      const simulation = simulationsMap.get(planId)
      simulation.fleets.add(fleet)
      simulation.documentsCount += 1

      if (new Date(timestamp) > new Date(simulation.latestTimestamp)) {
        simulation.latestTimestamp = timestamp
      }
    })

    const simulations = Array.from(simulationsMap.values())
      .map((simulation) => ({
        planId: simulation.planId,
        fleetCount: simulation.fleets.size,
        fleets: Array.from(simulation.fleets),
        latestTimestamp: simulation.latestTimestamp,
        documentsCount: simulation.documentsCount,
      }))
      .sort(
        (a, b) =>
          new Date(b.latestTimestamp).getTime() -
          new Date(a.latestTimestamp).getTime()
      )

    res.json({ success: true, data: simulations })
  } catch (error) {
    console.error('Error fetching simulations:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(500).json({ success: false, error: errorMessage })
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
