export const createFleetConfigFromDataset = (
  fleetConfigurations: any[],
  experimentId?: string,
  simulationSettings?: any
) => {
  const optimizeRoutes = simulationSettings?.optimizeRoutes ?? true
  const saveToElastic = simulationSettings?.saveToElastic ?? true
  const createReplay = simulationSettings?.createReplay ?? true

  const fleets = fleetConfigurations.map((fleet) => {
    return {
      name: fleet.name,
      hubAddress: fleet.hubAddress || 'LERHAGA 50, 151 66 Södertälje',
      recyclingTypes: fleet.recyclingTypes,
      vehicles: fleet.vehicles,
      optimizedRoutes: optimizeRoutes,
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

  console.log(
    `✅ Converted ${fleets.length} fleets successfully with optimizeRoutes: ${optimizeRoutes}`
  )

  return {
    'Södertälje kommun': {
      settings: {
        optimizedRoutes: optimizeRoutes,
        saveToElastic: saveToElastic,
        createReplay: createReplay,
        ...(experimentId && { replayExperiment: experimentId }),
      },
      fleets,
    },
  }
}
