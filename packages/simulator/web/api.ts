import { Router, Request, Response } from 'express'
import { virtualTime } from '../lib/virtualTime'
import { experimentController } from './controllers/ExperimentController'

const router = Router()

router.post('/simulation/start', async (req: Request, res: Response) => {
  try {
    const { parameters } = req.body

    const experiment = experimentController.createGlobalExperiment(parameters)
    virtualTime.reset()

    Object.assign(module.exports, {
      globalExperiment: experimentController.currentGlobalExperiment,
      isGlobalSimulationRunning: experimentController.isGlobalRunning,
      sessionExperiments: experimentController.sessions,
    })

    res.json({
      success: true,
      data: {
        experimentId: experiment.parameters.id,
        running: true,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start simulation',
    })
  }
})

router.delete('/simulation/stop', async (req: Request, res: Response) => {
  try {
    experimentController.stopGlobalExperiment()

    Object.assign(module.exports, {
      globalExperiment: experimentController.currentGlobalExperiment,
      isGlobalSimulationRunning: experimentController.isGlobalRunning,
      sessionExperiments: experimentController.sessions,
    })

    res.json({
      success: true,
      data: {
        running: false,
      },
    })
  } catch (error) {
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
        running: experimentController.isGlobalRunning,
        experimentId:
          experimentController.currentGlobalExperiment?.parameters?.id || null,
      },
    })
  } catch (error) {
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

    const experiment = experimentController.createSessionExperiment(
      sessionId,
      parameters
    )

    Object.assign(module.exports, {
      globalExperiment: experimentController.currentGlobalExperiment,
      isGlobalSimulationRunning: experimentController.isGlobalRunning,
      sessionExperiments: experimentController.sessions,
    })

    res.json({
      success: true,
      data: {
        sessionId,
        experimentId: experiment.parameters.id,
        running: true,
      },
    })
  } catch (error) {
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

      const experiment = experimentController.getSessionExperiment(sessionId)
      if (experiment) {
        experimentController.stopSessionExperiment(sessionId)
      }

      Object.assign(module.exports, {
        globalExperiment: experimentController.currentGlobalExperiment,
        isGlobalSimulationRunning: experimentController.isGlobalRunning,
        sessionExperiments: experimentController.sessions,
      })

      res.json({
        success: true,
        data: {
          sessionId,
          running: false,
        },
      })
    } catch (error) {
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

      const experiment = experimentController.getSessionExperiment(sessionId)

      res.json({
        success: true,
        data: {
          sessionId,
          running: !!experiment,
          experimentId: experiment?.parameters?.id || null,
        },
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get session status',
      })
    }
  }
)

export const globalExperiment = experimentController.currentGlobalExperiment
export const isGlobalSimulationRunning = experimentController.isGlobalRunning
export const sessionExperiments = experimentController.sessions
export default router
