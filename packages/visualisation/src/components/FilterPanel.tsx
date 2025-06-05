import React from 'react'
import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'
import WasteTypeFilter from './filters/WasteTypeFilter'
import ServiceTypeFilter from './filters/ServiceTypeFilter'
import VehicleFilter from './filters/VehicleFilter'
import CustomerNumberFilter from './filters/CustomerNumberFilter'

interface FilterPanelProps {
  data: any
  filters: {
    wasteTypes: string[]
    serviceTypes: string[]
    vehicles: string[]
    customerNumber: string
  }
  onFilterChange: (filterName: string, values: any) => void
  onClearFilters: () => void
  activeFilterCount: number
  filteredItemCount: number
  totalItemCount: number
  hideHeader?: boolean
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  data,
  filters,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  filteredItemCount,
  totalItemCount,
  hideHeader = false,
}) => {
  const handleWasteTypeChange = (wasteTypeId: string, checked: boolean) => {
    const currentWasteTypes = [...filters.wasteTypes]
    if (checked) {
      if (!currentWasteTypes.includes(wasteTypeId)) {
        onFilterChange('wasteTypes', [...currentWasteTypes, wasteTypeId])
      }
    } else {
      const index = currentWasteTypes.indexOf(wasteTypeId)
      if (index !== -1) {
        currentWasteTypes.splice(index, 1)
        onFilterChange('wasteTypes', currentWasteTypes)
      }
    }
  }

  const handleServiceTypeChange = (serviceTypeId: string, checked: boolean) => {
    const currentServiceTypes = [...filters.serviceTypes]
    if (checked) {
      if (!currentServiceTypes.includes(serviceTypeId)) {
        onFilterChange('serviceTypes', [...currentServiceTypes, serviceTypeId])
      }
    } else {
      const index = currentServiceTypes.indexOf(serviceTypeId)
      if (index !== -1) {
        currentServiceTypes.splice(index, 1)
        onFilterChange('serviceTypes', currentServiceTypes)
      }
    }
  }

  const handleVehicleChange = (vehicleId: string, checked: boolean) => {
    const currentVehicles = [...filters.vehicles]
    if (checked) {
      if (!currentVehicles.includes(vehicleId)) {
        onFilterChange('vehicles', [...currentVehicles, vehicleId])
      }
    } else {
      const index = currentVehicles.indexOf(vehicleId)
      if (index !== -1) {
        currentVehicles.splice(index, 1)
        onFilterChange('vehicles', currentVehicles)
      }
    }
  }

  return (
    <div className="mb-6 space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-lg font-medium">Filter</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            Visar {filteredItemCount} av {totalItemCount} objekt
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <WasteTypeFilter
          data={data}
          selectedWasteTypes={filters.wasteTypes}
          onWasteTypeChange={handleWasteTypeChange}
        />

        <ServiceTypeFilter
          data={data}
          selectedServiceTypes={filters.serviceTypes}
          onServiceTypeChange={handleServiceTypeChange}
        />

        <VehicleFilter
          data={data}
          selectedVehicles={filters.vehicles}
          onVehicleChange={handleVehicleChange}
        />

        <CustomerNumberFilter
          customerNumber={filters.customerNumber}
          onCustomerNumberChange={(value) =>
            onFilterChange('customerNumber', value)
          }
        />
      </div>

      {activeFilterCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Rensa filter
          </Button>
        </div>
      )}
    </div>
  )
}

export default FilterPanel
