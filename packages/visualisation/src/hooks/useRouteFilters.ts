import { useState } from 'react'

export interface RouteFilters {
  avfallstyp: string[]
  fordonstyp: string[]
  fordonsnummer: string[]
  tjanstetyp: string[]
  turid: string[]
  datum: string
}

export const useRouteFilters = () => {
  // Search filters - supports multiple selections
  const [searchFilters, setSearchFilters] = useState<RouteFilters>({
    avfallstyp: [],
    fordonstyp: [],
    fordonsnummer: [],
    tjanstetyp: [],
    turid: [],
    datum: ''
  })

  // Other filters (legacy support)
  const [filters, setFilters] = useState({
    vehicleType: [],
    vehicleNumber: '',
    weekday: [],
    address: '',
    customer: '',
    payerType: []
  })

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // Handle search filter changes for arrays
  const handleSearchFilterArrayChange = (filterName: string, value: string) => {
    setSearchFilters(prev => {
      const currentValues = [...(prev[filterName as keyof RouteFilters] as string[])]
      const index = currentValues.indexOf(value)
      if (index === -1) {
        return {
          ...prev,
          [filterName]: [...currentValues, value]
        }
      } else {
        currentValues.splice(index, 1)
        return {
          ...prev,
          [filterName]: currentValues
        }
      }
    })
  }

  // Handle search filter changes for strings
  const handleSearchFilterChange = (filterName: string, value: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [filterName]: value
    }))
  }

  // Handle filter changes
  const handleFilterChange = (filterName: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }))
  }

  // Handle specific filter array changes (add/remove items)
  const handleArrayFilterChange = (filterName: string, value: string) => {
    setFilters(prev => {
      const currentValues = [...(prev[filterName as keyof typeof prev] as any[])]
      const index = currentValues.indexOf(value)
      if (index === -1) {
        return {
          ...prev,
          [filterName]: [...currentValues, value]
        }
      } else {
        currentValues.splice(index, 1)
        return {
          ...prev,
          [filterName]: currentValues
        }
      }
    })
  }

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
  }

  // Dedicated clear functions for each filter type
  const clearAllWasteTypes = () => {
    setSearchFilters(prev => ({
      ...prev,
      avfallstyp: []
    }))
  }

  const clearAllVehicleTypes = () => {
    setSearchFilters(prev => ({
      ...prev,
      fordonstyp: []
    }))
  }

  const clearAllServiceTypes = () => {
    setSearchFilters(prev => ({
      ...prev,
      tjanstetyp: []
    }))
  }


  const clearAllVehicles = () => {
    setSearchFilters(prev => ({
      ...prev,
      fordonsnummer: []
    }))
  }

  const clearAllTurids = () => {
    setSearchFilters(prev => ({
      ...prev,
      turid: []
    }))
  }

  const clearSingleSelect = (filterName: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [filterName]: ''
    }))
  }

  // Reset filters
  const clearFilters = () => {
    setFilters({
      vehicleType: [],
      vehicleNumber: '',
      weekday: [],
      address: '',
      customer: '',
      payerType: []
    })
  }

  // Clear all search filters
  const clearAllSearchFilters = () => {
    setSearchFilters({
      avfallstyp: [],
      fordonstyp: [],
      fordonsnummer: [],
      tjanstetyp: [],
      turid: [],
      datum: ''
    })
    setSelectedDate(undefined)
  }

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0
    if (searchFilters.avfallstyp.length > 0) count++
    if (searchFilters.fordonstyp.length > 0) count++
    if (searchFilters.fordonsnummer.length > 0) count++
    if (searchFilters.tjanstetyp.length > 0) count++
    if (searchFilters.turid.length > 0) count++
    if (selectedDate) count++
    return count
  }

  return {
    searchFilters,
    filters,
    selectedDate,
    handleSearchFilterArrayChange,
    handleSearchFilterChange,
    handleFilterChange,
    handleArrayFilterChange,
    handleDateSelect,
    clearFilters,
    clearAllSearchFilters,
    getActiveFilterCount,
    // New dedicated clear functions
    clearAllWasteTypes,
    clearAllVehicleTypes,
    clearAllServiceTypes,
    clearAllVehicles,
    clearAllTurids,
    clearSingleSelect
  }
}