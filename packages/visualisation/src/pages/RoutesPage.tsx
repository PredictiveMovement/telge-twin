import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import FetchExistingRoutes from '@/components/routes/FetchExistingRoutes'
import SimulationData from '@/components/routes/SimulationData'

const RoutesPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { socket } = useSocket('simulationStarted', (simulationData) => {
    console.log('Simulation started')
  })

  const [activeTab, setActiveTab] = useState('fetch')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'previous') {
      setActiveTab('previous')
    }
  }, [searchParams])

  const handleSimulationStart = () => {
    setActiveTab('previous')
    navigate('/routes?tab=previous', { replace: true })
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal">Körturer</h1>
            <p className="text-muted-foreground mt-1">
              Hantera och redigera dina körturer
            </p>
          </div>
          <Button
            className="bg-[#BBD197] hover:bg-[#BBD197]/90"
            onClick={() => navigate('/routes/new')}
          >
            <Plus size={16} className="mr-2" />
            Skapa ny körtur
          </Button>
        </div>

        <div className="flex flex-col gap-4 items-start">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fetch">Hämta befintlig körtur</TabsTrigger>
              <TabsTrigger value="previous">Simuleringsdata</TabsTrigger>
            </TabsList>
            <TabsContent value="fetch" className="mt-4 w-full">
              <FetchExistingRoutes
                socket={socket}
                onSimulationStart={handleSimulationStart}
              />
            </TabsContent>
            <TabsContent value="previous">
              <SimulationData />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  )
}

export default RoutesPage
