import * as React from "react"
import { cn } from "@/lib/utils"

interface SegmentedControlOption {
  value: string
  label: React.ReactNode
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  hideIfSingle?: boolean
}

const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(({ 
  options, 
  value, 
  onValueChange,
  className,
  hideIfSingle = false,
  ...props 
}, ref) => {
  if (hideIfSingle && options.length <= 1) return null

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`,
  }

  const renderLabel = (label: React.ReactNode) => {
    if (typeof label === 'string') {
      const emojiRegex = /^([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])+\s*/u
      const match = label.match(emojiRegex)
      
      if (match) {
        const emoji = match[0].trim()
        const text = label.slice(match[0].length)
        return (
          <>
            <span>{emoji}</span>
            <span className="ml-3">{text}</span>
          </>
        )
      }
    }
    return label
  }

  return (
    <div
      ref={ref}
      className={cn(
        "w-full h-[50px] items-center justify-center rounded-md bg-muted p-1",
        className
      )}
      style={gridStyle}
      {...props}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "h-[42px] inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            value === option.value
              ? "bg-white text-black shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
          onClick={() => onValueChange?.(option.value)}
        >
          <span className="flex items-center">{renderLabel(option.label)}</span>
        </button>
      ))}
    </div>
  )
})
SegmentedControl.displayName = "SegmentedControl"

export { SegmentedControl, type SegmentedControlOption, type SegmentedControlProps }