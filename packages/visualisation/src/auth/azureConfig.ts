import { Configuration, PublicClientApplication } from '@azure/msal-browser'

const defaultRedirectUri =
  typeof window !== 'undefined' && window.location
    ? window.location.origin
    : undefined

const rawClientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID
const clientId = rawClientId || ''
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID
const redirectUri =
  import.meta.env.VITE_AZURE_AD_REDIRECT_URI || defaultRedirectUri

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : undefined,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
}

const scopeSetting = import.meta.env.VITE_AZURE_AD_SCOPES

export const loginRequest = {
  scopes:
    typeof scopeSetting === 'string' && scopeSetting.trim().length > 0
      ? scopeSetting
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : ['User.Read'],
}

export const msalInstance = new PublicClientApplication(msalConfig)

export const isAzureADConfigured = Boolean(rawClientId)
