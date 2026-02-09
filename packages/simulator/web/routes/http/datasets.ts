import { Router } from 'express'
import { elasticsearchService } from '../../services/ElasticsearchService'
import { safeId } from '../../../lib/id'
import { handleError, successResponse } from './helpers'

const router = Router()

router.get('/datasets', async (req, res) => {
  try {
    const datasets = await elasticsearchService.listDatasets()
    res.json(successResponse(datasets))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.get('/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params
    const hit = await elasticsearchService.findDocumentById('route-datasets', datasetId)

    if (!hit) {
      return res.status(404).json(handleError(null, 'Dataset not found'))
    }

    res.json(successResponse(hit._source))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.post('/datasets', async (req, res) => {
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

router.put('/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params
    const updates = req.body

    const existingDataset = await elasticsearchService.getDataset(datasetId)

    if (!existingDataset) {
      return res.status(404).json(handleError(null, 'Dataset not found'))
    }

    const updatedDataset = {
      ...existingDataset,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.optimizationSettings !== undefined && {
        optimizationSettings: updates.optimizationSettings
      }),
    }

    await elasticsearchService.saveDataset(datasetId, updatedDataset)

    res.json(successResponse({ dataset: updatedDataset }))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.delete('/datasets/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params
    await elasticsearchService.deleteDataset(datasetId)
    res.json(successResponse({ datasetId }))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

router.get('/datasets/:datasetId/bookings', async (req, res) => {
  try {
    const { datasetId } = req.params
    const hit = await elasticsearchService.findDocumentById('route-datasets', datasetId)

    if (!hit) {
      return res.status(404).json(handleError(null, 'Dataset not found'))
    }

    res.json(successResponse(hit._source.routeData || []))
  } catch (error) {
    res.status(500).json(handleError(error))
  }
})

export default router
