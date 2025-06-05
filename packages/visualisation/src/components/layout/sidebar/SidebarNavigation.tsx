import { NavLink } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Check, Map, Route, BarChart, Settings, Palette } from 'lucide-react'

interface SidebarNavigationProps {
  isCollapsed: boolean
}

const SidebarNavigation = ({ isCollapsed }: SidebarNavigationProps) => {
  const mainNavItems = [
    {
      title: 'Översikt',
      path: '/',
      icon: Check,
      disabled: false,
    },
    {
      title: 'Körturer',
      path: '/routes',
      icon: Route,
      disabled: true,
    },
    {
      title: 'Karta',
      path: '/map',
      icon: Map,
      disabled: false,
    },
    {
      title: 'Statistik',
      path: '/statistics',
      icon: BarChart,
      disabled: true,
    },
    {
      title: 'Inställningar',
      path: '/settings',
      icon: Settings,
      disabled: true,
    },
  ]

  const designSystemItem = {
    title: 'Design System',
    path: '/design-system',
    icon: Palette,
    disabled: false,
  }

  const getNavLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `flex items-center transition-colors ${
      isActive
        ? 'bg-primary text-primary-foreground font-medium'
        : 'hover:bg-sidebar-accent'
    }`

  const renderNavItem = (item: (typeof mainNavItems)[0]) => (
    <SidebarMenuItem key={item.path}>
      <SidebarMenuButton
        asChild={!item.disabled}
        disabled={item.disabled}
        size="lg"
        tooltip={isCollapsed ? item.title : undefined}
      >
        {item.disabled ? (
          <div className="flex items-center cursor-not-allowed opacity-50">
            <item.icon className="h-5 w-5 stroke-[2px]" />
            <span className="text-base ml-3">{item.title}</span>
          </div>
        ) : (
          <NavLink to={item.path} className={getNavLinkClassName}>
            <item.icon className="h-5 w-5 stroke-[2px]" />
            <span className="text-base ml-3">{item.title}</span>
          </NavLink>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>{mainNavItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="mt-8">
        <SidebarGroupContent>
          <SidebarMenu>{renderNavItem(designSystemItem)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

export default SidebarNavigation
