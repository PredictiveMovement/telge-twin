const kmeans = require('node-kmeans')
const assert = require('assert')
const { write } = require('./log')
const { info } = require('console')
const Position = require('./models/position')

const clusterPositions = (input: any, nrOfClusters = 5) => {
  const vectors = input.map(({ pickup, position = pickup.position }: any) => [
    position.lon,
    position.lat,
  ])
  info('Clustering', vectors.length, 'positions into', nrOfClusters, 'clusters')
  assert(
    vectors.length < 301,
    'Too many positions to cluster:' + vectors.length
  )
  vectors.forEach((vector: any, index: number) => {
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
    kmeans.clusterize(vectors, { k: nrOfClusters }, (err: any, res: any) => {
      write('.m')
      if (err) return reject(err)
      const clusters = res.map((cluster: any) => ({
        center: new Position({
          lon: cluster.centroid[0],
          lat: cluster.centroid[1],
        }),
        items: cluster.clusterInd.map((i: number) => input[i]),
      }))
      resolve(clusters)
    })
  )
}

module.exports = { clusterPositions }
