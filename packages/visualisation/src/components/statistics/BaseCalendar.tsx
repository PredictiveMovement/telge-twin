import React from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { sv } from 'date-fns/locale'
import { DayPickerProps } from 'react-day-picker'
import { CALENDAR_CONFIG } from '@/config/calendar'

interface BaseCalendarProps {
  showWeekNumbers?: boolean
  className?: string
}

const BaseCalendar: React.FC<BaseCalendarProps & DayPickerProps> = ({
  showWeekNumbers = true,
  className,
  ...props
}) => {
  return (
    <Card className="overflow-hidden border-0 shadow-none bg-white">
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] w-full">
          <Calendar
            initialFocus
            locale={sv}
            weekStartsOn={CALENDAR_CONFIG.WEEK_STARTS_ON}
            showWeekNumber={showWeekNumbers}
            modifiers={{
              today: new Date(),
            }}
            modifiersClassNames={{
              today:
                'bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground rounded-full',
            }}
            className={cn('w-full', className)}
            classNames={{
              months: 'flex flex-col space-y-4',
              month: 'space-y-4',
              caption: 'flex justify-center pt-1 relative items-center',
              caption_label: 'text-sm font-medium',
              nav: 'space-x-1 flex items-center',
              nav_button:
                'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-input rounded-md',
              nav_button_previous: 'absolute left-1',
              nav_button_next: 'absolute right-1',
              table: 'w-full border-collapse space-y-1',
              head_row: 'flex',
              head_cell:
                'text-muted-foreground rounded-md w-10 font-normal text-sm',
              row: 'flex w-full mt-2',
              cell: 'h-10 w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20 flex items-center justify-center',
              day: 'h-8 w-8 p-0 font-normal text-sm aria-selected:opacity-100 hover:bg-primary rounded-full aspect-square flex items-center justify-center',
              day_range_end: 'day-range-end rounded-full',
              day_selected:
                'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full',
              day_today:
                'bg-secondary text-secondary-foreground rounded-full h-8 w-8 aspect-square flex items-center justify-center relative z-10',
              day_outside:
                'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
              day_disabled: 'text-muted-foreground opacity-50',
              day_range_middle:
                'aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none',
              day_hidden: 'invisible',
              weeknumber:
                'text-muted-foreground text-[10px] font-normal h-10 w-10 flex items-center justify-center',
            }}
            formatters={{
              formatWeekNumber: (weekNumber: number) =>
                `${CALENDAR_CONFIG.WEEK_PREFIX}${weekNumber}`,
            }}
            {...props}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default BaseCalendar
