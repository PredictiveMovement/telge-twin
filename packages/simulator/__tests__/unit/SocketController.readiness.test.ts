const mockEmitters = jest.fn()

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

const { SocketController } = require('../../web/controllers/SocketController')
const { experimentController } = require('../../web/controllers/ExperimentController')

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
    expect(experiment.virtualTime.play).toHaveBeenCalledTimes(1)
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
    expect(experiment.virtualTime.play).toHaveBeenCalledTimes(1)
    expect(ioEmit).toHaveBeenCalledWith('simulationReady', {
      experimentId: 'exp-1',
    })
  })

  it('marks global simulation ready immediately when bookings emitter is disabled', () => {
    mockEmitters.mockReturnValue(['cars'])
    const experiment = createExperiment(12)

    controller.subscribe(experiment, socket)

    expect(experiment.parameters.dispatchReady).toBe(true)
    expect(experiment.virtualTime.play).toHaveBeenCalledTimes(1)
    expect(ioEmit).toHaveBeenCalledWith('simulationReady', {
      experimentId: 'exp-1',
    })
  })
})
