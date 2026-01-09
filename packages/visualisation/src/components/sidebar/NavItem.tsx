import { useLocation, useNavigate } from 'react-router-dom'
import { NavItem as NavItemType } from './types'

interface NavItemProps {
  item: NavItemType
}

export function NavItem({ item }: NavItemProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = location.pathname === item.url

  const handleClick = () => {
    navigate(item.url)
  }

  const isNotReady = item.url === '/map' || item.url === '/statistics'

  return (
    <button
      onClick={handleClick}
      className={`group w-full flex flex-col items-center justify-center h-20 px-1 py-4 rounded-lg transition-all duration-200 ${
        isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground'
      } ${isNotReady ? 'opacity-50' : ''}`}
    >
      <div
        className={`p-2 rounded-lg transition-all duration-200 ${
          isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'
        }`}
      >
        <item.icon className="h-5 w-5 flex-shrink-0 transition-all duration-200 group-hover:h-6 group-hover:w-6" />
      </div>
      <span className="text-sm font-medium text-center leading-tight mt-1">
        {item.title}
      </span>
    </button>
  )
}
