import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'
import { sv } from 'date-fns/locale'

interface CalendarPickerProps {
  dateRange: DateRange
  isCalendarOpen: boolean
  setIsCalendarOpen: (open: boolean) => void
  setDateRange: (range: DateRange | undefined) => void
  isDateDisabled: (day: Date) => boolean
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  dateRange,
  isCalendarOpen,
  setIsCalendarOpen,
  setDateRange,
  isDateDisabled,
}) => {
  return (
    <Collapsible
      open={isCalendarOpen}
      onOpenChange={setIsCalendarOpen}
      className="border border-border rounded-md"
    >
      <div className="p-3">
        <CollapsibleTrigger asChild>
          <div className="flex justify-between items-center cursor-pointer hover:bg-[hsl(var(--muted))] rounded-md p-2 -m-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Välj valfria datum i kalendern
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[hsl(var(--muted))]"
            >
              {isCalendarOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3">
          <Card className="overflow-hidden border-0 shadow-none">
            <CardContent className="p-0">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range)
                }}
                initialFocus
                locale={sv}
                weekStartsOn={1}
                disabled={isDateDisabled}
                modifiers={{
                  today: new Date(),
                }}
                modifiersClassNames={{
                  today:
                    'bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground',
                  selected: 'bg-primary text-primary-foreground',
                  range_start: 'bg-primary text-primary-foreground',
                  range_end: 'bg-primary text-primary-foreground',
                  range_middle: 'bg-accent text-accent-foreground opacity-75',
                }}
                className="pointer-events-auto w-full"
                classNames={{
                  months: 'flex flex-col space-y-3',
                  month: 'space-y-3 w-full',
                  table: 'w-full border-collapse space-y-1',
                  row: 'flex w-full mt-1 justify-between',
                  cell: 'h-7 w-full text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                  day: cn(
                    'h-7 w-full p-0 font-normal text-xs aria-selected:opacity-100 hover:bg-[hsl(var(--muted))]'
                  ),
                  day_disabled: 'text-muted-foreground opacity-50 bg-muted',
                  head_row: 'flex w-full justify-between',
                  head_cell:
                    'text-muted-foreground rounded-md w-full font-normal text-xs text-center',
                }}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end mt-4">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 hover:bg-[hsl(var(--muted))]"
              onClick={() => setIsCalendarOpen(false)}
            >
              <Check className="h-4 w-4" />
              Klar
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export default CalendarPicker
