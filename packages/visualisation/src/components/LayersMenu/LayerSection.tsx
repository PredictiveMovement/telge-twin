import React from 'react'
import { LayerSection as LayerSectionType } from './types'
import { LayerToggle } from './LayerToggle'
import { Separator } from '../ui/separator'

interface LayerSectionProps {
  section: LayerSectionType
  isLast?: boolean
}

export const LayerSection: React.FC<LayerSectionProps> = ({
  section,
  isLast = false,
}) => {
  return (
    <div>
      <div className="px-3 py-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {section.title}
        </h4>
      </div>
      <div className="space-y-1">
        {section.items.map((item) => (
          <LayerToggle key={item.id} item={item} />
        ))}
      </div>
      {!isLast && <Separator className="my-3" />}
    </div>
  )
}
