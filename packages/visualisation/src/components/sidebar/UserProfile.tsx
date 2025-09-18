import { useNavigate } from 'react-router-dom'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

export function UserProfile() {
  const navigate = useNavigate()

  const handleProfileClick = () => {
    navigate('/profil')
  }

  return (
    <TooltipProvider>
      <div className="p-4 bg-sidebar-user-background border-t border-sidebar-border">
        <div className="flex flex-col items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleProfileClick}
                className="h-10 w-10 mb-2 rounded-full flex items-center justify-center text-white font-bold text-sm transition-transform hover:scale-105"
                style={{ backgroundColor: '#F57D5B' }}
              >
                AA
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Anna Andersson</p>
            </TooltipContent>
          </Tooltip>
          <div className="text-center">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              Anna
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
