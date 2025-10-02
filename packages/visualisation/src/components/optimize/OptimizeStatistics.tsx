import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Route, Calendar, LayoutGrid, ArrowUpDown, Leaf, MapPin } from 'lucide-react';
const OptimizeStatistics = () => {
  const statisticsData = [{
    title: 'Antal körturer',
    value: '24',
    icon: Route,
    color: 'bg-telge-ljusgul'
  }, {
    title: 'Ordningsändringar',
    value: '8',
    icon: ArrowUpDown,
    color: 'bg-telge-ljusbla'
  }, {
    title: 'Minskad förbrukning',
    value: '12%',
    icon: Leaf,
    color: 'bg-telge-ljusgron'
  }, {
    title: 'Antal bokningar',
    value: '156',
    icon: Calendar,
    color: 'bg-telge-telgegul'
  }, {
    title: 'Antal kluster',
    value: '142',
    icon: LayoutGrid,
    color: 'bg-telge-ljusrod'
  }, {
    title: 'Minskad körsträcka',
    value: '18 Km',
    icon: MapPin,
    color: 'bg-telge-morkgul'
  }];
  return <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="font-normal">Statistik och data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {statisticsData.map((stat, index) => {
          const IconComponent = stat.icon;
          return <div key={index} className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <IconComponent className="h-6 w-6 text-black" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground break-words whitespace-normal">{stat.title}</p>
                </div>
              </div>;
        })}
        </div>
      </CardContent>
    </Card>;
};
export default OptimizeStatistics;