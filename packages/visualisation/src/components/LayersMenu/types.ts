import type { ButtonProps } from '../ui/button'

export interface MapStyleOption {
  id: string
  label: string
  value: string
}

export interface LayersMenuProps {
  mapStyle: string
  setMapStyle: (value: string) => void
  enable3D: boolean
  setEnable3D: (setter: (prev: boolean) => boolean) => void

  // UI customisation
  triggerClassName?: string
  triggerVariant?: ButtonProps['variant']
  triggerSize?: ButtonProps['size']
  iconClassName?: string
  triggerTooltip?: string
  contentClassName?: string
}
