import fetch from 'node-fetch'

type TokenInfo = { accessToken: string; expiresAt: number }

let tokenCache: TokenInfo | null = null

const getEnv = () => ({
  baseUrl: process.env.TELGE_API_BASE_URL || 'https://thorapimobile.telge.se',
  username: process.env.TELGE_API_USERNAME || '',
  password: process.env.TELGE_API_PASSWORD || '',
})

async function fetchToken(): Promise<TokenInfo> {
  const { baseUrl, username, password } = getEnv()
  if (!username || !password) {
    throw new Error(
      'CONFIG: TELGE_API_USERNAME or TELGE_API_PASSWORD not configured'
    )
  }

  const url = `${baseUrl}/apiRutt/token`
  const body = new URLSearchParams()
  body.set('grant_type', 'password')
  body.set('username', username)
  body.set('password', password)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`UPSTREAM: Failed to get token (${res.status}): ${text}`)
  }

  const json: any = await res.json()
  const accessToken: string = json.access_token || json.token || ''
  if (!accessToken)
    throw new Error('UPSTREAM: Token response missing access_token')
  const expiresIn: number = Number(json.expires_in || 3600)
  const expiresAt = Date.now() + Math.max(60, expiresIn - 30) * 1000
  return { accessToken, expiresAt }
}

async function getValidToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt)
    return tokenCache.accessToken
  tokenCache = await fetchToken()
  return tokenCache.accessToken
}

export async function fetchTelgeRouteData(from: string, to?: string): Promise<any[]> {
  const fromDate = from
  const toDate = to || from
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    throw new Error('VALIDATION: Invalid from date format, expected YYYY-MM-DD')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error('VALIDATION: Invalid to date format, expected YYYY-MM-DD')
  }
  
  const { baseUrl } = getEnv()
  const token = await getValidToken()
  const encodedFrom = encodeURIComponent(fromDate)
  const encodedTo = encodeURIComponent(toDate)
  const url = `${baseUrl}/apiRutt/ruttoptimering/routedata/${encodedFrom}/${encodedTo}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `UPSTREAM: Failed to fetch route data (${res.status}): ${text}`
    )
  }
  const json = await res.json().catch(() => [])
  if (Array.isArray(json)) return json
  if (json && Array.isArray((json as any).data)) return (json as any).data
  if (json && Array.isArray((json as any).routeData))
    return (json as any).routeData
  return []
}

export function resetTelgeToken() {
  tokenCache = null
}
