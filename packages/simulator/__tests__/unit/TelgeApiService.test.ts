const fetchMock = jest.fn()

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fetchMock(...args),
}))

import {
  fetchTelgeRouteData,
  resetTelgeToken,
} from '../../web/services/TelgeApiService'

const originalEnv = { ...process.env }

const createResponse = (overrides: Partial<Response> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '',
  ...overrides,
})

describe('TelgeApiService', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    resetTelgeToken()
    process.env = {
      ...originalEnv,
      TELGE_API_BASE_URL: 'https://example.com',
      TELGE_API_USERNAME: 'user',
      TELGE_API_PASSWORD: 'pass',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('rejects invalid date format', async () => {
    await expect(fetchTelgeRouteData('20240115')).rejects.toThrow(
      /Invalid from date format/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when credentials are missing', async () => {
    process.env.TELGE_API_USERNAME = ''
    process.env.TELGE_API_PASSWORD = ''

    await expect(fetchTelgeRouteData('2024-01-15')).rejects.toThrow(
      /TELGE_API_USERNAME or TELGE_API_PASSWORD/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates token fetch error', async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({
        ok: false,
        status: 401,
        text: async () => 'unauthorised',
      })
    )

    await expect(fetchTelgeRouteData('2024-01-15')).rejects.toThrow(
      /Failed to get token \(401\): unauthorised/
    )
  })

  it('propagates route fetch error', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'token', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 502,
          text: async () => 'bad gateway',
        })
      )

    await expect(fetchTelgeRouteData('2024-01-15')).rejects.toThrow(
      /Failed to fetch route data \(502\): bad gateway/
    )
  })

  it('returns array data from API response', async () => {
    const sampleData = [{ id: 1 }, { id: 2 }]
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'token', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          json: async () => sampleData,
        })
      )

    await expect(fetchTelgeRouteData('2024-01-15')).resolves.toEqual(sampleData)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
