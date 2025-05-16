export {}

const kmeans = require('node-kmeans')
const assert = require('assert')
const { write } = require('./log')
const { info } = require('console')
const Position = require('./models/position')

interface ClusterItem {
  pickup?: { position: any } // Position type
  position?: any // Position type
  // Add other properties existing on items in the input array
}

interface KmeansCluster {
  centroid: number[]
  clusterInd: number[]
}

interface OutputCluster {
  center: any // Position type
  items: ClusterItem[]
}

const clusterPositions = (
  input: ClusterItem[],
  nrOfClusters = 5
): Promise<OutputCluster[]> => {
  const vectors: number[][] = input.map(
    ({ pickup, position = pickup?.position }: ClusterItem) => {
      if (!position) {
        // Handle cases where position might still be undefined if pickup or pickup.position is undefined
        // For example, throw an error, or return a default vector, or filter out such items beforehand
        throw new Error(
          'Item in clusterPositions input is missing position data.'
        )
      }
      return [position.lon, position.lat]
    }
  )

  info('Clustering', vectors.length, 'positions into', nrOfClusters, 'clusters')
  assert(
    vectors.length < 301,
    'Too many positions to cluster:' + vectors.length
  )
  vectors.forEach((vector: number[], index: number) => {
    assert(
      vector.length === 2,
      `Expected 2 coordinates at index ${index}, got: ${vector.length}`
    )
    assert(
      vector[0] > -180 && vector[0] < 180,
      `Longitude out of range at index ${index}: ${vector[0]}`
    )
    assert(
      vector[1] > -90 && vector[1] < 90,
      `Latitude out of range at index ${index}: ${vector[1]}`
    )
  })
  write('k..')
  return new Promise((resolve, reject) =>
    kmeans.clusterize(
      vectors,
      { k: nrOfClusters },
      (err: any, res: KmeansCluster[]) => {
        write('.m')
        if (err) return reject(err)
        const clusters: OutputCluster[] = res.map((cluster: KmeansCluster) => ({
          center: new Position({
            lon: cluster.centroid[0],
            lat: cluster.centroid[1],
          }),
          items: cluster.clusterInd.map((i: number) => input[i]),
        }))
        resolve(clusters)
      }
    )
  )
}

module.exports = { clusterPositions }
