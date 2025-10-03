const vroom = require('../../lib/vroom')

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
    expect(shipment).toMatchObject({
      id: 0,
      amount: [100, 10],
      pickup: { id: 0, location: [18.0, 59.0] },
      delivery: { id: 1, location: [18.2, 59.2] },
      service: 60,
    })
    // time windows exist and are arrays of [start,end]
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
    // time_window exists and looks like [start,end]
    expect(Array.isArray(veh.time_window)).toBe(true)
    expect(veh.time_window.length).toBe(2)

    const dimensions =
      Object.getOwnPropertyDescriptor(veh, '__capacityDimensions')?.value
    expect(dimensions).toEqual(['volumeLiters', 'weightKg'])
  })
})
