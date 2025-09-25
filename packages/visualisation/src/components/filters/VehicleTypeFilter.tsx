
import React, { useRef, useState } from 'react';
import { FilterButton } from '@/components/ui/filter-button';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, X } from 'lucide-react';
import { useFilterPreview } from '@/hooks/useFilterPreview';

interface VehicleTypeFilterProps {
  data: any;
  selectedVehicleTypes: string[];
  onVehicleTypeChange: (vehicleTypeId: string, checked: boolean) => void;
  onClearAllVehicleTypes?: () => void;
}

const VehicleTypeFilter: React.FC<VehicleTypeFilterProps> = ({
  data,
  selectedVehicleTypes,
  onVehicleTypeChange,
  onClearAllVehicleTypes
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [preventOpen, setPreventOpen] = useState(false);
  const options = data?.settings?.vehicleTypes || [];

  const { getDisplayText } = useFilterPreview({
    selectedValues: selectedVehicleTypes,
    options,
    placeholder: "Alla fordonstyper",
    containerRef: buttonRef
  });

  const hasActiveFilters = selectedVehicleTypes.length > 0;

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setPreventOpen(true);
    setIsOpen(false);
    
    if (onClearAllVehicleTypes) {
      // Use dedicated clear function if provided
      onClearAllVehicleTypes();
    } else {
      // Fallback to individual clearing for backward compatibility
      selectedVehicleTypes.forEach(vehicleTypeId => {
        onVehicleTypeChange(vehicleTypeId, false);
      });
    }
    
    // Reset prevent flag after a short delay
    setTimeout(() => setPreventOpen(false), 100);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="vehicleType">Fordonstyp</Label>
      <div className="relative">
        <DropdownMenu 
          open={isOpen} 
          onOpenChange={(open) => {
            if (!preventOpen) {
              setIsOpen(open);
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <FilterButton 
              ref={buttonRef}
              variant={hasActiveFilters ? "outline-active" : "outline"}
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
                  <button
                    onClick={clearFilter}
                    className="h-4 w-4 text-[#F57D5B] hover:bg-[#F57D5B]/10 rounded cursor-pointer flex items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </div>
            </FilterButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[300px] bg-white border border-gray-200 shadow-lg z-50" align="start">
            <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
              {options.map((type: any) => (
                <DropdownMenuCheckboxItem
                  key={type.ID}
                  checked={selectedVehicleTypes.includes(type.ID)}
                  onCheckedChange={(checked) => onVehicleTypeChange(type.ID, checked)}
                  className="cursor-pointer hover:bg-[hsl(var(--accent))] !important focus:bg-[hsl(var(--accent))] !important"
                >
                  {type.BESKRIVNING}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default VehicleTypeFilter;
