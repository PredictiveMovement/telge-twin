import axios from 'axios'
import { SIMULATOR_CONFIG } from '../config/simulator'
import { Socket } from 'socket.io-client'

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
  originalSettings?: Record<string, unknown>
}

export interface FleetConfiguration {
  name: string
  hubAddress: string
  recyclingTypes: string[]
  vehicles: Record<string, number>
  compartmentConfiguration?: Record<string, unknown>[]
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
  experimentType?: 'vroom' | 'sequential' | 'replay'
}

export async function saveRouteDataset(datasetData: {
  name: string
  description?: string
  originalFilename: string
  filterCriteria: Record<string, unknown>
  routeData: Record<string, unknown>[]
  originalRecordCount: number
  fleetConfiguration?: Record<string, unknown>[]
  originalSettings?: Record<string, unknown>
}): Promise<{
  success: boolean
  datasetId?: string
  dataset?: RouteDataset
  error?: string
}> {
  try {
    const response = await simulatorApi.post('/api/datasets', datasetData)
    return response.data
  } catch (_error) {
    return {
      success: false,
      error:
        _error instanceof Error ? _error.message : 'Unknown error occurred',
    }
  }
}

export async function getRouteDatasets(): Promise<RouteDataset[]> {
  try {
    const response = await simulatorApi.get('/api/datasets')
    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return []
  } catch (_error) {
    return []
  }
}

export async function deleteRouteDataset(
  datasetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await simulatorApi.delete(`/api/datasets/${datasetId}`)
    return response.data
  } catch (_error) {
    return {
      success: false,
      error:
        _error instanceof Error ? _error.message : 'Unknown error occurred',
    }
  }
}

export async function getExperiments(): Promise<Experiment[]> {
  try {
    const response = await simulatorApi.get('/api/experiments')
    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return []
  } catch (_error) {
    return []
  }
}

export async function getExperiment(
  experimentId: string
): Promise<Experiment | null> {
  try {
    const response = await simulatorApi.get(`/api/experiments/${experimentId}`)
    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return null
  } catch (_error) {
    return null
  }
}

export async function getVroomPlan(
  experimentId: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await simulatorApi.get(
      `/api/experiments/${experimentId}/vroom-plan`
    )
    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return null
  } catch (_error) {
    return null
  }
}

export async function getOriginalBookings(
  datasetId: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await simulatorApi.get(
      `/api/datasets/${datasetId}/bookings`
    )
    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return null
  } catch (_error) {
    return null
  }
}

export async function prepareReplay(experimentId: string): Promise<{
  success: boolean
  data?: {
    experimentId: string
    sessionId: string
    parameters: Record<string, unknown>
  }
  error?: string
}> {
  try {
    const response = await simulatorApi.post('/api/simulation/prepare-replay', {
      experimentId,
    })
    return response.data
  } catch (_error) {
    return {
      success: false,
      error:
        _error instanceof Error ? _error.message : 'Unknown error occurred',
    }
  }
}

export async function prepareSequentialSession(datasetId: string): Promise<{
  success: boolean
  data?: {
    sessionId: string
    parameters: Record<string, unknown>
  }
  error?: string
}> {
  try {
    const response = await simulatorApi.post(
      '/api/simulation/prepare-sequential',
      {
        datasetId,
      }
    )
    return response.data
  } catch (_error) {
    return {
      success: false,
      error:
        _error instanceof Error ? _error.message : 'Unknown error occurred',
    }
  }
}

export function startSimulationFromDataset(
  socket: Socket,
  datasetId: string,
  datasetName: string,
  parameters: Record<string, unknown> = {}
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

    socket.emit(
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
    socket.once('simulationStarted', () => resolve())
  })
}

export const startSessionReplay = async (
  socket: Socket,
  experimentId: string
) => {
  try {
    const replayResult = await prepareReplay(experimentId)

    if (!replayResult.success || !replayResult.data) {
      throw new Error(replayResult.error || 'Failed to prepare replay')
    }

    const { sessionId, parameters } = replayResult.data

    socket.emit('startSessionReplay', {
      sessionId,
      experimentId,
      parameters,
    })

    return sessionId
  } catch (error) {
    console.error('Error starting session replay:', error)
    throw error
  }
}

export const startSequentialSession = async (
  socket: Socket,
  datasetId: string
) => {
  try {
    const sessionResult = await prepareSequentialSession(datasetId)

    if (!sessionResult.success || !sessionResult.data) {
      throw new Error(
        sessionResult.error || 'Failed to prepare sequential session'
      )
    }

    const { sessionId, parameters } = sessionResult.data

    socket.emit('startSequentialSession', {
      sessionId,
      datasetId,
      parameters,
    })

    return sessionId
  } catch (error) {
    console.error('Error starting sequential session:', error)
    throw error
  }
}

export default simulatorApi
