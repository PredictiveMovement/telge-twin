import React from 'react'
import { LayerItem } from './types'
import { Switch } from '../ui/switch'

interface LayerToggleProps {
  item: LayerItem
}

export const LayerToggle: React.FC<LayerToggleProps> = ({ item }) => {
  const Icon = item.icon

  return (
    <div
      className="flex items-center justify-between w-full py-2 px-3 hover:bg-accent rounded-sm transition-colors focus-within:bg-accent"
      role="menuitem"
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{item.label}</span>
      </div>
      <Switch
        checked={item.checked}
        onCheckedChange={item.onChange}
        aria-label={`Toggle ${item.label}`}
        className="focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
    </div>
  )
}
