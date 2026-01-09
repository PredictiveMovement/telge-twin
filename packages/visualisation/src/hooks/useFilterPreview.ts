import { useMemo, type RefObject } from 'react'

type FilterOption = {
  ID: string
  BESKRIVNING?: string
}

type UseFilterPreviewParams = {
  selectedValues: string[]
  options: FilterOption[]
  placeholder?: string
  containerRef?: RefObject<HTMLElement>
  maxPreviewItems?: number
}

type FilterPreview = {
  getDisplayText: () => string
}

const resolveLabel = (value: string, options: FilterOption[]) => {
  const match = options.find((option) => option.ID === value)
  return match?.BESKRIVNING || value
}

const buildPreview = (
  selectedValues: string[],
  options: FilterOption[],
  placeholder: string,
  maxPreviewItems: number
): string => {
  if (!selectedValues.length) {
    return placeholder
  }

  const labels = selectedValues
    .map((value) => resolveLabel(value, options))
    .filter((label): label is string => Boolean(label))

  if (labels.length <= maxPreviewItems) {
    return labels.join(', ')
  }

  const preview = labels.slice(0, maxPreviewItems).join(', ')
  const remaining = labels.length - maxPreviewItems
  return `${preview} +${remaining}`
}

export const useFilterPreview = ({
  selectedValues,
  options,
  placeholder = 'Alla',
  containerRef: _containerRef,
  maxPreviewItems = 3,
}: UseFilterPreviewParams): FilterPreview => {
  const text = useMemo(() => {
    const basePlaceholder = placeholder || 'Alla'
    return buildPreview(selectedValues, options, basePlaceholder, maxPreviewItems)
  }, [selectedValues, options, placeholder, maxPreviewItems])

  // API kept for backward compatibility. It does not (yet) measure container width,
  // but returning a function makes it easy to extend if that becomes necessary.
  const getDisplayText = () => text

  return { getDisplayText }
}

export type { FilterOption }
