import { useMemo } from 'react'
import {
  BookingStats,
  BookingFilters,
  RecyclingType,
  BookingStatus,
} from '../types'
import {
  BOOKING_COLORS,
  RECYCLING_TYPE_LABELS,
  STATUS_LABELS,
} from '../constants'

interface Booking {
  recyclingType: string
  status: string
}

export const useBookingStats = (
  bookings: Booking[],
  filters: BookingFilters
): BookingStats & {
  recyclingTypes: RecyclingType[]
  statuses: BookingStatus[]
} => {
  const stats = useMemo(() => {
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}

    bookings.forEach((booking) => {
      byType[booking.recyclingType] = (byType[booking.recyclingType] || 0) + 1
      byStatus[booking.status] = (byStatus[booking.status] || 0) + 1
    })

    const visibleBookings = filters.showAll
      ? bookings
      : bookings.filter(
          (booking) =>
            filters.recyclingTypes.has(booking.recyclingType) &&
            filters.statuses.has(booking.status)
        )

    const recyclingTypes: RecyclingType[] = Object.keys(
      RECYCLING_TYPE_LABELS
    ).map((type) => ({
      id: type,
      label: RECYCLING_TYPE_LABELS[type as keyof typeof RECYCLING_TYPE_LABELS],
      color:
        BOOKING_COLORS[type as keyof typeof BOOKING_COLORS] ||
        BOOKING_COLORS.default,
      count: byType[type] || 0,
      isActive: filters.recyclingTypes.has(type),
    }))

    const statuses: BookingStatus[] = Object.keys(STATUS_LABELS).map(
      (status) => ({
        id: status,
        label: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
        color:
          BOOKING_COLORS[
            status
              .toUpperCase()
              .replace(' ', '_') as keyof typeof BOOKING_COLORS
          ] || BOOKING_COLORS.default,
        count: byStatus[status] || 0,
        isActive: filters.statuses.has(status),
      })
    )

    return {
      total: bookings.length,
      visible: visibleBookings.length,
      byType,
      byStatus,
      recyclingTypes,
      statuses,
    }
  }, [bookings, filters])

  return stats
}
