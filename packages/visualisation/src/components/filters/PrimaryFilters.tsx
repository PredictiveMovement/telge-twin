import React from 'react';
import MultipleSelectFilter from '@/components/filters/MultipleSelectFilter';
import VehicleFilter from '@/components/filters/VehicleFilter';
import VehicleTypeFilter from '@/components/filters/VehicleTypeFilter';
import ServiceTypeFilter from '@/components/filters/ServiceTypeFilter';
import TuridFilter from '@/components/filters/TuridFilter';
import { FilterConfiguration } from './FilterConfiguration';

interface PrimaryFiltersProps {
  configuration: FilterConfiguration;
  data?: any;
  searchFilters: {
    avfallstyp: string[];
    fordonstyp: string[];
    fordonsnummer: string[];
    tjanstetyp: string[];
    turid: string[];
  };
  onWasteTypeChange: (wasteTypeId: string, checked: boolean) => void;
  onVehicleChange: (vehicleId: string, checked: boolean) => void;
  onVehicleTypeChange: (vehicleTypeId: string, checked: boolean) => void;
  onServiceTypeChange: (serviceTypeId: string, checked: boolean) => void;
  onTuridChange: (turidId: string, checked: boolean) => void;
  // New clear functions
  onClearAllWasteTypes?: () => void;
  onClearAllVehicles?: () => void;
  onClearAllVehicleTypes?: () => void;
  onClearAllServiceTypes?: () => void;
  onClearAllTurids?: () => void;
}

const PrimaryFilters: React.FC<PrimaryFiltersProps> = ({
  configuration,
  data,
  searchFilters,
  onWasteTypeChange,
  onVehicleChange,
  onVehicleTypeChange,
  onServiceTypeChange,
  onTuridChange,
  onClearAllWasteTypes,
  onClearAllVehicles,
  onClearAllVehicleTypes,
  onClearAllServiceTypes,
  onClearAllTurids
}) => {
  // Use the actual data if provided, otherwise fallback to configuration
  const filterData = data || { settings: configuration };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* TurID */}
        <TuridFilter 
          data={filterData} 
          selectedTurids={searchFilters.turid} 
          onTuridChange={onTuridChange}
          onClearAllTurids={onClearAllTurids}
        />

        {/* Avfallstyp */}
        <MultipleSelectFilter 
          data={filterData} 
          selectedValues={searchFilters.avfallstyp} 
          onValueChange={onWasteTypeChange}
          onClearAll={onClearAllWasteTypes}
          label="Avfallstyp"
          placeholder="Alla avfallstyper"
          dataKey="avftyper"
        />

        {/* Fordonstyp */}
        <VehicleTypeFilter 
          data={filterData} 
          selectedVehicleTypes={searchFilters.fordonstyp} 
          onVehicleTypeChange={onVehicleTypeChange}
          onClearAllVehicleTypes={onClearAllVehicleTypes}
        />

        {/* Fordon */}
        <VehicleFilter 
          data={filterData} 
          selectedVehicles={searchFilters.fordonsnummer} 
          onVehicleChange={onVehicleChange}
          onClearAllVehicles={onClearAllVehicles}
        />

        {/* Storlek på behållare (tjänstetyp) */}
        <ServiceTypeFilter 
          data={filterData} 
          selectedServiceTypes={searchFilters.tjanstetyp} 
          onServiceTypeChange={onServiceTypeChange}
          onClearAllServiceTypes={onClearAllServiceTypes}
        />
    </div>
  );
};

export default PrimaryFilters;
