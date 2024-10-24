export const BOOKING_COLORS = {
  // Household waste
  HUSHSORT: [254, 97, 0],
  HEMSORT: [254, 97, 0],
  BRÄNN: [254, 97, 0],

  // Organic waste
  MATAVF: [255, 132, 87],
  TRÄDGÅRD: [255, 132, 87],

  // Recyclables
  TEXTIL: [176, 96, 255],
  METFÖRP: [176, 96, 255],
  PLASTFÖRP: [176, 96, 255],
  PAPPFÖRP: [176, 96, 255],
  RETURPAPP: [176, 96, 255],
  WELLPAPP: [176, 96, 255],
  GLFÄ: [176, 96, 255],
  GLOF: [176, 96, 255],
  BMETFÖRP: [176, 96, 255],
  BPLASTFÖRP: [176, 96, 255],
  BPAPPFÖRP: [176, 96, 255],
  BRETURPAPP: [176, 96, 255],
  BGLFÄ: [176, 96, 255],
  BGLOF: [176, 96, 255],

  // Hazardous waste
  FA: [254, 254, 98],
  ELAVF: [254, 254, 98],
  TRÄIMP: [254, 254, 98],

  // Bulky waste
  BLANDAVF: [124, 167, 255],
  TRÄ: [124, 167, 255],
  HÖGSMTRL: [124, 167, 255],
  BRÄNNKL2: [124, 167, 255],

  // Special waste
  FETT: [251, 144, 201],
  SLAM: [251, 144, 201],
  LATRIN: [251, 144, 201],
  HAVREASKA: [251, 144, 201],
  ANJORD: [251, 144, 201],

  // Other
  DUMP: [50, 90, 100],
  DEP: [50, 90, 100],

  // Lastväxlare
  Liftdumper: [1, 161, 147],
  Rullflak: [1, 161, 147],
  komprimatorer: [1, 161, 147],

  // Statuses
  DELIVERED: [113, 120, 153],
  PICKED_UP: [173, 177, 199],
}

export const groupedColors = {
  Hushållsavfall: ['HUSHSORT', 'HEMSORT', 'BRÄNN'],
  'Organiskt avfall': ['MATAVF', 'TRÄDGÅRD'],
  Återvinningsbart: [
    'TEXTIL',
    'METFÖRP',
    'PLASTFÖRP',
    'PAPPFÖRP',
    'RETURPAPP',
    'WELLPAPP',
    'GLFÄ',
    'GLOF',
    'BMETFÖRP',
    'BPLASTFÖRP',
    'BPAPPFÖRP',
    'BRETURPAPP',
    'BGLFÄ',
    'BGLOF',
  ],
  'Farligt avfall': ['FA', 'ELAVF', 'TRÄIMP'],
  Grovavfall: ['BLANDAVF', 'TRÄ', 'HÖGSMTRL', 'BRÄNNKL2'],
  Specialavfall: ['FETT', 'SLAM', 'LATRIN', 'HAVREASKA', 'ANJORD'],
  Övrigt: ['DUMP', 'DEP'],
  Lastväxlare: ['Liftdumper', 'Rullflak', 'komprimatorer'],
}
