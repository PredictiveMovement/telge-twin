import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange'
  > {
  value?: number[]
  onValueChange?: (value: number[]) => void
  orientation?: 'horizontal' | 'vertical'
  max?: number
  min?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value,
      onValueChange,
      orientation = 'horizontal',
      max = 100,
      min = 0,
      step = 1,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value)
      onValueChange?.([newValue])
    }

    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value?.[0] ?? 0}
        onChange={handleChange}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 outline-none transition-opacity hover:opacity-70',
          orientation === 'vertical' && 'w-2 h-full transform rotate-[-90deg]',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none',
          className
        )}
        {...props}
      />
    )
  }
)

Slider.displayName = 'Slider'

export { Slider }
