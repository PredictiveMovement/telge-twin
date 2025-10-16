import { cleanCars } from '../../web/routes/cars'

describe('cleanCars mapping', () => {
  it('maps internal car shape to socket payload', () => {
    const car = {
      id: 't-1',
      position: { lon: 18.0, lat: 59.0 },
      altitude: 15,
      destination: { lon: 18.5, lat: 59.5 },
      speed: 12,
      bearing: 123,
      status: 'ready',
      fleet: { name: 'PostNord' },
      cargo: [1, 2],
      parcelCapacity: 100,
      queue: [1],
      co2: 10,
      distance: 5,
      ema: 0,
      eta: null,
      vehicleType: 'truck',
      recyclingTypes: ['paper'],
      delivered: [1, 2, 3],
    }
    const out = cleanCars(car as any)
    expect(out).toEqual({
      id: 't-1',
      destination: [18.5, 59.5],
      speed: 12,
      bearing: 123,
      position: [18.0, 59.0, 15],
      status: 'ready',
      fleet: 'PostNord',
      co2: 10,
      distance: 5,
      ema: 0,
      eta: null,
      cargo: 2,
      queue: 1,
      parcelCapacity: 100,
      vehicleType: 'truck',
      recyclingTypes: ['paper'],
      delivered: 3,
      compartments: [],
    })
  })

  it('handles missing optional fields', () => {
    const car = {
      id: 't-2',
      position: { lon: 18.0, lat: 59.0 },
      speed: 0,
      bearing: 0,
      status: 'ready',
      cargo: [],
      queue: [],
      co2: 0,
      distance: 0,
      vehicleType: 'truck',
      delivered: [],
    }
    const out = cleanCars(car as any)
    expect(out.fleet).toBe('Privat')
    expect(out.destination).toBeNull()
    expect(out.position).toEqual([18.0, 59.0, 0])
  })
})

export {}
