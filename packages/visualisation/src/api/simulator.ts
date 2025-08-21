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

export interface AreaPartition {
  id: string
  center: { lat: number; lon: number }
  bounds: {
    minLat: number
    minLng: number
    maxLat: number
    maxLng: number
  }
  count: number
  recyclingTypes: string[]
  polygon: number[][]
  truckId?: string
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
  areaPartitions?: AreaPartition[]
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

/**
 * Gets all route datasets.
 * @returns The route datasets.
 */

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

/**
 * Deletes a route dataset.
 * @param datasetId - The ID of the dataset to delete.
 * @returns The response from the API.
 */

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

/**
 * Gets all experiments.
 * @returns The experiments.
 */

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

/**
 * Gets an experiment.
 * @param experimentId - The ID of the experiment.
 * @returns The experiment.
 */

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

/**
 * Deletes an experiment.
 * @param documentId - The ID of the experiment to delete.
 * @returns The response from the API.
 */

export async function deleteExperiment(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await simulatorApi.delete(`/api/experiments/${documentId}`)
    return response.data
  } catch (_error) {
    return {
      success: false,
      error:
        _error instanceof Error ? _error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Gets the VROOM plan for an experiment.
 * @param experimentId - The ID of the experiment.
 * @returns The VROOM plan.
 */

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

/**
 * Gets the original bookings for a dataset.
 * @param datasetId - The ID of the dataset.
 * @returns The original bookings.
 */

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

/**
 * Prepares a replay for an experiment.
 * @param experimentId - The ID of the experiment.
 * @returns The replay.
 */

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

/**
 * Prepares a sequential session.
 * @param datasetId - The ID of the dataset.
 * @returns The sequential session.
 */

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

/**
 * Starts a simulation from a dataset.
 * @param socket - The socket.
 * @param datasetId - The ID of the dataset.
 * @param datasetName - The name of the dataset.
 * @param parameters - The parameters for the experiment.
 * @returns The experiment.
 */

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

/**
 * Starts a session replay.
 * @param socket - The socket.
 * @param experimentId - The ID of the experiment.
 * @returns The session ID.
 */

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
    throw error
  }
}

// Note: sequential session starter removed to avoid exposing standalone sequential runs in UI.

/**
 * Gets the original bookings for an experiment.
 * @param experimentId - The ID of the experiment.
 * @returns The original bookings.
 */

export async function getOriginalBookingsForExperiment(experimentId: string) {
  try {
    const response = await simulatorApi.get(
      `/api/experiments/${experimentId}/original-bookings`
    )
    return response.data
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch original bookings',
    }
  }
}

/**
 * Gets the VROOM bookings for an experiment.
 * @param experimentId - The ID of the experiment.
 * @returns The VROOM bookings.
 */

export async function getVroomBookingsForExperiment(experimentId: string) {
  try {
    const response = await simulatorApi.get(
      `/api/experiments/${experimentId}/vroom-bookings`
    )
    return response.data
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch VROOM bookings',
    }
  }
}

export default simulatorApi
