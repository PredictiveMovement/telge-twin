import { useMemo } from 'react'
import {
  Navigation,
  Clock,
  Truck,
  Map,
  Car,
  Image,
  Palette,
} from 'lucide-react'
import { LayerSection, LayersMenuProps } from '../types'

export const useLayersMenu = (props: LayersMenuProps): LayerSection[] => {
  const {
    activeLayers,
    showArcLayer,
    setShowArcLayer,
    showActiveDeliveries,
    setShowActiveDeliveries,
    showAssignedBookings,
    setShowAssignedBookings,
  } = props

  return useMemo(
    () => [
      {
        id: 'routes',
        title: 'Rutter & Transport',
        items: [
          {
            id: 'nextStop',
            label: 'Nästa stopp',
            icon: Navigation,
            checked: showArcLayer,
            onChange: () => setShowArcLayer((on) => !on),
          },
          {
            id: 'queuedBookings',
            label: 'Köade bokningar',
            icon: Clock,
            checked: showAssignedBookings,
            onChange: () => setShowAssignedBookings((on) => !on),
          },
          {
            id: 'activeDeliveries',
            label: 'Pågående leveranser',
            icon: Truck,
            checked: showActiveDeliveries,
            onChange: () => setShowActiveDeliveries((on) => !on),
          },
        ],
      },
      {
        id: 'map',
        title: 'Kartlager',
        items: [
          {
            id: 'municipalityBorders',
            label: 'Kommungränser',
            icon: Map,
            checked: activeLayers.municipalityLayer,
            onChange: () => activeLayers.setMunicipalityLayer((on) => !on),
          },
        ],
      },
      {
        id: 'vehicles',
        title: 'Fordonsvisning',
        items: [
          {
            id: 'showVehicles',
            label: 'Visa fordon',
            icon: Car,
            checked: activeLayers.carLayer,
            onChange: () => activeLayers.setCarLayer((on) => !on),
          },
          {
            id: 'useIcons',
            label: 'Använd ikoner för fordon',
            icon: Image,
            checked: activeLayers.useIcons,
            onChange: () => activeLayers.setUseIcons((on) => !on),
          },
        ],
      },
      {
        id: 'ui',
        title: 'UI-hjälpmedel',
        items: [
          {
            id: 'bookingLegend',
            label: 'Visa färgförklaring för bokningar',
            icon: Palette,
            checked: activeLayers.showBookingLegend,
            onChange: () => activeLayers.setShowBookingLegend((on) => !on),
          },
        ],
      },
    ],
    [
      activeLayers,
      showArcLayer,
      setShowArcLayer,
      showActiveDeliveries,
      setShowActiveDeliveries,
      showAssignedBookings,
      setShowAssignedBookings,
    ]
  )
}
