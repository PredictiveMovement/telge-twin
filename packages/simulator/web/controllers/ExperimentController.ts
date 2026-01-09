import moment from 'moment'
import { filter, take } from 'rxjs/operators'
import { emitters } from '../../config'
import { virtualTime, VirtualTime } from '../../lib/virtualTime'
import { safeId } from '../../lib/id'
import { elasticsearchService } from '../services/ElasticsearchService'
import { calculateBaselineStatistics } from '../../lib/dispatch/truckDispatch'
import engine from '../../index'

export class ExperimentController {
  private globalExperiment: any = null
  private isGlobalSimulationRunning = false
  private sessionExperiments = new Map<string, any>()
  private sessionVirtualTimes = new Map<string, VirtualTime>()

  private parseTimeToMinutes(value?: string): number | null {
    if (typeof value !== 'string') return null
    const match = value.trim().match(/^([0-9]{1,2}):([0-9]{2})$/)
    if (!match) return null
    const hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    if (hours < 0 || hours > 23) return null
    if (minutes < 0 || minutes > 59) return null
    return hours * 60 + minutes
  }

  private buildWorkdaySettings(workingHours?: {
    start?: string
    end?: string
  }):
    | ({
        start?: string
        end?: string
        startMinutes?: number
        endMinutes?: number
      } & Record<string, unknown>)
    | null {
    if (!workingHours) return null

    const startMinutes = this.parseTimeToMinutes(workingHours.start)
    const endMinutes = this.parseTimeToMinutes(workingHours.end)

    if (startMinutes == null && endMinutes == null) {
      return null
    }

    return {
      ...workingHours,
      ...(startMinutes != null ? { startMinutes } : {}),
      ...(endMinutes != null ? { endMinutes } : {}),
    }
  }

  private buildBreakSettings(
    breaks?: Array<{
      id?: string
      enabled?: boolean
      duration?: number
      desiredTime?: string
    }>,
    extraBreaks?: Array<{
      id?: string
      enabled?: boolean
      duration?: number
      desiredTime?: string
    }>
  ): Array<{ id: string; startMinutes: number; durationMinutes: number }> {
    const candidates = [
      ...(Array.isArray(breaks) ? breaks : []),
      ...(Array.isArray(extraBreaks) ? extraBreaks : []),
    ]

    const parsed: Array<{
      id: string
      startMinutes: number
      durationMinutes: number
    }> = []

    candidates.forEach((candidate, index) => {
      if (!candidate || candidate.enabled === false) return
      const startMinutes = this.parseTimeToMinutes(candidate.desiredTime)
      if (startMinutes == null) return
      const durationMinutes =
        typeof candidate.duration === 'number' ? candidate.duration : 0
      if (!isFinite(durationMinutes) || durationMinutes <= 0) return
      const id = candidate.id || `break-${index}`
      parsed.push({ id, startMinutes, durationMinutes })
    })

    return parsed
  }

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

    const workdaySettings: any = directParams?.workdaySettings || null
    const startMinutes =
      typeof workdaySettings?.startMinutes === 'number'
        ? workdaySettings.startMinutes
        : null
    const endMinutes =
      typeof workdaySettings?.endMinutes === 'number'
        ? workdaySettings.endMinutes
        : null

    const startHour = startMinutes != null ? startMinutes / 60 : 8.0
    const endHour = endMinutes != null ? endMinutes / 60 : undefined

    const globalVirtualTime = new VirtualTime(60, startHour, endHour)
    virtualTime.setGlobalVirtualTimeInstance(globalVirtualTime)
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

    const workdaySettings: any = directParams?.workdaySettings || null
    const startMinutes =
      typeof workdaySettings?.startMinutes === 'number'
        ? workdaySettings.startMinutes
        : null
    const endMinutes =
      typeof workdaySettings?.endMinutes === 'number'
        ? workdaySettings.endMinutes
        : null

    const startHour = startMinutes != null ? startMinutes / 60 : 8.0
    const endHour = endMinutes != null ? endMinutes / 60 : undefined

    const sessionVirtualTime = new VirtualTime(60, startHour, endHour)
    this.sessionVirtualTimes.set(sessionId, sessionVirtualTime)

    virtualTime.registerSession(sessionId, sessionVirtualTime)
    virtualTime.registerExperiment(experimentId, sessionId)

    const experiment = engine.createExperiment({
      defaultEmitters: currentEmitters,
      id: experimentId,
      directParams: { ...directParams, isReplay: true },
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
    const currentExperimentId = experimentId || safeId()
    let fleetsConfig: any[] = []

    let datasetData: any = null
    let datasetWorkdaySettings: any = null
    let datasetBreakSettingsRef: Array<{
      id: string
      startMinutes: number
      durationMinutes: number
    }> | null = null

    if (simData.sourceDatasetId || datasetId) {
      const targetDatasetId = simData.sourceDatasetId || datasetId
      datasetData = await elasticsearchService.getDataset(targetDatasetId)
      datasetWorkdaySettings = this.buildWorkdaySettings(
        datasetData?.optimizationSettings?.workingHours
      )
      datasetBreakSettingsRef = this.buildBreakSettings(
        datasetData?.optimizationSettings?.breaks,
        datasetData?.optimizationSettings?.extraBreaks
      )
      fleetsConfig = datasetData?.fleetConfiguration || []
    }

    const experimentType = parameters.experimentType || 'vroom'
    const workdaySettings =
      datasetWorkdaySettings || parameters?.workdaySettings
    const breakSettings = datasetBreakSettingsRef?.length
      ? datasetBreakSettingsRef
      : parameters?.breakSettings

    this.globalExperiment = null
    const experiment = this.createGlobalExperiment({
      ...parameters,
      experimentId: currentExperimentId,
      experimentType,
      sourceDatasetId: simData.sourceDatasetId || datasetId,
      datasetName: simData.datasetName,
      routeDataSource: 'elasticsearch',
      workdaySettings,
      breakSettings,
      optimizationSettings: datasetData?.optimizationSettings,
      fleets: {
        'Södertälje kommun': {
          settings: {
            experimentType,
            workday: workdaySettings || undefined,
            breaks: breakSettings || undefined,
            pickupsBeforeDelivery:
              datasetData?.originalSettings?.pickupsBeforeDelivery ||
              parameters?.pickupsBeforeDelivery ||
              undefined,
            tjtyper: datasetData?.originalSettings?.tjtyper || undefined,
            avftyper: datasetData?.originalSettings?.avftyper || undefined,
            ...(experimentType === 'replay' && experimentId
              ? { replayExperiment: experimentId }
              : {}),
          },
          fleets: fleetsConfig,
        },
      },
    })

    virtualTime.reset()

    // Calculate and save baseline statistics from original route data
    if (datasetData?.routeData && Array.isArray(datasetData.routeData)) {
      const baselineStats = calculateBaselineStatistics(datasetData.routeData)
      experiment.parameters.baselineStatistics = {
        totalDistanceKm: baselineStats.totalDistanceKm,
        totalCo2Kg: baselineStats.totalCo2Kg,
        bookingCount: baselineStats.bookingCount,
      }
    }

    return {
      success: true,
      experiment,
      experimentId: currentExperimentId,
      isReplay: !!isReplay,
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
    const experimentData = await elasticsearchService.getExperiment(
      experimentId
    )

    if (!experimentData) {
      throw new Error('Experiment not found for replay')
    }

    let fleetsConfig = []
    let datasetData: any = null
    if (experimentData.sourceDatasetId) {
      datasetData = await elasticsearchService.getDataset(
        experimentData.sourceDatasetId
      )
      fleetsConfig = datasetData?.fleetConfiguration || []
    } else {
      fleetsConfig = experimentData.fleets || []
    }

    const experimentSettings = {
      ...experimentData.settings,
      replayExperiment: experimentId,
      isReplay: true,
    }

    const workdaySettings =
      this.buildWorkdaySettings(
        datasetData?.optimizationSettings?.workingHours
      ) || this.buildWorkdaySettings(experimentData?.settings?.workday)
    const breakSettings =
      this.buildBreakSettings(
        datasetData?.optimizationSettings?.breaks,
        datasetData?.optimizationSettings?.extraBreaks
      ) || experimentData?.settings?.breaks

    const datasetFleetSettings =
      (datasetData?.originalSettings as Record<string, unknown>) ||
      (experimentData?.settings as Record<string, unknown>) ||
      {}

    const sessionParams = {
      ...parameters,
      ...experimentSettings,
      experimentId: experimentId,
      experimentType: 'replay',
      sourceDatasetId: experimentData.sourceDatasetId,
      datasetName: experimentData.datasetName,
      routeDataSource: 'elasticsearch',
      workdaySettings,
      breakSettings,
      fleets: {
        'Södertälje kommun': {
          settings: {
            ...datasetFleetSettings,
            experimentType: 'replay',
            workday: workdaySettings || undefined,
            breaks: breakSettings || undefined,
            pickupsBeforeDelivery:
              datasetData?.originalSettings?.pickupsBeforeDelivery ||
              parameters?.pickupsBeforeDelivery ||
              undefined,
            tjtyper: datasetData?.originalSettings?.tjtyper || undefined,
            avftyper: datasetData?.originalSettings?.avftyper || undefined,
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
  }

  /**
   * Creates a sequential session, from non optimized data.
   * @param sessionId - The ID of the session.
   * @param datasetId - The ID of the dataset.
   * @param parameters - The parameters for the experiment.
   * @returns The experiment.
   */

  async createSequentialSession(
    sessionId: string,
    datasetId: string,
    parameters: any
  ) {
    const datasetData = await elasticsearchService.getDataset(datasetId)

    const workdaySettings = this.buildWorkdaySettings(
      datasetData?.optimizationSettings?.workingHours
    )
    const breakSettings = this.buildBreakSettings(
      datasetData?.optimizationSettings?.breaks,
      datasetData?.optimizationSettings?.extraBreaks
    )

    const experiment = this.createSessionExperiment(sessionId, {
      ...parameters,
      sourceDatasetId: datasetId,
      experimentType: 'sequential',
      isReplay: true,
      workdaySettings: workdaySettings || undefined,
      fleets: {
        'Södertälje kommun': {
          settings: {
            ...parameters.fleets?.['Södertälje kommun']?.settings,
            experimentType: 'sequential',
            workday: workdaySettings || undefined,
            breaks: breakSettings || undefined,
            pickupsBeforeDelivery:
              datasetData?.originalSettings?.pickupsBeforeDelivery ||
              parameters?.pickupsBeforeDelivery ||
              undefined,
            tjtyper: datasetData?.originalSettings?.tjtyper || undefined,
            avftyper: datasetData?.originalSettings?.avftyper || undefined,
          },
          fleets: parameters.fleets?.['Södertälje kommun']?.fleets || [],
        },
      },
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
