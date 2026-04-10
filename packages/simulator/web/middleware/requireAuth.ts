import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { Request, Response, NextFunction } from 'express'

const TENANT_ID = process.env.AZURE_AD_TENANT_ID
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS() {
  if (!TENANT_ID) throw new Error('AZURE_AD_TENANT_ID is not configured')
  if (!jwks) {
    const url = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`
    jwks = createRemoteJWKSet(new URL(url))
  }
  return jwks
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

export const isAuthConfigured = Boolean(TENANT_ID && CLIENT_ID)

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJWKS(), {
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audience: CLIENT_ID,
  })
  return payload
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!isAuthConfigured) return next()

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' })
  }

  try {
    req.user = await verifyToken(header.slice(7))
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
