import React from 'react'
import styled from 'styled-components'
import { keyframes } from 'styled-components'
import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
} from '@mui/material'

const Wrapper = styled.div`
  width: 50vh;
  height: 50vh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 3;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  border-radius: 20px;
`

const pulseAnimation = keyframes`
  0%
  {
    transform: scale( 1.1 );
  }
  50%
  {
    transform: scale( 1.8 );
  }
  100%
  {
    transform: scale( 1.1 );
  }
`

const Loading = ({
  passengers,
  connected,
  cars,
  bookings,
  municipalities,
  parameters,
}) => {
  let activeStep = 0
  if (!connected) activeStep = 0
  else if (!parameters) activeStep = 1
  else if (!municipalities) activeStep = 2
  else if (!cars) activeStep = 3
  else if (!passengers || !bookings) activeStep = 4
  else activeStep = 5

  return (
    <Wrapper>
      <Stepper activeStep={activeStep} orientation="vertical">
        <Step key={1}>
          <StepLabel>Försöker nå simulatorn...</StepLabel>
          {activeStep === 0 && (
            <StepContent>
              <Typography
                color="white"
                sx={{
                  color: 'white',
                  fontSize: '0.9rem',
                  maxWidth: '300px',
                }}
              >
                Om detta steg tar tid beror det oftast på ett fel som har
                uppstått. Vänta någon minut så startar servrarna om sig
                automatiskt. Om det fortfarande inte fungerar kontakta teamet på
                Discord.
              </Typography>
            </StepContent>
          )}
        </Step>
        <Step key={2}>
          <StepLabel>Hämtar experimentparametrar...</StepLabel>
        </Step>
        <Step key={3}>
          <StepLabel>Hämtar {municipalities} kommuner...</StepLabel>
        </Step>
        <Step key={4}>
          <StepLabel>Skapar {cars} fordon...</StepLabel>
        </Step>
        <Step key={5}>
          <StepLabel>
            Genererar {passengers} passagerare och {bookings} bokningar...
          </StepLabel>
          <StepContent>
            <Typography
              color="white"
              sx={{
                color: 'white',
                fontSize: '0.9rem',
                maxWidth: '300px',
              }}
            >
              Vi hämtar data från SCB över var människor i varje municipality
              bor och därefter slår vi upp adresser från Lantmäteriet och
              genererar därefter fiktiva personer som bor och arbetar på olika
              adresser och rör sig på ett regelbundet sätt.
            </Typography>
          </StepContent>
        </Step>
      </Stepper>
    </Wrapper>
  )
}

export default Loading
