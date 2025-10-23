import React from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import BaseCalendar from '@/components/statistics/BaseCalendar'
import CalendarContainer from '@/components/statistics/CalendarContainer'

interface SingleDatePickerProps {
  selectedDate: Date | undefined
  isCalendarOpen: boolean
  setIsCalendarOpen: (open: boolean) => void
  setSelectedDate: (date: Date | undefined) => void
  isDateDisabled: (day: Date) => boolean
}

const SingleDatePicker: React.FC<SingleDatePickerProps> = ({
  selectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  setSelectedDate,
  isDateDisabled,
}) => {
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    // Automatically close the calendar when a date is selected
    if (date) {
      setIsCalendarOpen(false)
    }
  }

  const getDisplayText = () => {
    return selectedDate
      ? format(selectedDate, 'dd MMMM yyyy', { locale: sv })
      : 'Välj ett datum i kalendern'
  }

  return (
    <CalendarContainer
      isOpen={isCalendarOpen}
      setIsOpen={setIsCalendarOpen}
      hasActiveFilter={!!selectedDate}
      displayText={getDisplayText()}
    >
      <BaseCalendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        disabled={isDateDisabled}
        className="pointer-events-auto"
        classNames={{
          months: 'flex flex-col space-y-3',
          month: 'space-y-3 w-full',
          table: 'w-full border-collapse space-y-1',
          row: 'flex w-full mt-1 justify-between',
          cell: 'h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 flex items-center justify-center',
          day: 'h-8 w-8 p-0 font-normal text-sm aria-selected:opacity-100 hover:bg-[hsl(var(--muted))] rounded-full aspect-square flex items-center justify-center',
          day_disabled:
            'text-muted-foreground opacity-50 bg-muted rounded-full h-8 w-8 aspect-square flex items-center justify-center',
          head_row: 'flex w-full justify-between',
          head_cell:
            'text-muted-foreground rounded-md w-10 font-normal text-sm text-center flex items-center justify-center',
          weeknumber:
            'text-muted-foreground text-[10px] font-normal h-10 w-10 flex items-center justify-center',
        }}
      />
    </CalendarContainer>
  )
}

export default SingleDatePicker
