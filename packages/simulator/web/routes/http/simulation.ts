import { Router } from 'express'
import { elasticsearchService } from '../../services/ElasticsearchService'
import { safeId } from '../../../lib/id'
import { handleError, successResponse, DEFAULT_SIM_PARAMS } from './helpers'

const router = Router()

router.post('/simulation/start-from-dataset', async (req, res) => {
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

router.post('/simulation/prepare-replay', async (req, res) => {
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

router.post('/simulation/prepare-sequential', async (req, res) => {
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
      experimentType: 'sequential',
      optimizationSettings: dataset.optimizationSettings,
    }

    res.json(successResponse({ sessionId, parameters }))
  } catch (error) {
    res
      .status(500)
      .json(handleError(error, 'Failed to prepare sequential session'))
  }
})

export default router
