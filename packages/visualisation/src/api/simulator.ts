import axios from 'axios'
import { SIMULATOR_CONFIG } from '../config/simulator'
import io, { Socket } from 'socket.io-client'

const generateSessionId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}

const simulatorApi = axios.create({
  baseURL: SIMULATOR_CONFIG.url,
  timeout: SIMULATOR_CONFIG.requestConfig.timeout,
  headers: SIMULATOR_CONFIG.requestConfig.headers,
})

export interface RouteDataset {
  id: string
  datasetId: string
  name: string
  description: string
  uploadTimestamp: string
  originalFilename: string
  filterCriteria: {
    dateRange?: {
      from: string
      to: string
    }
    selectedBils?: string[]
    selectedAvftyper?: string[]
    selectedFrekvenser?: string[]
    selectedTjtyper?: string[]
  }
  recordCount: number
  originalRecordCount: number
  status: string
  associatedExperiments: string[]
  fleetConfiguration?: FleetConfiguration[]
  originalSettings?: any
}

export interface FleetConfiguration {
  name: string
  hubAddress: string
  recyclingTypes: string[]
  vehicles: Record<string, number>
  compartmentConfiguration?: any[]
  swedishCategory: string
  vehicleIds: string[]
  assignedTurids: string[]
  bookingCount: number
  source: 'route-data' | 'fack-config' | 'fallback'
  isPotential?: boolean
  isEmergency?: boolean
}

export interface Experiment {
  id: string
  startDate: string
  sourceDatasetId?: string
  datasetName?: string
  simulationStatus: string
  routeDataSource?: string
  fixedRoute?: number
  emitters?: string[]
}

export const fetchExperiments = async () => {
  try {
    const response = await simulatorApi.get('/api/experiments')

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }

    return []
  } catch (error) {
    console.error('Error fetching experiments:', error)
    throw error
  }
}

export const fetchExperimentIds = async () => {
  try {
    const experiments = await fetchExperiments()
    return experiments.map((exp) => exp.id)
  } catch (error) {
    console.error('Error fetching experiment IDs:', error)
    throw error
  }
}

export const fetchExperimentById = async (experimentId) => {
  try {
    const response = await simulatorApi.get(`/api/experiments/${experimentId}`)

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }

    return null
  } catch (error) {
    console.error('Error fetching experiment by ID:', error)
    throw error
  }
}

export const fetchPlanById = async (planId) => {
  try {
    const response = await simulatorApi.get(
      `${SIMULATOR_CONFIG.endpoints.experimentById}/${planId}`
    )

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }

    return null
  } catch (error) {
    console.error('Error fetching plan by ID:', error)
    throw error
  }
}

export const fetchSimulations = async () => {
  try {
    const response = await simulatorApi.get('/api/simulations')

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }

    return []
  } catch (error) {
    console.error('Error fetching simulations:', error)
    throw error
  }
}

export const startSessionReplay = async (socket, experimentId) => {
  try {
    const experimentData = await fetchExperimentById(experimentId)

    if (!experimentData) {
      throw new Error(`Experiment ${experimentId} not found`)
    }

    const sessionId = generateSessionId()

    const replayParameters = {
      ...experimentData,
      id: `replay_${experimentId}_${Date.now()}`,
      isReplay: true,
      fleets: Object.fromEntries(
        Object.entries((experimentData as any).fleets || {}).map(
          ([municipality, config]: [string, any]) => [
            municipality,
            {
              ...config,
              settings: {
                ...config.settings,
                replayExperiment: experimentId,
              },
            },
          ]
        )
      ),
    }

    if (socket) {
      socket.emit('startSessionReplay', {
        sessionId,
        experimentId,
        parameters: replayParameters,
      })
    }

    return sessionId
  } catch (error) {
    console.error('Error starting session replay:', error)
    throw error
  }
}

export const joinSession = (socket, sessionId, replayId) => {
  if (socket) {
    socket.emit('joinSession', { sessionId, replayId })
  }
}

export const leaveSession = (socket, sessionId) => {
  if (socket) {
    socket.emit('leaveSession', sessionId)
  }
}

export const startReplaySimulation = async (socket, experimentId) => {
  return await startSessionReplay(socket, experimentId)
}

export class SimulatorAPI {
  private socket: Socket

  constructor(url: string = 'http://localhost:3000') {
    this.socket = io(url)
    this.socket.connect()
  }

  saveRouteDataset(datasetData: {
    name: string
    description?: string
    originalFilename: string
    filterCriteria: any
    routeData: any[]
    originalRecordCount: number
    fleetConfiguration?: any[]
    originalSettings?: any
  }): Promise<{
    success: boolean
    datasetId?: string
    dataset?: RouteDataset
    error?: string
  }> {
    return new Promise((resolve) => {
      this.socket.emit('saveRouteDataset', datasetData)
      this.socket.once('routeDatasetSaved', (result) => {
        resolve(result)
      })

      setTimeout(() => {
        console.log('SimulatorAPI: Timeout efter 10 sekunder')
        resolve({ success: false, error: 'Timeout - no response from server' })
      }, 10000)
    })
  }

  getRouteDatasets(): Promise<RouteDataset[]> {
    return new Promise((resolve) => {
      this.socket.emit('getRouteDatasets')
      this.socket.once('routeDatasets', resolve)
    })
  }

  deleteRouteDataset(
    datasetId: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('deleteRouteDataset', datasetId)
      this.socket.once('routeDatasetDeleted', resolve)
    })
  }

  getExperiments(): Promise<Experiment[]> {
    return new Promise((resolve) => {
      this.socket.emit('getExperiments')
      this.socket.once('experiments', resolve)
    })
  }

  startSimulationFromDataset(
    datasetId: string,
    datasetName: string,
    parameters: any = {}
  ): Promise<void> {
    return new Promise((resolve) => {
      const defaultParameters = {
        id: null,
        startDate: new Date().toISOString(),
        fixedRoute: 100,
        emitters: ['bookings', 'cars'],
        initMapState: {
          latitude: 65.0964472642777,
          longitude: 17.112050188704504,
          zoom: 5,
        },
      }

      this.socket.emit(
        'startSimulation',
        {
          sourceDatasetId: datasetId,
          datasetName,
        },
        {
          ...defaultParameters,
          ...parameters,
          routeDataSource: 'elasticsearch',
        }
      )
      this.socket.once('simulationStarted', () => resolve())
    })
  }
}

export default simulatorApi
