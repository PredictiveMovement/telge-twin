import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RouteSearchTab from './RouteSearchTab'
import SavedDatasetsTab from './SavedDatasetsTab'
import ExperimentsTab from './ExperimentsTab'

export default function RouteDataTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('search')

  // Sätt aktiv tabb via navigation state (t.ex. { activeTab: 'datasets' }) eller query parameter
  useEffect(() => {
    // Check URL query parameters first
    const searchParams = new URLSearchParams(location.search)
    const tabParam = searchParams.get('tab')

    if (tabParam) {
      // Map legacy tab names for backwards compatibility
      let mappedTab = tabParam
      if (tabParam === 'previous') mappedTab = 'datasets'
      if (tabParam === 'fetch') mappedTab = 'search'

      // Validate that the tab exists
      if (['search', 'datasets', 'experiments'].includes(mappedTab)) {
        setActiveTab(mappedTab)
      }
    }

    // Also check navigation state (for programmatic navigation)
    const st = (location.state as any) || {}
    if (st.activeTab && typeof st.activeTab === 'string') {
      setActiveTab(st.activeTab)
      // Rensa state från historiken för att undvika oavsiktlig återanvändning
      navigate(location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.search])

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Körturer</h1>
        <p className="text-gray-600 mt-2">
          Hämta och hantera körturer genom API eller skapa experiment
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Hämta körtur
          </TabsTrigger>

          <TabsTrigger value="datasets" className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7l2-3h12l2 3M4 7h16"
              />
            </svg>
            Sparade Datasets
          </TabsTrigger>

          <TabsTrigger value="experiments" className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Experiment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-6">
          <RouteSearchTab />
        </TabsContent>

        <TabsContent value="datasets" className="mt-6">
          <SavedDatasetsTab />
        </TabsContent>

        <TabsContent value="experiments" className="mt-6">
          <ExperimentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
