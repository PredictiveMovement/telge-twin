module.exports = {
  point: jest.fn((coordinates: any, properties?: any) => {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinates,
      },
      properties: properties || {},
    }
  }),

  featureCollection: jest.fn((features: any) => {
    return {
      type: 'FeatureCollection',
      features: features,
    }
  }),

  distance: jest.fn((from: any, to: any, options?: any) => {
    // Simple distance calculation for testing
    const lat1 = from.geometry?.coordinates?.[1] || from.lat || from[1]
    const lng1 =
      from.geometry?.coordinates?.[0] || from.lng || from.lon || from[0]
    const lat2 = to.geometry?.coordinates?.[1] || to.lat || to[1]
    const lng2 = to.geometry?.coordinates?.[0] || to.lng || to.lon || to[0]

    const R = options?.units === 'kilometers' ? 6371 : 6371e3 // km or metres
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // in km or metres
  }),

  center: jest.fn((points: any) => {
    let sumLat = 0,
      sumLng = 0
    const features = points.features || points
    features.forEach((point: any) => {
      const coords = point.geometry ? point.geometry.coordinates : point
      sumLat += coords[1] || coords.lat
      sumLng += coords[0] || coords.lng || coords.lon
    })
    return {
      geometry: {
        coordinates: [sumLng / features.length, sumLat / features.length],
      },
    }
  }),

  bbox: jest.fn((points: any) => {
    let minLat = Infinity,
      maxLat = -Infinity
    let minLng = Infinity,
      maxLng = -Infinity

    points.forEach((point: any) => {
      const coords = point.geometry ? point.geometry.coordinates : point
      const lat = coords[1] || coords.lat
      const lng = coords[0] || coords.lng || coords.lon

      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
    })

    return [minLng, minLat, maxLng, maxLat]
  }),

  convex: jest.fn((featureCollection: any) => {
    const features = featureCollection.features || []
    if (features.length === 0) {
      return null
    }

    let minLng = Infinity,
      maxLng = -Infinity
    let minLat = Infinity,
      maxLat = -Infinity

    features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates
      minLng = Math.min(minLng, coords[0])
      maxLng = Math.max(maxLng, coords[0])
      minLat = Math.min(minLat, coords[1])
      maxLat = Math.max(maxLat, coords[1])
    })

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
          ],
        ],
      },
    }
  }),

  clustersDbscan: jest.fn(
    (featureCollection: any, maxDistance: any, options?: any) => {
      const features = featureCollection.features || []
      const minPoints = options?.minPoints || 1
      let clusterIndex = 0

      features.forEach((feature: any, i: number) => {
        if (feature.properties.cluster !== undefined) return

        const coords1 = feature.geometry.coordinates
        const nearbyPoints = [feature]

        features.forEach((other: any, j: number) => {
          if (i === j || other.properties.cluster !== undefined) return
          const coords2 = other.geometry.coordinates

          // Simple euclidean distance in degrees (approximation)
          const dist =
            Math.sqrt(
              Math.pow(coords1[0] - coords2[0], 2) +
                Math.pow(coords1[1] - coords2[1], 2)
            ) * 111000 // rough conversion to meters

          if (dist <= maxDistance) {
            nearbyPoints.push(other)
          }
        })

        if (nearbyPoints.length >= minPoints) {
          nearbyPoints.forEach((p: any) => {
            p.properties.cluster = clusterIndex
          })
          clusterIndex++
        } else {
          // Mark as noise
          feature.properties.cluster = -1
        }
      })

      return featureCollection
    }
  ),
}

// Also export as default for ES module compatibility
module.exports.default = module.exports
