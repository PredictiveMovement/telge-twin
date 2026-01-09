export const sodertaljeCoordinates = {
  // Central Södertälje / Geneta (cluster near hub, within ~400 m)
  centrum1: { lat: 59.19946, lng: 17.6307 },
  centrum2: { lat: 59.19988, lng: 17.63202 },
  centrum3: { lat: 59.19897, lng: 17.63131 },

  // Ronna area (northern residential cluster, within ~300 m)
  ronna1: { lat: 59.22211, lng: 17.64078 },
  ronna2: { lat: 59.22157, lng: 17.64201 },
  ronna3: { lat: 59.22089, lng: 17.64126 },

  // Weda / Hovsjö corridor (south-east, within ~350 m)
  weda1: { lat: 59.16976, lng: 17.63902 },
  weda2: { lat: 59.16892, lng: 17.64188 },
  weda3: { lat: 59.16837, lng: 17.63794 },

  // Järna outskirts (used for fallbacks/noise)
  jarna1: { lat: 59.116276819133915, lng: 17.5596008616507 },
  trosa: { lat: 58.86886590963991, lng: 17.545156636435042 },

  // Depot/Hub locations from dataset
  depot1: { lat: 59.135449, lng: 17.571239 },
  depot2: { lat: 59.169778746, lng: 17.600596542 },
}

// Telge area coordinates (used in actual data)
export const telgeCoordinates = {
  hub: { lat: 59.135449, lng: 17.571239 },
  pickup1: { lat: 59.13545, lng: 17.57124 },
  pickup2: { lat: 59.13555, lng: 17.5713 },
  pickup3: { lat: 59.2, lng: 17.7 },
}

// Alternative coordinate formats for testing
export const coordinateFormats = {
  latLng: { lat: 59.13545, lng: 17.57124 },
  latLon: { lat: 59.13545, lon: 17.57124 },
  LatLng: { Lat: 59.13545, Lng: 17.57124 },
  nested: { pickup: { position: { lat: 59.13545, lng: 17.57124 } } },
}
