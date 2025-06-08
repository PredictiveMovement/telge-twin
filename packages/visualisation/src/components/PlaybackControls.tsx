import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Play, Pause, Gauge, Plus, Minus } from 'lucide-react'

interface PlaybackControlsProps {
  isPlaying: boolean
  speed: number
  onPlay: () => void
  onPause: () => void
  onSpeedChange: (speed: number) => void
  disabled?: boolean
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  speed,
  onPlay,
  onPause,
  onSpeedChange,
  disabled = false,
}) => {
  const [showSpeedControl, setShowSpeedControl] = useState(false)
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null)

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause()
    } else {
      onPlay()
    }
  }

  const speedSteps = [1, 10, 20, 30, 60, 120, 300, 600, 900]

  const handleSpeedIncrease = () => {
    const nextSpeed = speedSteps.find((step) => step > speed)
    if (nextSpeed) {
      onSpeedChange(nextSpeed)
    }
  }

  const handleSpeedDecrease = () => {
    const lowerSpeedSteps = speedSteps.filter((step) => step < speed)
    const prevSpeed = lowerSpeedSteps[lowerSpeedSteps.length - 1]

    if (prevSpeed) {
      onSpeedChange(prevSpeed)
    }
  }

  const formatSpeed = (value: number) => {
    if (value <= 1) return 'Mycket långsam'
    if (value <= 10) return 'Långsam'
    if (value <= 30) return 'Normal'
    if (value <= 60) return 'Snabb'
    if (value <= 120) return 'Mycket snabb'
    if (value <= 300) return 'Extrem'
    return 'Maximal'
  }

  const handleMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      setHideTimeout(null)
    }
    setShowSpeedControl(true)
  }

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowSpeedControl(false)
    }, 300)
    setHideTimeout(timeout)
  }

  React.useEffect(() => {
    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
      }
    }
  }, [hideTimeout])

  return (
    <TooltipProvider>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col items-end gap-2">
          {showSpeedControl && (
            <Card className="mb-2 border-2 border-primary/20">
              <CardContent className="p-3">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs font-medium">Hastighet</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSpeedDecrease}
                      disabled={disabled || speed <= speedSteps[0]}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="text-sm font-mono min-w-[3rem] text-center">
                      {speed}x
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSpeedIncrease}
                      disabled={
                        disabled || speed >= speedSteps[speedSteps.length - 1]
                      }
                    >
                      <Plus size={12} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatSpeed(speed)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlayPause}
                  disabled={disabled}
                  className="bg-white shadow-lg border-2"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPlaying ? 'Pausa simulering' : 'Starta simulering'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white shadow-lg border-2 pointer-events-auto cursor-help"
                >
                  <Gauge size={14} className="mr-1" />
                  <span className="text-xs font-mono">{speed}x</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hastighet: {formatSpeed(speed)}</p>
                <p className="text-xs">Hover för att ändra</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default PlaybackControls
