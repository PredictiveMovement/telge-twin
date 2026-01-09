// @ts-nocheck
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Route } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname
    )
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-telge-ljusgron flex items-center justify-center mx-auto">
          <Route size={24} className="text-telge-bla" />
        </div>
        <h1 className="text-6xl font-bold text-telge-svart">404</h1>
        <p className="text-xl text-muted-foreground">
          Hoppsan! Denna rutt finns inte på kartan.
        </p>
        <p className="text-muted-foreground">
          Sidan du letar efter kan ha flyttats eller tagits bort, eller så har
          något gått fel.
        </p>
        <Button
          className="bg-telge-bla hover:bg-telge-bla/90 font-medium"
          size="lg"
          onClick={() => (window.location.href = '/')}
        >
          Tillbaka till översikten
        </Button>
      </div>
    </div>
  )
}

export default NotFound
