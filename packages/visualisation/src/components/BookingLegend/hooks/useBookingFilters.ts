import { useCallback } from 'react'
import { BookingFilters } from '../types'

export const useBookingFilters = (
  filters: BookingFilters,
  onFiltersChange: (filters: BookingFilters) => void
) => {
  const toggleRecyclingType = useCallback(
    (type: string) => {
      const newTypes = new Set(filters.recyclingTypes)

      if (newTypes.has(type)) {
        newTypes.delete(type)
      } else {
        newTypes.add(type)
      }

      onFiltersChange({
        ...filters,
        recyclingTypes: newTypes,
        showAll: newTypes.size === 5 && filters.statuses.size === 4, // All types and statuses
      })
    },
    [filters, onFiltersChange]
  )

  const toggleStatus = useCallback(
    (status: string) => {
      const newStatuses = new Set(filters.statuses)

      if (newStatuses.has(status)) {
        newStatuses.delete(status)
      } else {
        newStatuses.add(status)
      }

      onFiltersChange({
        ...filters,
        statuses: newStatuses,
        showAll:
          filters.recyclingTypes.size === 5 && newStatuses.size === 5, // All types and statuses
      })
    },
    [filters, onFiltersChange]
  )

  const resetFilters = useCallback(() => {
    onFiltersChange({
      recyclingTypes: new Set([
        'paper',
        'plastic',
        'glass',
        'metal',
        'organic',
      ]),
      statuses: new Set([
        'Assigned',
        'Queued',
        'Picked up',
        'Delivered',
        'Unreachable',
      ]),
      showAll: true,
    })
  }, [onFiltersChange])

  const selectOnly = useCallback(
    (type: 'recyclingType' | 'status', value: string) => {
      if (type === 'recyclingType') {
        onFiltersChange({
          ...filters,
          recyclingTypes: new Set([value]),
          showAll: false,
        })
      } else {
        onFiltersChange({
          ...filters,
          statuses: new Set([value]),
          showAll: false,
        })
      }
    },
    [filters, onFiltersChange]
  )

  return {
    toggleRecyclingType,
    toggleStatus,
    resetFilters,
    selectOnly,
    hasActiveFilters: !filters.showAll,
  }
}
