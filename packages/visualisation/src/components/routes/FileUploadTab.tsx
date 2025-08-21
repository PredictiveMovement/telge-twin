import { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { saveRouteDataset } from '@/api/simulator'
import { generateFleetsAndBookings } from '@/utils/fleetGenerator'
import { toast } from 'sonner'
import {
  FilterSection,
  TuridItem,
  FleetPreview,
  getUniqueValues,
  filterRouteData,
  getSettingsForPreview,
  processUploadedFile,
  type RouteRecord,
  type FilterCriteria,
} from './FileUpload'

export default function FileUploadTab() {
  const [uploadedData, setUploadedData] = useState<RouteRecord[]>([])
  const [originalFilename, setOriginalFilename] = useState<string>('')
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({})
  const [datasetName, setDatasetName] = useState<string>('')
  const [datasetDescription, setDatasetDescription] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rawData = JSON.parse(e.target?.result as string)
        const data = processUploadedFile(rawData, file.name)

        setUploadedData(data)
        setOriginalFilename(file.name)
        setDatasetName(file.name.replace('.json', ''))
        toast.success(`Fil laddad: ${file.name} (${data.length} records)`)
      } catch (error) {
        toast.error(
          'Fel vid läsning av fil. Kontrollera att det är en giltig JSON fil.'
        )
      }
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
  })

  const uniqueValues = useMemo(() => {
    if (!uploadedData.length) return {}

    return {
      bils: getUniqueValues(uploadedData, 'Bil'),
      avftyper: getUniqueValues(uploadedData, 'Avftyp'),
      tjtyper: getUniqueValues(uploadedData, 'Tjtyp'),
      dates: getUniqueValues(uploadedData, 'Datum').sort(),
    }
  }, [uploadedData])

  const filteredData = useMemo(() => {
    return filterRouteData(uploadedData, filterCriteria)
  }, [uploadedData, filterCriteria])

  const filteredTurids = useMemo(() => {
    return [...new Set(filteredData.map((record) => record.Turid))].sort()
  }, [filteredData])

  const toggleArrayFilter = (
    filterType: 'selectedBils' | 'selectedAvftyper' | 'selectedTjtyper',
    value: string
  ) => {
    setFilterCriteria((prev) => {
      const currentArray = prev[filterType] || []
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value]

      return { ...prev, [filterType]: newArray }
    })
  }

  const saveDataset = async () => {
    if (!datasetName.trim()) {
      toast.error('Dataset namn krävs')
      return
    }

    if (!filteredData.length) {
      toast.error('Ingen data att spara')
      return
    }

    setIsSaving(true)
    try {
      const originalSettings = getSettingsForPreview(
        uploadedData,
        originalFilename
      )

      const fleetConfiguration = generateFleetsAndBookings(
        filteredData,
        originalSettings
      ).fleets

      const result = await saveRouteDataset({
        name: datasetName,
        description: datasetDescription,
        originalFilename,
        filterCriteria: filterCriteria as Record<string, unknown>,
        routeData: filteredData as Record<string, unknown>[],
        originalRecordCount: uploadedData.length,
        fleetConfiguration: fleetConfiguration as unknown as Record<
          string,
          unknown
        >[],
        originalSettings,
      })

      if (result.success) {
        toast.success(
          `Dataset sparad: ${datasetName} (${fleetConfiguration.length} fleets)`
        )
        setUploadedData([])
        setDatasetName('')
        setDatasetDescription('')
        setFilterCriteria({})
        setOriginalFilename('')
      } else {
        toast.error(`Fel vid sparning: ${result.error}`)
      }
    } catch (error) {
      toast.error('Fel vid sparning av dataset')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ladda upp Route Data</CardTitle>
          <CardDescription>
            Ladda upp en JSON fil med route data för filtrering och bearbetning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-gray-600">
                {isDragActive ? (
                  <p>Släpp filen här...</p>
                ) : (
                  <p>
                    Dra och släpp en JSON fil här, eller klicka för att välja
                  </p>
                )}
              </div>
              {originalFilename && (
                <Badge variant="secondary">
                  Laddad: {originalFilename} ({uploadedData.length} records)
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {uploadedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filtrera Data</CardTitle>
            <CardDescription>
              Använd filtren nedan för att välja specifik data för din
              simulering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterSection
              label="Bilar"
              items={uniqueValues.bils || []}
              selectedItems={filterCriteria.selectedBils}
              onToggle={toggleArrayFilter}
              filterType="selectedBils"
            />

            <FilterSection
              label="Avfallstyper"
              items={uniqueValues.avftyper || []}
              selectedItems={filterCriteria.selectedAvftyper}
              onToggle={toggleArrayFilter}
              filterType="selectedAvftyper"
            />

            <FilterSection
              label="Tjänstetyper"
              items={uniqueValues.tjtyper || []}
              selectedItems={filterCriteria.selectedTjtyper}
              onToggle={toggleArrayFilter}
              filterType="selectedTjtyper"
            />

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Filtrerad data: <strong>{filteredData.length}</strong> av{' '}
                <strong>{uploadedData.length}</strong> records
              </p>
            </div>

            {filteredTurids.length > 0 && (
              <div className="mt-4 space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Filtrerade Turid ({filteredTurids.length})
                </Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredTurids.map((turid) => (
                    <TuridItem
                      key={turid}
                      turid={turid}
                      filteredData={filteredData}
                      uploadedData={uploadedData}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredData.length > 0 && (
              <div className="mt-6 space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Fleet Preview (Genererade Flottor)
                </Label>
                <FleetPreview
                  routeData={filteredData}
                  settings={getSettingsForPreview(
                    uploadedData,
                    originalFilename
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filteredData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Spara Dataset</CardTitle>
            <CardDescription>
              Ge din filtrerade dataset ett namn och beskrivning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="datasetName">Dataset Namn *</Label>
              <Input
                id="datasetName"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="T.ex. 'Telge Routes Augusti 2024'"
              />
            </div>

            <div>
              <Label htmlFor="datasetDescription">Beskrivning</Label>
              <Textarea
                id="datasetDescription"
                value={datasetDescription}
                onChange={(e) => setDatasetDescription(e.target.value)}
                placeholder="Beskrivning av dataset och filter som tillämpats..."
                rows={3}
              />
            </div>

            <Button
              onClick={saveDataset}
              disabled={!datasetName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? 'Sparar...' : 'Spara Dataset'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
