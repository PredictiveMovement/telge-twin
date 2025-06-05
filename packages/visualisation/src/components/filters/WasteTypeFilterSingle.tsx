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

interface WasteTypeFilterSingleProps {
  data: any
  selectedWasteType: string
  onWasteTypeChange: (wasteTypeId: string) => void
}

const WasteTypeFilterSingle: React.FC<WasteTypeFilterSingleProps> = ({
  data,
  selectedWasteType,
  onWasteTypeChange,
}) => {
  const getSelectedWasteTypeText = () => {
    if (!selectedWasteType) return 'Alla avfallstyper'
    const type = data?.settings?.avftyper?.find(
      (t: any) => t.ID === selectedWasteType
    )
    return type?.BESKRIVNING || 'Välj avfallstyp'
  }

  const getButtonClassName = (hasActiveFilter: boolean) => {
    if (hasActiveFilter) {
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
            variant="outline"
            className={getButtonClassName(!!selectedWasteType)}
          >
            <div className="flex items-center gap-2">
              {selectedWasteType && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {getSelectedWasteTypeText()}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full bg-popover">
          <DropdownMenuRadioGroup
            value={selectedWasteType}
            onValueChange={onWasteTypeChange}
          >
            <DropdownMenuRadioItem value="">
              Alla avfallstyper
            </DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {data?.settings?.avftyper?.map((type: any) => (
              <DropdownMenuRadioItem key={type.ID} value={type.ID}>
                {type.BESKRIVNING}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default WasteTypeFilterSingle
