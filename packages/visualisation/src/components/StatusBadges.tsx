import React from 'react'
import { Badge } from '@/components/ui/badge'

interface StatusBadgesProps {
  sessionId?: string | null
  mode: 'global' | 'replay' | 'idle'
  experimentId?: string | null
}

const StatusBadges: React.FC<StatusBadgesProps> = ({
  sessionId,
  mode,
  experimentId,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {sessionId && (
        <Badge variant="outline" className="bg-telge-ljusgul text-telge-gul">
          Session: {sessionId.slice(-8)}
        </Badge>
      )}
      <Badge
        variant={
          mode === 'global'
            ? 'default'
            : mode === 'replay'
            ? 'secondary'
            : 'outline'
        }
        className={
          mode === 'global'
            ? 'bg-telge-telgegron text-white'
            : mode === 'replay'
            ? 'bg-amber-500 text-amber-900'
            : 'bg-gray-300 text-gray-600'
        }
      >
        {mode === 'global'
          ? 'Global'
          : mode === 'replay'
          ? 'Replay'
          : 'Inaktiv'}
      </Badge>
      {experimentId && (
        <Badge variant="outline" className="bg-telge-ljusbla text-telge-bla">
          Experiment: {experimentId}
        </Badge>
      )}
    </div>
  )
}

export default StatusBadges
