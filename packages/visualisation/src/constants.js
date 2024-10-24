export const BOOKING_COLORS = {
  // Household waste
  HUSHSORT: [254, 97, 0], // Orange
  HEMSORT: [254, 97, 0], // Orange
  BRÄNN: [254, 97, 0], // Orange

  // Organic waste
  MATAVF: [255, 132, 87], // Light Orange
  TRÄDGÅRD: [255, 132, 87], // Light Orange

  // Recyclables
  TEXTIL: [176, 96, 255], // Purple
  METFÖRP: [176, 96, 255], // Purple
  PLASTFÖRP: [176, 96, 255], // Purple
  PAPPFÖRP: [176, 96, 255], // Purple
  RETURPAPP: [176, 96, 255], // Purple
  WELLPAPP: [176, 96, 255], // Purple
  GLFÄ: [176, 96, 255], // Purple
  GLOF: [176, 96, 255], // Purple
  BMETFÖRP: [176, 96, 255], // Purple
  BPLASTFÖRP: [176, 96, 255], // Purple
  BPAPPFÖRP: [176, 96, 255], // Purple
  BRETURPAPP: [176, 96, 255], // Purple
  BGLFÄ: [176, 96, 255], // Purple
  BGLOF: [176, 96, 255], // Purple

  // Hazardous waste
  FA: [254, 254, 98], // Yellow
  ELAVF: [254, 254, 98], // Yellow
  TRÄIMP: [254, 254, 98], // Yellow

  // Bulky waste
  BLANDAVF: [124, 167, 255], // Light Blue
  TRÄ: [124, 167, 255], // Light Blue
  HÖGSMTRL: [124, 167, 255], // Light Blue
  BRÄNNKL2: [124, 167, 255], // Light Blue

  // Special waste
  FETT: [251, 144, 201], // Pink
  SLAM: [251, 144, 201], // Pink
  LATRIN: [251, 144, 201], // Pink
  HAVREASKA: [251, 144, 201], // Pink
  ANJORD: [251, 144, 201], // Pink

  // Other
  DUMP: [50, 90, 100], // Dark Teal
  DEP: [50, 90, 100], // Dark Teal

  // Lastväxlare
  Liftdumper: [1, 161, 147], // Teal
  Rullflak: [1, 161, 147], // Teal
  komprimatorer: [1, 161, 147], // Teal

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
