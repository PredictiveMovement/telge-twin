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
    await this.client.index({
      index: 'experiments',
      id: experimentId,
      body: experimentData,
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
            startDate: {
              order: 'desc',
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

    const vehicleCounts = new Map()
    vehicleCountResult?.body?.aggregations?.vehicles_per_experiment?.buckets?.forEach(
      (bucket: any) => {
        vehicleCounts.set(bucket.key, bucket.unique_vehicles.value)
      }
    )

    return vehicleCounts
  }
}

export const elasticsearchService = new ElasticsearchService()
