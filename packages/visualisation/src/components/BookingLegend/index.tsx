import { RotateCcw, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { Badge } from '../ui/badge'
import { LegendItem } from './LegendItem'
import { useBookingFilters } from './hooks/useBookingFilters'
import { useBookingStats } from './hooks/useBookingStats'
import { BookingLegendProps } from './types'

export default function BookingLegend({
  bookings,
  filters,
  onFiltersChange,
  isVisible,
}: BookingLegendProps) {
  const { toggleRecyclingType, toggleStatus, resetFilters, hasActiveFilters } =
    useBookingFilters(filters, onFiltersChange)

  const { recyclingTypes, statuses, total, visible } = useBookingStats(
    bookings,
    filters
  )

  if (!isVisible) return null

  return (
    <Card className="w-80 backdrop-blur-sm bg-background/95 border border-border shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-base">Återvinningstyper</h3>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-7 px-2 text-xs"
              aria-label="Återställ alla filter"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Återställ
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Klicka för att filtrera kartan
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Material
          </h4>
          <div className="space-y-1">
            {recyclingTypes.map((type) => (
              <LegendItem
                key={type.id}
                item={type}
                onClick={() => toggleRecyclingType(type.id)}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Status
          </h4>
          <div className="space-y-1">
            {statuses.map((status) => (
              <LegendItem
                key={status.id}
                item={status}
                onClick={() => toggleStatus(status.id)}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Visar bokningar:</span>
          <div className="flex items-center gap-2">
            <Badge variant={hasActiveFilters ? 'default' : 'secondary'}>
              {visible.toLocaleString()}
            </Badge>
            <span className="text-muted-foreground">av</span>
            <Badge variant="outline">{total.toLocaleString()}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
