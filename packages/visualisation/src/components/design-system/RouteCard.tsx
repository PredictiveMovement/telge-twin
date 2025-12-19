import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, Package, Calendar, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getVehicleLabel } from '@/lib/vehicleUtils'
import { cn } from '@/lib/utils'

type FackInfo = {
  number: number
  volume?: number | null
  weight?: number | null
  allowedWasteTypes: string[]
}

interface RouteCardProps {
  title?: string
  vehicleNumber?: string
  vehicleNumbers?: string[]
  wasteTypes?: string[]
  frequency?: string
  bookingsCount?: number
  bookingsMatched?: number
  bookingsTotal?: number
  isSelected?: boolean

  /** Extra info för TurID-kort */
  vehicleDescription?: string
  fack?: FackInfo[] // visar fack-spec om detta finns

  /** Varning om turordning saknas i originaldata */
  missingTurordning?: boolean
}

export const RouteCard = ({
  title = 'HEM23MÅN',
  vehicleNumber = '40',
  vehicleNumbers,
  wasteTypes = ['Hushållsavfall', 'Papper', 'Plast'],
  frequency,
  bookingsCount = 47,
  bookingsMatched,
  bookingsTotal,
  isSelected = false,
  vehicleDescription,
  fack,
  missingTurordning,
}: RouteCardProps) => {
  const displayVehicles = vehicleNumbers || [vehicleNumber]
  const showFack = Array.isArray(fack) && fack.length > 0

  return (
    <Card className={cn(
      "bg-white shadow-none transition-colors duration-300 ring-2",
      isSelected ? "ring-secondary border-transparent" : "ring-transparent"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {missingTurordning && (
            <div
              className="text-amber-500"
              title="Turordning saknas i originaldata. Statistikjämförelse (original vs optimerad) blir ej tillgänglig."
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Avfallstyper */}
        {wasteTypes?.length ? (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {wasteTypes.map((type, index) => (
                <Badge key={index} variant="wasteType" className="text-xs">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Fordonsnummer med fordonstyp */}
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-1">
            {displayVehicles.map((vehicle, index) => (
              <Badge 
                key={index} 
                variant="vehicle" 
                className="text-xs"
                title={vehicleDescription}
              >
                {getVehicleLabel(vehicle)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Frekvens */}
        {frequency && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary" className="bg-telge-ljusrod text-telge-svart text-xs">
              {frequency}
            </Badge>
          </div>
        )}

        {/* Antal bokningar och antal fordon */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Antal bokningar:
            </span>
            <span
              className="text-lg font-normal"
              style={{ color: 'hsl(var(--text-primary))' }}
            >
              {typeof bookingsMatched === 'number' && typeof bookingsTotal === 'number'
                ? `${bookingsMatched}/${bookingsTotal}`
                : bookingsCount}
            </span>
          </div>
          {typeof bookingsMatched === 'number' && typeof bookingsTotal === 'number' && bookingsMatched < bookingsTotal ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Saknar passande fack:</span>
              <span className="text-xs font-medium">{bookingsTotal - bookingsMatched}</span>
            </div>
          ) : null}
          {vehicleNumbers && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Antal fordon:
              </span>
              <span
                className="text-lg font-normal"
                style={{ color: 'hsl(var(--text-primary))' }}
              >
                {vehicleNumbers.length}
              </span>
            </div>
          )}
        </div>

        {/* Fackinformation (endast om fack-objekt skickas in) */}
        {showFack ? (
          <div className="pt-3 border-t border-border">
            <div className="text-sm font-medium mb-2">Fackinformation</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {fack!.map((fx) => (
                <div
                  key={fx.number}
                  className="p-2 bg-muted rounded border border-border"
                >
                  <div className="font-medium text-xs">Fack {fx.number}</div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {typeof fx.volume === 'number' ? (
                      <div>Volym: {fx.volume}</div>
                    ) : null}
                    {typeof fx.weight === 'number' ? (
                      <div>Viktgräns: {fx.weight}</div>
                    ) : null}
                    {fx.allowedWasteTypes?.length ? (
                      <div className="mt-1">
                        <div className="text-xs font-medium text-foreground">
                          Tillåtna avfallstyper
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {fx.allowedWasteTypes.map((t, i) => (
                            <Badge
                              key={`${fx.number}-${t}-${i}`}
                              variant="outline"
                              className="px-1 py-0 text-[10px]"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {vehicleDescription ? (
              <div className="text-xs text-muted-foreground mt-2">
                Fordon: {vehicleDescription}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
