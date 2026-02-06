import { Client } from '@elastic/elasticsearch'
import { search } from '../../lib/elastic'
import {
  calculateBaselineStatistics,
  BaselineStatistics,
} from '../../lib/dispatch/truckDispatch'

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
      refresh: 'wait_for',
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

  /**
   * Get vehicle counts for experiments based on their vroomTruckPlanIds arrays.
   * Returns a Map of experimentId → vehicle count.
   */
  async getVehicleCountsForExperiments(
    experiments: Array<{ id: string; vroomTruckPlanIds?: string[] }>
  ): Promise<Map<string, number>> {
    const vehicleCounts = new Map<string, number>()

    for (const exp of experiments) {
      const planIds = exp.vroomTruckPlanIds || []
      vehicleCounts.set(exp.id, planIds.length)
    }

    return vehicleCounts
  }

  async deleteExperiment(documentId: string) {
    // First get the experiment to find its vroomTruckPlanIds for cleaning up related data
    const experimentResponse = await this.client.get({
      index: 'experiments',
      id: documentId,
    })

    const vroomTruckPlanIds =
      experimentResponse.body._source?.vroomTruckPlanIds || []

    // Delete the experiment document
    await this.client.delete({
      index: 'experiments',
      id: documentId,
    })

    // Clean up related truck-plans
    // Only delete plans that are not referenced by other experiments
    if (vroomTruckPlanIds.length > 0) {
      // Find which planIds are still referenced by other experiments
      const otherExperiments = await search({
        index: 'experiments',
        body: {
          query: {
            terms: { vroomTruckPlanIds: vroomTruckPlanIds },
          },
          _source: ['vroomTruckPlanIds'],
          size: 100,
        },
      })

      const stillReferencedIds = new Set<string>()
      otherExperiments?.body?.hits?.hits?.forEach((hit: any) => {
        ;(hit._source.vroomTruckPlanIds || []).forEach((id: string) =>
          stillReferencedIds.add(id)
        )
      })

      // Delete plans that are no longer referenced
      const toDelete = vroomTruckPlanIds.filter(
        (id: string) => !stillReferencedIds.has(id)
      )

      if (toDelete.length > 0) {
        await this.client.deleteByQuery({
          index: 'truck-plans',
          body: {
            query: {
              terms: { _id: toDelete },
            },
          },
        })
      }
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

  /**
   * Get vroom truck plans by their IDs.
   */
  async getVroomPlansByIds(planIds: string[]) {
    if (!planIds.length) return []

    const searchResult = await search({
      index: 'truck-plans',
      body: {
        query: { terms: { _id: planIds } },
        size: planIds.length,
      },
    })
    return (
      searchResult?.body?.hits?.hits?.map((hit: any) => ({
        ...hit._source,
        _id: hit._id,
      })) || []
    )
  }

  /**
   * Copy truck plans to a new experiment and return the new plan IDs.
   * Used when a copied experiment needs its own plans (e.g., when modifying route order).
   */
  async copyTruckPlansToExperiment(
    planIds: string[],
    newExperimentId: string
  ): Promise<string[]> {
    const sourcePlans = await this.getVroomPlansByIds(planIds)

    if (!sourcePlans.length) {
      throw new Error('No truck plans found to copy')
    }

    const newPlanIds: string[] = []
    const operations: any[] = []

    for (const plan of sourcePlans) {
      // Deterministic planId: newExperimentId-truckId
      const newPlanId = `${newExperimentId}-${plan.truckId}`
      newPlanIds.push(newPlanId)

      // Remove _id from source plan and set new planId/experimentId
      const { _id, ...planData } = plan
      operations.push(
        { index: { _index: 'truck-plans', _id: newPlanId } },
        {
          ...planData,
          planId: newPlanId,
          experimentId: newExperimentId,
        }
      )
    }

    await this.client.bulk({ body: operations, refresh: 'wait_for' })

    return newPlanIds
  }

  /**
   * Add a planId to an experiment's vroomTruckPlanIds array.
   * Called when a truck plan is saved during simulation.
   */
  async addPlanIdToExperiment(
    experimentId: string,
    planId: string
  ): Promise<void> {
    try {
      await this.client.update({
        index: 'experiments',
        id: experimentId,
        body: {
          script: {
            source: `
              if (ctx._source.vroomTruckPlanIds == null) {
                ctx._source.vroomTruckPlanIds = [params.planId];
              } else if (!ctx._source.vroomTruckPlanIds.contains(params.planId)) {
                ctx._source.vroomTruckPlanIds.add(params.planId);
              }
            `,
            params: { planId },
          },
        },
        retry_on_conflict: 3,
        refresh: 'wait_for',
      })
    } catch (err: any) {
      // Check if experiment was deleted (e.g., cancelled by user)
      if (err?.meta?.body?.error?.type === 'document_missing_exception') {
        console.info(
          `Experiment ${experimentId} was deleted (optimization cancelled) - skipping planId update`
        )
        return
      }
      // Experiment might not exist yet - that's OK
      console.warn(
        `Could not add planId ${planId} to experiment ${experimentId}:`,
        err
      )
    }
  }

  /**
   * Update the route order for a specific truck plan by its ID.
   * Updates the completePlan array with the new order of stops.
   */
  async updateTruckPlan(planId: string, completePlan: any[]) {
    await this.client.update({
      index: 'truck-plans',
      id: planId,
      body: {
        doc: {
          completePlan,
          updatedAt: new Date().toISOString(),
        },
      },
    })

    await this.client.indices.refresh({ index: 'truck-plans' })

    return { success: true }
  }

  /**
   * Aggregated statistics for vroom truck plans by their IDs.
   * Sums up totalDistanceKm, totalCo2Kg, and bookingCount from all plans.
   */
  async getStatisticsForPlans(planIds: string[]) {
    if (!planIds.length) {
      return {
        totalDistanceKm: 0,
        totalCo2Kg: 0,
        bookingCount: 0,
      }
    }

    const result = await search({
      index: 'truck-plans',
      body: {
        size: 0,
        query: {
          terms: { _id: planIds },
        },
        aggs: {
          total_distance: { sum: { field: 'totalDistanceKm' } },
          total_co2: { sum: { field: 'totalCo2Kg' } },
          total_bookings: { sum: { field: 'bookingCount' } },
        },
      },
    })

    const aggs = result?.body?.aggregations || {}
    return {
      totalDistanceKm: aggs.total_distance?.value || 0,
      totalCo2Kg: aggs.total_co2?.value || 0,
      bookingCount: aggs.total_bookings?.value || 0,
    }
  }

  /**
   * Get baseline statistics for an experiment.
   * First checks if baseline is stored on the experiment, then falls back to on-demand calculation.
   */
  async getBaselineStatisticsForExperiment(
    experimentId: string
  ): Promise<BaselineStatistics | null> {
    try {
      // 1. Check if baseline is stored on the experiment
      const experiment = await this.getExperiment(experimentId)
      if (experiment?.baselineStatistics) {
        return experiment.baselineStatistics as BaselineStatistics
      }

      // 2. Fallback: calculate on-demand (for older experiments)
      const { dataset } = await this.getExperimentWithDataset(experimentId)

      if (!dataset?.routeData || !Array.isArray(dataset.routeData)) {
        return null
      }

      return calculateBaselineStatistics(dataset.routeData)
    } catch {
      return null
    }
  }
}

export const elasticsearchService = new ElasticsearchService()
