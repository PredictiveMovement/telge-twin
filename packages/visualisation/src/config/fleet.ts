import type { FleetConfig } from '@/utils/fleetGenerator'
export const FLEET_CONFIG: FleetConfig = {
  groups: [
    {
      id: 'HUSH',
      label: 'Flotta – Hushåll',
      wasteIds: ['HUSHSORT', 'HEMSORT'],
    },
    { id: 'MAT', label: 'Flotta – Matavfall', wasteIds: ['MATAVF'] },
    {
      id: 'GLAS',
      label: 'Flotta – Glas',
      wasteIds: ['BGLOF', 'BGLFÄ', 'GLOF', 'GLFÄ', 'FGLOF', 'FGLFÄ'],
    },
    {
      id: 'FORP',
      label: 'Flotta – Förpackningar',
      wasteIds: [
        'PAPPFÖRP',
        'PLASTFÖRP',
        'METFÖRP',
        'BPAPPFÖRP',
        'BPLASTFÖRP',
        'BMETFÖRP',
      ],
    },
  ],
  fallbackTopN: 3,
}
