import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
const TopBar = () => {
  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
      <div className="flex h-16 items-center px-6 bg-[#000a00]/0">
        <div className="mr-4 lg:hidden" />

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
