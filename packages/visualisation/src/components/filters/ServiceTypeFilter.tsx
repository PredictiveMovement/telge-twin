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

interface ServiceTypeFilterProps {
  data: any
  selectedServiceTypes: string[]
  onServiceTypeChange: (serviceTypeId: string, checked: boolean) => void
}

const ServiceTypeFilter: React.FC<ServiceTypeFilterProps> = ({
  data,
  selectedServiceTypes,
  onServiceTypeChange,
}) => {
  const getSelectedServiceTypeText = () => {
    if (selectedServiceTypes.length === 0) return 'Alla tjänstetyper'
    if (selectedServiceTypes.length === 1) {
      const type = data?.settings?.tjtyper?.find(
        (t: any) => t.ID === selectedServiceTypes[0]
      )
      return type?.BESKRIVNING || 'Välj tjänstetyp'
    }
    return `${selectedServiceTypes.length} valda`
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
      <Label htmlFor="serviceType">Tjänstetyp</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={getButtonVariant(selectedServiceTypes.length > 0)}
            className={getButtonClassName(selectedServiceTypes.length > 0)}
          >
            <div className="flex items-center gap-2">
              {selectedServiceTypes.length > 0 && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {getSelectedServiceTypeText()}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full bg-popover">
          {data?.settings?.tjtyper?.map((type: any) => (
            <DropdownMenuCheckboxItem
              key={type.ID}
              checked={selectedServiceTypes.includes(type.ID)}
              onCheckedChange={(checked) =>
                onServiceTypeChange(type.ID, checked)
              }
            >
              {type.BESKRIVNING}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default ServiceTypeFilter
