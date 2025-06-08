export const createFleetConfigFromDataset = (
  fleetConfigurations: any[],
  experimentId?: string,
  simulationSettings?: any
) => {
  const experimentType = simulationSettings?.experimentType || 'vroom'

  const fleets = fleetConfigurations.map((fleet) => {
    return {
      name: fleet.name,
      hubAddress: fleet.hubAddress || 'LERHAGA 50, 151 66 Södertälje',
      recyclingTypes: fleet.recyclingTypes,
      vehicles: fleet.vehicles,
      compartmentConfiguration: fleet.compartmentConfiguration,
      swedishCategory: fleet.swedishCategory,
      vehicleIds: fleet.vehicleIds,
      assignedTurids: fleet.assignedTurids,
      bookingCount: fleet.bookingCount,
      source: fleet.source,
      templateId: fleet.templateId,
      preAssignedBookings: fleet.preAssignedBookings,
    }
  })

  return {
    'Södertälje kommun': {
      settings: {
        experimentType,
        ...(experimentId && { replayExperiment: experimentId }),
      },
      fleets,
    },
  }
}
