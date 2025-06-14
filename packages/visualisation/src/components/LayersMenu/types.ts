import { LucideIcon } from 'lucide-react'

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

export interface LayersMenuProps {
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
  }
  showArcLayer: boolean
  setShowArcLayer: (setter: (prev: boolean) => boolean) => void
  showActiveDeliveries: boolean
  setShowActiveDeliveries: (setter: (prev: boolean) => boolean) => void
  showAssignedBookings: boolean
  setShowAssignedBookings: (setter: (prev: boolean) => boolean) => void
}
