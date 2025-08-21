// Mock implementation of @turf modules to avoid ESM import issues
module.exports = {
  distance: jest.fn((from, to, options) => {
    // Simple distance calculation for testing
    const lat1 = from.lat || from[1]
    const lng1 = from.lng || from.lon || from[0]
    const lat2 = to.lat || to[1]
    const lng2 = to.lng || to.lon || to[0]

    const R = 6371e3 // metres
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // in metres
  }),

  center: jest.fn((points) => {
    // Simple center calculation
    let sumLat = 0,
      sumLng = 0
    points.forEach((point) => {
      const coords = point.geometry ? point.geometry.coordinates : point
      sumLat += coords[1] || coords.lat
      sumLng += coords[0] || coords.lng || coords.lon
    })
    return {
      geometry: {
        coordinates: [sumLng / points.length, sumLat / points.length],
      },
    }
  }),

  bbox: jest.fn((points) => {
    // Simple bounding box calculation
    let minLat = Infinity,
      maxLat = -Infinity
    let minLng = Infinity,
      maxLng = -Infinity

    points.forEach((point) => {
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

  convex: jest.fn((points) => {
    // Simple convex hull mock
    return {
      geometry: {
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    }
  }),

  clustersDbscan: jest.fn((points, maxDistance, options) => {
    // Simple clustering mock
    return {
      features: points.map((point, index) => ({
        ...point,
        properties: {
          ...point.properties,
          cluster: index % 3, // Simple cluster assignment
        },
      })),
    }
  }),
}
