import React from 'react';
import { Filter } from 'lucide-react';
import FilterConfigurationProvider from '@/components/filters/FilterConfiguration';
import PrimaryFilters from '@/components/filters/PrimaryFilters';

interface RouteFilterPanelProps {
  searchFilters: {
    avfallstyp: string[];
    fordonstyp: string[];
    fordonsnummer: string[];
    tjanstetyp: string[];
    turid: string[];
  };
  onFilterChange: (filterName: string, value: string) => void;
  onClearFilters?: () => void;
  activeFilterCount: number;
  avfallstyper: string[];
  vehicleOptions: Array<{
    id: string;
    display: string;
  }>;
  vehicleTypes?: string[];
  tjanstetyper: string[];
  turids: string[];
  hideHeader?: boolean;
  // Clear functions
  onClearAllWasteTypes?: () => void;
  onClearAllVehicles?: () => void;
  onClearAllVehicleTypes?: () => void;
  onClearAllServiceTypes?: () => void;
  onClearAllTurids?: () => void;
}

const RouteFilterPanel: React.FC<RouteFilterPanelProps> = ({
  searchFilters,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  avfallstyper,
  vehicleOptions,
  vehicleTypes,
  tjanstetyper,
  turids,
  hideHeader = false,
  onClearAllWasteTypes,
  onClearAllVehicles,
  onClearAllVehicleTypes,
  onClearAllServiceTypes,
  onClearAllTurids
}) => {
  // Filter change handlers
  const handleWasteTypeChange = (wasteTypeId: string, checked: boolean) => {
    onFilterChange('avfallstyp', wasteTypeId);
  };

  const handleVehicleChange = (vehicleId: string, checked: boolean) => {
    onFilterChange('fordonsnummer', vehicleId);
  };

  const handleServiceTypeChange = (serviceTypeId: string, checked: boolean) => {
    onFilterChange('tjanstetyp', serviceTypeId);
  };

  const handleTuridChange = (turidId: string, checked: boolean) => {
    onFilterChange('turid', turidId);
  };

  const handleVehicleTypeChange = (vehicleTypeId: string, checked: boolean) => {
    onFilterChange('fordonstyp', vehicleTypeId);
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
        vehicleTypes={vehicleTypes}
        tjanstetyper={tjanstetyper}
        veckodagar={[]}
        frekvenser={[]}
        turids={turids}
      >
        {(configuration) => (
          <div className="bg-muted p-6 rounded-lg">
            <PrimaryFilters
              configuration={configuration}
              searchFilters={searchFilters}
              onWasteTypeChange={handleWasteTypeChange}
              onVehicleChange={handleVehicleChange}
              onVehicleTypeChange={handleVehicleTypeChange}
              onServiceTypeChange={handleServiceTypeChange}
              onTuridChange={handleTuridChange}
              onClearAllWasteTypes={onClearAllWasteTypes}
              onClearAllVehicles={onClearAllVehicles}
              onClearAllVehicleTypes={onClearAllVehicleTypes}
              onClearAllServiceTypes={onClearAllServiceTypes}
              onClearAllTurids={onClearAllTurids}
            />
          </div>
        )}
      </FilterConfigurationProvider>
    </div>
  );
};

export default RouteFilterPanel;
