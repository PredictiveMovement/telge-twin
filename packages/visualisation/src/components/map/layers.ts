import {
  ScatterplotLayer,
  ArcLayer,
  IconLayer,
  PolygonLayer,
  TextLayer,
  PathLayer,
} from 'deck.gl'
import { Car, Booking } from '@/types/map'
import {
  getBookingColor,
  getPartitionColor,
  getVehicleColor,
  ICON_MAPPING,
  pointInPoly,
  pointInRect,
} from './utils'

export const createCarLayer = (
  cars: Car[],
  useIcons: boolean,
  handlers: { onHover: any; onClick: any }
) => {
  if (useIcons) {
    return new IconLayer({
      id: 'car-icon-layer',
      data: cars,
      pickable: true,
      iconAtlas: '/combined_truck_icons.png',
      iconMapping: ICON_MAPPING,
      getIcon: (d: Car) => {
        const status = d.status.toLowerCase()
        return Object.prototype.hasOwnProperty.call(
          ICON_MAPPING,
          status as keyof typeof ICON_MAPPING
        )
          ? status
          : 'default'
      },
      sizeScale: 7,
      getPosition: (d: Car) => d.position,
      getSize: (_d: Car) => 5,
      getColor: getVehicleColor,
      onHover: handlers.onHover,
      onClick: handlers.onClick,
    })
  }

  return new ScatterplotLayer({
    id: 'car-circle-layer',
    data: cars,
    pickable: true,
    opacity: 0.8,
    stroked: false,
    filled: true,
    radiusScale: 1,
    radiusUnits: 'pixels',
    getPosition: (d: Car) => d.position,
    getRadius: () => 8,
    getFillColor: getVehicleColor,
    onHover: handlers.onHover,
    onClick: handlers.onClick,
  })
}

export const createBookingLayer = (bookings: Booking[], onHover: any) =>
  new ScatterplotLayer({
    id: 'booking-layer',
    data: bookings,
    opacity: 1,
    stroked: false,
    filled: true,
    radiusScale: 1,
    radiusUnits: 'pixels',
    getPosition: (c: Booking) => c.pickup,
    getRadius: () => 4,
    getFillColor: getBookingColor,
    pickable: true,
    onHover,
  })

export const createDestinationLayer = (bookings: Booking[], onHover: any) =>
  new IconLayer({
    id: 'destination-layer',
    data: bookings.filter((b) => b.destination),
    pickable: true,
    iconAtlas: '/base-big.png',
    iconMapping: { marker: { x: 0, y: 0, width: 40, height: 40, mask: false } },
    getIcon: () => 'marker',
    sizeScale: 7,
    getPosition: (b: Booking) => b.destination,
    getSize: () => 5,
    onHover,
  })

export const createMunicipalityLayer = (
  data: { id: string; name: string; polygon: number[][] }[],
  onHover: any
) =>
  new PolygonLayer({
    id: 'municipality-layer',
    data,
    pickable: true,
    stroked: true,
    filled: true,
    wireframe: true,
    lineWidthMinPixels: 1,
    getPolygon: (d: { polygon: number[][] }) => d.polygon,
    getFillColor: [80, 210, 0, 80],
    getLineColor: [80, 210, 0, 255],
    getLineWidth: 2,
    onHover,
  })

export const createAreaPartitionLayer = (
  partitionData: any[],
  onHover: any,
  debugMode: boolean
) =>
  new PolygonLayer({
    id: 'area-partition-layer',
    data: partitionData,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 2,
    getPolygon: (d: any) => d.polygon,
    getFillColor: (d: any) => [...getPartitionColor(d.id), debugMode ? 20 : 40],
    getLineColor: (d: any) => [...getPartitionColor(d.id), 200],
    getLineWidth: 3,
    onHover,
  })

export const createCentroidPointLayer = (data: any[]) =>
  new ScatterplotLayer({
    id: 'debug-centroids',
    data,
    pickable: true,
    radiusScale: 1,
    radiusUnits: 'pixels',
    getPosition: (d: any) => d.position,
    getRadius: () => 6,
    getFillColor: (d: any) => [...(d.color || [255, 255, 255]), 220],
  })

export const createCentroidLabelLayer = (data: any[], getSize: () => number) =>
  new TextLayer({
    id: 'debug-centroid-labels',
    data,
    getPosition: (d: any) => d.position,
    getText: (d: any) => d.text,
    getSize,
    getColor: () => [255, 255, 255, 220],
    background: true,
    getBackgroundColor: () => [0, 0, 0, 220],
  })

export const createClusterOrderPathLayer = (pathsData: any[]) =>
  new PathLayer({
    id: 'debug-cluster-order',
    data: pathsData,
    getPath: (d: any) => d.path,
    getWidth: () => 2,
    getColor: (d: any) => d.color || [255, 215, 0, 160],
    widthUnits: 'pixels',
  })

export const createClusterTransitionsLayer = (segs: any[]) =>
  new PathLayer({
    id: 'debug-cluster-transitions',
    data: segs,
    getPath: (d: any) => d.path,
    getWidth: () => 2,
    getColor: (d: any) => d.color || [135, 206, 250, 200],
    widthUnits: 'pixels',
  })

export const createTransitionEndpointsLayer = (points: any[]) =>
  new ScatterplotLayer({
    id: 'debug-transition-endpoints',
    data: points,
    pickable: true,
    radiusScale: 1,
    radiusUnits: 'pixels',
    stroked: true,
    getLineColor: (_d: any) => [255, 255, 255, 255],
    lineWidthMinPixels: 2,
    getPosition: (d: any) => d.position,
    getRadius: (_d: any) => 7,
    getFillColor: (d: any) =>
      d.kind === 'first' ? [0, 220, 120, 255] : [230, 60, 60, 255],
  })

export const createRoutesLayer = (routesData: any[]) =>
  new ArcLayer({
    id: 'routesLayer',
    data: routesData,
    pickable: true,
    getWidth: 0.5,
    getSourcePosition: (d: any) => d.from,
    getTargetPosition: (d: any) => d.to,
    getSourceColor: (d: any) => d.inbound,
    getTargetColor: (d: any) => d.outbound,
  })

export const computePartitionData = (displayAreaPartitions: any[]) =>
  displayAreaPartitions.map((p) => ({
    ...p,
    polygon:
      p.polygon?.length >= 4
        ? p.polygon
        : [
            [p.bounds.minLng, p.bounds.minLat],
            [p.bounds.maxLng, p.bounds.minLat],
            [p.bounds.maxLng, p.bounds.maxLat],
            [p.bounds.minLng, p.bounds.maxLat],
            [p.bounds.minLng, p.bounds.minLat],
          ],
  }))

export const computeClusterTransitions = (routes: any[], partitions: any[]) => {
  const segs: any[] = []
  routes.forEach((route: any) => {
    if (!route || !Array.isArray(route.steps) || route.steps.length === 0)
      return
    const routePartitions = partitions.filter(
      (p: any) => !p.truckId || String(p.truckId) === String(route.vehicle)
    )
    const stepsWithMeta = route.steps
      .filter(
        (s: any) => s && s.action === 'pickup' && s.booking && s.booking.pickup
      )
      .map((s: any) => {
        const pt: [number, number] = [
          s.booking.pickup.lon,
          s.booking.pickup.lat,
        ]
        const part = routePartitions.find((p: any) => {
          if (p.polygon && p.polygon.length >= 3)
            return pointInPoly(pt, p.polygon)
          return pointInRect(pt, p.bounds)
        })
        return { ...s, pt, partitionId: part?.id }
      })
    const orderedPartitionIds: string[] = []
    stepsWithMeta.forEach((s) => {
      if (s.partitionId && !orderedPartitionIds.includes(s.partitionId)) {
        orderedPartitionIds.push(s.partitionId)
      }
    })
    if (orderedPartitionIds.length < 2) return
    const firstByPartition: Record<string, [number, number]> = {}
    const lastByPartition: Record<string, [number, number]> = {}
    stepsWithMeta.forEach((s) => {
      if (!s.partitionId) return
      if (!firstByPartition[s.partitionId])
        firstByPartition[s.partitionId] = s.pt
      lastByPartition[s.partitionId] = s.pt
    })
    for (let i = 0; i < orderedPartitionIds.length - 1; i++) {
      const a = orderedPartitionIds[i]
      const b = orderedPartitionIds[i + 1]
      const from = lastByPartition[a]
      const to = firstByPartition[b]
      if (from && to)
        segs.push({
          path: [from, to],
          color: getPartitionColor(
            String(route.vehicle || route.truckId || 'route')
          ),
        })
    }
  })
  return segs
}

export const computeTransitionEndpoints = (
  routes: any[],
  partitions: any[]
) => {
  const points: any[] = []
  routes.forEach((route: any) => {
    const routePartitions = partitions.filter(
      (p: any) => !p.truckId || String(p.truckId) === String(route.vehicle)
    )
    const stepsWithMeta = (route.steps || [])
      .filter(
        (s: any) => s && s.action === 'pickup' && s.booking && s.booking.pickup
      )
      .map((s: any) => {
        const pt: [number, number] = [
          s.booking.pickup.lon,
          s.booking.pickup.lat,
        ]
        const part = routePartitions.find((p: any) => {
          if (p.polygon && p.polygon.length >= 3)
            return pointInPoly(pt, p.polygon)
          return pointInRect(pt, p.bounds)
        })
        return { ...s, pt, partitionId: part?.id }
      })
    const orderedPartitionIds: string[] = []
    stepsWithMeta.forEach((s) => {
      if (s.partitionId && !orderedPartitionIds.includes(s.partitionId)) {
        orderedPartitionIds.push(s.partitionId)
      }
    })
    if (orderedPartitionIds.length < 2) return
    const firstByPartition: Record<string, [number, number]> = {}
    const lastByPartition: Record<string, [number, number]> = {}
    stepsWithMeta.forEach((s) => {
      if (!s.partitionId) return
      if (!firstByPartition[s.partitionId])
        firstByPartition[s.partitionId] = s.pt
      lastByPartition[s.partitionId] = s.pt
    })
    for (let i = 0; i < orderedPartitionIds.length - 1; i++) {
      const a = orderedPartitionIds[i]
      const b = orderedPartitionIds[i + 1]
      const from = lastByPartition[a]
      const to = firstByPartition[b]
      if (from) points.push({ position: from, kind: 'last' })
      if (to) points.push({ position: to, kind: 'first' })
    }
  })
  return points
}
