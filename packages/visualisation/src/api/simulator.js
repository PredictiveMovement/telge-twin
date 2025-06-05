import axios from 'axios'
import { SIMULATOR_CONFIG } from '../config/simulator'

const simulatorApi = axios.create({
  baseURL: SIMULATOR_CONFIG.url,
  timeout: SIMULATOR_CONFIG.requestConfig.timeout,
  headers: SIMULATOR_CONFIG.requestConfig.headers,
})

export const fetchExperimentIds = async () => {
  try {
    const response = await simulatorApi.get(
      SIMULATOR_CONFIG.endpoints.experiments
    )

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }

    return []
  } catch (error) {
    console.error('Error fetching experiment IDs:', error)
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
    startDate: '2025-06-05T13:52:44.298Z',
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
    console.log('Starting simulation')
    socket.emit('startSimulation', routeData, parameters)
  }
}

export default simulatorApi
