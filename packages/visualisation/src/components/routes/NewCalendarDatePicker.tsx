import React from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import { sv } from 'date-fns/locale'
import { SegmentedControlMini } from '@/components/ui/segmented-control-mini'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Search, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getWeekNumber } from '@/hooks/useNewCalendarSelection'

interface NewCalendarDatePickerProps {
  onSearch?: () => void
  resultsRef?: React.RefObject<HTMLDivElement>
  mode: 'individual' | 'range'
  setMode: (mode: 'individual' | 'range') => void
  selectedDates: Date[]
  dateRange: DateRange | undefined
  selectedWeeks: number[]
  disabledDateRange: { before: Date; after: Date } | undefined
  handleDateSelect: (selection: Date[] | DateRange) => void
  handleWeekToggle: (weekNum: number) => void
  clearAll: () => void
  onFileUpload?: () => void
}

const NewCalendarDatePicker: React.FC<NewCalendarDatePickerProps> = ({ 
  onSearch, 
  resultsRef,
  mode,
  setMode,
  selectedDates,
  dateRange,
  selectedWeeks,
  disabledDateRange,
  handleDateSelect,
  handleWeekToggle,
  clearAll,
  onFileUpload
}) => {

  const [displayMonths, setDisplayMonths] = React.useState({
    left: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    right: new Date()
  })

  const setMonthsFromLeft = (left: Date) => {
    const normalizedLeft = new Date(left.getFullYear(), left.getMonth(), 1)
    const right = new Date(normalizedLeft.getFullYear(), normalizedLeft.getMonth() + 1, 1)
    setDisplayMonths({ left: normalizedLeft, right })
  }

  const setMonthsFromRight = (right: Date) => {
    const normalizedRight = new Date(right.getFullYear(), right.getMonth(), 1)
    const left = new Date(normalizedRight.getFullYear(), normalizedRight.getMonth() - 1, 1)
    setDisplayMonths({ left, right: normalizedRight })
  }

  // Helper to detect single-day selection in range mode
  const isSameDay = (a?: Date, b?: Date) => !!(a && b) && a.toDateString() === b.toDateString()
  const isSingleRange = mode === 'range' && dateRange?.from && dateRange?.to && isSameDay(dateRange.from, dateRange.to)
  
  const modifiers = React.useMemo(() => ({
    singleRange: isSingleRange && dateRange?.from ? [dateRange.from] : []
  }), [isSingleRange, dateRange])
  
  const modifiersClassNames = React.useMemo(() => ({
    singleRange: '!w-10 !h-10 !rounded-full !aspect-square'
  }), [])

  const getDisabledDates = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Normalisera datum för jämförelse (ignorera tid)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)

    // Tillåt inte framtida datum
    if (d > today) return true

    // Begränsa valbara dagar till ±13 dagar från startdatum i range-läge
    if (mode === 'range') {
      const from = dateRange?.from
      const to = dateRange?.to

      // Om vi har ett startdatum men inget slutdatum ännu
      if (from && !to) {
        const anchor = new Date(from)
        anchor.setHours(0, 0, 0, 0)

        const windowStart = new Date(anchor)
        windowStart.setDate(anchor.getDate() - 13)
        windowStart.setHours(0, 0, 0, 0)

        const windowEnd = new Date(anchor)
        windowEnd.setDate(anchor.getDate() + 13)
        windowEnd.setHours(0, 0, 0, 0)

        // Samkör med ev. övergripande disabledDateRange
        let minAllowed = windowStart
        let maxAllowed = new Date(Math.min(windowEnd.getTime(), today.getTime()))

        if (disabledDateRange) {
          if (disabledDateRange.before > minAllowed) minAllowed = new Date(disabledDateRange.before)
          if (disabledDateRange.after < maxAllowed) maxAllowed = new Date(disabledDateRange.after)
        }

        if (d < minAllowed || d > maxAllowed) return true
      } else if (disabledDateRange) {
        // När både from och to är satta, använd ev. extern begränsning
        if (d < disabledDateRange.before) return true
        if (d > disabledDateRange.after) return true
      }
    } else if (disabledDateRange) {
      // I andra lägen (t.ex. multiple) behåll ev. övergripande begränsning
      if (d < disabledDateRange.before) return true
      if (d > disabledDateRange.after) return true
    }

    return false
  }

  const classNames = {
    months: "flex flex-row gap-8",
    month: "space-y-4 flex-1",
    caption: "flex justify-center pt-1 relative items-center mb-4",
    caption_label: "text-base font-medium text-foreground",
    nav: "space-x-1 flex items-center",
    nav_button: cn(
      "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
      "hover:bg-accent/30 rounded-md transition-colors cursor-pointer"
    ),
    nav_button_previous: "absolute left-1",
    nav_button_next: "absolute right-1",
    table: "w-full border-collapse",
    head_row: "flex w-full",
    head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-sm text-center",
    row: "flex w-full mt-2",
    cell: cn(
      "relative p-0 text-center text-sm flex-1 flex items-center justify-center",
      "focus-within:relative focus-within:z-20",
      "min-w-0"
    ),
    day: cn(
      "h-10 w-10 p-0 font-normal text-foreground !aspect-square rounded-full",
      "flex items-center justify-center shrink-0",
      "bg-background",
      "hover:bg-accent/50 hover:!rounded-full transition-colors",
      "focus:outline-none focus:ring-2 focus:ring-ring"
    ),
    day_today: "!rounded-full !ring-2 !ring-secondary ring-inset !aspect-square !h-10 !w-10",
    day_selected: "!rounded-full !bg-secondary !text-secondary-foreground hover:!bg-secondary/90 !aspect-square !h-10 !w-10",
    day_disabled: "!text-muted-foreground !opacity-40 cursor-not-allowed hover:!bg-transparent pointer-events-none",
    day_range_middle: "aria-selected:!bg-secondary aria-selected:!text-secondary-foreground aria-selected:!rounded-full aria-selected:!w-10 aria-selected:!h-10 aria-selected:!aspect-square",
    day_range_start: "aria-selected:!rounded-full aria-selected:!bg-secondary aria-selected:!text-secondary-foreground aria-selected:!w-10 aria-selected:!h-10 aria-selected:!aspect-square",
    day_range_end: "aria-selected:!rounded-full aria-selected:!bg-secondary aria-selected:!text-secondary-foreground aria-selected:!w-10 aria-selected:!h-10 aria-selected:!aspect-square",
    week_number: "text-muted-foreground text-xs font-normal cursor-pointer hover:font-semibold rounded-md transition-colors flex items-center justify-end w-full h-10 px-2",
    week_number_cell: "w-10 shrink-0 grow-0 flex-none rounded-md transition-colors hover:bg-accent/50",
    weeknumber: "text-muted-foreground text-xs font-normal cursor-pointer hover:font-semibold rounded-md transition-colors flex items-center justify-end w-full h-10 px-2",
    weeknumbercell: "w-10 shrink-0 grow-0 flex-none rounded-md transition-colors hover:bg-accent/50",
  }

  const getSelectedDaysCount = () => {
    if (mode === 'individual') {
      return selectedDates.length
    } else {
      if (dateRange?.from && dateRange?.to) {
        return Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }
      return 0
    }
  }

  const hasValidSelection = () => {
    // Range-mode: giltig om både from och to är satta (även om de är samma dag)
    if (mode === 'range' && dateRange?.from && dateRange?.to) return true
    // Individual-mode: giltig om minst ett datum är valt
    if (mode === 'individual' && selectedDates.length > 0) return true
    // Giltig om veckor är valda
    if (selectedWeeks.length > 0) return true
    return false
  }

  const handleClearSelection = () => {
    clearAll()
  }

  // Detektera om vi har icke-konsekutiva veckor
  const hasNonConsecutiveWeeks = React.useMemo(() => {
    if (selectedWeeks.length === 2) {
      const sorted = [...selectedWeeks].sort((a, b) => a - b)
      return Math.abs(sorted[1] - sorted[0]) !== 1
    }
    return false
  }, [selectedWeeks])

  // Dynamisk mode baserat på om veckorna är konsekutiva
  const effectiveMode = mode === 'range' && hasNonConsecutiveWeeks ? 'multiple' : mode
  const effectiveSelection = effectiveMode === 'range' ? dateRange : selectedDates

  return (
    <div className="w-full">
      {/* Toprad: Segmented Control vänster + Dagaräknare höger */}
      <div className="flex justify-between items-center mb-6">
        <div className="w-64">
          <SegmentedControlMini 
            options={[
              { value: 'individual', label: 'Enskilda datum' },
              { value: 'range', label: 'Intervall' }
            ]}
            value={mode}
            onValueChange={(value) => setMode(value as 'individual' | 'range')}
          />
        </div>
        
        <div className="text-sm text-muted-foreground">
          {getSelectedDaysCount()} av 14 dagar valda
        </div>
      </div>

      {/* Separator ovanför kalendrar */}
      <div className="border-t border-border mb-6"></div>

      {/* Två kalendrar */}
      <div className="flex gap-8 w-full">
          {effectiveMode === 'range' ? (
            <>
              {/* Förra månaden - Range mode */}
              <div className="flex-1">
                <DayPicker 
                  mode="range"
                  selected={effectiveSelection as DateRange}
                  onSelect={(range) => handleDateSelect(range as DateRange)}
                  month={displayMonths.left}
                  onMonthChange={setMonthsFromLeft}
                  locale={sv}
                  showWeekNumber
                  disabled={getDisabledDates}
                  toDate={new Date()}
                  classNames={classNames}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                  className="pointer-events-auto"
                  formatters={{
                    formatWeekNumber: (weekNumber) => `v${weekNumber}`
                  }}
                  onWeekNumberClick={(weekNumber, dates) => {
                    const weekNum = getWeekNumber(dates[0])
                    handleWeekToggle(weekNum)
                  }}
                  components={{
                    IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                    IconRight: () => <ChevronRight className="h-4 w-4 opacity-30 cursor-not-allowed" />,
                  }}
                />
              </div>
              
              {/* Aktuell månad - Range mode */}
              <div className="flex-1">
                <DayPicker 
                  mode="range"
                  selected={effectiveSelection as DateRange}
                  onSelect={(range) => handleDateSelect(range as DateRange)}
                  month={displayMonths.right}
                  onMonthChange={setMonthsFromRight}
                  locale={sv}
                  showWeekNumber
                  disabled={getDisabledDates}
                  toDate={new Date()}
                  classNames={classNames}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                  className="pointer-events-auto"
                  formatters={{
                    formatWeekNumber: (weekNumber) => `v${weekNumber}`
                  }}
                  onWeekNumberClick={(weekNumber, dates) => {
                    const weekNum = getWeekNumber(dates[0])
                    handleWeekToggle(weekNum)
                  }}
                  components={{
                    IconLeft: () => <ChevronLeft className="h-4 w-4 opacity-30 cursor-not-allowed" />,
                    IconRight: () => <ChevronRight className="h-4 w-4" />,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {/* Förra månaden - Multiple mode */}
              <div className="flex-1">
                <DayPicker 
                  mode="multiple"
                  selected={effectiveSelection as Date[]}
                  onSelect={(dates) => handleDateSelect(dates as Date[])}
                  month={displayMonths.left}
                  onMonthChange={setMonthsFromLeft}
                  locale={sv}
                  showWeekNumber
                  disabled={getDisabledDates}
                  toDate={new Date()}
                  classNames={classNames}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                  className="pointer-events-auto"
                  formatters={{
                    formatWeekNumber: (weekNumber) => `v${weekNumber}`
                  }}
                  onWeekNumberClick={(weekNumber, dates) => {
                    const weekNum = getWeekNumber(dates[0])
                    handleWeekToggle(weekNum)
                  }}
                  components={{
                    IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                    IconRight: () => <ChevronRight className="h-4 w-4 opacity-30 cursor-not-allowed" />,
                  }}
                />
              </div>
              
              {/* Aktuell månad - Multiple mode */}
              <div className="flex-1">
                <DayPicker 
                  mode="multiple"
                  selected={effectiveSelection as Date[]}
                  onSelect={(dates) => handleDateSelect(dates as Date[])}
                  month={displayMonths.right}
                  onMonthChange={setMonthsFromRight}
                  locale={sv}
                  showWeekNumber
                  disabled={getDisabledDates}
                  toDate={new Date()}
                  classNames={classNames}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                  className="pointer-events-auto"
                  formatters={{
                    formatWeekNumber: (weekNumber) => `v${weekNumber}`
                  }}
                  onWeekNumberClick={(weekNumber, dates) => {
                    const weekNum = getWeekNumber(dates[0])
                    handleWeekToggle(weekNum)
                  }}
                  components={{
                    IconLeft: () => <ChevronLeft className="h-4 w-4 opacity-30 cursor-not-allowed" />,
                    IconRight: () => <ChevronRight className="h-4 w-4" />,
                  }}
                />
              </div>
            </>
          )}
      </div>

      {/* Separator under kalendrar */}
      <div className="border-t border-border mt-8 mb-8"></div>

      {/* Knappar - Rensa vänster, Ladda upp fil + Hämta körtur höger */}
      <div className="flex justify-between items-center">
        <Button 
          variant="outline"
          className="px-6"
          onClick={handleClearSelection}
          disabled={!hasValidSelection()}
        >
          <X size={16} className="mr-2" />
          Rensa
        </Button>

        <div className="flex gap-3">
          {onFileUpload && (
            <Button 
              variant="secondary"
              className="px-8"
              onClick={onFileUpload}
            >
              <Upload size={16} className="mr-2" />
              Ladda upp fil
            </Button>
          )}

          <Button 
            onClick={() => {
              onSearch?.()
              
              // Auto-scroll till resultat efter sökning
              setTimeout(() => {
                if (resultsRef?.current) {
                  const rect = resultsRef.current.getBoundingClientRect()
                  const top = rect.top + window.scrollY
                  window.scrollTo({
                    top: Math.max(0, top),
                    behavior: "smooth"
                  })
                }
              }, 100)
            }} 
            className="bg-primary hover:bg-primary/90 px-8"
            disabled={!hasValidSelection()}
          >
            <Search size={16} className="mr-2" />
            Hämta körtur
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NewCalendarDatePicker