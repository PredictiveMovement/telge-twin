import React from 'react'

import Map from '@/components/Map'

interface MapDisplayCardProps {
  title: string
  statusColorClass: string
  headerClassName?: string
  headerActions?: React.ReactNode
  mapProps: React.ComponentProps<typeof Map>
  isConnected: boolean
  isRunning: boolean
  isLoading?: boolean
  loadingMessage?: string
  errorMessage?: string
  idleMessage?: string
  disconnectedMessage?: string
  sideControls?: React.ReactNode
  overlay?: React.ReactNode
  mapClassName?: string
}

export const MapDisplayCard: React.FC<MapDisplayCardProps> = ({
  title,
  statusColorClass,
  headerClassName,
  headerActions,
  mapProps,
  isConnected,
  isRunning,
  isLoading,
  loadingMessage,
  errorMessage,
  idleMessage,
  disconnectedMessage,
  sideControls,
  overlay,
  mapClassName,
}) => {
  const headerClasses = `px-4 py-3 border-b flex items-center justify-between ${
    headerClassName ?? 'bg-muted/30'
  }`
  const mapContainerClasses = `bg-muted relative ${mapClassName ?? 'aspect-square'}`

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className={`${headerClasses}`}>
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColorClass}`}
          ></div>
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
        </div>
        {headerActions}
      </div>

      <div className="relative">
        <div className={mapContainerClasses}>
          <div className="absolute inset-0">
            <Map {...mapProps} />
          </div>

          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black text-white px-4 py-2 rounded-md text-sm">
                {disconnectedMessage ?? 'Ingen anslutning till servern'}
              </div>
            </div>
          )}

          {isRunning && errorMessage && (
            <div className="absolute inset-0 z-40 flex items-center justify-center">
              <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm">
                {errorMessage}
              </div>
            </div>
          )}

          {isRunning && isLoading && !errorMessage && (
            <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
              <div className="w-full max-w-md rounded-xl border border-white/20 bg-black px-6 py-5 text-white shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-9 w-9 border-2 border-white/30 border-t-white" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      Förbereder simulering
                    </p>
                    <p className="text-xs text-white/80">
                      {loadingMessage ?? 'Laddar fordon...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isRunning && !errorMessage && (
            <div className="absolute inset-0 z-40 flex items-center justify-center">
              <div className="bg-black text-white px-4 py-2 rounded-md text-sm">
                {idleMessage ?? 'Tryck på play för att starta simuleringen'}
              </div>
            </div>
          )}
        </div>

        {sideControls ? (
          <div className="absolute bottom-32 right-4 hidden md:flex flex-col gap-3">
            {sideControls}
          </div>
        ) : null}

        {overlay}
      </div>
    </div>
  )
}
