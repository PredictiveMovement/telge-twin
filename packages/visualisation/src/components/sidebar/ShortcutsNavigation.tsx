import { NavItem } from './NavItem'
import { shortcutItems } from './types'

export function ShortcutsNavigation() {
  return (
    <div className="mt-16">
      <div className="text-center text-[10px] text-sidebar-foreground/60 uppercase tracking-wider mb-3">
        Genvägar
      </div>
      <div className="space-y-3 px-2">
        {shortcutItems.map((item) => (
          <NavItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  )
}
