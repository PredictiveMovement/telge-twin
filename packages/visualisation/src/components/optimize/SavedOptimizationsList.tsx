
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, FileText } from 'lucide-react';

interface SavedOptimization {
  id: string;
  name: string;
  description: string;
  selectedRoutes: string[];
  filters: any;
  createdAt: string;
}

interface SavedOptimizationsListProps {
  optimizations: SavedOptimization[];
  onDelete: (id: string) => void;
  onLoad: (optimization: SavedOptimization) => void;
}

const SavedOptimizationsList: React.FC<SavedOptimizationsListProps> = ({
  optimizations,
  onDelete,
  onLoad
}) => {
  if (optimizations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <FileText size={48} className="text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">Inga sparade optimeringsprojekt</h3>
              <p className="text-muted-foreground">
                Spara din första optimering för att se den här
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sparade optimeringsprojekt ({optimizations.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {optimizations.map((optimization) => (
            <div
              key={optimization.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{optimization.name}</h4>
                  {optimization.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {optimization.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {new Date(optimization.createdAt).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                    
                    <Badge variant="secondary">
                      {optimization.selectedRoutes.length} valda körturer
                    </Badge>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLoad(optimization)}
                  >
                    Ladda
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(optimization.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SavedOptimizationsList;
