import { Card, CardContent } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { MapStatus } from '@/hooks/useMapStatus'

interface StatusMessage {
  type: 'error' | 'warning' | 'success' | 'info' | 'loading'
  message: string
  icon: string
}

interface MapStatusCardProps {
  status: MapStatus
  statusMessage: StatusMessage
  isConnected: boolean
  socketError?: string | null
}

const getStatusColor = (type: StatusMessage['type'], isReplayMode: boolean) => {
  switch (type) {
    case 'error':
      return 'border-l-red-500 bg-red-50'
    case 'warning':
      return 'border-l-orange-500 bg-orange-50'
    case 'success':
      return isReplayMode ? 'border-l-orange-500' : 'border-l-telge-bla'
    case 'loading':
      return 'border-l-blue-500 bg-blue-50'
    default:
      return 'border-l-gray-400'
  }
}

const getStatusDotColor = (
  type: StatusMessage['type'],
  timeRunning: boolean
) => {
  if (type === 'error') return 'bg-red-500'
  if (type === 'warning') return 'bg-orange-500'
  if (type === 'loading') return 'bg-blue-500 animate-pulse'
  if (type === 'success') {
    return timeRunning ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
  }
  return 'bg-gray-400'
}

export const MapStatusCard = ({
  status,
  statusMessage,
  isConnected,
  socketError,
}: MapStatusCardProps) => {
  const isReplayMode = status.mode === 'replay'
  const displayError = status.error || socketError
  const finalMessage = displayError
    ? { type: 'error' as const, message: displayError, icon: '❌' }
    : statusMessage

  return (
    <Card
      className={`border-l-4 ${getStatusColor(
        finalMessage.type,
        isReplayMode
      )}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div
              className={`w-3 h-3 rounded-full ${getStatusDotColor(
                finalMessage.type,
                status.timeRunning
              )}`}
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg">{finalMessage.icon}</span>
                <p className="font-medium">{finalMessage.message}</p>
              </div>

              {status.experimentId && (
                <p className="text-sm text-muted-foreground mt-1">
                  Experiment: {status.experimentId}
                </p>
              )}

              {status.sessionId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Session: {status.sessionId}
                </p>
              )}

              {status.running && !displayError && (
                <p className="text-sm text-muted-foreground mt-1">
                  Hastighet: {status.timeSpeed}x | Tid:{' '}
                  {status.timeRunning ? 'Körs' : 'Pausad'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center space-x-2 ${
                !isConnected ? 'text-red-500' : 'text-green-500'
              }`}
            >
              <Activity size={16} />
              <span className="text-sm">
                {isConnected ? 'Ansluten' : 'Frånkopplad'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
