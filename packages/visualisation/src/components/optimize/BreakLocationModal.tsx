import React, { useState, useCallback, useRef, useMemo } from 'react';
import DeckGL, { ScatterplotLayer, IconLayer } from 'deck.gl';
import { StaticMap } from 'react-map-gl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import LayersMenu from '@/components/LayersMenu';
import { MAP_STYLES, isLightMapStyle } from '@/components/map/utils';
import { getBreakIconUrl, getMapPinIconUrl } from '@/components/map/layers';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PELIAS_URL } from '@/lib/pelias';
import { DEPOT_COORDINATE } from '@/utils/shared';

interface BreakLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: string, lat: number, lng: number) => void;
  currentLocation?: string;
  currentCoordinates?: { lat: number; lng: number };
  bookingCoordinates?: { lat: number; lng: number }[];
  otherBreakCoordinates?: { lat: number; lng: number }[];
}

const MAPBOX_TOKEN = (
  import.meta as unknown as { env: { VITE_MAPBOX_ACCESS_TOKEN: string } }
).env.VITE_MAPBOX_ACCESS_TOKEN;

const DEFAULT_CENTER = {
  latitude: 59.1955,
  longitude: 17.6253,
};

function computeBoundsViewport(
  bookings: { lat: number; lng: number }[],
  current?: { lat: number; lng: number } | null,
) {
  // If a location is already selected, center on it
  if (current) {
    return { latitude: current.lat, longitude: current.lng, zoom: 13 };
  }

  if (!bookings.length) return { latitude: DEFAULT_CENTER.latitude, longitude: DEFAULT_CENTER.longitude, zoom: 12 };

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of bookings) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const span = Math.max(latSpan, lngSpan);
  let zoom = 12;
  if (span > 0.5) zoom = 9;
  else if (span > 0.2) zoom = 10;
  else if (span > 0.1) zoom = 11;
  else if (span > 0.05) zoom = 12;
  else if (span > 0.01) zoom = 13;
  else zoom = 14;

  return { latitude: centerLat, longitude: centerLng, zoom };
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `${PELIAS_URL}/v1/reverse?point.lat=${lat}&point.lon=${lng}&size=1&layers=address,venue&boundary.circle.radius=500`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    return feature.properties?.label || feature.properties?.name || null;
  } catch {
    return null;
  }
}

const BreakLocationModal: React.FC<BreakLocationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentLocation,
  currentCoordinates,
  bookingCoordinates = [],
  otherBreakCoordinates = [],
}) => {
  const [viewState, setViewState] = useState({
    ...computeBoundsViewport(bookingCoordinates, currentCoordinates),
    bearing: 0,
    pitch: 0,
  });
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState(currentLocation || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapStyle, setMapStyle] = useState<string>(MAP_STYLES.colorful);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickIdRef = useRef(0);

  // Reset when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const vp = computeBoundsViewport(bookingCoordinates, currentCoordinates);
      setViewState(prev => ({ ...prev, ...vp }));
      setSelectedPoint(currentCoordinates || null);
      setAddress(currentLocation || '');
      setIsGeocoding(false);
      setFullscreen(false);
      clickIdRef.current += 1;
    }
  }, [isOpen, bookingCoordinates, currentLocation, currentCoordinates]);

  const handleMapClick = useCallback(async (event: any) => {
    const [lng, lat] = event.coordinate || [];
    if (lat == null || lng == null) return;
    const id = ++clickIdRef.current;
    setSelectedPoint({ lat, lng });
    setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setIsGeocoding(true);

    const resolved = await reverseGeocode(lat, lng);
    if (id !== clickIdRef.current) return;
    if (resolved) {
      setAddress(resolved);
    }
    setIsGeocoding(false);
  }, []);

  const handleClose = useCallback(() => {
    setFullscreen(false);
    onClose();
  }, [onClose]);

  const handleSave = () => {
    if (selectedPoint) {
      onSave(address, selectedPoint.lat, selectedPoint.lng);
    }
    handleClose();
  };

  const zoomIn = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom + 1, 20) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom - 1, 1) }));
  }, []);

  const layers = useMemo(() => {
    const result = [];

    if (bookingCoordinates.length > 0) {
      const fillColor: [number, number, number, number] = isLightMapStyle(mapStyle)
        ? [100, 110, 125, 204]
        : [254, 254, 254, 204];
      result.push(
        new ScatterplotLayer({
          id: 'booking-points',
          data: bookingCoordinates,
          getPosition: (d: { lat: number; lng: number }) => [d.lng, d.lat],
          getFillColor: fillColor,
          opacity: 1,
          stroked: false,
          filled: true,
          radiusScale: 1,
          radiusUnits: 'pixels' as const,
          getRadius: 4,
          pickable: false,
        }),
      );
    }

    result.push(
      new IconLayer({
        id: 'depot-location',
        data: [DEPOT_COORDINATE],
        getPosition: (d: [number, number]) => d,
        iconAtlas: '/base-big.png',
        iconMapping: { marker: { x: 0, y: 0, width: 40, height: 40, mask: false } },
        getIcon: () => 'marker',
        sizeScale: 7,
        getSize: 5,
        pickable: false,
      }),
    );

    if (otherBreakCoordinates.length > 0) {
      result.push(
        new IconLayer({
          id: 'other-break-locations',
          data: otherBreakCoordinates,
          getPosition: (d: { lat: number; lng: number }) => [d.lng, d.lat],
          iconAtlas: getBreakIconUrl(),
          iconMapping: { break: { x: 0, y: 0, width: 64, height: 64, mask: false } },
          getIcon: () => 'break',
          getSize: 32,
          sizeScale: 1,
          pickable: false,
          alphaCutoff: -1,
          parameters: { depthTest: false },
        }),
      );
    }

    if (selectedPoint) {
      result.push(
        new IconLayer({
          id: 'selected-point',
          data: [selectedPoint],
          getPosition: (d: { lat: number; lng: number }) => [d.lng, d.lat],
          getIcon: () => ({
            url: getMapPinIconUrl(),
            width: 128,
            height: 128,
            anchorY: 128,
            mask: false,
          }),
          getSize: 40,
          sizeScale: 1,
          pickable: false,
        }),
      );
    }

    return result;
  }, [bookingCoordinates, otherBreakCoordinates, selectedPoint, mapStyle]);

  const addressDisplay = (
    <p className="text-sm text-muted-foreground flex items-center gap-1">
      <span className="font-medium">Adress:</span>{' '}
      {isGeocoding ? (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Söker adress...
        </span>
      ) : (
        address || 'Klicka på kartan för att välja plats'
      )}
    </p>
  );

  const actionButtons = (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleClose}>
        Avbryt
      </Button>
      <Button onClick={handleSave} disabled={!selectedPoint || isGeocoding}>
        Spara
      </Button>
    </div>
  );

  const mapControls = (
    <TooltipProvider>
      <div className="absolute bottom-32 right-4 flex flex-col gap-3 z-10">
        <Button
          size="icon"
          variant="ghost"
          className="bg-white/90 text-gray-800 hover:bg-white h-8 w-8 rounded-full"
          onClick={() => setFullscreen(f => !f)}
          aria-label={fullscreen ? 'Minimera' : 'Helskärm'}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>

        <LayersMenu
          mapStyle={mapStyle}
          setMapStyle={setMapStyle}
          enable3D={false}
          setEnable3D={() => {}}
          triggerClassName="bg-white/90 text-gray-800 hover:bg-white h-8 w-8"
          triggerVariant="ghost"
          triggerSize="icon"
          iconClassName="h-4 w-4"
          triggerTooltip="Kartlager"
          contentClassName="bg-white/95 backdrop-blur"
          show3DToggle={false}
        />

        <div className="bg-white/90 rounded-full p-1 flex flex-col">
          <Button
            size="icon"
            variant="ghost"
            className="text-gray-800 hover:bg-gray-100 h-6 w-6 rounded-full"
            onClick={zoomIn}
            aria-label="Zooma in"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-gray-800 hover:bg-gray-100 h-6 w-6 rounded-full"
            onClick={zoomOut}
            aria-label="Zooma ut"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={
          fullscreen
            ? '!duration-0 !max-w-[100vw] !w-[100vw] !h-[100vh] !p-0 !m-0 !border-none !rounded-none !translate-x-0 !translate-y-0 !top-0 !left-0 [&>button]:hidden'
            : '!duration-0 sm:max-w-[700px]'
        }
      >
        {!fullscreen && (
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Välj plats på kartan
            </DialogTitle>
          </DialogHeader>
        )}

        <div className={fullscreen ? 'flex flex-col h-full' : 'contents'}>
          <div className={fullscreen ? 'flex-1 relative' : ''}>
            <div
              ref={containerRef}
              className="w-full relative rounded-md overflow-hidden border border-gray-200"
              style={{ height: fullscreen ? '100%' : 450 }}
            >
              <DeckGL
                viewState={viewState}
                onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
                onClick={handleMapClick}
                controller={true}
                layers={layers}
                getCursor={() => 'crosshair'}
                style={{ position: 'absolute', inset: 0 }}
              >
                <StaticMap
                  mapStyle={mapStyle}
                  mapboxApiAccessToken={MAPBOX_TOKEN}
                />
              </DeckGL>
              {mapControls}
            </div>
          </div>

          {fullscreen ? (
            <div className="bg-white border-t px-4 py-3 flex items-center justify-between">
              {addressDisplay}
              {actionButtons}
            </div>
          ) : (
            <>
              {addressDisplay}
              <DialogFooter>
                {actionButtons}
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BreakLocationModal;
