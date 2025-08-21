import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  MapPin,
  Truck,
  Package,
  Calendar,
  ArrowRight,
  Target,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface OriginalBookingData {
  originalTurid?: string
  originalKundnr?: number
  originalHsnr?: number
  originalTjnr?: number
  originalAvftyp?: string
  originalTjtyp?: string
  originalFrekvens?: string
  originalDatum?: string
  originalBil?: string
  originalSchemalagd?: number
  originalDec?: string
  originalTurordningsnr?: number
  originalRouteRecord?: any
}

interface BookingData {
  id: string
  bookingId?: string
  turordningsnr?: number
  recyclingType: string
  vehicleId?: string
  serviceType?: string
  frequency?: string
  position?: [number, number]
  dec?: string
  datum?: string
  scheduled?: boolean | number
  stepIndex?: number
  truckId?: string
  fullId?: string
  originalData?: OriginalBookingData
}

interface BookingDisplayCardProps {
  booking: BookingData
  variant?: 'compact' | 'detailed' | 'comparison'
  showOrder?: boolean
  showVehicle?: boolean
  showCoordinates?: boolean
  showMetadata?: boolean
  className?: string
  status?: 'default' | 'moved' | 'unchanged' | 'missing'
  comparisonData?: {
    originalOrder?: number
    newOrder?: number
    positionChanged?: boolean
  }
  orderLabel?: string
}

export default function BookingDisplayCard({
  booking,
  variant = 'detailed',
  showOrder = true,
  showVehicle = true,
  showCoordinates = false,
  showMetadata = true,
  className,
  status = 'default',
  comparisonData,
  orderLabel,
}: BookingDisplayCardProps) {
  const formatPosition = (pos?: [number, number]) => {
    if (!pos || pos.length !== 2) return null
    return `${pos[1]?.toFixed(4)}, ${pos[0]?.toFixed(4)}`
  }

  const formatOrder = (order?: number) => {
    if (order === undefined || order === null) return null
    return `#${order}`
  }

  const getStatusStyles = () => {
    switch (status) {
      case 'moved':
        return 'border-orange-200 bg-orange-50'
      case 'unchanged':
        return 'border-green-200 bg-green-50'
      case 'missing':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-white'
    }
  }

  const StatusIcon = () => {
    switch (status) {
      case 'moved':
        return <ArrowRight className="h-3 w-3 text-orange-600" />
      case 'unchanged':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />
      case 'missing':
        return <AlertCircle className="h-3 w-3 text-red-600" />
      default:
        return null
    }
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-md border text-sm',
          getStatusStyles(),
          className
        )}
      >
        <StatusIcon />
        {showOrder && booking.turordningsnr && (
          <Badge variant="outline" className="text-xs">
            {formatOrder(booking.turordningsnr)}
          </Badge>
        )}
        <span className="font-medium">{booking.id}</span>
        <Badge variant="secondary" className="text-xs">
          {booking.recyclingType}
        </Badge>
        {showVehicle && booking.vehicleId && (
          <Badge variant="outline" className="text-xs">
            🚛 {booking.vehicleId}
          </Badge>
        )}
        {comparisonData?.positionChanged && (
          <Badge variant="destructive" className="text-xs">
            Flyttad
          </Badge>
        )}
      </div>
    )
  }

  if (variant === 'comparison') {
    return (
      <Card className={cn('p-3', getStatusStyles(), className)}>
        <CardContent className="p-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon />
              <span className="font-medium">{booking.bookingId}</span>
              {showOrder && booking.turordningsnr && (
                <Badge variant="outline">
                  {formatOrder(booking.turordningsnr)}
                </Badge>
              )}
              {showOrder && booking.stepIndex !== undefined && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  VROOM #{booking.stepIndex}
                </Badge>
              )}
            </div>
            {comparisonData && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                {comparisonData.originalOrder && (
                  <span>{formatOrder(comparisonData.originalOrder)}</span>
                )}
                {comparisonData.positionChanged && (
                  <>
                    <ArrowRight className="h-3 w-3" />
                    <span>{formatOrder(comparisonData.newOrder)}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Package className="h-3 w-3 text-gray-500" />
            <Badge variant="secondary" className="text-xs">
              {booking.recyclingType}
            </Badge>
            {showVehicle && booking.vehicleId && (
              <>
                <Truck className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600">{booking.vehicleId}</span>
              </>
            )}
          </div>

          {showMetadata && booking.serviceType && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Target className="h-3 w-3" />
              <span>{booking.serviceType}</span>
              {booking.frequency && (
                <Badge variant="outline" className="text-xs">
                  {booking.frequency}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('p-4', getStatusStyles(), className)}>
      <CardContent className="p-0 space-y-3">
        {showOrder && (
          <div className="flex items-center gap-2 mb-2">
            {booking.turordningsnr !== undefined &&
              booking.turordningsnr !== 0 && (
                <Badge
                  variant="default"
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                >
                  {orderLabel || 'Ordning'} #{booking.turordningsnr}
                </Badge>
              )}
            {booking.turordningsnr === 0 && (
              <Badge variant="destructive" className="text-xs">
                {orderLabel || 'Ordning'} #0 (ospec.)
              </Badge>
            )}
            {booking.stepIndex !== undefined && (
              <Badge
                variant="secondary"
                className="text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                {orderLabel || 'VROOM'} #{booking.stepIndex}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon />
            <span className="font-medium text-lg">{booking.id}</span>
          </div>
          {booking.scheduled && (
            <Badge variant="default" className="text-xs">
              Schemalagd
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <Badge variant="secondary">{booking.recyclingType}</Badge>
          </div>
          {showVehicle && booking.vehicleId && (
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">{booking.vehicleId}</span>
            </div>
          )}
        </div>

        {showMetadata && (
          <div className="space-y-2 text-sm text-gray-600">
            {booking.serviceType && (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span>{booking.serviceType}</span>
                {booking.frequency && (
                  <Badge variant="outline" className="text-xs">
                    {booking.frequency}
                  </Badge>
                )}
              </div>
            )}

            {booking.datum && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{booking.datum}</span>
              </div>
            )}

            {showCoordinates && booking.position && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-mono text-xs">
                  {formatPosition(booking.position)}
                </span>
              </div>
            )}
          </div>
        )}

        {comparisonData && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Position:</span>
              <div className="flex items-center gap-2">
                {comparisonData.originalOrder && (
                  <span>{formatOrder(comparisonData.originalOrder)}</span>
                )}
                {comparisonData.positionChanged ? (
                  <>
                    <ArrowRight className="h-3 w-3 text-orange-600" />
                    <span className="text-orange-600">
                      {formatOrder(comparisonData.newOrder)}
                    </span>
                    <Badge variant="destructive" className="text-xs ml-2">
                      Flyttad
                    </Badge>
                  </>
                ) : (
                  <Badge variant="default" className="text-xs ml-2">
                    Oförändrad
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
