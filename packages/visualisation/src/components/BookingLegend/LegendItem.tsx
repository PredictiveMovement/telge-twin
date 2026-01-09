import React from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { LegendItemProps } from './types'
import { cn } from '@/lib/utils'

export const LegendItem: React.FC<LegendItemProps> = ({ item, onClick }) => {
  const { label, color, count, isActive } = item

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'w-full justify-between p-2 h-auto hover:bg-accent/50 transition-all duration-200',
        isActive
          ? 'bg-accent border border-border shadow-sm'
          : 'opacity-60 hover:opacity-80'
      )}
      aria-label={`${isActive ? 'Dölj' : 'Visa'} ${label}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 border border-border/20"
          style={{
            backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
          }}
        />
        <span className="text-sm font-medium text-left">{label}</span>
      </div>

      <Badge
        variant={isActive ? 'default' : 'secondary'}
        className="ml-2 text-xs min-w-[2rem] justify-center"
      >
        {count}
      </Badge>
    </Button>
  )
}
