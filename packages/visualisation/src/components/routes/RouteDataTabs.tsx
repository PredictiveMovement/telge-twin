import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import FileUploadTab from './FileUploadTab'
import SavedDatasetsTab from './SavedDatasetsTab'
import ExperimentsTab from './ExperimentsTab'

export default function RouteDataTabs() {
  const [activeTab, setActiveTab] = useState('upload')

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Körturer</h1>
        <p className="text-gray-600 mt-2">
          Hantera route data genom att ladda upp filer, skapa filtreringar och
          köra simuleringar
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Filuppladdning & Filtrering
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
            Sparade Filtreringar
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

        <TabsContent value="upload" className="mt-6">
          <FileUploadTab />
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
