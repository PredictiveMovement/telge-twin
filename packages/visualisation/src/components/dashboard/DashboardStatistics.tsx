import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Leaf, Route } from 'lucide-react';

const DashboardStatistics = () => {
  const statisticsData = [
    {
      title: 'Minskad körsträcka',
      value: '142 km',
      icon: MapPin,
      colorClass: 'bg-telge-morkgul'
    },
    {
      title: 'Minskad förbrukning',
      value: '12%',
      icon: Leaf,
      colorClass: 'bg-telge-ljusgron'
    },
    {
      title: 'Antal optimeringar',
      value: '24',
      icon: Route,
      colorClass: 'bg-telge-ljusgul'
    }
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-normal text-xl">Optimeringar i siffror</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {statisticsData.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.colorClass}`}>
                  <IconComponent className="h-6 w-6 text-black" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardStatistics;
