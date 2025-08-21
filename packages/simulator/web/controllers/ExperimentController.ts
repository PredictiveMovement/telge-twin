import moment from 'moment'
import { filter, take } from 'rxjs/operators'
import { emitters } from '../../config'
import { virtualTime, VirtualTime } from '../../lib/virtualTime'
import { safeId } from '../../lib/id'
import { createFleetConfigFromDataset } from '../../lib/fleet-utils'
import { elasticsearchService } from '../services/ElasticsearchService'

const engine: {
  createExperiment: (opts: unknown) => unknown
} = require('../../index')

export class ExperimentController {
  private globalExperiment: any = null
  private isGlobalSimulationRunning = false
  private sessionExperiments = new Map<string, any>()
  private sessionVirtualTimes = new Map<string, VirtualTime>()

  get currentGlobalExperiment() {
    return this.globalExperiment
  }

  get isGlobalRunning() {
    return this.isGlobalSimulationRunning
  }

  get sessions() {
    return this.sessionExperiments
  }

  getSessionExperiment(sessionId: string) {
    return this.sessionExperiments.get(sessionId)
  }

  getSessionVirtualTime(sessionId: string) {
    return this.sessionVirtualTimes.get(sessionId)
  }

  /**
   * Gets the default map state.
   * @returns The default map state.
   */

  private getDefaultMapState() {
    return {
      latitude: parseFloat(process.env.LATITUDE || '59.1955'),
      longitude: parseFloat(process.env.LONGITUDE || '17.6253'),
      zoom: parseInt(process.env.ZOOM || '10', 10),
    }
  }

  /**
   * Sets up auto-stop on end of day.
   * @param experiment - The experiment to set up auto-stop on end of day for.
   * @param onStop - The function to call when the experiment stops.
   */

  private setupAutoStopOnEndOfDay(experiment: any, onStop: () => void) {
    if (experiment.virtualTime) {
      experiment.virtualTime
        .getTimeStream()
        .pipe(
          filter((time: number) => time >= moment().endOf('day').valueOf()),
          take(1)
        )
        .subscribe(() => {
          onStop()
        })
    }
  }

  /**
   * Creates a global experiment.
   * @param directParams - The direct parameters for the experiment.
   * @returns The global experiment.
   */

  createGlobalExperiment(directParams?: any) {
    const currentEmitters = emitters()
    const experimentId = directParams?.id || safeId()

    const globalVirtualTime = new VirtualTime(60, 8.0)
    globalVirtualTime.play()

    this.globalExperiment = engine.createExperiment({
      defaultEmitters: currentEmitters,
      id: experimentId,
      directParams: { ...directParams, isReplay: false },
      virtualTime: globalVirtualTime,
    })

    if (!this.globalExperiment.parameters.emitters) {
      this.globalExperiment.parameters.emitters = currentEmitters
    }

    this.globalExperiment.parameters.initMapState = this.getDefaultMapState()

    this.setupAutoStopOnEndOfDay(this.globalExperiment, () => {
      this.stopGlobalExperiment()
    })

    this.isGlobalSimulationRunning = true
    return this.globalExperiment
  }

  /**
   * Creates a session experiment.
   * @param sessionId - The ID of the session.
   * @param directParams - The direct parameters for the experiment.
   * @returns The session experiment.
   */

  createSessionExperiment(sessionId: string, directParams?: any) {
    const currentEmitters = emitters()
    const experimentId = directParams?.id || safeId()

    const sessionVirtualTime = new VirtualTime(60, 8.0)
    this.sessionVirtualTimes.set(sessionId, sessionVirtualTime)

    virtualTime.registerSession(sessionId, sessionVirtualTime)
    virtualTime.registerExperiment(experimentId, sessionId)

    const experiment = engine.createExperiment({
      defaultEmitters: currentEmitters,
      id: experimentId,
      directParams: directParams,
      virtualTime: sessionVirtualTime,
    }) as any

    if (!experiment.parameters.emitters) {
      experiment.parameters.emitters = currentEmitters
    }

    experiment.parameters.initMapState = this.getDefaultMapState()

    this.setupAutoStopOnEndOfDay(experiment, () => {
      this.stopSessionExperiment(sessionId)
    })

    this.sessionExperiments.set(sessionId, experiment)
    return experiment
  }

  /**
   * Stops a global experiment.
   * @returns True if the experiment was stopped, false otherwise.
   */

  stopGlobalExperiment() {
    if (this.globalExperiment) {
      this.globalExperiment = null
      this.isGlobalSimulationRunning = false
      virtualTime.reset()
      return true
    }
    return false
  }

  /**
   * Stops a session experiment.
   * @param sessionId - The ID of the session.
   * @returns True if the experiment was stopped, false otherwise.
   */

  stopSessionExperiment(sessionId: string) {
    const experiment = this.sessionExperiments.get(sessionId)
    if (experiment) {
      this.sessionExperiments.delete(sessionId)
      this.sessionVirtualTimes.delete(sessionId)
      virtualTime.unregisterSession(sessionId)
      return true
    }
    return false
  }

  /**
   * Starts a simulation from data.
   * @param simData - The simulation data.
   * @param parameters - The parameters for the experiment.
   * @returns The experiment.
   */

  async startSimulationFromData(simData: any, parameters: any) {
    const { experimentId, datasetId } = simData
    const isReplay = parameters.experimentType === 'replay'
    let currentExperimentId = experimentId || safeId()
    let fleetsConfig: any[] = []
    let experimentSettings: any = {}

    try {
      if (isReplay && experimentId) {
        const experimentData = await elasticsearchService.getExperiment(
          experimentId
        )

        if (experimentData.sourceDatasetId) {
          // Loading dataset for replay
          const datasetData = await elasticsearchService.getDataset(
            experimentData.sourceDatasetId
          )
          fleetsConfig = datasetData.fleetConfiguration || []
        } else {
          fleetsConfig = experimentData.fleets || []
        }

        experimentSettings = {
          ...experimentData.settings,
          replayExperiment: experimentId,
          isReplay: true,
        }

        // Replay mode: Loading experiment with fleets
      } else if (datasetId) {
        const datasetData = await elasticsearchService.getDataset(datasetId)
        fleetsConfig = datasetData.fleetConfiguration || []

        const newExperimentData = {
          id: currentExperimentId,
          name: `Experiment from ${datasetData.name}`,
          description: `Auto-generated from dataset: ${datasetData.description}`,
          datasetId: datasetId,
          fleets: fleetsConfig,
          settings: datasetData.originalSettings || {},
          startDate: new Date().toISOString(),
          status: 'running',
        }

        await elasticsearchService.saveExperiment(
          currentExperimentId,
          newExperimentData
        )
      } else if (simData.sourceDatasetId || datasetId) {
        const targetDatasetId = simData.sourceDatasetId || datasetId
        const dataset = await elasticsearchService.getDataset(targetDatasetId)
        fleetsConfig = dataset.fleetConfiguration || []
      } else {
        const defaultConfig = createFleetConfigFromDataset(
          [],
          undefined,
          parameters
        )
        fleetsConfig = defaultConfig['Södertälje kommun']?.fleets || []
      }

      // Use experimentType from parameters, default to 'vroom' if not specified
      const experimentType = parameters.experimentType || 'vroom'

      // Creating experiment with specified type

      this.globalExperiment = null
      const experiment = this.createGlobalExperiment({
        ...parameters,
        ...experimentSettings,
        experimentId: currentExperimentId,
        experimentType,
        sourceDatasetId: simData.sourceDatasetId || datasetId,
        datasetName: simData.datasetName,
        routeDataSource: 'elasticsearch',
        fleets: {
          'Södertälje kommun': {
            settings: {
              experimentType, // ✅ Forward experimentType to fleet settings
              ...(experimentType === 'replay' && experimentId
                ? { replayExperiment: experimentId }
                : {}),
            },
            fleets: fleetsConfig,
          },
        },
      })

      virtualTime.reset()

      return {
        success: true,
        experiment,
        experimentId: currentExperimentId,
        isReplay: !!isReplay,
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * Starts a session replay.
   * @param sessionId - The ID of the session.
   * @param experimentId - The ID of the experiment.
   * @param parameters - The parameters for the experiment.
   * @returns The experiment.
   */

  async startSessionReplay(
    sessionId: string,
    experimentId: string,
    parameters: any
  ) {
    try {
      const experimentData = await elasticsearchService.getExperiment(
        experimentId
      )

      if (!experimentData) {
        throw new Error('Experiment not found for replay')
      }

      let fleetsConfig = []
      if (experimentData.sourceDatasetId) {
        const datasetData = await elasticsearchService.getDataset(
          experimentData.sourceDatasetId
        )
        fleetsConfig = datasetData.fleetConfiguration || []
      } else {
        fleetsConfig = experimentData.fleets || []
      }

      const experimentSettings = {
        ...experimentData.settings,
        replayExperiment: experimentId,
        isReplay: true,
      }

      const sessionParams = {
        ...parameters,
        ...experimentSettings,
        experimentId: experimentId,
        experimentType: 'replay',
        sourceDatasetId: experimentData.sourceDatasetId,
        datasetName: experimentData.datasetName,
        routeDataSource: 'elasticsearch',
        fleets: {
          'Södertälje kommun': {
            settings: {
              experimentType: 'replay',
              replayExperiment: experimentId,
            },
            fleets: fleetsConfig,
          },
        },
      }

      const experiment = this.createSessionExperiment(sessionId, sessionParams)
      experiment.virtualTime.reset()
      experiment.virtualTime.pause()

      return experiment
    } catch (error) {
      throw error
    }
  }

  /**
   * Creates a sequential session, from non optimized data.
   * @param sessionId - The ID of the session.
   * @param datasetId - The ID of the dataset.
   * @param parameters - The parameters for the experiment.
   * @returns The experiment.
   */

  createSequentialSession(
    sessionId: string,
    datasetId: string,
    parameters: any
  ) {
    // Mark as non-persistent by setting isReplay=true to avoid indexing a new experiment document
    const experiment = this.createSessionExperiment(sessionId, {
      ...parameters,
      sourceDatasetId: datasetId,
      experimentType: 'sequential',
      isReplay: true,
    })

    experiment.virtualTime.reset()
    experiment.virtualTime.pause()

    return experiment
  }

  /**
   * Resets the global experiment.
   * @param parameters - The parameters for the experiment.
   * @returns The experiment.
   */

  resetGlobalExperiment(parameters?: any) {
    virtualTime.reset()

    if (this.isGlobalSimulationRunning) {
      this.globalExperiment = null
      this.createGlobalExperiment(parameters)
      return this.globalExperiment
    }

    return null
  }
}

export const experimentController = new ExperimentController()
