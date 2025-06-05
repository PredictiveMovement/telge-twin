import React from 'react'
import Layout from '@/components/layout/Layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Route, Map, ArrowRight } from 'lucide-react'
const Index = () => {
  const stats = [
    {
      title: 'Aktiva rutter',
      value: '12',
      icon: Route,
      color: 'bg-telge-ljusgul',
      textColor: 'text-telge-gul',
    },
    {
      title: 'Optimerade körturer',
      value: '8',
      icon: Check,
      color: 'bg-telge-ljusgron',
      textColor: 'text-green-700',
    },
    {
      title: 'Områden',
      value: '3',
      icon: Map,
      color: 'bg-telge-ljusbla',
      textColor: 'text-telge-bla',
    },
  ]
  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-normal tracking-tight">
            Välkommen till Ruttger
          </h1>
          <p className="text-muted-foreground mt-1">
            Verktyget som visar data och optimerar körturer{' '}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, index) => (
            <Card key={index} className="hover-card">
              <CardContent className="p-6 flex gap-4 items-center">
                <div
                  className={`${stat.color} rounded-md p-2 flex items-center justify-center`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.textColor}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <h3 className="text-2xl font-normal">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover-card">
            <CardHeader>
              <CardTitle className="font-normal text-2xl">
                Senaste körturer
              </CardTitle>
              <CardDescription>
                Kolla status på dina senaste tillagda körturer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Norrort', 'Söderort', 'Centrala'].map((route, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b pb-2"
                  >
                    <div className="flex items-center gap-2">
                      <Route size={16} />
                      <span>
                        {route} #{Date.now().toString().slice(-4)}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ArrowRight size={14} className="mr-2" />
                      Se detaljer
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-card bg-gradient-to-br from-[#BBD197] to-[#BBD197]/80 text-text-primary">
            <CardHeader>
              <CardTitle className="font-normal text-2xl">
                Optimera dina rutter
              </CardTitle>
              <CardDescription className="text-text-primary/80">
                Spara tid och bränsle genom att optimera dina körrutter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Kom igång med vår ruttoptimerare för att spara upp till 25% av
                din körtid.
              </p>
              <Button
                variant="secondary"
                className="bg-white text-text-primary hover:bg-white/90"
              >
                Optimera rutt
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
export default Index
