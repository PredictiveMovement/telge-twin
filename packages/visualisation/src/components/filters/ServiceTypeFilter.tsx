import React, { useMemo, useRef, useState } from 'react'
import { FilterButton } from '@/components/ui/filter-button'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Check, X } from 'lucide-react'
import { useFilterPreview } from '@/hooks/useFilterPreview'

interface ServiceTypeFilterProps {
  data: any
  selectedServiceTypes: string[]
  onServiceTypeChange: (serviceTypeId: string, checked: boolean) => void
  onClearAllServiceTypes?: () => void
}

const ServiceTypeFilter: React.FC<ServiceTypeFilterProps> = ({
  data,
  selectedServiceTypes,
  onServiceTypeChange,
  onClearAllServiceTypes,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [preventOpen, setPreventOpen] = useState(false)

  const rawServiceTypes = useMemo(() => data?.settings?.tjtyper || [], [data?.settings?.tjtyper])

  const previewOptions = useMemo(() => {
    const optionMap = new Map<string, string>()

    rawServiceTypes.forEach((type: any) => {
      const identifier = type?.ID ?? type?.BESKRIVNING
      const display = type?.BESKRIVNING ?? type?.ID
      if (identifier) optionMap.set(String(identifier), String(display ?? identifier))
      if (display) optionMap.set(String(display), String(display))
    })

    return Array.from(optionMap.entries()).map(([id, label]) => ({
      ID: id,
      BESKRIVNING: label,
    }))
  }, [rawServiceTypes])

  const { getDisplayText } = useFilterPreview({
    selectedValues: selectedServiceTypes,
    options: previewOptions,
    placeholder: 'Alla tjänstetyper',
    containerRef: buttonRef,
  })

  const selectedLookup = useMemo(
    () => new Set(selectedServiceTypes.map((value) => String(value))),
    [selectedServiceTypes]
  )

  const hasActiveFilters = selectedServiceTypes.length > 0

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    setPreventOpen(true)
    setIsOpen(false)

    if (onClearAllServiceTypes) {
      onClearAllServiceTypes()
    } else {
      rawServiceTypes.forEach((type: any) => {
        const display = type?.BESKRIVNING ?? type?.ID
        const identifier = type?.ID ?? display
        if (!display || !identifier) return
        if (
          selectedLookup.has(String(display)) ||
          selectedLookup.has(String(identifier))
        ) {
          onServiceTypeChange(String(identifier), false)
        }
      })
    }

    setTimeout(() => setPreventOpen(false), 100)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="serviceType">Tjänstetyp</Label>
      <div className="relative">
        <DropdownMenu
          open={isOpen}
          onOpenChange={(open) => {
            if (!preventOpen) {
              setIsOpen(open)
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <FilterButton
              ref={buttonRef}
              variant={hasActiveFilters ? 'outline-active' : 'outline'}
              className="w-full h-[42px] justify-between hover:bg-[#fafafa] pr-2"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {hasActiveFilters && (
                  <Check className="h-4 w-4 text-[#F57D5B] flex-shrink-0" />
                )}
                <span className="truncate">{getDisplayText()}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {hasActiveFilters && (
                  <div
                    onClick={clearFilter}
                    className="h-4 w-4 text-[#F57D5B] hover:bg-[#F57D5B]/10 rounded cursor-pointer flex items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </div>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </div>
            </FilterButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[300px] bg-white border border-gray-200 shadow-lg z-50" align="start">
            <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
              {rawServiceTypes.map((type: any) => {
                const display = type?.BESKRIVNING ?? type?.ID
                const identifier = type?.ID ?? display
                if (!display || !identifier) return null
                const isChecked =
                  selectedLookup.has(String(display)) ||
                  selectedLookup.has(String(identifier))

                return (
                  <DropdownMenuCheckboxItem
                    key={String(identifier)}
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      onServiceTypeChange(String(identifier), checked)
                    }
                    className="cursor-pointer hover:bg-[hsl(var(--accent))] !important focus:bg-[hsl(var(--accent))] !important"
                  >
                    <span>{display}</span>
                  </DropdownMenuCheckboxItem>
                )
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default ServiceTypeFilter
