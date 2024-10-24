import React, { useCallback } from 'react'
import { Typography, Box } from '@mui/material'
import { BOOKING_COLORS, groupedColors } from '../../constants'

const BookingLegend = React.memo(({ activeFilter, setActiveFilter }) => {
  const handleFilterClick = useCallback(
    (groupName) => {
      setActiveFilter((prevFilter) =>
        prevFilter === groupName ? null : groupName
      )
    },
    [setActiveFilter]
  )

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: '150px',
        left: '20px',
        backgroundColor: 'rgba(69, 69, 69, 0.8)',
        padding: '20px',
        borderRadius: '5px',
        color: '#FFFFFF',
        maxHeight: '70vh',
        overflowY: 'auto',
        width: '200px',
      }}
    >
      <Typography variant="h6">Bokningar</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
        <Box
          sx={{
            width: '20px',
            height: '20px',
            backgroundColor: `rgb(${BOOKING_COLORS.DELIVERED.join(',')})`,
            marginRight: '10px',
            borderRadius: '50%',
          }}
        />
        <Typography>Levererad</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
        <Box
          sx={{
            width: '20px',
            height: '20px',
            backgroundColor: `rgb(${BOOKING_COLORS.PICKED_UP.join(',')})`,
            marginRight: '10px',
            borderRadius: '50%',
          }}
        />
        <Typography>Upphämtad</Typography>
      </Box>
      <Box
        sx={{
          height: '1px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          margin: '10px 0',
        }}
      />
      {Object.entries(groupedColors).map(([groupName, types]) => (
        <Box
          key={groupName}
          onClick={() => handleFilterClick(groupName)}
          sx={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            padding: '5px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'background-color 0.3s',
            backgroundColor:
              activeFilter === groupName
                ? 'rgba(255, 255, 255, 0.3)'
                : 'transparent',
            '&:hover': {
              backgroundColor:
                activeFilter === groupName
                  ? 'rgba(255, 255, 255, 0.4)'
                  : 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <Box
            sx={{
              width: '20px',
              height: '20px',
              backgroundColor: `rgb(${
                BOOKING_COLORS[types[0]] || BOOKING_COLORS.DELIVERED.join(',')
              })`,
              marginRight: '10px',
              borderRadius: '50%',
              flexShrink: 0,
            }}
          />
          <Typography
            variant="subtitle1"
            sx={{
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {groupName}
          </Typography>
        </Box>
      ))}
    </Box>
  )
})

export default BookingLegend
