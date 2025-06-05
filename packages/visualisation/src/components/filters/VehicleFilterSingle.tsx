import React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Check } from 'lucide-react'

interface VehicleFilterSingleProps {
  data: any
  selectedVehicle: string
  onVehicleChange: (vehicleId: string) => void
}

const VehicleFilterSingle: React.FC<VehicleFilterSingleProps> = ({
  data,
  selectedVehicle,
  onVehicleChange,
}) => {
  const getSelectedVehicleText = () => {
    if (!selectedVehicle) return 'Alla fordon'
    const vehicle = data?.settings?.bilar?.find(
      (v: any) => v.ID === selectedVehicle
    )
    return vehicle?.BESKRIVNING || 'Välj fordon'
  }

  const getButtonClassName = (hasActiveFilter: boolean) => {
    if (hasActiveFilter) {
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
            variant="outline"
            className={getButtonClassName(!!selectedVehicle)}
          >
            <div className="flex items-center gap-2">
              {selectedVehicle && <Check className="h-4 w-4 text-green-600" />}
              {getSelectedVehicleText()}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full bg-popover">
          <DropdownMenuRadioGroup
            value={selectedVehicle}
            onValueChange={onVehicleChange}
          >
            <DropdownMenuRadioItem value="">Alla fordon</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {data?.settings?.bilar
              ?.filter((vehicle: any) => vehicle.ID !== '--')
              ?.sort((a: any, b: any) =>
                a.ID.localeCompare(b.ID, undefined, {
                  numeric: true,
                  sensitivity: 'base',
                })
              )
              ?.map((vehicle: any) => (
                <DropdownMenuRadioItem key={vehicle.ID} value={vehicle.ID}>
                  <span className="mr-3">{vehicle.ID}</span>
                  <span>{vehicle.BESKRIVNING}</span>
                </DropdownMenuRadioItem>
              ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default VehicleFilterSingle
