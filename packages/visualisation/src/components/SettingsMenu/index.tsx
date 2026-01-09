import { Settings } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { SettingsMenuProps } from './types'
import { useSettingsMenu } from './hooks/useSettingsMenu'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { LayerSection } from './LayerSection'

export default function SettingsMenu(props: SettingsMenuProps) {
  const {
    triggerClassName = 'bg-white/90 text-gray-800 hover:bg-white h-8 w-8',
    triggerVariant = 'ghost',
    triggerSize = 'icon',
    iconClassName = 'h-4 w-4',
    triggerTooltip = 'Kartlager',
    contentClassName = 'bg-white/95 backdrop-blur',
    visibleSectionIds,
    hiddenSectionIds,
  } = props

  const allSections = useSettingsMenu(props)
  const { menuRef } = useKeyboardNavigation(allSections)

  // Filter sections based on visibleSectionIds and hiddenSectionIds
  let sections = allSections
  if (visibleSectionIds) {
    sections = sections.filter((s) => visibleSectionIds.includes(s.id))
  }
  if (hiddenSectionIds) {
    sections = sections.filter((s) => !hiddenSectionIds.includes(s.id))
  }

  const button = (
    <Button
      size={triggerSize}
      variant={triggerVariant}
      className={triggerClassName}
      aria-label={triggerTooltip}
    >
      <Settings className={iconClassName} />
    </Button>
  )

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`w-80 p-0 ${contentClassName}`}
        sideOffset={8}
      >
        <div ref={menuRef} className="max-h-96 overflow-y-auto" tabIndex={-1}>
          <div className="p-4 border-b">
            <h3 className="font-semibold text-base">Inställningar</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Anpassade inställningar för kartan
            </p>
          </div>
          <div className="py-2">
            {sections.map((section, index) => (
              <LayerSection
                key={section.id}
                section={section}
                isLast={index === sections.length - 1}
              />
            ))}
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
