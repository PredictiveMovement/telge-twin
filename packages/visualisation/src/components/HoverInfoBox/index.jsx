import React, { useMemo } from 'react'
import styled from 'styled-components'
import ProgressBar from '../ProgressBar'
import moment from 'moment'
import {
  DirectionsCar,
  Speed,
  Navigation,
  LocalShipping,
  Delete,
  Timer,
  Info,
  LocationOn,
} from '@mui/icons-material'

const Wrapper = styled.div.attrs((props) => ({
  style: {
    left: props.left - 50,
    bottom: props.top,
  },
}))`
  position: absolute;
  background-color: #fff;
  color: #000;
  width: 300px;
  padding: 1.1rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1;

  :after {
    z-index: -1;
    position: absolute;
    top: 98.1%;
    left: 43%;
    margin-left: -25%;
    content: '';
    width: 0;
    height: 0;
    border-top: solid 10px white;
    border-left: solid 10px transparent;
    border-right: solid 10px transparent;
  }
`

const VehicleImage = styled.img`
  width: 100%;
  height: 120px;
  object-fit: cover;
  object-position: bottom;
  border-radius: 6px;
  margin-bottom: 1rem;
`

const InfoItem = styled.div`
  margin-bottom: 0.5rem;
  display: flex;
  align-items: start;
`

const IconWrapper = styled.div`
  margin-right: 0.5rem;
  display: flex;
  align-items: center;
  color: #666;
`

const Label = styled.span`
  font-size: 0.9rem;
  color: #666;
`

const Value = styled.span`
  font-weight: bold;
  font-size: 0.9rem;
  margin-left: 0.3rem;
`

const Title = styled.h3`
  margin-top: 0rem;
  margin-bottom: 1rem;
`

const vehicleName = (vehicleType) => {
  switch (vehicleType) {
    case 'car':
      return 'Bil'
    case 'truck':
      return 'Smart fordon'
    case 'recycleTruck':
      return 'Återvinningsfordon'
    default:
      return 'Fordon'
  }
}

const statusLabel = (status) => {
  switch (status) {
    case 'Queued':
    case 'Assigned':
      return 'Väntar på tömning'
    case 'Picked up':
      return 'Tömd'
    case 'Delivered':
      return 'Tömd och klar'
    default:
      return status
  }
}

const vehicleImages = {
  Matavfall: '/matavfall.png',
  default: '/matavfall.png',
}

const ProgressBarContainer = styled.div`
  margin-top: 1rem;
`

const ProgressBarLabel = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
`

const CarInfo = ({ data }) => {
  const imageUrl = vehicleImages[data.fleet] || vehicleImages.default

  return (
    <Wrapper left={data.x} top={data.viewport.height - data.y + 20}>
      <VehicleImage
        src={imageUrl}
        alt={`${vehicleName(data.vehicleType)} ${data.id}`}
      />
      <Title>
        <strong>{`${vehicleName(data.vehicleType)} ${data.id}`}</strong>
      </Title>
      <InfoItem>
        <IconWrapper>
          <DirectionsCar />
        </IconWrapper>
        <Label>Flotta:</Label> <Value>{data.fleet}</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <Info />
        </IconWrapper>
        <Label>Status:</Label> <Value>{data.status}</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <Speed />
        </IconWrapper>
        <Label>Hastighet:</Label> <Value>{data.speed || 0} km/h</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <LocationOn />
        </IconWrapper>
        <Label>Avstånd:</Label> <Value>{data.ema} m</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <Navigation />
        </IconWrapper>
        <Label>Körsträcka:</Label>{' '}
        <Value>{Math.ceil(10 * data.distance) / 10 || 0} km</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <LocalShipping />
        </IconWrapper>
        <Label>
          CO<sub>2</sub>:
        </Label>{' '}
        <Value>{Math.ceil(10 * data.co2) / 10 || 0} kg</Value>
      </InfoItem>

      {data.recyclingTypes && (
        <InfoItem>
          <IconWrapper>
            <Delete />
          </IconWrapper>
          <Label>Återvinningstyper:</Label>{' '}
          <Value>{data.recyclingTypes.join(', ')}</Value>
        </InfoItem>
      )}

      <InfoItem>
        <IconWrapper>
          <Timer />
        </IconWrapper>
        <Label>Köat:</Label> <Value>{data.queue || 0} kärl</Value>
      </InfoItem>

      <ProgressBarContainer>
        <ProgressBarLabel>
          <Label>Upphämtat:</Label>
          <Value>{data.cargo || 0} kärl</Value>
        </ProgressBarLabel>
        <ProgressBar
          completed={Math.round((data.cargo / data.queue) * 100) || 0}
          color="#4CAF50"
        />
      </ProgressBarContainer>

      <ProgressBarContainer>
        <ProgressBarLabel>
          <Label>Tömt:</Label>
          <Value>{data.delivered || 0} kärl</Value>
        </ProgressBarLabel>
        <ProgressBar
          completed={Math.round((data.delivered / data.queue) * 100) || 0}
          color="#2196F3"
        />
      </ProgressBarContainer>

      {data.passengerCapacity && (
        <ProgressBarContainer>
          <ProgressBarLabel>
            <Label>Passagerarfyllnadsgrad:</Label>
            <Value>
              {Math.round((data.passengers / data.passengerCapacity) * 100) ||
                0}
              %
            </Value>
          </ProgressBarLabel>
          <ProgressBar
            completed={Math.round(
              Math.min(100, (data.passengers / data.passengerCapacity) * 100) ||
                0
            )}
            color="#13c57b"
          />
        </ProgressBarContainer>
      )}
      {data.parcelCapacity && (
        <ProgressBarContainer>
          <ProgressBarLabel>
            <Label>Fyllnadsgrad 2 kärl:</Label>
            <Value>
              {Math.round((data.cargo / data.parcelCapacity) * 100) || 0}%
            </Value>
          </ProgressBarLabel>
          <ProgressBar
            completed={Math.round(
              Math.min(100, (data.cargo / data.parcelCapacity) * 100) || 0
            )}
            color="#13c57b"
          />
        </ProgressBarContainer>
      )}
    </Wrapper>
  )
}

const GenericInfo = ({ data }) => {
  return (
    <Wrapper left={data.x} top={data.viewport.height - data.y + 20}>
      <Title>
        <strong>{data.id}</strong>
      </Title>
      <InfoItem>
        <IconWrapper>
          <Delete />
        </IconWrapper>
        <Label>Typ:</Label> <Value>Återvinningskärl</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <Delete />
        </IconWrapper>
        <Label>Återvinningstyp:</Label> <Value>{data.recyclingType}</Value>
      </InfoItem>
      <InfoItem>
        <IconWrapper>
          <DirectionsCar />
        </IconWrapper>
        <Label>Bil:</Label> <Value>{data.carId}</Value>
      </InfoItem>
      {data.deliveryTime && (
        <InfoItem>
          <IconWrapper>
            <Timer />
          </IconWrapper>
          <Label>Leveranstid:</Label>{' '}
          <Value>{Math.ceil((10 * data.deliveryTime) / 60 / 60) / 10} h</Value>
        </InfoItem>
      )}
      {data.status && (
        <InfoItem>
          <IconWrapper>
            <Info />
          </IconWrapper>
          <Label>Status:</Label> <Value>{statusLabel(data.status)}</Value>
        </InfoItem>
      )}
      {data.pickupDateTime && (
        <InfoItem>
          <IconWrapper>
            <Timer />
          </IconWrapper>
          <Label>Tömdes kl:</Label>{' '}
          <Value>{moment(data.pickupDateTime).format('HH:mm')}</Value>
        </InfoItem>
      )}
      {data.co2 && (
        <InfoItem>
          <IconWrapper>
            <LocalShipping />
          </IconWrapper>
          <Label>
            CO<sub>2</sub>:
          </Label>{' '}
          <Value>{Math.ceil(10 * data.co2) / 10} kg</Value>
        </InfoItem>
      )}
      {data.cost && (
        <InfoItem>
          <IconWrapper>
            <Info />
          </IconWrapper>
          <Label>Schablonkostnad:</Label>{' '}
          <Value>{Math.ceil(10 * data.cost) / 10} kr</Value>
        </InfoItem>
      )}
    </Wrapper>
  )
}

const HoverInfoBox = ({ data, cars, bookings }) => {
  const objectData = useMemo(() => {
    if (data.type === 'car') {
      const car = cars.find((car) => car.id === data.id)
      if (!car) return null
      return { ...car, ...data }
    } else if (data.type === 'booking') {
      const booking = bookings.find((booking) => booking.id === data.id)
      if (!booking) return null
      return { ...booking, ...data }
    }
    return null
  }, [data, cars, bookings])

  if (!objectData) return null

  switch (data.type) {
    case 'car':
      return <CarInfo data={objectData} />
    case 'booking':
      return <GenericInfo data={objectData} />
    default:
      return null
  }
}

export default HoverInfoBox
