const clustersDbscan = jest.fn(
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

        // Haversine distance calculation (more accurate)
        const R = options?.units === 'kilometers' ? 6371 : 6371000 // km or meters
        const dLat = ((coords2[1] - coords1[1]) * Math.PI) / 180
        const dLon = ((coords2[0] - coords1[0]) * Math.PI) / 180
        const lat1 = (coords1[1] * Math.PI) / 180
        const lat2 = (coords2[1] * Math.PI) / 180

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.sin(dLon / 2) *
            Math.sin(dLon / 2) *
            Math.cos(lat1) *
            Math.cos(lat2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c

        if (distance <= maxDistance) {
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
)

module.exports = clustersDbscan
module.exports.default = clustersDbscan
