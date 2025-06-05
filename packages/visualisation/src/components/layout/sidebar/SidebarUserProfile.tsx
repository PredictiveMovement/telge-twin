import { SidebarFooter } from '@/components/ui/sidebar'

interface SidebarUserProfileProps {
  isCollapsed: boolean
}

const SidebarUserProfile = ({ isCollapsed }: SidebarUserProfileProps) => {
  return (
    <SidebarFooter className="p-4 border-t">
      <div
        className={`flex items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent transition-colors ${
          isCollapsed ? 'justify-center' : ''
        }`}
      >
        <div
          className="h-8 w-8 rounded-full bg-telge-gul flex items-center justify-center text-xs font-medium text-telge-svart"
          title="Tomas Brum"
        >
          TB
        </div>
        {!isCollapsed && (
          <div className="flex-1 transition-all duration-300">
            <p className="text-sm font-medium">Tomas Brum</p>
            <p className="text-xs text-muted-foreground">Administratör</p>
          </div>
        )}
      </div>
    </SidebarFooter>
  )
}

export default SidebarUserProfile
