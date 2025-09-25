
import React from 'react';
import PrimaryFilters from '@/components/filters/PrimaryFilters';
import SecondaryFilters from '@/components/filters/SecondaryFilters';
import { FilterConfiguration } from './FilterConfiguration';

interface FilterRowProps {
  type: 'primary' | 'secondary';
  configuration: FilterConfiguration;
  data?: any; // Add data prop to receive actual JSON data
  searchFilters: {
    avfallstyp: string[];
    fordonstyp: string[];
    fordonsnummer: string[];
    tjanstetyp: string[];
    veckodag: string[];
    frekvens: string[];
    datum: string;
  };
  selectedDate: Date | undefined;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  onWasteTypeChange: (wasteTypeId: string, checked: boolean) => void;
  onVehicleChange: (vehicleId: string, checked: boolean) => void;
  onVehicleTypeChange: (vehicleTypeId: string, checked: boolean) => void;
  onServiceTypeChange: (serviceTypeId: string, checked: boolean) => void;
  onWeekdayChange: (weekdayId: string, checked: boolean) => void;
  onFrequencyChange: (frequencyId: string, checked: boolean) => void;
  onDateChange: (date: Date | undefined) => void;
  // New clear functions
  onClearAllWasteTypes?: () => void;
  onClearAllVehicles?: () => void;
  onClearAllVehicleTypes?: () => void;
  onClearAllServiceTypes?: () => void;
  onClearAllWeekdays?: () => void;
  onClearAllFrequencies?: () => void;
}

const FilterRow: React.FC<FilterRowProps> = ({
  type,
  configuration,
  data,
  searchFilters,
  selectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  onWasteTypeChange,
  onVehicleChange,
  onVehicleTypeChange,
  onServiceTypeChange,
  onWeekdayChange,
  onFrequencyChange,
  onDateChange,
  onClearAllWasteTypes,
  onClearAllVehicles,
  onClearAllVehicleTypes,
  onClearAllServiceTypes,
  onClearAllWeekdays,
  onClearAllFrequencies
}) => {
  if (type === 'primary') {
    return (
      <PrimaryFilters
        configuration={configuration}
        data={data}
        searchFilters={searchFilters}
        onWasteTypeChange={onWasteTypeChange}
        onVehicleChange={onVehicleChange}
        onVehicleTypeChange={onVehicleTypeChange}
        onServiceTypeChange={onServiceTypeChange}
        onClearAllWasteTypes={onClearAllWasteTypes}
        onClearAllVehicles={onClearAllVehicles}
        onClearAllVehicleTypes={onClearAllVehicleTypes}
        onClearAllServiceTypes={onClearAllServiceTypes}
      />
    );
  }

  return (
    <SecondaryFilters
      configuration={configuration}
      data={data}
      searchFilters={searchFilters}
      selectedDate={selectedDate}
      isCalendarOpen={isCalendarOpen}
      setIsCalendarOpen={setIsCalendarOpen}
      onWeekdayChange={onWeekdayChange}
      onFrequencyChange={onFrequencyChange}
      onDateChange={onDateChange}
      onClearAllWeekdays={onClearAllWeekdays}
      onClearAllFrequencies={onClearAllFrequencies}
    />
  );
};

export default FilterRow;
