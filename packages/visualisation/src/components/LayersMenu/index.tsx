import { Layers, Check } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { LayersMenuProps } from './types'
import { MAP_STYLES } from '../map/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

const mapStyleOptions = [
  { id: 'dark', label: 'Mörk', value: MAP_STYLES.dark },
  { id: 'satellite', label: 'Satellit', value: MAP_STYLES.satellite },
  { id: 'colorful', label: 'Färgrik', value: MAP_STYLES.colorful },
]

export default function LayersMenu(props: LayersMenuProps) {
  const {
    mapStyle,
    setMapStyle,
    enable3D,
    setEnable3D,
    triggerClassName = 'bg-white/90 text-gray-800 hover:bg-white h-8 w-8',
    triggerVariant = 'ghost',
    triggerSize = 'icon',
    iconClassName = 'h-4 w-4',
    triggerTooltip = 'Kartinställningar',
    contentClassName = 'bg-white/95 backdrop-blur',
  } = props

  const button = (
    <Button
      size={triggerSize}
      variant={triggerVariant}
      className={triggerClassName}
      aria-label={triggerTooltip}
    >
      <Layers className={iconClassName} />
    </Button>
  )

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`w-72 p-0 ${contentClassName}`}
        sideOffset={8}
      >
        <div className="max-h-96 overflow-y-auto">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-base">Lagerinställningar</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Välj kartbas och visuella inställningar
            </p>
          </div>

          <div className="p-4 space-y-6">
            {/* Map Style Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Kartbas</Label>
              <div className="space-y-1">
                {mapStyleOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setMapStyle(option.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                      mapStyle === option.value
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <span>{option.label}</span>
                    {mapStyle === option.value && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">3D-visning</Label>
                <p className="text-xs text-muted-foreground">
                  Visa byggnader i 3D
                </p>
              </div>
              <Switch
                checked={enable3D}
                onCheckedChange={(checked) => setEnable3D(() => checked)}
              />
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Wrap in Tooltip if tooltip text is provided
  if (triggerTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{menu}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{triggerTooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return menu
}
