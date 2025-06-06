import axios from 'axios'
import { SIMULATOR_CONFIG } from '../config/simulator'

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

export const uploadFile = async (file) => {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${SIMULATOR_CONFIG.url}/api/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(
        `Upload failed with status ${response.status}: ${response.statusText}`
      )
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export const selectDataFile = (socket, filename) => {
  socket.emit('selectDataFile', filename)
}

export const saveDataFileSelection = (socket, filename) => {
  socket.emit('saveDataFileSelection', filename)
}

export const getUploadedFiles = (socket) => {
  socket.emit('getUploadedFiles')
}

export const startSimulation = (socket, routeData) => {
  const parameters = {
    id: null,
    startDate: new Date().toISOString(),
    fixedRoute: 100,
    emitters: ['bookings', 'cars'],
    fleets: {
      'Södertälje kommun': {
        settings: {
          optimizedRoutes: true,
          replayExperiment: '',
        },
        fleets: [
          {
            name: 'Hushållsavfall',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: ['HUSHSORT'],
            vehicles: {
              baklastare: 3,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Hemsortering',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: ['HEMSORT', 'BRÄNN'],
            vehicles: {
              fyrfack: 10,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Matavfall',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: ['MATAVF'],
            vehicles: {
              matbil: 2,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Baklastare',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: ['TRÄDGÅRD'],
            vehicles: {
              baklastare: 2,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Skåpbil',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: ['TEXTIL'],
            vehicles: {
              skåpbil: 3,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Frontlastare',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: [
              'BMETFÖRP',
              'METFÖRP',
              'BPLASTFÖRP',
              'PLASTFÖRP',
              'BPAPPFÖRP',
              'PAPPFÖRP',
              'BRETURPAPP',
              'RETURPAPP',
              'WELLPAPP',
              'BGLFÄ',
              'GLFÄ',
              'BGLOF',
              'GLOF',
            ],
            vehicles: {
              '2-fack': 5,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Latrin (Påhittad, ska tas bort när vi vet hur det ska hanteras)',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: [
              'FETT',
              'SLAM',
              'LATRIN',
              'BLANDAVF',
              'BRÄNNKL2',
              'TRÄ',
              'FA',
              'DUMP',
              'HAVREASKA',
              'ANJORD',
              'DEP',
              'ELAVF',
              'TRÄIMP',
              'HÖGSMTRL',
            ],
            vehicles: {
              latrin: 3,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Lastväxlare',
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            recyclingTypes: ['Liftdumper', 'Rullflak', 'komprimatorer'],
            vehicles: {
              lastväxlare: 4,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Kranbil',
            recyclingTypes: ['HEMSORT'],
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            vehicles: {
              kranbil: 3,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Lastväxlare',
            recyclingTypes: ['Liftdumper', 'Rullflak', 'komprimatorer'],
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            vehicles: {
              lastväxlare: 4,
            },
            optimizedRoutes: true,
          },
          {
            name: 'Baklastare',
            recyclingTypes: ['Externa kommuner'],
            hubAddress: 'LERHAGA 50, 151 66 Södertälje',
            vehicles: {
              baklastare: 3,
            },
            optimizedRoutes: true,
          },
        ],
      },
    },
    selectedDataFile: 'ruttdata_sample.json',
    initMapState: {
      latitude: 65.0964472642777,
      longitude: 17.112050188704504,
      zoom: 5,
    },
  }

  if (socket) {
    socket.emit('startSimulation', routeData, parameters)
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

export default simulatorApi
