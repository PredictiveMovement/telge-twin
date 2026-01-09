export const testSettings = {
  avftyper: [
    {
      ID: 'HUSHSORT',
      BESKRIVNING: 'Hushållsavfall (sorterat)',
      VOLYMVIKT: 150, // kg/m³
    },
    {
      ID: 'MATAVF',
      BESKRIVNING: 'Matavfall',
      VOLYMVIKT: 400, // kg/m³
    },
    {
      ID: 'PAPPFÖRP',
      BESKRIVNING: 'Pappförpackningar',
      VOLYMVIKT: 50, // kg/m³
    },
    {
      ID: 'PLASTFÖRP',
      BESKRIVNING: 'Plastförpackningar',
      VOLYMVIKT: 30, // kg/m³
    },
    {
      ID: 'GLOF',
      BESKRIVNING: 'Glas (ofärgat)',
      VOLYMVIKT: 500, // kg/m³
    },
  ],

  tjtyper: [
    {
      ID: 'KRL140',
      BESKRIVNING: 'Kärl 140L',
      VOLYM: 140, // liters
      FYLLNADSGRAD: 80, // percent
    },
    {
      ID: 'KRL240',
      BESKRIVNING: 'Kärl 240L',
      VOLYM: 240,
      FYLLNADSGRAD: 85,
    },
    {
      ID: 'KRL370',
      BESKRIVNING: 'Kärl 370L',
      VOLYM: 370,
      FYLLNADSGRAD: 90,
    },
    {
      ID: 'CONTAINER',
      BESKRIVNING: 'Container 660L',
      VOLYM: 660,
      FYLLNADSGRAD: 95,
    },
  ],

  bilar: [
    {
      ID: '101',
      BESKRIVNING: 'Sopbil 2-fack',
      FACK: [
        {
          fackNumber: 1,
          volym: 12, // m³
          vikt: 3000, // kg
          avfallstyper: [{ avftyp: 'HUSHSORT' }, { avftyp: 'MATAVF' }],
        },
        {
          fackNumber: 2,
          volym: 8, // m³
          vikt: 2000, // kg
          avfallstyper: [{ avftyp: 'PAPPFÖRP' }, { avftyp: 'PLASTFÖRP' }],
        },
      ],
    },
    {
      ID: '102',
      BESKRIVNING: 'Sopbil 3-fack',
      FACK: [
        {
          fackNumber: 1,
          volym: 10, // m³
          vikt: 2500, // kg
          avfallstyper: [{ avftyp: 'HUSHSORT' }],
        },
        {
          fackNumber: 2,
          volym: 6, // m³
          vikt: 1500, // kg
          avfallstyper: [{ avftyp: 'MATAVF' }],
        },
        {
          fackNumber: 3,
          volym: 4, // m³
          vikt: 1000, // kg
          avfallstyper: [{ avftyp: 'PAPPFÖRP' }],
        },
      ],
    },
    {
      ID: '201',
      BESKRIVNING: 'Lastbil utan fack',
      FACK: [],
    },
  ],

  frekvenser: [
    { ID: 'V1', BESKRIVNING: 'Varje vecka' },
    { ID: 'V2', BESKRIVNING: 'Varannan vecka' },
    { ID: 'V4', BESKRIVNING: 'Var fjärde vecka' },
  ],

  pickupsBeforeDelivery: 15,

  breaks: [
    {
      id: 'lunch',
      startMinutes: 720, // 12:00
      durationMinutes: 30,
    },
  ],

  workday: {
    startMinutes: 360, // 06:00
    endMinutes: 900, // 15:00
  },

  optimizationSettings: {
    workingHours: {
      start: '06:00',
      end: '15:00',
    },
    breaks: [
      {
        id: 'morning-break',
        desiredTime: '09:00',
        duration: 15,
      },
      {
        id: 'lunch',
        desiredTime: '12:00',
        duration: 30,
      },
    ],
  },
}

export const minimalSettings = {
  avftyper: [],
  tjtyper: [],
  bilar: [],
  frekvenser: [],
}
