import { Badge } from '@/components/ui/badge'

interface RouteRecord {
  Turid: string
  Datum: string
  Tjtyp: string
  Lat: number
  Lng: number
  Bil: string
  Turordningsnr: string | number
  Avftyp: string
  Hsadress?: string
  Nyckelkod?: string
  [key: string]: any
}

interface TuridItemProps {
  turid: string
  filteredData?: RouteRecord[]
  uploadedData?: RouteRecord[]
}

function getUnique(
  data: RouteRecord[] | undefined,
  key: keyof RouteRecord
): string[] {
  const out = new Set<string>()
  for (const row of data ?? []) {
    const v = row?.[key]
    if (v !== undefined && v !== null && v !== '') out.add(String(v))
  }
  return Array.from(out).sort()
}

export function TuridItem({
  turid,
  filteredData,
  uploadedData,
}: TuridItemProps) {
  const filtered = filteredData ?? []
  const uploaded = uploadedData ?? []

  const turidBookings = filtered.filter((r) => r?.Turid === turid)
  const totalBookings = uploaded.filter((r) => r?.Turid === turid).length

  const uniqueAvftyper = getUnique(turidBookings, 'Avftyp')
  const uniqueBilar = getUnique(turidBookings, 'Bil')

  const maxVehiclesToShow = 8
  const maxWasteToShow = 4

  return (
    <div className="p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary" className="px-2 py-1">
          {turid}
        </Badge>
        <span className="text-xs text-gray-600">
          {turidBookings.length}/{totalBookings} bokningar
        </span>
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 font-medium shrink-0">🚛 Fordon:</span>
          <div className="flex flex-wrap gap-1">
            {uniqueBilar.slice(0, maxVehiclesToShow).map((bil) => (
              <Badge key={bil} variant="outline" className="px-1 py-0 text-xs">
                {bil}
              </Badge>
            ))}
            {uniqueBilar.length > maxVehiclesToShow && (
              <span className="text-xs text-gray-500">
                +{uniqueBilar.length - maxVehiclesToShow} fler
              </span>
            )}
            {uniqueBilar.length === 0 && (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="mt-0.5 font-medium shrink-0">📦 Avfall:</span>
          <div className="flex flex-wrap gap-1">
            {uniqueAvftyper.slice(0, maxWasteToShow).map((typ) => (
              <Badge key={typ} variant="outline" className="px-1 py-0 text-xs">
                {typ}
              </Badge>
            ))}
            {uniqueAvftyper.length > maxWasteToShow && (
              <span className="text-xs text-gray-500">
                +{uniqueAvftyper.length - maxWasteToShow} fler
              </span>
            )}
            {uniqueAvftyper.length === 0 && (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
