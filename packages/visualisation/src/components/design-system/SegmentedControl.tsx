import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SegmentedControlOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  hideIfSingle?: boolean
}

export const SegmentedControl = ({
  options,
  value,
  onValueChange,
  className = '',
  hideIfSingle = false,
}: SegmentedControlProps) => {
  if (hideIfSingle && options.length <= 1) return null

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.max(
      options.length,
      1
    )}, minmax(0, 1fr))`,
  }

  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList className="w-full bg-muted" style={gridStyle}>
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="data-[state=active]:bg-background data-[state=active]:text-foreground"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
