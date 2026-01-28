import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, FileText } from 'lucide-react'
import RouteSearchTab from './RouteSearchTab'
import SavedDatasetsTab from './SavedDatasetsTab'

export default function RouteDataTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('search')

  // Sätt aktiv tabb via navigation state eller query parameter
  useEffect(() => {
    // Check URL query parameters first
    const searchParams = new URLSearchParams(location.search)
    const tabParam = searchParams.get('tab')

    if (tabParam) {
      // Validate that the tab exists
      if (['search', 'optimizations'].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    }

    // Also check navigation state (for programmatic navigation)
    const st = (location.state as any) || {}
    if (st.activeTab && typeof st.activeTab === 'string') {
      if (['search', 'optimizations'].includes(st.activeTab)) {
        setActiveTab(st.activeTab)
      }
      // Rensa state från historiken för att undvika oavsiktlig återanvändning
      navigate(location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.search])

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-normal break-words hyphens-auto">Körturer</h1>
        <p className="text-muted-foreground max-w-2xl">
          Här kan du skapa nya optimeringar eller fortsätta arbeta med sparade projekt.
        </p>
      </div>

      <div className="flex flex-col gap-4 items-start">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-col sm:grid sm:grid-cols-2 w-full gap-1 sm:gap-0 p-1 h-[50px]">
            <TabsTrigger value="search" className="w-full text-foreground h-[42px]">
              <Calendar className="w-4 h-4 mr-2" />
              Hämta befintlig körtur
            </TabsTrigger>
            <TabsTrigger value="optimizations" className="w-full h-[42px]">
              <FileText className="w-4 h-4 mr-2" />
              Sparade optimeringar
            </TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-4 w-full">
            <RouteSearchTab />
          </TabsContent>
          <TabsContent value="optimizations" className="mt-4 w-full">
            <SavedDatasetsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
