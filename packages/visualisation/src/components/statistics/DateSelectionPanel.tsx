import React from 'react'
import { Button } from '@/components/ui/button'
import { DateRange } from 'react-day-picker'
import PeriodSelector from './PeriodSelector'
import CalendarPicker from './CalendarPicker'
import { format } from 'date-fns'
interface PeriodOption {
  value: number
  label: string
}
interface DateSelectionPanelProps {
  period: string
  selectedWeek: number
  selectedMonth: number
  selectedQuarter: number
  selectedYear: number
  availableWeeks: PeriodOption[]
  availableMonths: PeriodOption[]
  availableQuarters: PeriodOption[]
  availableYears: PeriodOption[]
  dateRange: DateRange
  isCalendarOpen: boolean
  setIsCalendarOpen: (open: boolean) => void
  setDateRange: (range: DateRange | undefined) => void
  isDateDisabled: (day: Date) => boolean
  onPeriodSelection: (periodType: string, specificValue?: number) => void
  handleUpdate: () => void
}
const DateSelectionPanel: React.FC<DateSelectionPanelProps> = ({
  period,
  selectedWeek,
  selectedMonth,
  selectedQuarter,
  selectedYear,
  availableWeeks,
  availableMonths,
  availableQuarters,
  availableYears,
  dateRange,
  isCalendarOpen,
  setIsCalendarOpen,
  setDateRange,
  isDateDisabled,
  onPeriodSelection,
  handleUpdate,
}) => {
  const handleCalendarDateChange = (range: DateRange | undefined) => {
    if (range) {
      setDateRange(range)
      if (range.from) {
        onPeriodSelection('custom')
      }
    }
  }
  return (
    <div className="max-w-xl py-[18px]">
      <h2 className="text-3xl font-normal mb-6">Välj period</h2>

      <div className="grid gap-6">
        <PeriodSelector
          period={period}
          selectedWeek={selectedWeek}
          selectedMonth={selectedMonth}
          selectedQuarter={selectedQuarter}
          selectedYear={selectedYear}
          availableWeeks={availableWeeks}
          availableMonths={availableMonths}
          availableQuarters={availableQuarters}
          availableYears={availableYears}
          onPeriodSelection={onPeriodSelection}
        />

        <div>
          <CalendarPicker
            dateRange={dateRange}
            isCalendarOpen={isCalendarOpen}
            setIsCalendarOpen={setIsCalendarOpen}
            setDateRange={handleCalendarDateChange}
            isDateDisabled={isDateDisabled}
          />

          {dateRange.from && (
            <div className="bg-telge-ljusgron15 p-4 rounded-md mt-4">
              <div className="flex justify-between items-end">
                <div className="min-h-[80px] flex flex-col justify-between">
                  <p className="font-medium text-sm py-[5px]">Vald period</p>
                  <div>
                    {period === 'today' && (
                      <>
                        <div className="text-lg font-medium">Idag</div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM yyyy')}
                        </div>
                      </>
                    )}
                    {period === 'yesterday' && (
                      <>
                        <div className="text-lg font-medium">Igår</div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM yyyy')}
                        </div>
                      </>
                    )}
                    {period === 'dayBeforeYesterday' && (
                      <>
                        <div className="text-lg font-medium">I förrgår</div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM yyyy')}
                        </div>
                      </>
                    )}
                    {period === 'week' && (
                      <>
                        <div className="text-lg font-medium">
                          Vecka {selectedWeek}
                        </div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM')} –{' '}
                          {format(
                            dateRange.to || dateRange.from,
                            'd MMMM yyyy'
                          )}
                        </div>
                      </>
                    )}
                    {period === 'month' && (
                      <>
                        <div className="text-lg font-medium py-0">
                          {
                            availableMonths.find(
                              (m) => m.value === selectedMonth
                            )?.label
                          }
                        </div>
                        <div className="text-sm py-0">
                          {format(dateRange.from, 'd MMMM')} –{' '}
                          {format(
                            dateRange.to || dateRange.from,
                            'd MMMM yyyy'
                          )}
                        </div>
                      </>
                    )}
                    {period === 'quarter' && (
                      <>
                        <div className="text-lg font-medium">
                          Kvartal {selectedQuarter}
                        </div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM')} –{' '}
                          {format(
                            dateRange.to || dateRange.from,
                            'd MMMM yyyy'
                          )}
                        </div>
                      </>
                    )}
                    {period === 'year' && (
                      <>
                        <div className="text-lg font-medium">
                          {selectedYear}
                        </div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM')} –{' '}
                          {format(
                            dateRange.to || dateRange.from,
                            'd MMMM yyyy'
                          )}
                        </div>
                      </>
                    )}
                    {period === 'custom' && (
                      <>
                        <div className="text-lg font-medium">
                          Anpassad period
                        </div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM yyyy')}
                          {dateRange.to
                            ? ` – ${format(dateRange.to, 'd MMMM yyyy')}`
                            : ''}
                        </div>
                      </>
                    )}
                    {![
                      'today',
                      'yesterday',
                      'dayBeforeYesterday',
                      'week',
                      'month',
                      'quarter',
                      'year',
                      'custom',
                    ].includes(period) && (
                      <>
                        <div className="text-lg font-medium">
                          Anpassad period
                        </div>
                        <div className="text-sm">
                          {format(dateRange.from, 'd MMMM yyyy')}
                          {dateRange.to
                            ? ` – ${format(dateRange.to, 'd MMMM yyyy')}`
                            : ''}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleUpdate}
                  className="hover:bg-primary/90 px-[60px] self-end"
                >
                  <span className="text-sm font-medium">Hämta ruttdata</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default DateSelectionPanel
