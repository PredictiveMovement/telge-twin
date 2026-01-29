import axios from 'axios'
import { SIMULATOR_CONFIG } from '../config/simulator'
import { Socket } from 'socket.io-client'

const simulatorApi = axios.create({
  baseURL: SIMULATOR_CONFIG.url,
  timeout: SIMULATOR_CONFIG.requestConfig.timeout,
  headers: SIMULATOR_CONFIG.requestConfig.headers,
})

export interface OptimizationBreakSetting {
  id: string
  name: string
  duration: number
  enabled: boolean
  desiredTime?: string
}

export interface OptimizationSettings {
  workingHours?: {
    start: string
    end: string
  }
  weeklySchedule?: {
    monday?: { enabled: boolean; startTime: string; endTime: string }
    tuesday?: { enabled: boolean; startTime: string; endTime: string }
    wednesday?: { enabled: boolean; startTime: string; endTime: string }
    thursday?: { enabled: boolean; startTime: string; endTime: string }
    friday?: { enabled: boolean; startTime: string; endTime: string }
    saturday?: { enabled: boolean; startTime: string; endTime: string }
    sunday?: { enabled: boolean; startTime: string; endTime: string }
  }
  breaks?: OptimizationBreakSetting[]
  extraBreaks?: OptimizationBreakSetting[]
}

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
  optimizationSettings?: OptimizationSettings
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
  createdAt?: string
  sourceDatasetId?: string
  datasetName?: string
  simulationStatus: string
  routeDataSource?: string
  fixedRoute?: number
  emitters?: string[]
  experimentType?: 'vroom' | 'sequential' | 'replay'
  areaPartitions?: AreaPartition[]
  // Array of vroom-truck-plan IDs belonging to this experiment
  vroomTruckPlanIds?: string[]
  name?: string
  description?: string
  optimizationSettings?: OptimizationSettings
  baselineStatistics?: {
    totalDistanceKm: number
    totalCo2Kg: number
    bookingCount: number
  }
}

export interface ExperimentStatistics {
  experimentId: string
  totalDistanceKm: number
  totalCo2Kg: number
  vehicleCount: number
  bookingCount: number
  clusterCount: number
  baseline?: {
    totalDistanceKm: number
    totalCo2Kg: number
    bookingCount: number
  } | null
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
  optimizationSettings?: OptimizationSettings
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
 * Gets a single route dataset by ID.
 * @param datasetId - The ID of the dataset.
 * @returns The route dataset or null if not found.
 */

export async function getRouteDataset(
  datasetId: string
): Promise<RouteDataset | null> {
  try {
    const response = await simulatorApi.get(`/api/datasets/${datasetId}`)
    if (response.data?.success && response.data?.data) {
      return response.data.data
    }
    return null
  } catch (_error) {
    return null
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
 * Loads Telge route data for a specific date or date range.
 * @param from - YYYY-MM-DD (start date)
 * @param to - YYYY-MM-DD (end date, optional - defaults to from)
 */
export async function getTelgeRouteData(from: string, to?: string): Promise<any[]> {
  try {
    const response = await simulatorApi.get('/api/telge/routedata', {
      params: { 
        from,
        to: to || from
      },
    })
    if (!response.data?.success) {
      const message =
        typeof response.data?.message === 'string'
          ? response.data.message
          : 'Failed to load Telge route data'
      throw new Error(message)
    }
    return response.data.data || []
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Failed to load Telge route data')
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
 * Creates a copy of an experiment with updated settings.
 * @param experimentId - The ID of the experiment to copy.
 * @param updates - The fields to update in the new experiment.
 * @returns The new experiment.
 */

export async function copyExperiment(
  experimentId: string,
  updates: {
    name?: string
    description?: string
    optimizationSettings?: OptimizationSettings
  }
): Promise<{ success: boolean; experimentId?: string; experiment?: Experiment; error?: string }> {
  try {
    const response = await simulatorApi.post(
      `/api/experiments/${experimentId}/copy`,
      updates
    )
    if (response.data?.success && response.data?.data) {
      return {
        success: true,
        experimentId: response.data.data.experimentId,
        experiment: response.data.data.experiment,
      }
    }
    return { success: false, error: 'Copy failed' }
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
 * Gets aggregated statistics (distance, CO₂) for a VROOM experiment.
 * @param experimentId - The ID of the experiment.
 */
export async function getExperimentStatistics(
  experimentId: string
): Promise<ExperimentStatistics | null> {
  try {
    const response = await simulatorApi.get(
      `/api/experiments/${experimentId}/statistics`
    )
    if (response.data?.success && response.data?.data) {
      return response.data.data as ExperimentStatistics
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
 * Starts a session replay.
 * @param socket - The socket.
 * @param experimentId - The ID of the experiment.
 * @returns The session ID.
 */

export const startSessionReplay = async (
  socket: Socket,
  experimentId: string
) => {
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

/**
 * Updates the route order for a specific truck in an experiment.
 * @param experimentId - The ID of the experiment.
 * @param truckId - The ID of the truck/vehicle.
 * @param completePlan - The new ordered array of route instructions.
 * @returns Success status or error.
 */
export async function updateRouteOrder(
  experimentId: string,
  truckId: string,
  completePlan: any[]
) {
  try {
    const response = await simulatorApi.put(
      `/api/experiments/${experimentId}/trucks/${truckId}/route-order`,
      { completePlan }
    )
    return response.data
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update route order',
    }
  }
}

/**
 * Starts a simulation from a dataset via REST API.
 * @param datasetId - The ID of the dataset.
 * @param datasetName - The name of the dataset.
 * @param parameters - The parameters for the experiment.
 * @returns The result of starting the simulation.
 */
export async function startSimulationFromDatasetRest(
  datasetId: string,
  datasetName: string,
  parameters: { startDate?: string; experimentType?: string } = {}
): Promise<{ success: boolean; experimentId?: string; error?: string }> {
  try {
    const response = await simulatorApi.post('/api/simulation/start', {
      sourceDatasetId: datasetId,
      datasetName,
      parameters: {
        id: null,
        startDate: parameters.startDate || new Date().toISOString(),
        experimentType: parameters.experimentType || 'vroom',
        fixedRoute: 100,
        emitters: ['bookings', 'cars'],
        routeDataSource: 'elasticsearch',
        initMapState: {
          latitude: 59.195,
          longitude: 17.625,
          zoom: 12,
        },
      },
    })

    if (response.data?.success) {
      return {
        success: true,
        experimentId: response.data.data?.experimentId,
      }
    }

    return {
      success: false,
      error: response.data?.error || 'Failed to start simulation',
    }
  } catch (_error) {
    return {
      success: false,
      error:
        _error instanceof Error ? _error.message : 'Failed to start simulation',
    }
  }
}

export default simulatorApi
