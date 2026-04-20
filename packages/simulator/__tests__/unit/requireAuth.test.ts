const jwtVerifyMock = jest.fn()
const createRemoteJWKSetMock = jest.fn()

jest.mock('jose', () => ({
  __esModule: true,
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
  createRemoteJWKSet: (...args: unknown[]) => createRemoteJWKSetMock(...args),
}))

const FAKE_TENANT = 'fake-tenant-id'
const FAKE_CLIENT = 'fake-client-id'

const originalEnv = { ...process.env }

function createReqResMock(authHeader?: string) {
  const req = {
    headers: { authorization: authHeader },
    user: undefined,
  } as any

  const jsonMock = jest.fn()
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock })
  const res = { status: statusMock } as any
  const next = jest.fn()

  return { req, res, next, statusMock, jsonMock }
}

describe('requireAuth middleware', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jwtVerifyMock.mockReset()
    createRemoteJWKSetMock.mockReset()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('when auth is NOT configured', () => {
    it('calls next() without checking the token', async () => {
      delete process.env.AZURE_AD_TENANT_ID
      delete process.env.AZURE_AD_CLIENT_ID

      const { requireAuth, isAuthConfigured } = require(
        '../../web/middleware/requireAuth'
      )

      expect(isAuthConfigured).toBe(false)

      const { req, res, next } = createReqResMock()

      await requireAuth(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(res.status).not.toHaveBeenCalled()
      expect(jwtVerifyMock).not.toHaveBeenCalled()
    })
  })

  describe('when auth IS configured', () => {
    let requireAuth: any
    let verifyToken: any
    let isAuthConfigured: boolean

    beforeEach(() => {
      jest.resetModules()
      process.env.AZURE_AD_TENANT_ID = FAKE_TENANT
      process.env.AZURE_AD_CLIENT_ID = FAKE_CLIENT

      const mod = require('../../web/middleware/requireAuth')
      requireAuth = mod.requireAuth
      verifyToken = mod.verifyToken
      isAuthConfigured = mod.isAuthConfigured
    })

    it('exports isAuthConfigured as true', () => {
      expect(isAuthConfigured).toBe(true)
    })

    it('returns 401 when Authorization header is missing', async () => {
      const { req, res, next, statusMock, jsonMock } = createReqResMock()

      await requireAuth(req, res, next)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing or malformed Authorization header',
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when Authorization header lacks Bearer prefix', async () => {
      const { req, res, next, statusMock, jsonMock } =
        createReqResMock('Basic abc123')

      await requireAuth(req, res, next)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing or malformed Authorization header',
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('sets req.user and calls next() for a valid token', async () => {
      const fakePayload = {
        sub: 'user-123',
        preferred_username: 'alice@example.com',
        iss: `https://login.microsoftonline.com/${FAKE_TENANT}/v2.0`,
        aud: FAKE_CLIENT,
      }
      jwtVerifyMock.mockResolvedValue({ payload: fakePayload })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      const { req, res, next } = createReqResMock('Bearer valid.jwt.token')

      await requireAuth(req, res, next)

      expect(req.user).toEqual(fakePayload)
      expect(next).toHaveBeenCalledTimes(1)
      expect(res.status).not.toHaveBeenCalled()
    })

    it('returns 401 when jwtVerify throws', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('token expired'))
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      const { req, res, next, statusMock, jsonMock } =
        createReqResMock('Bearer expired.jwt.token')

      await requireAuth(req, res, next)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('strips Bearer prefix before passing to jwtVerify', async () => {
      const fakePayload = { sub: 'user-1' }
      jwtVerifyMock.mockResolvedValue({ payload: fakePayload })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      const { req, res, next } = createReqResMock('Bearer my.actual.token')

      await requireAuth(req, res, next)

      expect(jwtVerifyMock).toHaveBeenCalledWith(
        'my.actual.token',
        expect.anything(),
        expect.objectContaining({
          issuer: `https://login.microsoftonline.com/${FAKE_TENANT}/v2.0`,
          audience: FAKE_CLIENT,
        })
      )
    })
  })

  describe('verifyToken', () => {
    let verifyToken: any

    beforeEach(() => {
      jest.resetModules()
      process.env.AZURE_AD_TENANT_ID = FAKE_TENANT
      process.env.AZURE_AD_CLIENT_ID = FAKE_CLIENT

      const mod = require('../../web/middleware/requireAuth')
      verifyToken = mod.verifyToken
    })

    it('calls jwtVerify with correct issuer and audience', async () => {
      const fakePayload = { sub: 'user-42', name: 'Test User' }
      jwtVerifyMock.mockResolvedValue({ payload: fakePayload })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      await verifyToken('some.jwt.token')

      expect(jwtVerifyMock).toHaveBeenCalledWith(
        'some.jwt.token',
        'mock-jwks-fn',
        {
          issuer: `https://login.microsoftonline.com/${FAKE_TENANT}/v2.0`,
          audience: FAKE_CLIENT,
        }
      )
    })

    it('returns the JWT payload on success', async () => {
      const fakePayload = { sub: 'user-42', name: 'Test User', iat: 1700000000 }
      jwtVerifyMock.mockResolvedValue({ payload: fakePayload })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      const result = await verifyToken('valid.token.here')

      expect(result).toEqual(fakePayload)
    })

    it('throws when jwtVerify rejects', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('signature mismatch'))
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      await expect(verifyToken('bad.token')).rejects.toThrow(
        'signature mismatch'
      )
    })

    it('constructs the JWKS URL with the tenant ID', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { sub: '1' } })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      await verifyToken('any.token')

      expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1)
      const urlArg = createRemoteJWKSetMock.mock.calls[0][0]
      expect(urlArg).toBeInstanceOf(URL)
      expect(urlArg.toString()).toBe(
        `https://login.microsoftonline.com/${FAKE_TENANT}/discovery/v2.0/keys`
      )
    })

    it('caches the JWKS across multiple calls', async () => {
      jwtVerifyMock.mockResolvedValue({ payload: { sub: '1' } })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      await verifyToken('token-1')
      await verifyToken('token-2')

      expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1)
      expect(jwtVerifyMock).toHaveBeenCalledTimes(2)
    })

    it('throws when AZURE_AD_TENANT_ID is missing', async () => {
      jest.resetModules()
      delete process.env.AZURE_AD_TENANT_ID
      process.env.AZURE_AD_CLIENT_ID = FAKE_CLIENT

      const mod = require('../../web/middleware/requireAuth')

      await expect(mod.verifyToken('any.token')).rejects.toThrow(
        'AZURE_AD_TENANT_ID is not configured'
      )
    })
  })
})

export {}
