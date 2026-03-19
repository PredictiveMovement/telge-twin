import React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Truck, ChevronDown } from 'lucide-react'

interface FackOverride {
  vehicleId: string
  fackNumber: number
  allowedWasteTypes: string[]
}

interface VehicleInfo {
  originalId: string
  description: string
  fackDetails: Array<{
    fackNumber: number
    avfallstyper: Array<{ avftyp: string; beskrivning?: string | null }>
  }>
}

interface AvfOption {
  ID: string
  BESKRIVNING: string
}

interface RouteBooking {
  Bil?: string
  Avftyp?: string
}

interface VehicleSettingsSectionProps {
  vehicles: VehicleInfo[]
  wasteTypesPerVehicle: Map<string, AvfOption[]>
  fackOverrides: FackOverride[]
  onFackOverridesChange: React.Dispatch<React.SetStateAction<FackOverride[]>>
  routeData?: RouteBooking[]
}

function getSelectedTypes(
  vehicle: VehicleInfo,
  fackNumber: number,
  overrides: FackOverride[]
): string[] {
  const override = overrides.find(
    (o) => o.vehicleId === vehicle.originalId && o.fackNumber === fackNumber
  )
  if (override) return override.allowedWasteTypes

  const fack = vehicle.fackDetails.find((f) => f.fackNumber === fackNumber)
  return (fack?.avfallstyper || []).map((a) => a.avftyp)
}

function getLabel(
  selectedTypes: string[],
  options: AvfOption[]
): string {
  if (selectedTypes.length === 0) return 'Välj avfallstyp'
  const names = selectedTypes
    .map((id) => options.find((o) => o.ID === id)?.BESKRIVNING || id)
  if (names.length <= 2) return names.join(', ')
  return `${names[0]} +${names.length - 1}`
}

function countUnmatchedBookings(
  vehicle: VehicleInfo,
  overrides: FackOverride[],
  routeData: RouteBooking[]
): number {
  const bookings = routeData.filter((r) => r.Bil === vehicle.originalId && r.Avftyp)
  if (!bookings.length) return 0

  // Collect all allowed waste types across all facks (with overrides applied)
  const allAllowed = new Set<string>()
  for (const fack of vehicle.fackDetails) {
    const types = getSelectedTypes(vehicle, fack.fackNumber, overrides)
    types.forEach((t) => allAllowed.add(t))
  }

  return bookings.filter((b) => !allAllowed.has(b.Avftyp!)).length
}

const VehicleSettingsSection: React.FC<VehicleSettingsSectionProps> = ({
  vehicles,
  wasteTypesPerVehicle,
  fackOverrides,
  onFackOverridesChange,
  routeData = [],
}) => {
  if (!vehicles.length) return null

  const handleToggleWasteType = (
    vehicle: VehicleInfo,
    fackNumber: number,
    avftyp: string,
  ) => {
    onFackOverridesChange((prev) => {
      const currentTypes = getSelectedTypes(vehicle, fackNumber, prev)
      const isSelected = currentTypes.includes(avftyp)
      const newTypes = isSelected
        ? currentTypes.filter((t) => t !== avftyp)
        : [...currentTypes, avftyp]

      const existing = prev.filter(
        (o) => !(o.vehicleId === vehicle.originalId && o.fackNumber === fackNumber)
      )
      return [
        ...existing,
        { vehicleId: vehicle.originalId, fackNumber, allowedWasteTypes: newTypes },
      ]
    })
  }

  return (
    <div className="space-y-5 rounded-xl bg-muted/50 p-6">
      <div>
        <h3 className="text-lg font-semibold">Fordonsinställningar</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Anpassa vilken avfallstyp som sorteras i varje fack
        </p>
      </div>

      {vehicles.map((vehicle) => {
        const fackCount = vehicle.fackDetails.length
        if (fackCount === 0) return null

        const options = wasteTypesPerVehicle.get(vehicle.originalId) || []

        return (
          <div key={vehicle.originalId} className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>
                <span className="font-semibold">Fordon {vehicle.originalId}</span>
                {'  '}
                <span className="text-muted-foreground">
                  ({fackCount}-fack)
                </span>
              </span>
            </div>

            {(() => {
              const unmatched = countUnmatchedBookings(vehicle, fackOverrides, routeData)
              return unmatched > 0 ? (
                <p className="text-sm text-orange-600">
                  {unmatched} bokning{unmatched !== 1 ? 'ar' : ''} utan matchande fack
                </p>
              ) : null
            })()}

            <div className="grid grid-cols-2 gap-3">
              {vehicle.fackDetails.map((fack) => {
                const selectedTypes = getSelectedTypes(
                  vehicle,
                  fack.fackNumber,
                  fackOverrides
                )

                // Merge fack's configured waste types into route-based options
                const fackOptions = [...options]
                for (const a of fack.avfallstyper) {
                  if (!fackOptions.some((o) => o.ID === a.avftyp)) {
                    fackOptions.push({
                      ID: a.avftyp,
                      BESKRIVNING: a.beskrivning || a.avftyp,
                    })
                  }
                }

                return (
                  <div
                    key={fack.fackNumber}
                    className="space-y-2 rounded-lg border bg-white p-3"
                  >
                    <span className="text-sm font-medium">
                      Fack {fack.fackNumber}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <span className="truncate">
                            {getLabel(selectedTypes, fackOptions)}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-2" align="start">
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {fackOptions.map((a) => (
                            <label
                              key={a.ID}
                              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedTypes.includes(a.ID)}
                                onCheckedChange={() =>
                                  handleToggleWasteType(
                                    vehicle,
                                    fack.fackNumber,
                                    a.ID,
                                  )
                                }
                              />
                              {a.BESKRIVNING}
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default VehicleSettingsSection
