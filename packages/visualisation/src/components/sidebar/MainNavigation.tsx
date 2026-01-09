import { NavItem } from './NavItem'
import { mainNavItems } from './types'

export function MainNavigation() {
  return (
    <div className="mt-8">
      <div className="space-y-3 px-2">
        {mainNavItems.map((item) => (
          <NavItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  )
}
