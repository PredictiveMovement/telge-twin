import { SidebarHeader } from './sidebar/SidebarHeader'
import { MainNavigation } from './sidebar/MainNavigation'
import { ShortcutsNavigation } from './sidebar/ShortcutsNavigation'
import { UserProfile } from './sidebar/UserProfile'

export function DashboardSidebar() {
  return (
    <div className="w-[78px] bg-sidebar border-r border-sidebar-border shadow-lg flex flex-col h-screen fixed left-0 top-0 z-50">
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto">
        <MainNavigation />
        <ShortcutsNavigation />
      </div>

      <UserProfile />
    </div>
  )
}
