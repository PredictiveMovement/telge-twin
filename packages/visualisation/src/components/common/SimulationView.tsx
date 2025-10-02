import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WifiOff, AlertTriangle, Play, Square } from 'lucide-react'
import Map from '@/components/Map'
import * as simulator from '@/api/simulator'
import { useSimulationSession } from '@/hooks/useSimulationSession'

interface SimulationViewProps {
  title: string
  type: 'replay' | 'sequential'
  datasetId: string
  experimentId?: string
  areaPartitions?: simulator.AreaPartition[]
}

const SimulationView: React.FC<SimulationViewProps> = ({
  title,
  type,
  datasetId,
  experimentId,
  areaPartitions,
}) => {
  const {
    cars,
    bookings,
    isRunning,
    isTimeRunning,
    timeSpeed,
    virtualTime,
    error,
    isConnected,
    vroomPlan,
    start,
    stop,
    play,
    pause,
    setSpeed,
  } = useSimulationSession({
    type,
    datasetId,
    experimentId,
  })

  const displayError = !isConnected ? 'Ingen anslutning till servern.' : error

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {isRunning && (
            <div className="text-sm text-gray-600 mt-1">
              Simulering:{' '}
              {type === 'replay' ? 'VROOM Optimerad' : 'Sekventiell'}
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          {!isRunning ? (
            <Button onClick={start} disabled={!isConnected || isRunning}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive">
              <Square className="mr-2 h-4 w-4" /> Stoppa
            </Button>
          )}
        </div>
      </div>

      {displayError && (
        <Alert variant="destructive">
          {!isConnected && <WifiOff className="h-4 w-4" />}
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <Card className="relative h-[400px] overflow-hidden">
        <CardContent className="absolute inset-0 p-0">
          <Map
            cars={cars}
            bookings={bookings}
            isSimulationRunning={isRunning}
            isConnected={isConnected}
            isTimeRunning={isTimeRunning}
            timeSpeed={timeSpeed}
            virtualTime={virtualTime}
            onPlayTime={play}
            onPauseTime={pause}
            onSpeedChange={setSpeed}
            areaPartitions={areaPartitions}
            vroomPlan={vroomPlan as any}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default SimulationView
