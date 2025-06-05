import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import SidebarNavigation from './sidebar/SidebarNavigation'
import SidebarUserProfile from './sidebar/SidebarUserProfile'

const Sidebar = () => {
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const headerPadding = isCollapsed ? 'px-2' : 'px-[10px]'
  const headerLayout = isCollapsed ? 'justify-center' : 'justify-between'
  const buttonPosition = isCollapsed ? 'mx-auto' : ''

  return (
    <SidebarComponent variant="sidebar" collapsible="icon">
      <SidebarHeader className={`py-6 bg-[#f7f7f7] ${headerPadding}`}>
        <div className={`flex items-center w-full ${headerLayout}`}>
          {!isCollapsed && (
            <div className="transition-opacity duration-300">
              <span className="text-xl font-semibold font-prompt">Ruttger</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded hover:bg-sidebar-accent transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sidebar-ring ${buttonPosition}`}
            aria-label="Toggle Sidebar"
          >
            {isCollapsed ? (
              <ArrowRight size={18} className="text-primary" />
            ) : (
              <ChevronLeft size={18} className="text-primary" />
            )}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-[14px] px-[6px] bg-[#f7f7f7]">
        <SidebarNavigation isCollapsed={isCollapsed} />
      </SidebarContent>

      <SidebarUserProfile isCollapsed={isCollapsed} />
    </SidebarComponent>
  )
}

export default Sidebar
