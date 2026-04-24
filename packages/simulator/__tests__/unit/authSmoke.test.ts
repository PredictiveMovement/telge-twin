const jwtVerifyMock = jest.fn()
const createRemoteJWKSetMock = jest.fn()

jest.mock('jose', () => ({
  __esModule: true,
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
  createRemoteJWKSet: (...args: unknown[]) => createRemoteJWKSetMock(...args),
}))

// Stub out route dependencies that touch Elasticsearch, experiments, etc.
jest.mock('../../web/services/ElasticsearchService', () => ({
  elasticsearchService: {
    getExperiment: jest.fn(),
    getVroomPlansByIds: jest.fn(),
    listExperiments: jest.fn().mockResolvedValue([]),
    listDatasets: jest.fn().mockResolvedValue([]),
  },
}))
jest.mock('../../web/controllers/ExperimentController', () => ({
  experimentController: {
    currentGlobalExperiment: null,
    isGlobalRunning: false,
    sessions: new Map(),
  },
}))
jest.mock('../../web/controllers/SocketController', () => ({
  socketController: {},
}))
jest.mock('../../lib/elastic', () => ({ search: jest.fn() }))
jest.mock('../../lib/virtualTime', () => ({
  virtualTime: { reset: jest.fn() },
}))

const FAKE_TENANT = 'fake-tenant-id'
const FAKE_CLIENT = 'fake-client-id'
const originalEnv = { ...process.env }

import express from 'express'
import request from 'supertest'

describe('auth smoke tests (auth configured)', () => {
  let app: express.Express

  beforeAll(() => {
    process.env.AZURE_AD_TENANT_ID = FAKE_TENANT
    process.env.AZURE_AD_CLIENT_ID = FAKE_CLIENT
    jest.resetModules()

    const { requireAuth } = require('../../web/middleware/requireAuth')
    const telgeRouter = require('../../web/routes/http/telge').default
    const experimentsRouter =
      require('../../web/routes/http/experiments').default

    app = express()
    app.use(express.json())

    app.use('/api', requireAuth)
    app.use('/api', telgeRouter)
    app.use('/api', experimentsRouter)

    app.get('/', (_req: any, res: any) => {
      res.status(200).send('PM Digital Twin Engine. Status: OK')
    })
  })

  beforeEach(() => {
    jwtVerifyMock.mockReset()
    createRemoteJWKSetMock.mockReset()
  })

  afterAll(() => {
    process.env = originalEnv
    jest.resetModules()
  })

  it('GET / (health check) does not require auth', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Status: OK')
  })

  it('GET /api/telge/routedata returns 401 without token', async () => {
    const res = await request(app).get('/api/telge/routedata?from=2024-01-15')
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Authorization')
  })

  it('GET /api/telge/routedata passes auth with valid token', async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: 'user-1' } })
    createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

    const res = await request(app)
      .get('/api/telge/routedata?from=2024-01-15')
      .set('Authorization', 'Bearer valid.token')

    // Should pass auth (get 400/200/502 from route handler, not 401)
    expect(res.status).not.toBe(401)
  })
})

export {}
