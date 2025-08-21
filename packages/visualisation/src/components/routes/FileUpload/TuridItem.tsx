import { Badge } from '@/components/ui/badge'

interface RouteRecord {
  Turid: string
  Datum: string
  Tjtyp: string
  Lat: number
  Lng: number
  Bil: string
  Turordningsnr: string
  Avftyp: string
  [key: string]: any
}

interface TuridItemProps {
  turid: string
  filteredData: RouteRecord[]
  uploadedData: RouteRecord[]
}

export function TuridItem({
  turid,
  filteredData,
  uploadedData,
}: TuridItemProps) {
  const turidBookings = filteredData.filter((r) => r.Turid === turid)
  const totalBookings = uploadedData.filter((r) => r.Turid === turid).length
  const uniqueAvftyper = [...new Set(turidBookings.map((b) => b.Avftyp))]
  const uniqueBilar = [...new Set(turidBookings.map((b) => b.Bil))]

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
        <div className="flex items-center gap-2">
          <span className="font-medium">🚛 Fordon:</span>
          <div className="flex gap-1">
            {uniqueBilar.map((bil) => (
              <Badge key={bil} variant="outline" className="px-1 py-0 text-xs">
                {bil}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">📦 Avfall:</span>
          <div className="flex gap-1 flex-wrap">
            {uniqueAvftyper.slice(0, 4).map((typ) => (
              <Badge key={typ} variant="outline" className="px-1 py-0 text-xs">
                {typ}
              </Badge>
            ))}
            {uniqueAvftyper.length > 4 && (
              <span className="text-xs text-gray-500">
                +{uniqueAvftyper.length - 4} fler
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
