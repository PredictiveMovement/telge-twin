import React, { useMemo } from 'react'
import type { Car, Booking } from '@/types/map'
import telgeSettings from '@/config/telge-settings.json'

export type HoverInfoType =
  | 'car'
  | 'municipality'
  | 'dropoff'
  | 'area-partition'
  | 'booking'

export interface HoverInfoData {
  id: string
  type: HoverInfoType
  x: number
  y: number
  viewport?: { width: number; height: number } | null
  name?: string
}

interface HoverInfoBoxProps {
  hoverInfo: HoverInfoData | null
  cars: Car[]
  bookings: Booking[]
}

const CARD_WIDTH = 280

const formatNumber = (value: number | null | undefined, decimals = 0) => {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('sv-SE', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
}

const renderDetailRow = (label: string, value: React.ReactNode) => (
  <div key={label} className="flex justify-between gap-3 text-xs">
    <span className="text-slate-300">{label}</span>
    <span className="text-right font-medium text-white">{value}</span>
  </div>
)

const telgeAllowedIndex: Map<string, Map<number, string[]>> = (() => {
  const bilar = (telgeSettings as { settings?: { bilar?: any[] } }).settings
    ?.bilar
  const index = new Map<string, Map<number, string[]>>()
  ;(bilar || []).forEach((bil) => {
    const facks = new Map<number, string[]>()
    ;(bil?.FACK || []).forEach((f: any) => {
      if (!f?.FACK || !f?.AVFTYP) return
      const list = facks.get(f.FACK) || []
      list.push(f.AVFTYP)
      facks.set(f.FACK, list)
    })
    if (facks.size > 0) {
      index.set(String(bil.ID), facks)
    }
  })
  return index
})()

const renderCompartment = (
  comp: NonNullable<Car['compartments']>[number],
  allowedOverride?: string[]
) => {
  const hasVolumeCap =
    typeof comp.capacityLiters === 'number' && comp.capacityLiters > 0
  const hasWeightCap =
    typeof comp.capacityKg === 'number' && comp.capacityKg > 0

  const fillLiters = Math.max(0, comp.fillLiters ?? 0)
  const fillKg = Math.max(0, comp.fillKg ?? 0)

  const volumePercent = hasVolumeCap
    ? Math.min(100, (fillLiters / (comp.capacityLiters as number)) * 100)
    : null
  const weightPercent = hasWeightCap
    ? Math.min(100, (fillKg / (comp.capacityKg as number)) * 100)
    : null

  const rawAllowed = Array.isArray(allowedOverride)
    ? allowedOverride
    : comp.allowedWasteTypes
  const allowedList = Array.isArray(rawAllowed)
    ? Array.from(new Set(rawAllowed.filter(Boolean)))
    : []
  const allowedTypes = allowedList.length
    ? allowedList.includes('*')
      ? 'Alla'
      : allowedList.join(', ')
    : '—'
  const allowedLabel =
    allowedList.length && !allowedList.includes('*')
      ? `Typer (${allowedList.length})`
      : 'Typer'

  return (
    <div
      key={`compartment-${comp.fackNumber}`}
      className="rounded border border-white/10 bg-white/5 p-2"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-white">
          Fack {comp.fackNumber}
        </span>
        <span className="text-slate-200">
          {formatNumber(fillLiters, 0)}
          {hasVolumeCap
            ? ` / ${formatNumber(comp.capacityLiters ?? 0, 0)} L`
            : ' L'}
        </span>
      </div>
      <div className="mt-1 space-y-1 text-[11px] text-slate-300">
        <div>
          Volym: {hasVolumeCap ? `${formatNumber(volumePercent, 1)} %` : '—'}
        </div>
        <div>
          Vikt:{' '}
          {hasWeightCap
            ? `${formatNumber(fillKg, 1)} / ${formatNumber(
                comp.capacityKg ?? 0,
                1
              )} kg (${formatNumber(weightPercent ?? 0, 1)} %)`
            : `${formatNumber(fillKg, 1)} kg`}
        </div>
        <div>
          {allowedLabel}: {allowedTypes}
        </div>
      </div>
    </div>
  )
}

const useCarPayload = (hoverInfo: HoverInfoData | null, cars: Car[]) =>
  useMemo(() => {
    if (!hoverInfo || hoverInfo.type !== 'car') return null
    const car = cars.find((item) => item.id === hoverInfo.id)
    if (!car) return null
    return car
  }, [hoverInfo, cars])

const useBookingPayload = (
  hoverInfo: HoverInfoData | null,
  bookings: Booking[]
) =>
  useMemo(() => {
    if (!hoverInfo || hoverInfo.type !== 'booking') return null
    const booking = bookings.find((item) => item.id === hoverInfo.id)
    if (!booking) return null
    return booking
  }, [hoverInfo, bookings])

const HoverInfoBox: React.FC<HoverInfoBoxProps> = ({
  hoverInfo,
  cars,
  bookings,
}) => {
  const car = useCarPayload(hoverInfo, cars)
  const booking = useBookingPayload(hoverInfo, bookings)

  if (!hoverInfo) return null

  const viewport = hoverInfo.viewport ?? null
  const width =
    typeof viewport?.width === 'number' ? Math.max(0, viewport.width) : null

  let left = hoverInfo.x + 12
  if (width && left + CARD_WIDTH > width) {
    left = Math.max(12, hoverInfo.x - CARD_WIDTH - 12)
  }

  let top = Math.max(12, hoverInfo.y - 12)
  const height =
    typeof viewport?.height === 'number' ? Math.max(0, viewport.height) : null
  if (height && top > height - 160) {
    top = Math.max(12, height - 200)
  }

  let content: React.ReactNode = null

  if (hoverInfo.type === 'car' && car) {
    const compartments = Array.isArray(car.compartments) ? car.compartments : []
    const allowedOverrideMap = telgeAllowedIndex.get(String(car.id))
    const allowedUnion = allowedOverrideMap
      ? Array.from(
          new Set(
            Array.from(allowedOverrideMap.values()).flatMap((list) => list)
          )
        )
      : []

    const carDetails: React.ReactNode[] = []
    if (car.status) carDetails.push(renderDetailRow('Status', car.status))
    if (car.fleet) carDetails.push(renderDetailRow('Flotta', car.fleet))
    const recyclingTypesToShow =
      allowedUnion.length > 0 ? allowedUnion : car.recyclingTypes || []
    if (recyclingTypesToShow.length)
      carDetails.push(
        renderDetailRow('Återvinningstyper', recyclingTypesToShow.join(', '))
      )
    if (typeof car.cargo === 'number')
      carDetails.push(renderDetailRow('Lastade kärl', car.cargo))
    if (typeof car.queue === 'number')
      carDetails.push(renderDetailRow('Planerade stopp', car.queue))
    if (typeof car.parcelCapacity === 'number')
      carDetails.push(renderDetailRow('Kapacitet (kärl)', car.parcelCapacity))
    if (typeof (car as any).speed === 'number')
      carDetails.push(renderDetailRow('Hastighet (km/h)', (car as any).speed))
    if (typeof car.distance === 'number')
      carDetails.push(renderDetailRow('Körsträcka (km)', formatNumber(car.distance, 1)))
    if (typeof car.co2 === 'number')
      carDetails.push(renderDetailRow('CO₂ (kg)', formatNumber(car.co2, 1)))

    content = (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-white">
          Fordon {car.id}
        </div>
        <div className="space-y-1">{carDetails}</div>
        {compartments.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Fackinformation
            </div>
            <div className="space-y-2">
              {compartments.map((comp) =>
                renderCompartment(
                  comp,
                  telgeAllowedIndex.get(String(car.id))?.get(comp.fackNumber)
                )
              )}
            </div>
          </div>
        )}
      </div>
    )
  } else if (hoverInfo.type === 'booking' && booking) {
    const bookingDetails: React.ReactNode[] = []
    bookingDetails.push(
      renderDetailRow('Status', booking.status ?? 'Okänd')
    )
    if (booking.recyclingType)
      bookingDetails.push(
        renderDetailRow('Återvinningstyp', booking.recyclingType)
      )
    if (booking.carId)
      bookingDetails.push(renderDetailRow('Bil', booking.carId))
    if (typeof booking.distance === 'number')
      bookingDetails.push(
        renderDetailRow('Körsträcka (km)', formatNumber(booking.distance, 1))
      )
    if (typeof booking.co2 === 'number')
      bookingDetails.push(
        renderDetailRow('CO₂ (kg)', formatNumber(booking.co2, 1))
      )
    if (typeof booking.cost === 'number')
      bookingDetails.push(
        renderDetailRow('Schablonkostnad (kr)', formatNumber(booking.cost, 1))
      )

    content = (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-white">
          Bokning {booking.id}
        </div>
        <div className="space-y-1">{bookingDetails}</div>
      </div>
    )
  } else if (hoverInfo.type === 'municipality') {
    content = (
      <div className="space-y-1">
        <div className="text-sm font-semibold text-white">Kommun</div>
        <div className="text-xs text-slate-200">{hoverInfo.name ?? hoverInfo.id}</div>
      </div>
    )
  } else if (hoverInfo.type === 'area-partition') {
    content = (
      <div className="space-y-1">
        <div className="text-sm font-semibold text-white">Kluster</div>
        <div className="text-xs text-slate-200">{hoverInfo.name ?? hoverInfo.id}</div>
      </div>
    )
  } else if (hoverInfo.type === 'dropoff') {
    content = (
      <div className="space-y-1">
        <div className="text-sm font-semibold text-white">Destination</div>
        <div className="text-xs text-slate-200">Återvinningscentral</div>
      </div>
    )
  }

  if (!content) return null

  return (
    <div
      className="pointer-events-none absolute z-50 w-[280px]"
      style={{ left, top }}
    >
      <div className="rounded-md border border-white/10 bg-slate-900/90 p-3 text-xs text-white shadow-xl backdrop-blur">
        {content}
      </div>
    </div>
  )
}

export default HoverInfoBox
