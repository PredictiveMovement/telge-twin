import { Route, Map, LayoutDashboard, Zap, LucideIcon } from 'lucide-react'

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
}

export const mainNavItems: NavItem[] = [
  { title: 'Översikt', url: '/', icon: LayoutDashboard },
  { title: 'Körturer', url: '/routes', icon: Route },
  { title: 'Karta', url: '/map', icon: Map },
]

export const shortcutItems: NavItem[] = [
  { title: 'Optimera', url: '/optimize/save', icon: Zap },
]
