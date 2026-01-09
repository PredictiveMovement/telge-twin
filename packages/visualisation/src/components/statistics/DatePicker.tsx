import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
interface DatePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
}
export const DatePicker: React.FC<DatePickerProps> = ({
  date,
  onDateChange,
}) => {
  const [open, setOpen] = useState(false)
  const handleDateSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate)
    if (selectedDate) {
      setOpen(false)
    }
  }
  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'yyyy-MM-dd') : <span>Välj datum</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
export default DatePicker
