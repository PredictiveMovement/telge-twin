
import React from 'react';
import { Filter } from 'lucide-react';
import FilterConfigurationProvider from '@/components/filters/FilterConfiguration';
import FilterRow from '@/components/filters/FilterRow';

interface RouteFilterPanelProps {
  searchFilters: {
    avfallstyp: string[];
    fordonstyp: string[];
    fordonsnummer: string[];
    tjanstetyp: string[];
    veckodag: string[];
    frekvens: string[];
    datum: string;
  };
  onFilterChange: (filterName: string, value: string) => void;
  activeFilterCount: number;
  avfallstyper: string[];
  vehicleOptions: Array<{
    id: string;
    display: string;
  }>;
  tjanstetyper: string[];
  veckodagar: string[];
  frekvenser: string[];
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  hideHeader?: boolean;
  // New clear functions
  onClearAllWasteTypes?: () => void;
  onClearAllVehicles?: () => void;
  onClearAllVehicleTypes?: () => void;
  onClearAllServiceTypes?: () => void;
  onClearAllWeekdays?: () => void;
  onClearAllFrequencies?: () => void;
}

const RouteFilterPanel: React.FC<RouteFilterPanelProps> = ({
  searchFilters,
  onFilterChange,
  activeFilterCount,
  avfallstyper,
  vehicleOptions,
  tjanstetyper,
  veckodagar,
  frekvenser,
  selectedDate,
  onDateChange,
  hideHeader = false,
  onClearAllWasteTypes,
  onClearAllVehicles,
  onClearAllVehicleTypes,
  onClearAllServiceTypes,
  onClearAllWeekdays,
  onClearAllFrequencies
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // Enhanced date change handler that clears weekday when date is selected
  const handleDateChange = (date: Date | undefined) => {
    onDateChange(date);
    
    // Clear weekday filter when a date is selected
    if (date && searchFilters.veckodag.length > 0) {
      // Clear all weekday selections
      searchFilters.veckodag.forEach(weekday => {
        onFilterChange('veckodag', weekday);
      });
    }
  };

  // Filter change handlers
  const handleWasteTypeChange = (wasteTypeId: string, _checked: boolean) => {
    onFilterChange('avfallstyp', wasteTypeId);
  };

  const handleVehicleChange = (vehicleId: string, _checked: boolean) => {
    onFilterChange('fordonsnummer', vehicleId);
  };

  const handleServiceTypeChange = (serviceTypeId: string, _checked: boolean) => {
    const serviceType = tjanstetyper.find((_, index) => (index + 1).toString() === serviceTypeId);
    if (serviceType) {
      onFilterChange('tjanstetyp', serviceType);
    }
  };

  const handleWeekdayChange = (weekdayId: string, _checked: boolean) => {
    const weekday = veckodagar.find((_, index) => (index + 1).toString() === weekdayId);
    if (weekday) {
      onFilterChange('veckodag', weekday);
    }
  };

  const handleFrequencyChange = (frequencyId: string, _checked: boolean) => {
    const frequency = frekvenser.find((_, index) => (index + 1).toString() === frequencyId);
    if (frequency) {
      onFilterChange('frekvens', frequency);
    }
  };

  const handleVehicleTypeChange = (vehicleTypeId: string, checked: boolean) => {
    const typeName = vehicleTypeId; // IDs are the type names

    // Toggle the type itself
    onFilterChange('fordonstyp', typeName);

    // Helper to extract the type from display string "ID DESCRIPTION"
    const getTypeFromDisplay = (display: string) => {
      const parts = display.split(' ');
      const desc = parts.slice(1).join(' ').trim();
      const tokens = desc.split(' ');
      return tokens[tokens.length - 1] || desc;
    };

    // Find all vehicle IDs matching this type
    const matchingIds = vehicleOptions
      .filter(v => getTypeFromDisplay(v.display) === typeName)
      .map(v => v.id);

    if (checked) {
      // Ensure all matching IDs are selected
      matchingIds
        .filter(id => !searchFilters.fordonsnummer.includes(id))
        .forEach(id => onFilterChange('fordonsnummer', id));
    } else {
      // Remove all matching IDs
      matchingIds
        .filter(id => searchFilters.fordonsnummer.includes(id))
        .forEach(id => onFilterChange('fordonsnummer', id));
    }
  };

  return (
    <div className="mb-6">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-lg font-medium">Filter</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>
      )}
      
      <FilterConfigurationProvider
        avfallstyper={avfallstyper}
        vehicleOptions={vehicleOptions}
        tjanstetyper={tjanstetyper}
        veckodagar={veckodagar}
        frekvenser={frekvenser}
      >
        {(configuration) => (
          <div className="space-y-4">
            {/* Primary filters container */}
            <div className="bg-muted p-6 rounded-lg">
              <FilterRow
                type="primary"
                configuration={configuration}
                searchFilters={searchFilters}
                selectedDate={selectedDate}
                isCalendarOpen={isCalendarOpen}
                setIsCalendarOpen={setIsCalendarOpen}
                onWasteTypeChange={handleWasteTypeChange}
                onVehicleChange={handleVehicleChange}
                onVehicleTypeChange={handleVehicleTypeChange}
                onServiceTypeChange={handleServiceTypeChange}
                onWeekdayChange={handleWeekdayChange}
                onFrequencyChange={handleFrequencyChange}
                onDateChange={handleDateChange}
                onClearAllWasteTypes={onClearAllWasteTypes}
                onClearAllVehicles={onClearAllVehicles}
                onClearAllVehicleTypes={onClearAllVehicleTypes}
                onClearAllServiceTypes={onClearAllServiceTypes}
              />
            </div>

            {/* Secondary filters container */}
            <div className="bg-muted p-6 rounded-lg">
              <FilterRow
                type="secondary"
                configuration={configuration}
                searchFilters={searchFilters}
                selectedDate={selectedDate}
                isCalendarOpen={isCalendarOpen}
                setIsCalendarOpen={setIsCalendarOpen}
                onWasteTypeChange={handleWasteTypeChange}
                onVehicleChange={handleVehicleChange}
                onVehicleTypeChange={handleVehicleTypeChange}
                onServiceTypeChange={handleServiceTypeChange}
                onWeekdayChange={handleWeekdayChange}
                onFrequencyChange={handleFrequencyChange}
                onDateChange={handleDateChange}
                onClearAllWeekdays={onClearAllWeekdays}
                onClearAllFrequencies={onClearAllFrequencies}
              />
            </div>
          </div>
        )}
      </FilterConfigurationProvider>
    </div>
  );
};

export default RouteFilterPanel;
