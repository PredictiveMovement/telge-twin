
import React, { useRef, useState } from 'react';
import { FilterButton } from '@/components/ui/filter-button';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, X } from 'lucide-react';
import { useFilterPreview } from '@/hooks/useFilterPreview';

interface MultipleSelectFilterProps {
  data: any;
  selectedValues: string[];
  onValueChange: (valueId: string, checked: boolean) => void;
  onClearAll?: () => void;
  label: string;
  placeholder?: string;
  dataKey: string;
}

const MultipleSelectFilter: React.FC<MultipleSelectFilterProps> = ({
  data,
  selectedValues = [],
  onValueChange,
  onClearAll,
  label,
  placeholder = "Alla",
  dataKey
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [preventOpen, setPreventOpen] = useState(false);
  
  // Safe access to data with fallback to empty array - check both structures
  const options = data?.settings?.[dataKey] || data?.[dataKey] || [];

  const { getDisplayText } = useFilterPreview({
    selectedValues,
    options,
    placeholder,
    containerRef: buttonRef
  });

  const hasActiveFilters = selectedValues?.length > 0;

  const handleClearPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setPreventOpen(true);
  };

  const clearFilter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);

    if (onClearAll) {
      onClearAll();
    } else {
      selectedValues.forEach(valueId => {
        onValueChange(valueId, false);
      });
    }

    setPreventOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={dataKey}>{label}</Label>
      <div className="relative">
        <DropdownMenu 
          open={isOpen} 
          onOpenChange={(open) => {
            if (preventOpen) {
              setPreventOpen(false);
              return;
            }
            setIsOpen(open);
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
                  <div
                    onPointerDown={handleClearPointerDown}
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
              {options.map((option: any) => (
                <DropdownMenuCheckboxItem
                  key={option.ID}
                  checked={selectedValues?.includes(option.ID) || false}
                  onCheckedChange={(checked) => onValueChange(option.ID, checked)}
                  className="cursor-pointer hover:bg-[hsl(var(--accent))] !important focus:bg-[hsl(var(--accent))] !important"
                >
                  <div className="flex items-center gap-3">
                    <span>{option.ID}</span>
                    <span className="text-gray-500 text-sm">{option.BESKRIVNING}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default MultipleSelectFilter;
