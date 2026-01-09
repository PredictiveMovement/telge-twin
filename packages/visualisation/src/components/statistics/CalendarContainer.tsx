import React, { useEffect, useRef, useState } from 'react'
import { CalendarIcon, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
interface CalendarContainerProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  hasActiveFilter: boolean
  displayText: string
  children: React.ReactNode
  showActionButton?: boolean
  onActionClick?: () => void
  shortTitle?: string
}

const CalendarContainer: React.FC<CalendarContainerProps> = ({
  isOpen,
  setIsOpen,
  hasActiveFilter,
  displayText,
  children,
  showActionButton = false,
  onActionClick,
  shortTitle = 'Datum...',
}) => {
  const textContainerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [useShortTitleState, setUseShortTitleState] = useState(false)

  const recomputeOverflow = () => {
    const container = textContainerRef.current
    const measurer = measureRef.current
    if (container && measurer) {
      const containerWidth = container.clientWidth
      const contentWidth = measurer.scrollWidth
      setUseShortTitleState(contentWidth > containerWidth)
    }
  }

  useEffect(() => {
    recomputeOverflow()
  }, [displayText, isOpen])

  useEffect(() => {
    const container = textContainerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => recomputeOverflow())
    ro.observe(container)
    window.addEventListener('resize', recomputeOverflow)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recomputeOverflow)
    }
  }, [])

  return (
    <div className="relative">
      <div
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 outline-none border ${
          hasActiveFilter ? 'border-2 border-primary' : 'border border-input'
        } bg-background hover:bg-[#fafafa] hover:text-accent-foreground w-full h-[42px] justify-between cursor-pointer px-4 py-2`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          ref={textContainerRef}
          className="relative flex items-center gap-2 flex-1 min-w-0"
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium truncate" title={displayText}>
            {useShortTitleState ? shortTitle : displayText}
          </p>
          <span
            ref={measureRef}
            className="invisible absolute whitespace-nowrap max-w-full"
          >
            {displayText}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-[#fbfbfb]"
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4 opacity-50" />
          ) : (
            <ChevronDown className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-input rounded-md shadow-lg px-3 pb-3">
          <div className="mt-3">{children}</div>
          {showActionButton && (
            <div className="flex justify-end mt-4">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 hover:bg-[#fbfbfb] rounded-md"
                onClick={onActionClick}
              >
                <Check className="h-4 w-4" />
                Klar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CalendarContainer
