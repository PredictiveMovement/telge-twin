import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Search } from 'lucide-react'
const TopBar = () => {
  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
      <div className="flex h-16 items-center px-6 bg-[#000a00]/0">
        <div className="mr-4 lg:hidden">
          <SidebarTrigger className="p-2 rounded-md hover:bg-accent transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </SidebarTrigger>
        </div>

        <div className="flex-1"></div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Sök..."
              className="pl-10 pr-4 py-2 h-10 w-full rounded-full bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-offset-0"
            />
          </div>
          <Button variant="outline" size="sm">
            Hjälp
          </Button>
        </div>
      </div>
    </header>
  )
}
export default TopBar
