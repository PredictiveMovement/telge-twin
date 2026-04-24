const fetchRouteDataMock = jest.fn()
const exportRouteDataMock = jest.fn()
const getExperimentMock = jest.fn()
const getVroomPlansByIdsMock = jest.fn()

jest.mock('../../web/services/TelgeApiService', () => ({
  fetchRouteData: (...args: unknown[]) => fetchRouteDataMock(...args),
  exportRouteData: (...args: unknown[]) => exportRouteDataMock(...args),
}))

jest.mock('../../web/services/ElasticsearchService', () => ({
  elasticsearchService: {
    getExperiment: (...args: unknown[]) => getExperimentMock(...args),
    getVroomPlansByIds: (...args: unknown[]) => getVroomPlansByIdsMock(...args),
  },
}))

import express from 'express'
import request from 'supertest'
import telgeRouter from '../../web/routes/http/telge'

const app = express()
app.use(express.json())
app.use('/telge', telgeRouter)

describe('GET /telge/routedata', () => {
  beforeEach(() => {
    fetchRouteDataMock.mockReset()
  })

  it('returns 400 when from date is missing', async () => {
    const res = await request(app).get('/telge/telge/routedata')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when from date has invalid format', async () => {
    const res = await request(app).get('/telge/telge/routedata?from=20240115')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when to date has invalid format', async () => {
    const res = await request(app).get(
      '/telge/telge/routedata?from=2024-01-15&to=baddate'
    )
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 200 with data on success', async () => {
    const data = [{ id: 1 }, { id: 2 }]
    fetchRouteDataMock.mockResolvedValue(data)

    const res = await request(app).get(
      '/telge/telge/routedata?from=2024-01-15&to=2024-01-16'
    )
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(data)
    expect(fetchRouteDataMock).toHaveBeenCalledWith('2024-01-15', '2024-01-16')
  })

  it('returns 400 when fetchRouteData throws VALIDATION error', async () => {
    fetchRouteDataMock.mockRejectedValue(
      new Error('VALIDATION: bad input')
    )

    const res = await request(app).get(
      '/telge/telge/routedata?from=2024-01-15'
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 when fetchRouteData throws CONFIG error', async () => {
    fetchRouteDataMock.mockRejectedValue(
      new Error('CONFIG: credentials missing')
    )

    const res = await request(app).get(
      '/telge/telge/routedata?from=2024-01-15'
    )
    expect(res.status).toBe(500)
  })

  it('returns 502 for upstream/unknown errors', async () => {
    fetchRouteDataMock.mockRejectedValue(
      new Error('UPSTREAM: connection failed')
    )

    const res = await request(app).get(
      '/telge/telge/routedata?from=2024-01-15'
    )
    expect(res.status).toBe(502)
  })
})

describe('POST /telge/export', () => {
  beforeEach(() => {
    exportRouteDataMock.mockReset()
    getExperimentMock.mockReset()
    getVroomPlansByIdsMock.mockReset()
  })

  it('returns 400 when experimentId is missing', async () => {
    const res = await request(app)
      .post('/telge/telge/export')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 404 when experiment is not found', async () => {
    getExperimentMock.mockResolvedValue(null)

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'nonexistent' })
    expect(res.status).toBe(404)
  })

  it('returns 404 when experiment has no vroomTruckPlanIds', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Test',
      vroomTruckPlanIds: [],
    })

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1' })
    expect(res.status).toBe(404)
  })

  it('returns 404 when vehicleId filter has no matches', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Test',
      vroomTruckPlanIds: ['plan-1'],
    })
    getVroomPlansByIdsMock.mockResolvedValue([
      { truckId: 'truck-A', completePlan: [] },
    ])

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1', vehicleId: 'truck-NONEXISTENT' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no exportable route data is found', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Test',
      vroomTruckPlanIds: ['plan-1'],
    })
    getVroomPlansByIdsMock.mockResolvedValue([
      {
        truckId: 'truck-A',
        completePlan: [{ booking: {} }], // no originalRouteRecord
      },
    ])

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1' })
    expect(res.status).toBe(400)
  })

  it('exports single vehicle with tourName as Turid', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Tur 42',
      vroomTruckPlanIds: ['plan-1'],
    })
    getVroomPlansByIdsMock.mockResolvedValue([
      {
        truckId: 'truck-A',
        completePlan: [
          { booking: { originalRouteRecord: { Kundnr: '100' } } },
          { booking: { originalRouteRecord: { Kundnr: '200' } } },
        ],
      },
    ])
    exportRouteDataMock.mockResolvedValue({ success: true })

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.tours).toHaveLength(1)
    expect(res.body.data.tours[0].tourName).toBe('Tur 42')
    expect(res.body.data.tours[0].exportedRows).toBe(2)

    const exportedRows = exportRouteDataMock.mock.calls[0][0]
    expect(exportedRows[0].Turid).toBe('Tur 42')
    expect(exportedRows[0].Turordningsnr).toBe(1)
    expect(exportedRows[1].Turordningsnr).toBe(2)
  })

  it('exports multi vehicle with "tourName - Bil X" as Turid', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Tur 42',
      vroomTruckPlanIds: ['plan-1', 'plan-2'],
    })
    getVroomPlansByIdsMock.mockResolvedValue([
      {
        truckId: 'truck-A',
        completePlan: [
          { booking: { originalRouteRecord: { Kundnr: '100' } } },
        ],
      },
      {
        truckId: 'truck-B',
        completePlan: [
          { booking: { originalRouteRecord: { Kundnr: '200' } } },
        ],
      },
    ])
    exportRouteDataMock.mockResolvedValue({ success: true })

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1' })

    expect(res.status).toBe(200)
    expect(res.body.data.tours).toHaveLength(2)
    expect(res.body.data.tours[0].tourName).toBe('Tur 42 - Bil truck-A')
    expect(res.body.data.tours[1].tourName).toBe('Tur 42 - Bil truck-B')
  })

  it('assigns sequential Turordningsnr per plan', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Tour',
      vroomTruckPlanIds: ['plan-1'],
    })
    getVroomPlansByIdsMock.mockResolvedValue([
      {
        truckId: 'truck-A',
        completePlan: [
          { booking: { originalRouteRecord: { Kundnr: 'a' } } },
          { booking: {} }, // no originalRouteRecord — skipped
          { booking: { originalRouteRecord: { Kundnr: 'b' } } },
          { booking: { originalRouteRecord: { Kundnr: 'c' } } },
        ],
      },
    ])
    exportRouteDataMock.mockResolvedValue({})

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1' })

    expect(res.status).toBe(200)
    const rows = exportRouteDataMock.mock.calls[0][0]
    expect(rows).toHaveLength(3)
    expect(rows.map((r: any) => r.Turordningsnr)).toEqual([1, 2, 3])
  })

  it('returns 502 when exportRouteData throws', async () => {
    getExperimentMock.mockResolvedValue({
      name: 'Tour',
      vroomTruckPlanIds: ['plan-1'],
    })
    getVroomPlansByIdsMock.mockResolvedValue([
      {
        truckId: 'truck-A',
        completePlan: [
          { booking: { originalRouteRecord: { Kundnr: '100' } } },
        ],
      },
    ])
    exportRouteDataMock.mockRejectedValue(
      new Error('UPSTREAM: connection refused')
    )

    const res = await request(app)
      .post('/telge/telge/export')
      .send({ experimentId: 'exp-1' })

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
  })
})

export {}
