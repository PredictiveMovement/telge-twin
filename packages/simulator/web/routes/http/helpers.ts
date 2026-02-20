export const handleError = (
  error: unknown,
  defaultMessage = 'Unknown error occurred'
) => ({
  success: false,
  error: error instanceof Error ? error.message : typeof error === 'string' ? error : defaultMessage,
})

export const successResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
})

export const DEFAULT_SIM_PARAMS = {
  startDate: () => new Date().toISOString(),
  fixedRoute: 100,
  emitters: ['bookings', 'cars'],
  initMapState: {
    latitude: 65.0964472642777,
    longitude: 17.112050188704504,
    zoom: 5,
  },
}
