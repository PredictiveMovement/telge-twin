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

  private getDefaultMapState() {
    return {
      latitude: parseFloat(process.env.LATITUDE || '59.1955'),
      longitude: parseFloat(process.env.LONGITUDE || '17.6253'),
      zoom: parseInt(process.env.ZOOM || '10', 10),
    }
  }

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

  stopGlobalExperiment() {
    if (this.globalExperiment) {
      this.globalExperiment = null
      this.isGlobalSimulationRunning = false
      virtualTime.reset()
      return true
    }
    return false
  }

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

  async startSimulationFromData(simData: any, parameters: any) {
    const { experimentId, datasetId, isReplay } = simData
    let currentExperimentId = experimentId || safeId()
    let fleetsConfig: any[] = []
    let experimentSettings: any = {}

    try {
      if (isReplay && experimentId) {
        const experimentData = await elasticsearchService.getExperiment(
          experimentId
        )

        if (experimentData.sourceDatasetId) {
          console.log(
            `🔄 Loading dataset ${experimentData.sourceDatasetId} for replay`
          )
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

        console.log(
          `🔄 Replay mode: Loading experiment ${experimentId} with ${
            fleetsConfig.length
          } fleets from ${
            experimentData.sourceDatasetId ? 'dataset' : 'experiment'
          }`
        )
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
      } else if (simData.sourceDatasetId) {
        const dataset = await elasticsearchService.getDataset(
          simData.sourceDatasetId
        )
        fleetsConfig = dataset.fleetConfiguration || []
      } else {
        const defaultConfig = createFleetConfigFromDataset(
          [],
          undefined,
          parameters
        )
        fleetsConfig = defaultConfig['Södertälje kommun']?.fleets || []
      }

      const experimentType =
        parameters.experimentType || (isReplay ? 'replay' : 'vroom')

      this.globalExperiment = null
      const experiment = this.createGlobalExperiment({
        ...parameters,
        ...experimentSettings,
        experimentId: currentExperimentId,
        experimentType,
        sourceDatasetId: datasetId || simData.sourceDatasetId,
        datasetName: simData.datasetName,
        routeDataSource: 'elasticsearch',
        fleets: {
          'Södertälje kommun': {
            settings: {},
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

  createSequentialSession(
    sessionId: string,
    datasetId: string,
    parameters: any
  ) {
    const experiment = this.createSessionExperiment(sessionId, {
      ...parameters,
      sourceDatasetId: datasetId,
      experimentType: 'sequential',
      isReplay: false,
    })

    experiment.virtualTime.reset()
    experiment.virtualTime.pause()

    return experiment
  }

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
