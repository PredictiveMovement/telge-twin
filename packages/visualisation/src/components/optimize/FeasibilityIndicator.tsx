import React, { useState } from 'react'
import { Clock, CheckCircle, AlertTriangle, ChevronDown, Truck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeasibilityResult, VehicleFeasibility } from '@/utils/feasibilityEstimate'
import { formatMinutes } from '@/utils/feasibilityEstimate'

interface FeasibilityIndicatorProps {
  result: FeasibilityResult | null
  loading?: boolean
}

const statusConfig: Record<
  VehicleFeasibility['status'],
  {
    bar: string
    track: string
    border: string
    bg: string
    text: string
    icon: typeof CheckCircle
  }
> = {
  fits: {
    bar: 'bg-telge-ljusgron',
    track: 'bg-telge-ljusgron/20',
    border: 'border-telge-ljusgron/40',
    bg: 'bg-telge-ljusgron/10',
    text: 'text-telge-morkgron',
    icon: CheckCircle,
  },
  tight: {
    bar: 'bg-telge-morkgul',
    track: 'bg-telge-ljusgul/30',
    border: 'border-telge-ljusgul',
    bg: 'bg-telge-ljusgul/15',
    text: 'text-telge-morkgul',
    icon: Clock,
  },
  overflows: {
    bar: 'bg-telge-morkrod',
    track: 'bg-telge-ljusrod/30',
    border: 'border-telge-ljusrod',
    bg: 'bg-telge-ljusrod/20',
    text: 'text-telge-morkrod',
    icon: AlertTriangle,
  },
}

const FeasibilityIndicator: React.FC<FeasibilityIndicatorProps> = ({
  result,
  loading,
}) => {
  const [expanded, setExpanded] = useState(true)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Beräknar tidsuppskattning…</span>
      </div>
    )
  }

  if (!result || result.vehicles.length === 0) {
    return null
  }

  const { summary, vehicles } = result
  const allFit = summary.overflows === 0 && summary.tight === 0
  const hasOverflows = summary.overflows > 0

  const summaryText = allFit
    ? 'Fordonet bedöms ha hunnit hämta allt under den ursprungliga arbetstiden'
    : hasOverflows
      ? 'Fordonet bedöms inte ha hunnit hämta allt under den ursprungliga arbetstiden'
      : 'Fordonet bedöms ha haft svårt att hinna hämta allt under den ursprungliga arbetstiden'

  const summaryStatus = allFit ? 'fits' : hasOverflows ? 'overflows' : 'tight'
  const SummaryIcon = statusConfig[summaryStatus].icon

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tidsuppskattning för fordon</span>
        {vehicles.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {expanded ? 'Dölj' : 'Visa detaljer'}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                expanded && 'rotate-180'
              )}
            />
          </button>
        )}
      </div>

      {/* Vehicle details */}
      {(expanded || vehicles.length <= 3) && (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <VehicleRow key={v.vehicleId} vehicle={v} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3">
        <SummaryIcon
          className={cn('h-4 w-4', statusConfig[summaryStatus].text)}
        />
        <span
          className={cn(
            'text-sm font-medium',
            statusConfig[summaryStatus].text
          )}
        >
          {summaryText}
        </span>
      </div>
    </div>
  )
}

const VehicleRow: React.FC<{ vehicle: VehicleFeasibility }> = ({
  vehicle,
}) => {
  const config = statusConfig[vehicle.status]
  const fillPercent = Math.min(100, vehicle.utilizationPercent)

  return (
    <div
      className={cn(
        'rounded-md border p-3 flex items-center gap-3',
        config.border,
        config.bg
      )}
    >
      <div className="flex items-center gap-2 w-[80px] flex-shrink-0">
        <Truck className={cn('h-4 w-4 flex-shrink-0', config.text)} />
        <span className={cn('text-sm font-medium truncate', config.text)}>
          {vehicle.vehicleId}
        </span>
      </div>

      <div
        className={cn(
          'flex-1 h-2 rounded-full overflow-hidden',
          config.track
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all', config.bar)}
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      <span
        className={cn(
          'text-sm font-medium tabular-nums w-[36px] text-right flex-shrink-0',
          config.text
        )}
      >
        {vehicle.utilizationPercent}%
      </span>

      <div className="flex items-center gap-2 w-[110px] justify-end flex-shrink-0">
        <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="text-sm leading-none text-muted-foreground tabular-nums">
          {formatMinutes(vehicle.estimatedMinutes)} / {formatMinutes(vehicle.availableMinutes)}
        </span>
      </div>

    </div>
  )
}

export default FeasibilityIndicator
