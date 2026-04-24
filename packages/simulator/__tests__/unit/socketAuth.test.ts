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

function createSocketMock(token?: string) {
  return {
    handshake: {
      auth: token !== undefined ? { token } : {},
    },
    data: {},
  } as any
}

describe('socketAuth middleware', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    jwtVerifyMock.mockReset()
    createRemoteJWKSetMock.mockReset()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
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

      const { socketAuth } = require('../../web/middleware/socketAuth')
      const socket = createSocketMock()
      const next = jest.fn()

      await socketAuth(socket, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith()
      expect(jwtVerifyMock).not.toHaveBeenCalled()
    })
  })

  describe('when auth IS configured', () => {
    let socketAuth: any

    beforeEach(() => {
      jest.resetModules()
      process.env.AZURE_AD_TENANT_ID = FAKE_TENANT
      process.env.AZURE_AD_CLIENT_ID = FAKE_CLIENT

      socketAuth = require('../../web/middleware/socketAuth').socketAuth
    })

    it('calls next with Error when token is missing', async () => {
      const socket = createSocketMock()
      const next = jest.fn()

      await socketAuth(socket, next)

      expect(next).toHaveBeenCalledTimes(1)
      const err = next.mock.calls[0][0]
      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe('Missing token')
    })

    it('calls next() without error and sets socket.data.user for a valid token', async () => {
      const fakePayload = { sub: 'user-1', preferred_username: 'alice@example.com' }
      jwtVerifyMock.mockResolvedValue({ payload: fakePayload })
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      const socket = createSocketMock('valid.jwt.token')
      const next = jest.fn()

      await socketAuth(socket, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith()
      expect(socket.data.user).toEqual(fakePayload)
    })

    it('calls next with Error when token is invalid', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('token expired'))
      createRemoteJWKSetMock.mockReturnValue('mock-jwks-fn')

      const socket = createSocketMock('bad.jwt.token')
      const next = jest.fn()

      await socketAuth(socket, next)

      expect(next).toHaveBeenCalledTimes(1)
      const err = next.mock.calls[0][0]
      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe('Invalid or expired token')
    })
  })
})

export {}
