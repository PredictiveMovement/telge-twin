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

interface WasteTypeFilterProps {
  data: any
  selectedWasteTypes: string[]
  onWasteTypeChange: (wasteTypeId: string, checked: boolean) => void
}

const WasteTypeFilter: React.FC<WasteTypeFilterProps> = ({
  data,
  selectedWasteTypes,
  onWasteTypeChange,
}) => {
  const getSelectedWasteTypeText = () => {
    if (selectedWasteTypes.length === 0) return 'Alla avfallstyper'
    if (selectedWasteTypes.length === 1) {
      const type = data?.settings?.avftyper?.find(
        (t: any) => t.ID === selectedWasteTypes[0]
      )
      return type?.BESKRIVNING || 'Välj avfallstyp'
    }
    return `${selectedWasteTypes.length} valda`
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
      <Label htmlFor="wasteType">Välj avfallstyp</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={getButtonVariant(selectedWasteTypes.length > 0)}
            className={getButtonClassName(selectedWasteTypes.length > 0)}
          >
            <div className="flex items-center gap-2">
              {selectedWasteTypes.length > 0 && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {getSelectedWasteTypeText()}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full bg-popover">
          {data?.settings?.avftyper?.map((type: any) => (
            <DropdownMenuCheckboxItem
              key={type.ID}
              checked={selectedWasteTypes.includes(type.ID)}
              onCheckedChange={(checked) => onWasteTypeChange(type.ID, checked)}
            >
              {type.BESKRIVNING}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default WasteTypeFilter
