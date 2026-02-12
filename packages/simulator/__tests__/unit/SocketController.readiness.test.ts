const mockEmitters = jest.fn()
const mockAddDispatchErrorToExperiment = jest.fn(
  (..._args: any[]) => Promise.resolve()
)

jest.mock('../../config', () => ({
  emitters: (...args: any[]) => mockEmitters(...args),
}))

jest.mock('../../web/routes/bookings', () => ({
  register: jest.fn(() => []),
}))

jest.mock('../../web/routes/cars', () => ({
  register: jest.fn(() => []),
}))

jest.mock('../../web/routes/time', () => ({
  register: jest.fn(() => []),
}))

jest.mock('../../web/routes/log', () => ({
  register: jest.fn(() => []),
}))

jest.mock('../../web/services/ElasticsearchService', () => ({
  elasticsearchService: {
    addDispatchErrorToExperiment: (experimentId: string, errorEntry: any) =>
      mockAddDispatchErrorToExperiment(experimentId, errorEntry),
  },
}))

const { SocketController } = require('../../web/controllers/SocketController')
const { experimentController } = require('../../web/controllers/ExperimentController')
const { sessionController } = require('../../web/controllers/SessionController')

const createExperiment = (expectedTruckPlanCount: number) => {
  let playing = false

  const virtualTime = {
    play: jest.fn(() => {
      playing = true
    }),
    isPlaying: jest.fn(() => playing),
    getTimeMultiplier: jest.fn(() => 60),
  }

  return {
    parameters: {
      id: 'exp-1',
      dispatchReady: false,
      expectedTruckPlanCount,
      savedTruckPlanIds: [],
    },
    virtualTime,
  }
}

describe('SocketController readiness handling', () => {
  let controller: any
  let ioEmit: jest.Mock
  let socket: any

  beforeEach(() => {
    mockEmitters.mockReset()
    mockAddDispatchErrorToExperiment.mockClear()
    ioEmit = jest.fn()
    socket = { emit: jest.fn(), data: {} }
    controller = new SocketController()
    controller.setIoInstance({ emit: ioEmit } as any)
    ;(experimentController as any).globalExperiment = null
  })

  afterEach(() => {
    ;(experimentController as any).globalExperiment = null
  })

  it('marks global simulation ready only after all unique truck plans are saved', () => {
    mockEmitters.mockReturnValue(['bookings', 'cars'])
    const experiment = createExperiment(2)
    ;(experimentController as any).globalExperiment = experiment

    controller.subscribe(experiment, socket)
    expect(experiment.parameters.dispatchReady).toBe(false)
    expect(experiment.virtualTime.play).not.toHaveBeenCalled()
    expect(ioEmit).not.toHaveBeenCalled()

    controller.emitPlanSaved('exp-1', 'exp-1-truck-1')
    expect(experiment.parameters.savedTruckPlanIds).toEqual(['exp-1-truck-1'])
    expect(experiment.parameters.dispatchReady).toBe(false)

    controller.emitPlanSaved('exp-1', 'exp-1-truck-1')
    expect(experiment.parameters.savedTruckPlanIds).toEqual(['exp-1-truck-1'])
    expect(experiment.parameters.dispatchReady).toBe(false)

    controller.emitPlanSaved('exp-1', 'exp-1-truck-2')
    expect(experiment.parameters.savedTruckPlanIds).toEqual([
      'exp-1-truck-1',
      'exp-1-truck-2',
    ])
    expect(experiment.parameters.dispatchReady).toBe(true)
    expect(experiment.virtualTime.play).not.toHaveBeenCalled()
    expect(ioEmit).toHaveBeenCalledTimes(1)
    expect(ioEmit).toHaveBeenCalledWith('simulationReady', {
      experimentId: 'exp-1',
    })
  })

  it('marks global simulation ready immediately when expected truck plan count is zero', () => {
    mockEmitters.mockReturnValue(['bookings', 'cars'])
    const experiment = createExperiment(0)

    controller.subscribe(experiment, socket)

    expect(experiment.parameters.dispatchReady).toBe(true)
    expect(experiment.virtualTime.play).not.toHaveBeenCalled()
    expect(ioEmit).toHaveBeenCalledWith('simulationReady', {
      experimentId: 'exp-1',
    })
  })

  it('marks global simulation ready immediately when bookings emitter is disabled', () => {
    mockEmitters.mockReturnValue(['cars'])
    const experiment = createExperiment(12)

    controller.subscribe(experiment, socket)

    expect(experiment.parameters.dispatchReady).toBe(true)
    expect(experiment.virtualTime.play).not.toHaveBeenCalled()
    expect(ioEmit).toHaveBeenCalledWith('simulationReady', {
      experimentId: 'exp-1',
    })
  })

  it('marks global simulation ready when dispatch errors account for remaining trucks', () => {
    mockEmitters.mockReturnValue(['bookings', 'cars'])
    const experiment = createExperiment(2)
    ;(experiment.parameters as any).sourceDatasetId = 'dataset-1'
    ;(experimentController as any).globalExperiment = experiment

    controller.subscribe(experiment, socket)

    controller.emitPlanSaved('exp-1', 'exp-1-truck-1')
    expect(experiment.parameters.dispatchReady).toBe(false)

    controller.emitDispatchError(
      'exp-1',
      'truck-2',
      'Fleet 2',
      'VROOM planning failed'
    )

    expect(experiment.parameters.dispatchReady).toBe(true)
    expect(ioEmit).toHaveBeenCalledWith('simulationReady', {
      experimentId: 'exp-1',
    })
    expect(ioEmit).toHaveBeenCalledWith(
      'dispatchError',
      expect.objectContaining({
        experimentId: 'exp-1',
        truckId: 'truck-2',
        fleet: 'Fleet 2',
        sourceDatasetId: 'dataset-1',
      })
    )
  })

  it('emits dispatchError without sourceDatasetId when experiment id does not match active experiment', () => {
    mockEmitters.mockReturnValue(['bookings', 'cars'])
    const experiment = createExperiment(2)
    experiment.parameters.id = 'exp-active'
    ;(experiment.parameters as any).sourceDatasetId = 'dataset-active'
    ;(experimentController as any).globalExperiment = experiment

    controller.emitDispatchError(
      'exp-other',
      'truck-99',
      'Fleet X',
      'Forced failure'
    )

    const dispatchCall = ioEmit.mock.calls.find(
      (call: any[]) => call[0] === 'dispatchError'
    )
    expect(dispatchCall).toBeTruthy()
    expect(dispatchCall[1]).toEqual(
      expect.objectContaining({
        experimentId: 'exp-other',
        truckId: 'truck-99',
        fleet: 'Fleet X',
      })
    )
    expect(dispatchCall[1]).not.toHaveProperty('sourceDatasetId')
  })

  it('broadcastSimulationStopped notifies global watchers with simulationStopped', () => {
    const notifySpy = jest
      .spyOn(sessionController, 'notifyGlobalWatchers')
      .mockImplementation(() => {})

    controller.broadcastSimulationStopped()

    expect(notifySpy).toHaveBeenCalledTimes(1)
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({ emit: ioEmit }),
      'simulationStopped'
    )

    notifySpy.mockRestore()
  })
})
