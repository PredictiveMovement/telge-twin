import { useState } from 'react'
import { DateRange } from 'react-day-picker'

type SelectionMode = 'individual' | 'range'

// Helper för att få veckonummer
export const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Helper för att konvertera veckonummer till datumintervall
const getWeekDateRange = (weekNum: number, year: number = new Date().getFullYear()): { from: Date; to: Date } => {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const weekStart = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7)
  
  const from = new Date(weekStart)
  const to = new Date(weekStart)
  to.setDate(to.getDate() + 6)
  
  return { from, to }
}

// Generera tillgängliga veckor
const getAvailableWeeks = () => {
  const weeks = []
  const currentDate = new Date()
  const currentWeek = getWeekNumber(currentDate)
  
  // Generera senaste 8 veckorna med svenska etiketter
  for (let i = 0; i < 8; i++) {
    const weekNum = currentWeek - i
    if (weekNum > 0) {
      let label
      if (i === 0) {
        label = 'Denna vecka'
      } else if (i === 1) {
        label = 'Förra veckan'
      } else {
        label = `Vecka ${weekNum}`
      }
      
      weeks.push({
        value: weekNum,
        label: label
      })
    }
  }
  
  return weeks
}

export const useNewCalendarSelection = () => {
  const today = new Date()
  const [mode, setMode] = useState<SelectionMode>('individual')
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([])
  const [disabledDateRange, setDisabledDateRange] = useState<{ before: Date; after: Date } | undefined>()

  const handleModeChange = (newMode: SelectionMode) => {
    setMode(newMode)
    // Nollställ selections när mode ändras
    setSelectedDates([])
    setDateRange(undefined)
    setDisabledDateRange(undefined)
  }

  const handleDateSelect = (dates: Date[] | DateRange | undefined) => {
    // Nollställ veckor när användaren väljer manuellt i kalendern
    setSelectedWeeks([])
    
    if (mode === 'individual') {
      const newDates = dates as Date[]
      if (newDates && newDates.length <= 14) {
        setSelectedDates(newDates)
      }
    } else {
      const range = dates as DateRange
      
      if (!range) {
        setDateRange(undefined)
        setDisabledDateRange(undefined)
        return
      }
      
      // Om bara from är satt (första klicket)
      if (range.from && !range.to) {
        setDateRange({ from: range.from, to: undefined })
        
        const before = new Date(range.from)
        before.setDate(before.getDate() - 14)
        const after = new Date(range.from)
        after.setDate(after.getDate() + 14)
        setDisabledDateRange({ before, after })
        return
      }
      
      // Om både from och to är satta (andra klicket - komplett range eller enskild dag)
      if (range.from && range.to) {
        const daysDiff = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24))
        // Tillåt enskild dag (daysDiff === 0) eller intervall upp till 14 dagar (daysDiff <= 13)
        if (daysDiff >= 0 && daysDiff <= 13) {
          setDateRange(range)
          setDisabledDateRange(undefined)
        }
      }
    }
  }

  const setToday = () => {
    const today = new Date()
    setSelectedWeeks([])
    if (mode === 'range') {
      setDateRange({ from: today, to: today })
    } else {
      setSelectedDates([today])
    }
  }

  const setYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    setSelectedWeeks([])
    if (mode === 'range') {
      setDateRange({ from: yesterday, to: yesterday })
    } else {
      setSelectedDates([yesterday])
    }
  }

  const setDayBeforeYesterday = () => {
    const dayBefore = new Date()
    dayBefore.setDate(dayBefore.getDate() - 2)
    setSelectedWeeks([])
    if (mode === 'range') {
      setDateRange({ from: dayBefore, to: dayBefore })
    } else {
      setSelectedDates([dayBefore])
    }
  }

  const handleWeekToggle = (weekValue: number) => {
    setSelectedWeeks(prev => {
      let newWeeks
      if (prev.includes(weekValue)) {
        newWeeks = prev.filter(w => w !== weekValue)
      } else if (prev.length < 2) {
        newWeeks = [...prev, weekValue]
      } else {
        return prev
      }
      
      // Synka kalendern med veckovalen
      if (newWeeks.length > 0) {
        const sortedWeeks = [...newWeeks].sort((a, b) => a - b)
        
        // Kontrollera om veckorna är konsekutiva
        const areConsecutive = newWeeks.length === 1 || 
          (newWeeks.length === 2 && Math.abs(sortedWeeks[1] - sortedWeeks[0]) === 1)
        
        if (mode === 'range' && areConsecutive) {
          // Konsekutiva veckor: använd range
          const firstWeek = getWeekDateRange(sortedWeeks[0])
          const lastWeek = getWeekDateRange(sortedWeeks[sortedWeeks.length - 1])
          setDateRange({ from: firstWeek.from, to: lastWeek.to })
        } else {
          // Icke-konsekutiva veckor ELLER individual-läge: samla alla datum
          const allDates: Date[] = []
          sortedWeeks.forEach(week => {
            const { from, to } = getWeekDateRange(week)
            const current = new Date(from)
            while (current <= to) {
              allDates.push(new Date(current))
              current.setDate(current.getDate() + 1)
            }
          })
          setSelectedDates(allDates)
          
          // I range-läge med icke-konsekutiva veckor, nollställ dateRange
          if (mode === 'range') {
            setDateRange(undefined)
          }
        }
      } else {
        // Nollställ kalenderval om inga veckor är valda
        setDateRange(undefined)
        setSelectedDates([])
      }
      
      return newWeeks
    })
  }

  const clearAll = () => {
    setSelectedDates([])
    setDateRange(undefined)
    setSelectedWeeks([])
    setDisabledDateRange(undefined)
  }

  const getSelectedWeekLabel = () => {
    if (selectedWeeks.length === 0) return 'Välj vecka'
    
    const sortedWeeks = [...selectedWeeks].sort((a, b) => a - b)
    const currentWeek = getWeekNumber(new Date())
    
    if (selectedWeeks.length === 1) {
      const selectedWeek = sortedWeeks[0]
      
      if (selectedWeek === currentWeek) {
        return 'Denna vecka'
      } else if (selectedWeek === currentWeek - 1) {
        return 'Förra veckan'
      } else {
        return `Vecka ${selectedWeek}`
      }
    }
    
    // För flera veckor, visa "Veckor X, Y"
    return `Veckor ${sortedWeeks.join(', ')}`
  }

  const availableWeeks = getAvailableWeeks()

  return {
    mode,
    setMode: handleModeChange,
    selectedDates,
    dateRange,
    selectedWeeks,
    availableWeeks,
    disabledDateRange,
    handleDateSelect,
    setToday,
    setYesterday,
    setDayBeforeYesterday,
    handleWeekToggle,
    getSelectedWeekLabel,
    clearAll
  }
}