import React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Check } from 'lucide-react'

interface VehicleFilterProps {
  data: any
  selectedVehicles: string[]
  onVehicleChange: (vehicleId: string, checked: boolean) => void
}

const VehicleFilter: React.FC<VehicleFilterProps> = ({
  data,
  selectedVehicles,
  onVehicleChange,
}) => {
  const getSelectedVehicleText = () => {
    if (selectedVehicles.length === 0) return 'Alla fordon'
    if (selectedVehicles.length === 1) {
      const vehicle = data?.settings?.bilar?.find(
        (v: any) => v.ID === selectedVehicles[0]
      )
      return vehicle?.BESKRIVNING || 'Välj fordon'
    }
    return `${selectedVehicles.length} valda`
  }

  const getButtonVariant = (hasActiveFilters: boolean): 'outline' => {
    return 'outline'
  }

  const getButtonClassName = (hasActiveFilters: boolean) => {
    if (hasActiveFilters) {
      return 'w-full justify-between hover:bg-[hsl(var(--muted))] bg-white border-primary border-2'
    }
    return 'w-full justify-between hover:bg-[hsl(var(--muted))]'
  }

  return (
    <div>
      <Label htmlFor="vehicle">Fordon</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={getButtonVariant(selectedVehicles.length > 0)}
            className={getButtonClassName(selectedVehicles.length > 0)}
          >
            <div className="flex items-center gap-2">
              {selectedVehicles.length > 0 && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {getSelectedVehicleText()}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full bg-popover">
          {data?.settings?.bilar
            ?.filter((vehicle: any) => vehicle.ID !== '--')
            ?.sort((a: any, b: any) =>
              a.ID.localeCompare(b.ID, undefined, {
                numeric: true,
                sensitivity: 'base',
              })
            )
            ?.map((vehicle: any) => (
              <DropdownMenuCheckboxItem
                key={vehicle.ID}
                checked={selectedVehicles.includes(vehicle.ID)}
                onCheckedChange={(checked) =>
                  onVehicleChange(vehicle.ID, checked)
                }
              >
                <span className="mr-3">{vehicle.ID}</span>
                <span>{vehicle.BESKRIVNING}</span>
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default VehicleFilter
