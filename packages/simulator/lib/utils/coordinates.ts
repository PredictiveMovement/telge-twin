export const extractCoordinates = (booking: any) => {
  const lat = booking.pickup?.position?.lat ?? booking.Lat
  const lng =
    booking.pickup?.position?.lng ??
    booking.pickup?.position?.lon ??
    booking.Lng

  return { lat, lng }
}

export const validateCoordinates = ({ lat, lng }: { lat: any; lng: any }) =>
  Number.isFinite(lat) && Number.isFinite(lng)
