import React from 'react'
import { Play, Pause } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface MapPlaybackOverlayProps {
  progress: number
  progressLabel: string
  startLabel: string
  endLabel: string
  isPlaying: boolean
  onTogglePlayback: () => void
  disabled?: boolean
  extraControl?: React.ReactNode
}

export const MapPlaybackOverlay: React.FC<MapPlaybackOverlayProps> = ({
  progress,
  progressLabel,
  startLabel,
  endLabel,
  isPlaying,
  onTogglePlayback,
  disabled,
  extraControl,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  const progressPositionStyle = (() => {
    if (clampedProgress <= 10) {
      return { left: '0', right: 'auto', transform: 'none' as const }
    }
    if (clampedProgress >= 90) {
      return { left: 'auto', right: '0', transform: 'none' as const }
    }
    return {
      left: `${clampedProgress}%`,
      right: 'auto',
      transform: 'translateX(-50%)' as const,
    }
  })()

  return (
    <div className="absolute bottom-2 left-2 right-2 bg-black/20 rounded-lg p-2">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {extraControl}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="bg-white/90 text-gray-800 hover:bg-white h-8 w-8"
                onClick={onTogglePlayback}
                disabled={disabled}
              >
                {isPlaying ? (
                  <Pause className="h-3 w-3" fill="currentColor" />
                ) : (
                  <Play className="h-3 w-3" fill="currentColor" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPlaying ? 'Pausa uppspelning' : 'Starta uppspelning'}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1 pt-8">
          <div className="space-y-2 relative">
            <div className="relative">
              <Slider
                value={[clampedProgress]}
                max={100}
                step={1}
                disabled
                className="w-full [&_[data-slot=track]]:bg-telge-ljusgra [&_[data-slot=range]]:!bg-telge-telgerod [&_[data-slot=thumb]]:!border-telge-telgerod [&_[data-slot=thumb]]:!bg-telge-ljusgra"
              />
              <div
                className="absolute -top-8 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none transition-all duration-75 ease-linear"
                style={progressPositionStyle}
              >
                {progressLabel}
              </div>
            </div>

            <div className="flex justify-between text-xs text-white">
              <span>{startLabel}</span>
              <span>{endLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
