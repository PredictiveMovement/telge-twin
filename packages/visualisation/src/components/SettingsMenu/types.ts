import { LucideIcon } from 'lucide-react'
import type { ButtonProps } from '../ui/button'

export interface LayerItem {
  id: string
  label: string
  icon: LucideIcon
  checked: boolean
  onChange: () => void
}

export interface LayerSection {
  id: string
  title: string
  items: LayerItem[]
}

export interface SettingsMenuProps {
  activeLayers: {
    municipalityLayer: boolean
    setMunicipalityLayer: (setter: (prev: boolean) => boolean) => void
    carLayer: boolean
    setCarLayer: (setter: (prev: boolean) => boolean) => void
    useIcons: boolean
    setUseIcons: (setter: (prev: boolean) => boolean) => void
    showBookingLegend: boolean
    setShowBookingLegend: (setter: (prev: boolean) => boolean) => void
    showAreaPartitions: boolean
    setShowAreaPartitions: (setter: (prev: boolean) => boolean) => void
    enable3D: boolean
    setEnable3D: (setter: (prev: boolean) => boolean) => void
    mapStyle: string
    setMapStyle: (value: string) => void
  }
  showArcLayer: boolean
  setShowArcLayer: (setter: (prev: boolean) => boolean) => void
  showActiveDeliveries: boolean
  setShowActiveDeliveries: (setter: (prev: boolean) => boolean) => void
  showAssignedBookings: boolean
  setShowAssignedBookings: (setter: (prev: boolean) => boolean) => void

  // Debug controls
  debugMode?: boolean
  setDebugMode?: (setter: (prev: boolean) => boolean) => void
  debugShowCentroids?: boolean
  setDebugShowCentroids?: (setter: (prev: boolean) => boolean) => void
  debugShowClusterOrder?: boolean
  setDebugShowClusterOrder?: (setter: (prev: boolean) => boolean) => void
  debugShowTransitions?: boolean
  setDebugShowTransitions?: (setter: (prev: boolean) => boolean) => void

  // UI customisation
  triggerClassName?: string
  triggerVariant?: ButtonProps['variant']
  triggerSize?: ButtonProps['size']
  iconClassName?: string
  triggerTooltip?: string
  contentClassName?: string
  visibleSectionIds?: string[]
  hiddenSectionIds?: string[]
}
