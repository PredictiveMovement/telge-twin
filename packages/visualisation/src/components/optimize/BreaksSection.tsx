import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import BreakCard from './BreakCard'
interface BreakConfig {
  id: string
  name: string
  duration: number
  enabled: boolean
  desiredTime?: string
}
interface BreaksSectionProps {
  breaks: BreakConfig[]
  extraBreaks: BreakConfig[]
  timeOptions: string[]
  onBreaksChange: (breaks: BreakConfig[]) => void
  onExtraBreaksChange: (extraBreaks: BreakConfig[]) => void
  disableHover?: boolean
}
const BreaksSection: React.FC<BreaksSectionProps> = ({
  breaks,
  extraBreaks,
  timeOptions,
  onBreaksChange,
  onExtraBreaksChange,
  disableHover,
}) => {
  const updateBreakDuration = (id: string, change: number, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(
        extraBreaks.map((breakItem) =>
          breakItem.id === id
            ? {
                ...breakItem,
                duration: Math.max(5, breakItem.duration + change),
              }
            : breakItem
        )
      )
    } else {
      onBreaksChange(
        breaks.map((breakItem) =>
          breakItem.id === id
            ? {
                ...breakItem,
                duration: Math.max(5, breakItem.duration + change),
              }
            : breakItem
        )
      )
    }
  }
  const updateBreakName = (id: string, newName: string, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(
        extraBreaks.map((breakItem) =>
          breakItem.id === id
            ? {
                ...breakItem,
                name: newName,
              }
            : breakItem
        )
      )
    } else {
      onBreaksChange(
        breaks.map((breakItem) =>
          breakItem.id === id
            ? {
                ...breakItem,
                name: newName,
              }
            : breakItem
        )
      )
    }
  }
  const updateBreakTime = (id: string, newTime: string, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(
        extraBreaks.map((breakItem) =>
          breakItem.id === id
            ? {
                ...breakItem,
                desiredTime: newTime,
              }
            : breakItem
        )
      )
    } else {
      onBreaksChange(
        breaks.map((breakItem) =>
          breakItem.id === id
            ? {
                ...breakItem,
                desiredTime: newTime,
              }
            : breakItem
        )
      )
    }
  }
  const deleteBreak = (id: string, isExtra = false) => {
    if (isExtra) {
      onExtraBreaksChange(
        extraBreaks.filter((breakItem) => breakItem.id !== id)
      )
    } else {
      onBreaksChange(breaks.filter((breakItem) => breakItem.id !== id))
    }
  }
  const addExtraBreak = () => {
    const newBreak: BreakConfig = {
      id: `extra-${Date.now()}`,
      name: 'Kort rast',
      duration: 15,
      enabled: true,
      desiredTime: '10:00',
    }
    onExtraBreaksChange([...extraBreaks, newBreak])
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Raster</Label>
          <p className="text-muted-foreground mt-1 text-sm">
            Önskat klockslag är ungefärlig och planeras in där det passar i
            körturen
          </p>
        </div>
        <Button
          type="button"
          variant="primary-outline"
          size="sm"
          className="border-[1.5px]"
          onClick={addExtraBreak}
        >
          <Plus className="h-4 w-4 mr-2" />
          Lägg till rast
        </Button>
      </div>
      <div className="space-y-2">
        {breaks.map((breakItem) => (
          <BreakCard
            key={breakItem.id}
            breakItem={breakItem}
            isExtra={false}
            timeOptions={timeOptions}
            onUpdateDuration={updateBreakDuration}
            onUpdateName={updateBreakName}
            onUpdateTime={updateBreakTime}
            onDelete={deleteBreak}
            disableHover={disableHover}
          />
        ))}
        {extraBreaks.map((breakItem) => (
          <BreakCard
            key={breakItem.id}
            breakItem={breakItem}
            isExtra={true}
            timeOptions={timeOptions}
            onUpdateDuration={updateBreakDuration}
            onUpdateName={updateBreakName}
            onUpdateTime={updateBreakTime}
            onDelete={deleteBreak}
            disableHover={disableHover}
          />
        ))}
      </div>
    </div>
  )
}
export default BreaksSection
