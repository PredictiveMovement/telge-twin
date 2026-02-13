const vroom = require('../../lib/vroom')
import { CLUSTERING_CONFIG } from '../../lib/config'

const COMPRESSION = CLUSTERING_CONFIG.CAPACITY.VOLUME_COMPRESSION_FACTOR

describe('vroom mapping utilities', () => {
  it('bookingToShipment maps coordinates, load and time windows from virtual time', () => {
    const booking = {
      id: 'b1',
      pickup: { position: { lon: 18.0, lat: 59.0 } },
      destination: { position: { lon: 18.2, lat: 59.2 } },
      recyclingType: 'TEST',
      originalRecord: { Tjtyp: 'T1' },
      fleet: {
        settings: {
          workday: { startMinutes: 360, endMinutes: 900 },
          tjtyper: [{ ID: 'T1', VOLYM: 200, FYLLNADSGRAD: 50 }],
          avftyper: [{ ID: 'TEST', VOLYMVIKT: 100 }],
        },
      },
    }
    const shipment = vroom.bookingToShipment(booking, 0, {
      capacityDimensions: ['volumeLiters', 'weightKg'],
      fleet: booking.fleet,
    })
    const expectedVolume = Math.round(200 * 0.5 * COMPRESSION) // 200L * 50% * compression
    const expectedWeight = Math.round((expectedVolume / 1000) * 100) // vroom.ts uses Math.round() on weight
    expect(shipment).toMatchObject({
      id: 0,
      amount: [expectedVolume, expectedWeight],
      pickup: { id: 0, location: [18.0, 59.0] },
      delivery: { id: 1, location: [18.2, 59.2] },
      service: 60,
    })
    expect(Array.isArray(shipment.pickup.time_windows)).toBe(true)
    expect(Array.isArray(shipment.delivery.time_windows)).toBe(true)
  })

  it('truckToVehicle maps start/end and capacity', () => {
    const truck = {
      position: { lon: 18.0, lat: 59.0 },
      parcelCapacity: 10,
      destination: { lon: 18.5, lat: 59.5 },
      cargo: [1, 2, 3],
      fleet: {
        settings: {
          workday: { startMinutes: 360, endMinutes: 900 },
          breaks: [],
        },
      },
      compartments: [
        {
          capacityLiters: 500,
          fillLiters: 100,
          capacityKg: 200,
          fillKg: 50,
          allowedWasteTypes: ['*'],
        },
      ],
    }
    const veh = vroom.truckToVehicle(truck, 7)
    expect(veh).toMatchObject({
      id: 7,
      capacity: [400, 150],
      start: [18.0, 59.0],
      end: [18.5, 59.5],
    })
    expect(Array.isArray(veh.time_window)).toBe(true)
    expect(veh.time_window.length).toBe(2)

    const dimensions =
      Object.getOwnPropertyDescriptor(veh, '__capacityDimensions')?.value
    expect(dimensions).toEqual(['volumeLiters', 'weightKg'])
  })
})

export {}
