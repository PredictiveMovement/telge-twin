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

interface ServiceTypeFilterSingleProps {
  data: any
  selectedServiceType: string
  onServiceTypeChange: (serviceTypeId: string) => void
}

const ServiceTypeFilterSingle: React.FC<ServiceTypeFilterSingleProps> = ({
  data,
  selectedServiceType,
  onServiceTypeChange,
}) => {
  const getSelectedServiceTypeText = () => {
    if (!selectedServiceType) return 'Alla tjänstetyper'
    const type = data?.settings?.tjtyper?.find(
      (t: any) => t.ID === selectedServiceType
    )
    return type?.BESKRIVNING || 'Välj tjänstetyp'
  }

  const getButtonClassName = (hasActiveFilter: boolean) => {
    if (hasActiveFilter) {
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
            variant="outline"
            className={getButtonClassName(!!selectedServiceType)}
          >
            <div className="flex items-center gap-2">
              {selectedServiceType && (
                <Check className="h-4 w-4 text-green-600" />
              )}
              {getSelectedServiceTypeText()}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full bg-popover">
          <DropdownMenuRadioGroup
            value={selectedServiceType}
            onValueChange={onServiceTypeChange}
          >
            <DropdownMenuRadioItem value="">
              Alla tjänstetyper
            </DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {data?.settings?.tjtyper?.map((type: any) => (
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

export default ServiceTypeFilterSingle
