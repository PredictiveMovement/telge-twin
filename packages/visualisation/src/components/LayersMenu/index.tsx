import { Layers } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { LayersMenuProps } from './types'
import { useLayersMenu } from './hooks/useLayersMenu'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { LayerSection } from './LayerSection'

export default function LayersMenu(props: LayersMenuProps) {
  const sections = useLayersMenu(props)
  const { menuRef } = useKeyboardNavigation(sections)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 hover:bg-accent"
          aria-label="Hantera kartlager"
        >
          <Layers className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div ref={menuRef} className="max-h-96 overflow-y-auto" tabIndex={-1}>
          <div className="p-4 border-b">
            <h3 className="font-semibold text-base">Kartlager</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Välj vilka lager som ska visas på kartan
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
}
