const mockFindDocumentById = jest.fn()
const mockDeleteExperiment = jest.fn()
const mockVirtualTimeReset = jest.fn()

jest.mock('../../web/services/ElasticsearchService', () => ({
  elasticsearchService: {
    findDocumentById: (...args: any[]) => mockFindDocumentById(...args),
    deleteExperiment: (...args: any[]) => mockDeleteExperiment(...args),
  },
}))

jest.mock('../../lib/virtualTime', () => ({
  virtualTime: {
    reset: (...args: any[]) => mockVirtualTimeReset(...args),
    setGlobalVirtualTimeInstance: jest.fn(),
    registerSession: jest.fn(),
    registerExperiment: jest.fn(),
    unregisterSession: jest.fn(),
  },
  VirtualTime: jest.fn(),
}))

jest.mock('../../index', () => ({
  createExperiment: jest.fn(),
}))

const { ExperimentController } = require('../../web/controllers/ExperimentController')

describe('ExperimentController.cancelGlobalOptimizationByDataset', () => {
  let controller: any

  beforeEach(() => {
    mockFindDocumentById.mockReset()
    mockDeleteExperiment.mockReset()
    mockVirtualTimeReset.mockReset()
    controller = new ExperimentController()
    controller.globalExperiment = null
    controller.isGlobalSimulationRunning = false
  })

  it('returns not_running when no global simulation is active', async () => {
    const result = await controller.cancelGlobalOptimizationByDataset('dataset-1')

    expect(result).toEqual({
      reason: 'not_running',
      experimentId: null,
      deletedExperiment: false,
    })
    expect(mockDeleteExperiment).not.toHaveBeenCalled()
    expect(mockVirtualTimeReset).not.toHaveBeenCalled()
  })

  it('returns dataset_mismatch and does not stop/delete when active dataset differs', async () => {
    controller.globalExperiment = {
      parameters: {
        id: 'exp-1',
        sourceDatasetId: 'dataset-other',
      },
    }
    controller.isGlobalSimulationRunning = true

    const result = await controller.cancelGlobalOptimizationByDataset('dataset-1')

    expect(result).toEqual({
      reason: 'dataset_mismatch',
      experimentId: 'exp-1',
      deletedExperiment: false,
    })
    expect(controller.globalExperiment).not.toBeNull()
    expect(controller.isGlobalSimulationRunning).toBe(true)
    expect(mockDeleteExperiment).not.toHaveBeenCalled()
    expect(mockVirtualTimeReset).not.toHaveBeenCalled()
  })

  it('cancels and deletes active experiment when document exists', async () => {
    controller.globalExperiment = {
      parameters: {
        id: 'exp-1',
        sourceDatasetId: 'dataset-1',
      },
    }
    controller.isGlobalSimulationRunning = true
    mockFindDocumentById.mockResolvedValue({ _id: 'exp-1' })
    mockDeleteExperiment.mockResolvedValue({ success: true })

    const result = await controller.cancelGlobalOptimizationByDataset('dataset-1')

    expect(result).toEqual({
      reason: 'cancelled',
      experimentId: 'exp-1',
      deletedExperiment: true,
    })
    expect(mockFindDocumentById).toHaveBeenCalledWith('experiments', 'exp-1')
    expect(mockDeleteExperiment).toHaveBeenCalledWith('exp-1')
    expect(controller.globalExperiment).toBeNull()
    expect(controller.isGlobalSimulationRunning).toBe(false)
    expect(mockVirtualTimeReset).toHaveBeenCalledTimes(1)
  })

  it('cancels even when experiment document is already missing', async () => {
    controller.globalExperiment = {
      parameters: {
        id: 'exp-1',
        sourceDatasetId: 'dataset-1',
      },
    }
    controller.isGlobalSimulationRunning = true
    mockFindDocumentById.mockResolvedValue(null)

    const result = await controller.cancelGlobalOptimizationByDataset('dataset-1')

    expect(result).toEqual({
      reason: 'cancelled',
      experimentId: 'exp-1',
      deletedExperiment: false,
    })
    expect(mockDeleteExperiment).not.toHaveBeenCalled()
    expect(controller.globalExperiment).toBeNull()
    expect(controller.isGlobalSimulationRunning).toBe(false)
    expect(mockVirtualTimeReset).toHaveBeenCalledTimes(1)
  })
})
