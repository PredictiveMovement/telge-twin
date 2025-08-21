import { useMemo } from 'react'
import {
  Navigation,
  Clock,
  Truck,
  Map,
  Car,
  Image,
  Palette,
  Grid3x3,
} from 'lucide-react'
import { LayerSection, LayersMenuProps } from '../types'
import { MAP_STYLES } from '@/components/map/utils'

export const useLayersMenu = (props: LayersMenuProps): LayerSection[] => {
  const {
    activeLayers,
    showArcLayer,
    setShowArcLayer,
    showActiveDeliveries,
    setShowActiveDeliveries,
    showAssignedBookings,
    setShowAssignedBookings,
    debugMode,
    setDebugMode,
    debugShowCentroids,
    setDebugShowCentroids,
    debugShowClusterOrder,
    setDebugShowClusterOrder,
    debugShowTransitions,
    setDebugShowTransitions,
  } = props

  return useMemo(
    () => [
      {
        id: 'map-base',
        title: 'Kartbas & 3D',
        items: [
          {
            id: '3d',
            label: props.activeLayers.enable3D ? '3D på' : '3D av',
            icon: Map,
            checked: props.activeLayers.enable3D,
            onChange: () => props.activeLayers.setEnable3D((on) => !on),
          },
          {
            id: 'style-dark',
            label: 'Bas: Dark',
            icon: Map,
            checked: props.activeLayers.mapStyle === MAP_STYLES.dark,
            onChange: () => props.activeLayers.setMapStyle(MAP_STYLES.dark),
          },
          {
            id: 'style-satellite',
            label: 'Bas: Satellite',
            icon: Map,
            checked: props.activeLayers.mapStyle === MAP_STYLES.satellite,
            onChange: () =>
              props.activeLayers.setMapStyle(MAP_STYLES.satellite),
          },
          {
            id: 'style-colorful',
            label: 'Bas: Colorful',
            icon: Map,
            checked: props.activeLayers.mapStyle === MAP_STYLES.colorful,
            onChange: () => props.activeLayers.setMapStyle(MAP_STYLES.colorful),
          },
        ],
      },
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
        title: 'Tematiska lager',
        items: [
          {
            id: 'municipalityBorders',
            label: 'Kommungränser',
            icon: Map,
            checked: activeLayers.municipalityLayer,
            onChange: () => activeLayers.setMunicipalityLayer((on) => !on),
          },
          {
            id: 'areaPartitions',
            label: 'Area partitioner (kluster)',
            icon: Grid3x3,
            checked: activeLayers.showAreaPartitions,
            onChange: () => activeLayers.setShowAreaPartitions((on) => !on),
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
      {
        id: 'debug',
        title: 'Debug',
        items: [
          {
            id: 'debugMode',
            label: 'Aktivera debug-läge',
            icon: Map,
            checked: Boolean(debugMode),
            onChange: () => setDebugMode && setDebugMode((on) => !on),
          },
          ...(debugMode
            ? [
                {
                  id: 'debugCentroids',
                  label: 'Visa klustercentroider',
                  icon: Grid3x3,
                  checked: Boolean(debugShowCentroids),
                  onChange: () =>
                    setDebugShowCentroids && setDebugShowCentroids((on) => !on),
                },
                {
                  id: 'debugClusterOrder',
                  label: 'Visa klusterordning',
                  icon: Navigation,
                  checked: Boolean(debugShowClusterOrder),
                  onChange: () =>
                    setDebugShowClusterOrder &&
                    setDebugShowClusterOrder((on) => !on),
                },
                {
                  id: 'debugClusterTransitions',
                  label: 'Visa övergångar (sista→första)',
                  icon: Navigation,
                  checked: Boolean(debugShowTransitions),
                  onChange: () =>
                    setDebugShowTransitions &&
                    setDebugShowTransitions((on) => !on),
                },
              ]
            : []),
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
      debugMode,
      setDebugMode,
      debugShowCentroids,
      setDebugShowCentroids,
      debugShowClusterOrder,
      setDebugShowClusterOrder,
      debugShowTransitions,
      setDebugShowTransitions,
    ]
  )
}
