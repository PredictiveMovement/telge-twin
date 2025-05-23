export const SIMULATOR_CONFIG = {
  url: import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:4000',

  endpoints: {
    experiments: '/api/experiments',
    experimentById: '/api/experiments',
  },

  requestConfig: {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  },
}

export default SIMULATOR_CONFIG
