export interface BookingFilters {
  recyclingTypes: Set<string>
  statuses: Set<string>
  showAll: boolean
}

export interface RecyclingType {
  id: string
  label: string
  color: readonly [number, number, number]
  count: number
  isActive: boolean
}

export interface BookingStatus {
  id: string
  label: string
  color: readonly [number, number, number]
  count: number
  isActive: boolean
}

export interface BookingLegendProps {
  bookings: Array<{
    id: string
    recyclingType: string
    status: string
    [key: string]: unknown
  }>
  filters: BookingFilters
  onFiltersChange: (filters: BookingFilters) => void
  isVisible: boolean
}

export interface LegendItemProps {
  item: RecyclingType | BookingStatus
  onClick: () => void
}

export interface BookingStats {
  total: number
  visible: number
  byType: Record<string, number>
  byStatus: Record<string, number>
}
