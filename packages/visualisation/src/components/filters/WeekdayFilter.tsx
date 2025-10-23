
import React, { useRef, useState } from 'react';
import { FilterButton } from '@/components/ui/filter-button';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Check, X } from 'lucide-react';
import { useFilterPreview } from '@/hooks/useFilterPreview';

interface WeekdayFilterProps {
  data: any;
  selectedWeekdays: string[];
  onWeekdayChange: (weekdayId: string, checked: boolean) => void;
  onClearAllWeekdays?: () => void;
}

const WeekdayFilter: React.FC<WeekdayFilterProps> = ({
  data,
  selectedWeekdays,
  onWeekdayChange,
  onClearAllWeekdays
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [preventOpen, setPreventOpen] = useState(false);
  const options = data?.settings?.veckodagar || [];

  const { getDisplayText } = useFilterPreview({
    selectedValues: selectedWeekdays,
    options,
    placeholder: "Alla veckodagar",
    containerRef: buttonRef
  });

  const hasActiveFilters = selectedWeekdays.length > 0;

  const handleClearPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setPreventOpen(true);
  };

  const clearFilter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsOpen(false);

    if (onClearAllWeekdays) {
      onClearAllWeekdays();
    } else {
      selectedWeekdays.forEach(weekdayId => {
        onWeekdayChange(weekdayId, false);
      });
    }

    setPreventOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="weekday">Veckodag</Label>
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
              {options.map((weekday: any) => (
                <DropdownMenuCheckboxItem
                  key={weekday.ID}
                  checked={selectedWeekdays.includes(weekday.ID)}
                  onCheckedChange={(checked) => onWeekdayChange(weekday.ID, checked)}
                  className="cursor-pointer hover:bg-[hsl(var(--accent))] !important focus:bg-[hsl(var(--accent))] !important"
                >
                  {weekday.BESKRIVNING}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default WeekdayFilter;
