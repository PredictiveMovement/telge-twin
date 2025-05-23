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

export default simulatorApi
