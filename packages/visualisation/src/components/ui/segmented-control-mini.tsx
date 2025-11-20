import * as React from "react"
import { cn } from "@/lib/utils"

interface SegmentedControlMiniOption {
  value: string
  label: React.ReactNode
}

interface SegmentedControlMiniProps {
  options: SegmentedControlMiniOption[]
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

const SegmentedControlMini = React.forwardRef<
  HTMLDivElement,
  SegmentedControlMiniProps
>(({ 
  options, 
  value, 
  onValueChange,
  className,
  ...props 
}, ref) => {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`,
  }

  return (
    <div
      ref={ref}
      className={cn(
        "w-full h-[25px] items-center justify-center rounded-md bg-muted p-0.5",
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
            "h-[21px] inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            value === option.value
              ? "bg-white text-black shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
          onClick={() => onValueChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
})
SegmentedControlMini.displayName = "SegmentedControlMini"

export { SegmentedControlMini, type SegmentedControlMiniOption, type SegmentedControlMiniProps }