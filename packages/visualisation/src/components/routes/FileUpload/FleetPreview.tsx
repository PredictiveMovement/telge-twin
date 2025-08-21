import { Badge } from '@/components/ui/badge'
import { generateFleetsAndBookings } from '@/utils/fleetGenerator'

interface FleetPreviewProps {
  routeData: any[]
  settings: any
}

export function FleetPreview({ routeData, settings }: FleetPreviewProps) {
  const fleets = generateFleetsAndBookings(routeData, settings).fleets

  if (!fleets.length) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
        Inga flottor kunde genereras från den filtrerade datan.
      </div>
    )
  }

  const totalBookings = routeData.length
  const assignedBookings = fleets.reduce(
    (sum, fleet) => sum + fleet.bookingCount,
    0
  )
  const isComplete = assignedBookings === totalBookings

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-green-800">
            {fleets.length} Avfallstyp-baserade Fleets
          </span>
          <span className="text-green-600">
            {assignedBookings}/{totalBookings} bokningar täckta
            <Badge
              variant={isComplete ? 'default' : 'destructive'}
              className="ml-2"
            >
              {isComplete ? '✓ Komplett' : '⚠ Ofullständig'}
            </Badge>
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {fleets.map((fleet, index) => (
          <div
            key={index}
            className="p-3 bg-blue-50 rounded-lg border border-blue-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  {fleet.name}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {fleet.source}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  {fleet.bookingCount} bokningar
                </Badge>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">📦 Avfallstyp:</span>
                <div className="flex gap-1 flex-wrap">
                  {fleet.recyclingTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="px-1 py-0 text-xs"
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">
                  🚛 Fordon ({fleet.vehicles.length}):
                </span>
                <div className="flex gap-1 flex-wrap">
                  {fleet.vehicles.slice(0, 4).map((vehicle) => (
                    <Badge
                      key={vehicle.originalId}
                      variant="outline"
                      className="px-1 py-0 text-xs"
                      title={`${vehicle.description} (${vehicle.type})`}
                    >
                      {vehicle.originalId}
                    </Badge>
                  ))}
                  {fleet.vehicles.length > 4 && (
                    <span className="text-xs text-gray-500">
                      +{fleet.vehicles.length - 4} fler
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-blue-200">
                <span className="font-medium">🏗️ Fordonstyper:</span>
                <span className="text-xs">
                  {Object.entries(
                    fleet.vehicles.reduce(
                      (counts: Record<string, number>, vehicle) => {
                        counts[vehicle.type] = (counts[vehicle.type] || 0) + 1
                        return counts
                      },
                      {}
                    )
                  )
                    .map(([type, count]) => `${count}x ${type}`)
                    .join(', ')}
                </span>
              </div>

              {fleet.vehicles.length > 0 && (
                <div className="pt-2 border-t border-blue-200">
                  <span className="font-medium text-xs">
                    📋 Fordonsdetaljer:
                  </span>
                  <div className="mt-1 space-y-2">
                    {fleet.vehicles.map((vehicle) => (
                      <div
                        key={vehicle.originalId}
                        className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2"
                      >
                        <div className="font-medium text-gray-700">
                          {vehicle.originalId}: {vehicle.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {[
                            vehicle.weight > 0 && `Vikt: ${vehicle.weight}kg`,
                            vehicle.parcelCapacity > 0 &&
                              `Kapacitet: ${vehicle.parcelCapacity}`,
                            vehicle.usageCount > 0 &&
                              `Användning: ${vehicle.usageCount} gånger`,
                          ]
                            .filter(Boolean)
                            .join(' | ')}
                        </div>

                        {vehicle.fackDetails &&
                          vehicle.fackDetails.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <span className="font-medium text-xs text-gray-600">
                                🗂️ Fackdetaljer:
                              </span>
                              {vehicle.fackDetails.map((fack) => (
                                <div
                                  key={fack.fackNumber}
                                  className="ml-2 p-1 bg-gray-50 rounded text-xs"
                                >
                                  <div className="font-medium">
                                    Fack {fack.fackNumber}
                                  </div>
                                  {fack.volym && (
                                    <div>Volym: {fack.volym}L</div>
                                  )}
                                  {fack.vikt && <div>Vikt: {fack.vikt}kg</div>}
                                  <div className="mt-1">
                                    {fack.avfallstyper.map((waste, idx) => (
                                      <div
                                        key={idx}
                                        className="text-xs text-gray-600"
                                      >
                                        <span className="font-medium">
                                          {waste.avftyp}
                                        </span>
                                        {waste.volymvikt &&
                                          ` (${waste.volymvikt} kg/m³)`}
                                        {waste.fyllnadsgrad &&
                                          ` - ${waste.fyllnadsgrad}% fyllning`}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
