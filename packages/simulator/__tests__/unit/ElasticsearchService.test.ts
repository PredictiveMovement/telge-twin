import { ElasticsearchService } from '../../web/services/ElasticsearchService'

// Mock the Elasticsearch client
jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    index: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteByQuery: jest.fn(),
    bulk: jest.fn(),
    search: jest.fn(),
    indices: {
      refresh: jest.fn(),
    },
  })),
}))

// Mock the elastic module's search function
jest.mock('../../lib/elastic', () => ({
  search: jest.fn(),
}))

// Mock truckDispatch to avoid actual calculations
jest.mock('../../lib/dispatch/truckDispatch', () => ({
  calculateBaselineStatistics: jest.fn().mockReturnValue({
    totalDistanceKm: 100,
    totalCo2Kg: 5,
    bookingCount: 50,
  }),
}))

const { search } = require('../../lib/elastic')
const { Client } = require('@elastic/elasticsearch')

describe('ElasticsearchService', () => {
  let service: ElasticsearchService
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ElasticsearchService()
    // Get the mock client instance
    mockClient = (Client as jest.Mock).mock.results[0].value
  })

  describe('getVehicleCountsForExperiments', () => {
    it('returns a Map with vehicle counts based on vroomTruckPlanIds length', async () => {
      const experiments = [
        { id: 'exp-1', vroomTruckPlanIds: ['plan-1', 'plan-2', 'plan-3'] },
        { id: 'exp-2', vroomTruckPlanIds: ['plan-4'] },
        { id: 'exp-3', vroomTruckPlanIds: [] },
      ]

      const result = await service.getVehicleCountsForExperiments(experiments)

      expect(result).toBeInstanceOf(Map)
      expect(result.get('exp-1')).toBe(3)
      expect(result.get('exp-2')).toBe(1)
      expect(result.get('exp-3')).toBe(0)
    })

    it('handles experiments without vroomTruckPlanIds', async () => {
      const experiments = [
        { id: 'exp-1' },
        { id: 'exp-2', vroomTruckPlanIds: undefined },
      ]

      const result = await service.getVehicleCountsForExperiments(experiments)

      expect(result.get('exp-1')).toBe(0)
      expect(result.get('exp-2')).toBe(0)
    })

    it('returns empty Map for empty input', async () => {
      const result = await service.getVehicleCountsForExperiments([])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })
  })

  describe('getVroomPlansByIds', () => {
    it('returns plans with their IDs', async () => {
      const mockPlans = [
        { _id: 'plan-1', _source: { truckId: 'truck-1', completePlan: [] } },
        { _id: 'plan-2', _source: { truckId: 'truck-2', completePlan: [] } },
      ]

      search.mockResolvedValue({
        body: {
          hits: {
            hits: mockPlans,
          },
        },
      })

      const result = await service.getVroomPlansByIds(['plan-1', 'plan-2'])

      expect(search).toHaveBeenCalledWith({
        index: 'truck-plans',
        body: {
          query: { terms: { _id: ['plan-1', 'plan-2'] } },
          size: 2,
        },
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ truckId: 'truck-1', completePlan: [], _id: 'plan-1' })
      expect(result[1]).toEqual({ truckId: 'truck-2', completePlan: [], _id: 'plan-2' })
    })

    it('returns empty array for empty planIds', async () => {
      const result = await service.getVroomPlansByIds([])

      expect(result).toEqual([])
      expect(search).not.toHaveBeenCalled()
    })

    it('handles missing hits gracefully', async () => {
      search.mockResolvedValue({
        body: {
          hits: {},
        },
      })

      const result = await service.getVroomPlansByIds(['plan-1'])

      expect(result).toEqual([])
    })
  })

  describe('copyTruckPlansToExperiment', () => {
    it('copies plans with deterministic new IDs', async () => {
      const sourcePlans = [
        { _id: 'old-plan-1', truckId: 'truck-1', completePlan: [{ action: 'pickup' }] },
        { _id: 'old-plan-2', truckId: 'truck-2', completePlan: [{ action: 'delivery' }] },
      ]

      search.mockResolvedValue({
        body: {
          hits: {
            hits: sourcePlans.map((p) => ({ _id: p._id, _source: p })),
          },
        },
      })

      mockClient.bulk.mockResolvedValue({ body: { errors: false } })

      const newPlanIds = await service.copyTruckPlansToExperiment(
        ['old-plan-1', 'old-plan-2'],
        'new-experiment-123'
      )

      expect(newPlanIds).toEqual([
        'new-experiment-123-truck-1',
        'new-experiment-123-truck-2',
      ])

      expect(mockClient.bulk).toHaveBeenCalledWith({
        body: expect.arrayContaining([
          { index: { _index: 'truck-plans', _id: 'new-experiment-123-truck-1' } },
          expect.objectContaining({
            truckId: 'truck-1',
            planId: 'new-experiment-123-truck-1',
            experimentId: 'new-experiment-123',
          }),
        ]),
        refresh: 'wait_for',
      })
    })

    it('throws error when no plans found', async () => {
      search.mockResolvedValue({
        body: {
          hits: {
            hits: [],
          },
        },
      })

      await expect(
        service.copyTruckPlansToExperiment(['non-existent'], 'new-exp')
      ).rejects.toThrow('No truck plans found to copy')
    })
  })

  describe('addPlanIdToExperiment', () => {
    it('updates experiment with script to add planId', async () => {
      mockClient.update.mockResolvedValue({ body: { result: 'updated' } })

      await service.addPlanIdToExperiment('exp-123', 'plan-456')

      expect(mockClient.update).toHaveBeenCalledWith({
        index: 'experiments',
        id: 'exp-123',
        body: {
          script: {
            source: expect.stringContaining('vroomTruckPlanIds'),
            params: { planId: 'plan-456' },
          },
        },
        retry_on_conflict: 3,
        refresh: 'wait_for',
      })
    })

    it('handles errors gracefully without throwing', async () => {
      mockClient.update.mockRejectedValue(new Error('Experiment not found'))

      // Should not throw
      await expect(
        service.addPlanIdToExperiment('non-existent', 'plan-123')
      ).resolves.toBeUndefined()
    })
  })

  describe('updateTruckPlan', () => {
    it('updates the completePlan for a specific plan', async () => {
      mockClient.update.mockResolvedValue({ body: { result: 'updated' } })
      mockClient.indices.refresh.mockResolvedValue({})

      const newPlan = [{ action: 'pickup', booking: { id: 'b1' } }]
      const result = await service.updateTruckPlan('plan-123', newPlan)

      expect(mockClient.update).toHaveBeenCalledWith({
        index: 'truck-plans',
        id: 'plan-123',
        body: {
          doc: {
            completePlan: newPlan,
            updatedAt: expect.any(String),
          },
        },
      })

      expect(mockClient.indices.refresh).toHaveBeenCalledWith({ index: 'truck-plans' })
      expect(result).toEqual({ success: true })
    })
  })

  describe('getStatisticsForPlans', () => {
    it('aggregates statistics from multiple plans', async () => {
      search.mockResolvedValue({
        body: {
          aggregations: {
            total_distance: { value: 150.5 },
            total_co2: { value: 7.25 },
            total_bookings: { value: 100 },
          },
        },
      })

      const result = await service.getStatisticsForPlans(['plan-1', 'plan-2', 'plan-3'])

      expect(search).toHaveBeenCalledWith({
        index: 'truck-plans',
        body: {
          size: 0,
          query: {
            terms: { _id: ['plan-1', 'plan-2', 'plan-3'] },
          },
          aggs: {
            total_distance: { sum: { field: 'totalDistanceKm' } },
            total_co2: { sum: { field: 'totalCo2Kg' } },
            total_bookings: { sum: { field: 'bookingCount' } },
          },
        },
      })

      expect(result).toEqual({
        totalDistanceKm: 150.5,
        totalCo2Kg: 7.25,
        bookingCount: 100,
      })
    })

    it('returns zeros for empty planIds', async () => {
      const result = await service.getStatisticsForPlans([])

      expect(result).toEqual({
        totalDistanceKm: 0,
        totalCo2Kg: 0,
        bookingCount: 0,
      })

      expect(search).not.toHaveBeenCalled()
    })

    it('handles missing aggregations gracefully', async () => {
      search.mockResolvedValue({
        body: {},
      })

      const result = await service.getStatisticsForPlans(['plan-1'])

      expect(result).toEqual({
        totalDistanceKm: 0,
        totalCo2Kg: 0,
        bookingCount: 0,
      })
    })
  })

  describe('listDatasets', () => {
    it('fetches a lightweight dataset list and maps elastic _id to id', async () => {
      mockClient.search.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _id: 'dataset-1',
                _source: {
                  datasetId: 'dataset-1',
                  name: 'Dataset 1',
                  description: 'desc',
                  fleetVehicleCount: 4,
                },
              },
            ],
          },
        },
      })

      const result = await service.listDatasets()

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'route-datasets',
        body: {
          query: { match_all: {} },
          sort: [{ uploadTimestamp: { order: 'desc' } }],
          size: 100,
          _source: {
            excludes: ['routeData', 'fleetConfiguration', 'originalSettings'],
          },
        },
      })

      expect(result).toEqual([
        {
          id: 'dataset-1',
          datasetId: 'dataset-1',
          name: 'Dataset 1',
          description: 'desc',
          fleetVehicleCount: 4,
        },
      ])
    })
  })

  describe('deleteExperiment', () => {
    it('deletes experiment and unreferenced plans', async () => {
      // Mock getting the experiment
      mockClient.get.mockResolvedValue({
        body: {
          _source: {
            vroomTruckPlanIds: ['plan-1', 'plan-2'],
          },
        },
      })

      // Mock delete experiment
      mockClient.delete.mockResolvedValue({})

      // Mock search for other experiments - none found
      search.mockResolvedValue({
        body: {
          hits: {
            hits: [],
          },
        },
      })

      // Mock deleteByQuery for plans
      mockClient.deleteByQuery.mockResolvedValue({})

      const result = await service.deleteExperiment('exp-to-delete')

      expect(mockClient.get).toHaveBeenCalledWith({
        index: 'experiments',
        id: 'exp-to-delete',
      })

      expect(mockClient.delete).toHaveBeenCalledWith({
        index: 'experiments',
        id: 'exp-to-delete',
      })

      // Should delete both plans since no other experiments reference them
      expect(mockClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'truck-plans',
        body: {
          query: {
            terms: { _id: ['plan-1', 'plan-2'] },
          },
        },
      })

      expect(result).toEqual({ success: true })
    })

    it('preserves plans referenced by other experiments', async () => {
      mockClient.get.mockResolvedValue({
        body: {
          _source: {
            vroomTruckPlanIds: ['plan-1', 'plan-2', 'plan-3'],
          },
        },
      })

      mockClient.delete.mockResolvedValue({})

      // Another experiment references plan-1 and plan-2
      search.mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _source: {
                  vroomTruckPlanIds: ['plan-1', 'plan-2'],
                },
              },
            ],
          },
        },
      })

      mockClient.deleteByQuery.mockResolvedValue({})

      await service.deleteExperiment('exp-to-delete')

      // Should only delete plan-3 since plan-1 and plan-2 are still referenced
      expect(mockClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'truck-plans',
        body: {
          query: {
            terms: { _id: ['plan-3'] },
          },
        },
      })
    })

    it('skips plan cleanup when experiment has no vroomTruckPlanIds', async () => {
      mockClient.get.mockResolvedValue({
        body: {
          _source: {
            vroomTruckPlanIds: [],
          },
        },
      })

      mockClient.delete.mockResolvedValue({})

      await service.deleteExperiment('exp-without-plans')

      expect(mockClient.deleteByQuery).not.toHaveBeenCalled()
    })

    it('handles experiment without vroomTruckPlanIds field', async () => {
      mockClient.get.mockResolvedValue({
        body: {
          _source: {},
        },
      })

      mockClient.delete.mockResolvedValue({})

      const result = await service.deleteExperiment('old-experiment')

      expect(result).toEqual({ success: true })
      expect(mockClient.deleteByQuery).not.toHaveBeenCalled()
    })
  })
})

export {}
