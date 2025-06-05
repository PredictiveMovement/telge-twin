import Layout from '@/components/layout/Layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Map, Route } from 'lucide-react'
import MapSimulator from '@/components/MapSimulator'

const MapPage = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal">Karta</h1>
            <p className="text-muted-foreground mt-1">
              Visualisera och planera dina rutter på kartan
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Route size={16} className="mr-2" />
              Välj rutter
            </Button>
            <Button className="bg-telge-bla hover:bg-telge-bla/90">
              Optimera rutt
            </Button>
          </div>
        </div>

        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="map">Kartvy</TabsTrigger>
            <TabsTrigger value="satellite">Satellitvy</TabsTrigger>
          </TabsList>
          <TabsContent value="map" className="mt-4">
            <Card className="relative h-[500px] overflow-hidden">
              <CardContent className="absolute inset-0 p-0">
                <MapSimulator />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="satellite" className="mt-4">
            <Card className="relative h-[500px] overflow-hidden">
              <CardContent className="absolute inset-0 p-0">
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                  <div className="text-center">
                    <Map size={48} className="mx-auto mb-2" />
                    <p>Satellitvy laddas här.</p>
                    <p className="text-sm text-gray-300 mt-1">
                      Växla tillbaka till standardkarta för bättre rutt-visning.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-telge-ljusgul p-4 rounded-md">
                <p className="text-sm font-medium">Aktiva rutter på kartan</p>
                <h3 className="text-2xl font-normal mt-1">3</h3>
              </div>
              <div className="bg-telge-ljusgron p-4 rounded-md">
                <p className="text-sm font-medium">Totalt avstånd</p>
                <h3 className="text-2xl font-normal mt-1">124 km</h3>
              </div>
              <div className="bg-telge-ljusbla p-4 rounded-md">
                <p className="text-sm font-medium">Antal stopp</p>
                <h3 className="text-2xl font-normal mt-1">32</h3>
              </div>
              <div className="bg-telge-ljusgra p-4 rounded-md">
                <p className="text-sm font-medium">Estimerad körtid</p>
                <h3 className="text-2xl font-normal mt-1">4h 10m</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default MapPage
