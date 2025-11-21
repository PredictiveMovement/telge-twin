import { Client } from '@elastic/elasticsearch'
import { search } from '../../lib/elastic'

export class ElasticsearchService {
  private client: Client

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    })
  }

  async getExperiment(experimentId: string) {
    const response = await this.client.get({
      index: 'experiments',
      id: experimentId,
    })
    return response.body._source
  }

  async getDataset(datasetId: string) {
    const response = await this.client.get({
      index: 'route-datasets',
      id: datasetId,
    })
    return response.body._source
  }

  async saveExperiment(experimentId: string, experimentData: any) {
    const experimentBody = {
      createdAt: experimentData?.createdAt || new Date().toISOString(),
      ...experimentData,
    }

    await this.client.index({
      index: 'experiments',
      id: experimentId,
      body: experimentBody,
    })
  }

  async getAllExperiments() {
    const searchResult = await search({
      index: 'experiments',
      body: {
        query: {
          match_all: {},
        },
        sort: [
          {
            createdAt: {
              order: 'desc',
              missing: '_last',
            },
          },
          {
            startDate: {
              order: 'desc',
              missing: '_last',
            },
          },
          {
            id: {
              order: 'desc',
              missing: '_last',
            },
          },
        ],
        size: 100,
      },
    })

    return searchResult?.body?.hits?.hits || []
  }

  async getVehicleCounts(experimentIds: string[]) {
    if (experimentIds.length === 0) return new Map()

    const vehicleCountResult = await search({
      index: 'vroom-truck-plans',
      body: {
        query: {
          terms: { experiment: experimentIds },
        },
        aggs: {
          vehicles_per_experiment: {
            terms: { field: 'experiment', size: 1000 },
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

    const vehicleCounts = new Map()
    vehicleCountResult?.body?.aggregations?.vehicles_per_experiment?.buckets?.forEach(
      (bucket: any) => {
        vehicleCounts.set(bucket.key, bucket.unique_vehicles.value)
      }
    )

    return vehicleCounts
  }

  async deleteExperiment(documentId: string) {
    // First get the experiment to find its ID for cleaning up related data
    const experimentResponse = await this.client.get({
      index: 'experiments',
      id: documentId,
    })

    const experimentId = experimentResponse.body._source?.id

    // Delete the experiment document
    await this.client.delete({
      index: 'experiments',
      id: documentId,
    })

    // Clean up related vroom-truck-plans if experimentId exists
    if (experimentId) {
      await this.client.deleteByQuery({
        index: 'vroom-truck-plans',
        body: {
          query: {
            term: { experiment: experimentId },
          },
        },
      })
    }

    return { success: true }
  }

  async saveDataset(datasetId: string, datasetBody: any) {
    await this.client.index({
      index: 'route-datasets',
      id: datasetId,
      body: datasetBody,
    })
    await this.client.indices.refresh({ index: 'route-datasets' })
    return { success: true }
  }

  async deleteDataset(datasetId: string) {
    await this.client.delete({ index: 'route-datasets', id: datasetId })
    await this.client.indices.refresh({ index: 'route-datasets' })
    return { success: true }
  }

  async listDatasets() {
    const response = await this.client.search({
      index: 'route-datasets',
      body: {
        query: { match_all: {} },
        sort: [{ uploadTimestamp: { order: 'desc' } }],
        size: 100,
      },
    })
    return response.body.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }))
  }

  async findDocumentById(index: string, id: string) {
    const result = await search({
      index,
      body: { query: { term: { _id: id } } },
    })
    return result?.body?.hits?.hits?.[0]
  }

  async getExperimentWithDataset(experimentId: string) {
    const experiment = await this.getExperiment(experimentId)
    if (!experiment) throw new Error('Experiment not found')
    const datasetId = experiment.sourceDatasetId
    if (!datasetId) throw new Error('No source dataset found for experiment')
    const dataset = await this.getDataset(datasetId)
    if (!dataset) throw new Error('Dataset not found')
    return {
      experiment,
      dataset,
      routeData: dataset.routeData || [],
    }
  }

  async getVroomPlansForExperiment(experimentId: string) {
    const searchResult = await search({
      index: 'vroom-truck-plans',
      body: {
        query: { term: { experiment: experimentId } },
        size: 100,
      },
    })
    return searchResult?.body?.hits?.hits?.map((hit: any) => hit._source) || []
  }
}

export const elasticsearchService = new ElasticsearchService()
