import React, { useState, useRef } from 'react';
import { Check, Search, ChevronDown, X } from 'lucide-react';
import { FilterButton } from '@/components/ui/filter-button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFilterPreview } from '@/hooks/useFilterPreview';

interface TuridFilterProps {
  data: any;
  selectedTurids: string[];
  onTuridChange: (turidId: string, checked: boolean) => void;
  onClearAllTurids?: () => void;
}

const TuridFilter: React.FC<TuridFilterProps> = ({
  data,
  selectedTurids,
  onTuridChange,
  onClearAllTurids
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [preventOpen, setPreventOpen] = useState(false);

  const turids = data?.settings?.turids || [];
  
  // Filter turids based on search term
  const filteredTurids = turids.filter((turid: any) =>
    turid.BESKRIVNING.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { getDisplayText } = useFilterPreview({
    selectedValues: selectedTurids,
    options: turids,
    placeholder: "Alla TurID",
    containerRef: buttonRef
  });

  const hasActiveFilters = selectedTurids.length > 0;

  const handleClearPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setPreventOpen(true);
  };

  const clearFilter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsOpen(false);
    
    if (onClearAllTurids) {
      onClearAllTurids();
    } else {
      selectedTurids.forEach(turidId => {
        onTuridChange(turidId, false);
      });
    }
    
    setPreventOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="turid">TurID</Label>
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
          <DropdownMenuContent 
            className="w-[300px] bg-white border border-gray-200 shadow-lg z-50" 
            align="start"
          >
            {/* Search field - sticky at top */}
            <div className="p-3 pb-2 sticky top-0 bg-white z-10 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Sök TurID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Scrollable list */}
            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
              {filteredTurids.length > 0 ? (
                filteredTurids.map((turid: any) => (
                  <DropdownMenuCheckboxItem
                    key={turid.ID}
                    checked={selectedTurids.includes(turid.ID)}
                    onCheckedChange={(checked) => onTuridChange(turid.ID, checked)}
                    className="cursor-pointer hover:bg-[hsl(var(--accent))] !important focus:bg-[hsl(var(--accent))] !important"
                  >
                    <span>{turid.BESKRIVNING}</span>
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Inga TurID hittades
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default TuridFilter;

