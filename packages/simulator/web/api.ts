import { Router, Request, Response } from 'express'
import { safeId } from '../lib/id'
import { virtualTime } from '../lib/virtualTime'
import { emitters } from '../config'

const engine = require('../index')
let globalExperiment: any = null
let isGlobalSimulationRunning = false
const sessionExperiments = new Map<string, any>()
const router = Router()

function createGlobalSimulation(directParams?: any) {
  const currentEmitters = emitters()
  const experimentId = directParams?.id || safeId()

  globalExperiment = engine.createExperiment({
    defaultEmitters: currentEmitters,
    id: experimentId,
    directParams: { ...directParams, isReplay: false },
  })

  if (!globalExperiment.parameters.emitters) {
    globalExperiment.parameters.emitters = currentEmitters
  }

  globalExperiment.parameters.initMapState = {
    latitude: parseFloat(process.env.LATITUDE || '59.1955'),
    longitude: parseFloat(process.env.LONGITUDE || '17.6253'),
    zoom: parseInt(process.env.ZOOM || '10', 10),
  }

  return globalExperiment
}

function createSessionSimulation(sessionId: string, directParams?: any) {
  const currentEmitters = emitters()
  const experimentId = directParams?.id || safeId()

  const experiment = engine.createExperiment({
    defaultEmitters: currentEmitters,
    id: experimentId,
    directParams: { ...directParams, isReplay: true },
  }) as any

  if (!experiment.parameters.emitters) {
    experiment.parameters.emitters = currentEmitters
  }

  experiment.parameters.initMapState = {
    latitude: parseFloat(process.env.LATITUDE || '59.1955'),
    longitude: parseFloat(process.env.LONGITUDE || '17.6253'),
    zoom: parseInt(process.env.ZOOM || '10', 10),
  }

  sessionExperiments.set(sessionId, experiment)
  return experiment
}

router.post('/simulation/start', async (req: Request, res: Response) => {
  try {
    const { parameters } = req.body

    globalExperiment = null
    const experiment = createGlobalSimulation(parameters)
    isGlobalSimulationRunning = true
    virtualTime.reset()

    Object.assign(module.exports, {
      globalExperiment,
      isGlobalSimulationRunning,
    })

    res.json({
      success: true,
      data: {
        experimentId: experiment.parameters.id,
        running: true,
      },
    })
  } catch (error) {
    console.error('Error starting simulation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start simulation',
    })
  }
})

router.delete('/simulation/stop', async (req: Request, res: Response) => {
  try {
    globalExperiment = null
    isGlobalSimulationRunning = false

    Object.assign(module.exports, {
      globalExperiment,
      isGlobalSimulationRunning,
    })

    res.json({
      success: true,
      data: {
        running: false,
      },
    })
  } catch (error) {
    console.error('Error stopping simulation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to stop simulation',
    })
  }
})

router.get('/simulation/status', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        running: isGlobalSimulationRunning,
        experimentId: globalExperiment?.parameters?.id || null,
      },
    })
  } catch (error) {
    console.error('Error getting simulation status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get simulation status',
    })
  }
})

router.post('/session/replay/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, experimentId, parameters } = req.body

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      })
    }

    const experiment = createSessionSimulation(sessionId, parameters)
    virtualTime.reset()

    res.json({
      success: true,
      data: {
        sessionId,
        experimentId: experiment.parameters.id,
        running: true,
      },
    })
  } catch (error) {
    console.error('Error starting session replay:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start session replay',
    })
  }
})

router.delete(
  '/session/replay/:sessionId',
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params

      const experiment = sessionExperiments.get(sessionId)
      if (experiment) {
        sessionExperiments.delete(sessionId)
      }

      res.json({
        success: true,
        data: {
          sessionId,
          running: false,
        },
      })
    } catch (error) {
      console.error('Error stopping session replay:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to stop session replay',
      })
    }
  }
)

router.get(
  '/session/:sessionId/status',
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params

      const experiment = sessionExperiments.get(sessionId)

      res.json({
        success: true,
        data: {
          sessionId,
          running: !!experiment,
          experimentId: experiment?.parameters?.id || null,
        },
      })
    } catch (error) {
      console.error('Error getting session status:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get session status',
      })
    }
  }
)

export { globalExperiment, isGlobalSimulationRunning, sessionExperiments }
export default router
