import { useEffect, useState, type ReactNode } from 'react'
import {
  InteractionType,
  EventType,
  type AuthenticationResult,
} from '@azure/msal-browser'
import {
  MsalProvider,
  MsalAuthenticationTemplate,
  type MsalAuthenticationResult,
} from '@azure/msal-react'
import { loginRequest, msalInstance, isAzureADConfigured } from './azureConfig'
import { AuthLoading, AuthMessage } from '../components/auth'

let msalEventCallbackId: string | undefined

if (!msalEventCallbackId) {
  msalEventCallbackId = msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const authResult = event.payload as AuthenticationResult
      if (authResult.account) {
        msalInstance.setActiveAccount(authResult.account)
      }
    }
  })
}

export function AzureAuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const prepareInstance = async () => {
      if (!isAzureADConfigured) {
        if (isMounted) setIsReady(true)
        return
      }

      try {
        await msalInstance.initialize()
        const existingAccounts = msalInstance.getAllAccounts()
        if (existingAccounts.length > 0) {
          msalInstance.setActiveAccount(existingAccounts[0])
        }
      } catch (error) {
        console.error('MSAL initialization failed', error)
      } finally {
        if (isMounted) {
          setIsReady(true)
        }
      }
    }

    prepareInstance()

    return () => {
      isMounted = false
    }
  }, [])

  if (!isAzureADConfigured) {
    return <>{children}</>
  }

  if (!isReady) {
    return <AuthLoading />
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthGuard>{children}</AuthGuard>
    </MsalProvider>
  )
}

function AuthGuard({ children }: { children: ReactNode }) {
  const ErrorComponent = ({ error }: MsalAuthenticationResult) => (
    <AuthMessage
      variant="error"
      title="Inloggning misslyckades"
      message={error?.message || 'Ett fel uppstod. Försök igen senare.'}
    />
  )

  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
      loadingComponent={AuthLoading}
      errorComponent={ErrorComponent}
    >
      {children}
    </MsalAuthenticationTemplate>
  )
}
