const fetchMock = jest.fn()

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fetchMock(...args),
}))

import {
  fetchRouteData,
  exportRouteData,
  resetToken,
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
    resetToken()
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
    await expect(fetchRouteData('20240115')).rejects.toThrow(
      /Invalid from date format/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when credentials are missing', async () => {
    process.env.TELGE_API_USERNAME = ''
    process.env.TELGE_API_PASSWORD = ''

    await expect(fetchRouteData('2024-01-15')).rejects.toThrow(
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

    await expect(fetchRouteData('2024-01-15')).rejects.toThrow(
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

    await expect(fetchRouteData('2024-01-15')).rejects.toThrow(
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

    await expect(fetchRouteData('2024-01-15')).resolves.toEqual(sampleData)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reuses cached token for second call within TTL', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'cached-tok', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({ json: async () => [{ id: 1 }] })
      )
      .mockResolvedValueOnce(
        createResponse({ json: async () => [{ id: 2 }] })
      )

    await fetchRouteData('2024-01-15')
    await fetchRouteData('2024-01-16')

    // token fetch once + two route data fetches = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // both route requests used the cached token
    const authHeader1 = fetchMock.mock.calls[1][1].headers.Authorization
    const authHeader2 = fetchMock.mock.calls[2][1].headers.Authorization
    expect(authHeader1).toBe('Bearer cached-tok')
    expect(authHeader2).toBe('Bearer cached-tok')
  })

  it('fetches a new token after resetToken()', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'tok-1', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({ json: async () => [{ id: 1 }] })
      )

    await fetchRouteData('2024-01-15')
    resetToken()

    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'tok-2', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({ json: async () => [{ id: 2 }] })
      )

    await fetchRouteData('2024-01-16')

    // 2 token fetches + 2 route fetches = 4
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const authHeader2 = fetchMock.mock.calls[3][1].headers.Authorization
    expect(authHeader2).toBe('Bearer tok-2')
  })

  it('fetches a new token after cache expires', async () => {
    const realDateNow = Date.now
    let now = 1000000

    Date.now = () => now

    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'old-tok', expires_in: 60 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({ json: async () => [{ id: 1 }] })
      )

    await fetchRouteData('2024-01-15')

    // advance past the expiry (60s - 30s buffer = 30s minimum, so advance 31s)
    now += 61 * 1000

    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'new-tok', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({ json: async () => [{ id: 2 }] })
      )

    await fetchRouteData('2024-01-16')

    // 2 token fetches + 2 route fetches = 4
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const authHeader2 = fetchMock.mock.calls[3][1].headers.Authorization
    expect(authHeader2).toBe('Bearer new-tok')

    Date.now = realDateNow
  })
})

describe('exportRouteData', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    resetToken()
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

  it('throws on empty rows array', async () => {
    await expect(exportRouteData([])).rejects.toThrow(
      /No route data rows to export/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts rows to routedatasave endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'token', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ success: true }),
        })
      )

    const rows = [{ Turid: 'test', Turordningsnr: 1 }]
    await exportRouteData(rows)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('https://example.com/apiRutt/ruttoptimering/routedatasave')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual(rows)
  })

  it('throws on upstream HTTP error', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          json: async () => ({ access_token: 'token', expires_in: 3600 }),
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 500,
          text: async () => 'internal error',
        })
      )

    await expect(
      exportRouteData([{ Turid: 'test' }])
    ).rejects.toThrow(/Failed to export route data \(500\): internal error/)
  })
})
