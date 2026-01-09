import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Route, Map, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const QuickAccessGrid = () => {
  const navigate = useNavigate()

  const quickAccessItems = [
    {
      title: 'Optimera körtur',
      icon: Route,
      path: '/routes',
      enabled: true,
      colorClass: 'bg-muted',
    },
    {
      title: 'Karta',
      icon: Map,
      path: '/map',
      enabled: false,
      colorClass: 'bg-muted',
    },
    {
      title: 'Statistik',
      icon: BarChart3,
      path: '/statistics',
      enabled: false,
      colorClass: 'bg-muted',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {quickAccessItems.map((item) => {
        const IconComponent = item.icon
        return (
          <Card
            key={item.title}
            className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
              item.enabled
                ? 'hover:border-primary/50'
                : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={() => item.enabled && navigate(item.path)}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${item.colorClass}`}>
                <IconComponent className="h-6 w-6 text-black" />
              </div>
              <h3 className="font-medium text-lg">{item.title}</h3>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default QuickAccessGrid
