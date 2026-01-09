import { useCallback, useEffect, useRef } from 'react'
import { LayerSection } from '../types'

export const useKeyboardNavigation = (sections: LayerSection[]) => {
  const currentFocusIndex = useRef<number>(-1)
  const menuRef = useRef<HTMLDivElement>(null)

  const allItems = sections.flatMap((section) => section.items)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!menuRef.current) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          currentFocusIndex.current = Math.min(
            currentFocusIndex.current + 1,
            allItems.length - 1
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          currentFocusIndex.current = Math.max(currentFocusIndex.current - 1, 0)
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          if (currentFocusIndex.current >= 0) {
            allItems[currentFocusIndex.current]?.onChange()
          }
          break
        case 'Escape':
          break
        default:
          return
      }
    },
    [allItems]
  )

  useEffect(() => {
    const menu = menuRef.current
    if (menu) {
      menu.addEventListener('keydown', handleKeyDown)
      return () => menu.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return { menuRef, currentFocusIndex: currentFocusIndex.current }
}
