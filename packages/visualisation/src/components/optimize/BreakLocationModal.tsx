import React, { useState, useCallback, useRef } from 'react';
import DeckGL, { ScatterplotLayer } from 'deck.gl';
import { StaticMap } from 'react-map-gl';
import { WebMercatorViewport } from '@deck.gl/core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Loader2 } from 'lucide-react';

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

export const PELIAS_URL = (
  import.meta as unknown as { env: { VITE_PELIAS_URL?: string } }
).env.VITE_PELIAS_URL || 'https://pelias.telge.iteam.pub';

const DEFAULT_CENTER = {
  latitude: 59.1955,
  longitude: 17.6253,
};

function computeBoundsViewport(coords: { lat: number; lng: number }[]) {
  if (!coords.length) return { latitude: DEFAULT_CENTER.latitude, longitude: DEFAULT_CENTER.longitude, zoom: 12 };

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
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

function projectPoint(
  coord: { lat: number; lng: number },
  viewState: any,
  width: number,
  height: number
): [number, number] | null {
  if (width <= 0 || height <= 0) return null;
  const vp = new WebMercatorViewport({ ...viewState, width, height });
  return vp.project([coord.lng, coord.lat]) as [number, number];
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
    ...computeBoundsViewport(bookingCoordinates),
    bearing: 0,
    pitch: 0,
  });
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState(currentLocation || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickIdRef = useRef(0);
  const [, setMounted] = useState(false);

  // Force a re-render after dialog opens so containerRef is measured
  React.useEffect(() => {
    if (isOpen) {
      setMounted(false);
      requestAnimationFrame(() => setMounted(true));
    }
  }, [isOpen]);

  // Reset when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const vp = computeBoundsViewport(bookingCoordinates);
      setViewState(prev => ({ ...prev, ...vp }));
      setSelectedPoint(currentCoordinates || null);
      setAddress(currentLocation || '');
      setIsGeocoding(false);
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

  const handleSave = () => {
    if (selectedPoint) {
      onSave(address, selectedPoint.lat, selectedPoint.lng);
    }
    onClose();
  };

  // Read container size directly from ref during render
  const cw = containerRef.current?.clientWidth ?? 0;
  const ch = containerRef.current?.clientHeight ?? 0;

  const layers = [
    ...(bookingCoordinates.length > 0
      ? [
          new ScatterplotLayer({
            id: 'booking-points',
            data: bookingCoordinates,
            getPosition: (d: { lat: number; lng: number }) => [d.lng, d.lat],
            getFillColor: [254, 254, 254, 204],
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: 1,
            radiusUnits: 'pixels' as const,
            getRadius: 4,
            pickable: false,
          }),
        ]
      : []),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Välj plats på kartan
          </DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="w-full rounded-md overflow-hidden border border-gray-200"
          style={{ height: 450 }}
        >
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
            onClick={handleMapClick}
            controller={true}
            layers={layers}
            getCursor={() => 'crosshair'}
            style={{ position: 'relative', width: '100%', height: '100%' }}
          >
            <StaticMap
              mapStyle="mapbox://styles/mapbox/dark-v11"
              mapboxApiAccessToken={MAPBOX_TOKEN}
            />

            {/* Markers rendered as DeckGL children — inside internal overlay above canvas */}
            {otherBreakCoordinates.map((coord, i) => {
              const pos = projectPoint(coord, viewState, cw, ch);
              if (!pos) return null;
              const [x, y] = pos;
              return (
                <div
                  key={`break-${i}`}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: 28 }}>☕</span>
                </div>
              );
            })}

            {selectedPoint && (() => {
              const pos = projectPoint(selectedPoint, viewState, cw, ch);
              if (!pos) return null;
              const [x, y] = pos;
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                  }}
                >
                  <MapPin className="h-10 w-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" style={{ color: '#1a1a1a', fill: '#1a1a1a', stroke: '#ffffff', strokeWidth: 1 }} />
                </div>
              );
            })()}
          </DeckGL>
        </div>

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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={!selectedPoint || isGeocoding}>
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BreakLocationModal;
