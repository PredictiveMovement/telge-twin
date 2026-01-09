import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface PeriodOption {
  value: number
  label: string
  year?: number
}

interface PeriodSelectorProps {
  period: string
  selectedWeek: number
  selectedMonth: number
  selectedQuarter: number
  selectedYear: number
  availableWeeks: PeriodOption[]
  availableMonths: PeriodOption[]
  availableQuarters: PeriodOption[]
  availableYears: PeriodOption[]
  onPeriodSelection: (periodType: string, specificValue?: number) => void
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  selectedWeek,
  selectedMonth,
  selectedQuarter,
  selectedYear,
  availableWeeks,
  availableMonths,
  availableQuarters,
  availableYears,
  onPeriodSelection,
}) => {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Button
          variant="outline"
          className={cn(
            'w-full hover:bg-[hsl(var(--muted))]',
            period === 'today' ? 'border-primary border-2' : ''
          )}
          onClick={() => onPeriodSelection('today')}
        >
          Idag
        </Button>
        <Button
          variant="outline"
          className={cn(
            'w-full hover:bg-[hsl(var(--muted))]',
            period === 'yesterday' ? 'border-primary border-2' : ''
          )}
          onClick={() => onPeriodSelection('yesterday')}
        >
          Igår
        </Button>
        <Button
          variant="outline"
          className={cn(
            'w-full hover:bg-[hsl(var(--muted))]',
            period === 'dayBeforeYesterday' ? 'border-primary border-2' : ''
          )}
          onClick={() => onPeriodSelection('dayBeforeYesterday')}
        >
          I förrgår
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-between hover:bg-[hsl(var(--muted))]',
                period === 'week' ? 'border-primary border-2' : ''
              )}
            >
              <span>Vecka {selectedWeek}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-popover text-popover-foreground border-border"
          >
            {availableWeeks.map((week) => (
              <DropdownMenuItem
                key={week.value}
                onClick={() => onPeriodSelection('week', week.value)}
                className={cn(
                  selectedWeek === week.value &&
                    'text-muted-foreground bg-muted pointer-events-none'
                )}
              >
                {week.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-between hover:bg-[hsl(var(--muted))]',
                period === 'month' ? 'border-primary border-2' : ''
              )}
            >
              <span>
                {availableMonths.find((m) => m.value === selectedMonth)
                  ?.label || 'Månad'}
                {availableMonths.find((m) => m.value === selectedMonth)
                  ?.year !== 2025 &&
                  availableMonths.find((m) => m.value === selectedMonth)
                    ?.year &&
                  ` ${
                    availableMonths.find((m) => m.value === selectedMonth)?.year
                  }`}
              </span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-popover text-popover-foreground border-border"
          >
            {availableMonths.map((month, index) => {
              const showYear =
                index === 0 ||
                (availableMonths[index - 1]?.year !== month.year &&
                  month.year !== undefined)

              return (
                <DropdownMenuItem
                  key={`${month.value}-${month.year}`}
                  onClick={() => onPeriodSelection('month', month.value)}
                  className={cn(
                    selectedMonth === month.value &&
                      'text-muted-foreground bg-muted pointer-events-none'
                  )}
                >
                  {month.label}
                  {showYear && month.year && month.year !== 2025
                    ? ` ${month.year}`
                    : ''}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-between hover:bg-[hsl(var(--muted))]',
                period === 'quarter' ? 'border-primary border-2' : ''
              )}
            >
              <span>
                Kvartal {selectedQuarter}
                {availableQuarters.find((q) => q.value === selectedQuarter)
                  ?.year !== 2025 &&
                  availableQuarters.find((q) => q.value === selectedQuarter)
                    ?.year &&
                  ` ${
                    availableQuarters.find((q) => q.value === selectedQuarter)
                      ?.year
                  }`}
              </span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-popover text-popover-foreground border-border"
          >
            {availableQuarters.map((quarter, index) => {
              const showYear =
                index === 0 ||
                (availableQuarters[index - 1]?.year !== quarter.year &&
                  quarter.year !== undefined)

              const shouldShowYear =
                quarter.value !== 2 &&
                showYear &&
                quarter.year !== undefined &&
                quarter.year !== 2025

              return (
                <DropdownMenuItem
                  key={`${quarter.value}-${quarter.year}`}
                  onClick={() => onPeriodSelection('quarter', quarter.value)}
                  className={cn(
                    selectedQuarter === quarter.value &&
                      'text-muted-foreground bg-muted pointer-events-none'
                  )}
                >
                  {quarter.label}
                  {shouldShowYear ? ` ${quarter.year}` : ''}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-between hover:bg-[hsl(var(--muted))]',
                period === 'year' ? 'border-primary border-2' : ''
              )}
            >
              <span>{selectedYear}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-popover text-popover-foreground border-border"
          >
            {availableYears.map((year) => (
              <DropdownMenuItem
                key={year.value}
                onClick={() => onPeriodSelection('year', year.value)}
                className={cn(
                  selectedYear === year.value &&
                    'text-muted-foreground bg-muted pointer-events-none'
                )}
              >
                {year.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default PeriodSelector
