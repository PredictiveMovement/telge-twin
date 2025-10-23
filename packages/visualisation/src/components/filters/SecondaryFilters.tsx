import React from 'react'
import WeekdayFilter from '@/components/filters/WeekdayFilter'
import FrequencyFilter from '@/components/filters/FrequencyFilter'
import SingleDatePicker from '@/components/statistics/SingleDatePicker'
import { Label } from '@/components/ui/label'
import { FilterConfiguration } from './FilterConfiguration'

interface SecondaryFiltersProps {
  configuration: FilterConfiguration
  data?: any
  searchFilters: {
    avfallstyp: string[]
    fordonstyp: string[]
    fordonsnummer: string[]
    tjanstetyp: string[]
    veckodag: string[]
    frekvens: string[]
    datum: string
  }
  selectedDate: Date | undefined
  isCalendarOpen: boolean
  setIsCalendarOpen: (open: boolean) => void
  onWeekdayChange: (weekdayId: string, checked: boolean) => void
  onFrequencyChange: (frequencyId: string, checked: boolean) => void
  onDateChange: (date: Date | undefined) => void
  // New clear functions
  onClearAllWeekdays?: () => void
  onClearAllFrequencies?: () => void
}

const SecondaryFilters: React.FC<SecondaryFiltersProps> = ({
  configuration,
  data,
  searchFilters,
  selectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  onWeekdayChange,
  onFrequencyChange,
  onDateChange,
  onClearAllWeekdays,
  onClearAllFrequencies,
}) => {
  // Use the actual data if provided, otherwise fallback to configuration
  const filterData = data || { settings: configuration }

  const isDateDisabled = () => false

  // Enhanced date change handler that clears weekday and frequency when date is selected
  const handleDateChange = (date: Date | undefined) => {
    onDateChange(date)

    // Clear weekday and frequency filters when a date is selected
    if (date) {
      // Use dedicated clear functions for more reliable clearing
      if (onClearAllWeekdays) {
        onClearAllWeekdays()
      }
      if (onClearAllFrequencies) {
        onClearAllFrequencies()
      }
    }
  }

  // Enhanced weekday change handler that clears date when weekday is selected
  const handleWeekdayChange = (weekdayId: string, checked: boolean) => {
    // Clear the selected date when a weekday is selected
    if (checked && selectedDate) {
      onDateChange(undefined)
    }
    onWeekdayChange(weekdayId, checked)
  }

  // Enhanced frequency change handler that clears date when frequency is selected
  const handleFrequencyChange = (frequencyId: string, checked: boolean) => {
    // Clear the selected date when a frequency is selected
    if (checked && selectedDate) {
      onDateChange(undefined)
    }
    onFrequencyChange(frequencyId, checked)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Veckodag */}
      <WeekdayFilter
        data={filterData}
        selectedWeekdays={searchFilters.veckodag
          .map((day) => {
            const found = configuration.veckodagar.find(
              (d) => d.BESKRIVNING === day
            )
            return found ? found.ID : ''
          })
          .filter(Boolean)}
        onWeekdayChange={handleWeekdayChange}
        onClearAllWeekdays={onClearAllWeekdays}
      />

      {/* Frekvens */}
      <FrequencyFilter
        data={filterData}
        selectedFrequencies={searchFilters.frekvens
          .map((freq) => {
            const found = configuration.frekvenser.find(
              (f) => f.BESKRIVNING === freq
            )
            return found ? found.ID : ''
          })
          .filter(Boolean)}
        onFrequencyChange={handleFrequencyChange}
        onClearAllFrequencies={onClearAllFrequencies}
      />

      {/* Datum */}
      <div className="space-y-2">
        <Label htmlFor="datum">Specifik dag</Label>
        <SingleDatePicker
          selectedDate={selectedDate}
          isCalendarOpen={isCalendarOpen}
          setIsCalendarOpen={setIsCalendarOpen}
          setSelectedDate={handleDateChange}
          isDateDisabled={isDateDisabled}
        />
      </div>
    </div>
  )
}

export default SecondaryFilters
