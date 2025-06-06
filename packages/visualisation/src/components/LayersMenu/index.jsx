import * as React from 'react'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LayersIcon from '@mui/icons-material/Layers'
import {
  FormControlLabel,
  ListItemText,
  Switch,
  Select,
  FormControl,
} from '@mui/material'
import ContentPaste from '@mui/icons-material/ContentPaste'
import FolderIcon from '@mui/icons-material/Folder'
import UploadFileIcon from '@mui/icons-material/UploadFile'

import { Hail, Info, Map, Person } from '@mui/icons-material'
import RouteIcon from '@mui/icons-material/Route'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import LegendToggleIcon from '@mui/icons-material/LegendToggle'

export default function LayersMenu({
  activeLayers,
  showArcLayer,
  setShowArcLayer,
  showActiveDeliveries,
  setShowActiveDeliveries,
  showAssignedBookings,
  setShowAssignedBookings,
  setShowEditExperimentModal,
  experimentId,
  socket,
  selectedDataFile,
  setSelectedDataFile,
  uploadedFiles,
}) {
  const [anchorEl, setAnchorEl] = React.useState(null)
  const open = Boolean(anchorEl)
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleFileSelect = (event) => {
    const filename = event.target.value
    setSelectedDataFile(filename)
    socket.emit('selectDataFile', filename)
    socket.emit('saveDataFileSelection', filename)
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      console.log('Försöker ladda upp fil:', file.name)

      const formData = new FormData()
      formData.append('file', file)

      console.log('Laddar upp fil...')

      const apiUrl = `${
        import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:4000'
      }/api/upload`

      fetch(apiUrl, {
        method: 'POST',
        body: formData,
      })
        .then((response) => {
          console.log('Upload status:', response.status)
          if (!response.ok) {
            throw new Error(
              `Upload failed with status ${response.status}: ${response.statusText}`
            )
          }
          return response.json()
        })
        .then((data) => {
          console.log('Upload success:', data)
          if (data.success) {
            socket.emit('getUploadedFiles')
            setSelectedDataFile(file.name)
          }
        })
        .catch((error) => {
          console.error('Error uploading file:', error)
          alert(`Filuppladdning misslyckades: ${error.message}`)
        })
    }
  }

  return (
    <React.Fragment>
      <IconButton
        onClick={handleClick}
        onMouseOver={handleClick}
        size="small"
        sx={{ ml: 2 }}
        aria-controls={open ? 'account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <LayersIcon sx={{ width: 32, height: 32 }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem>
          <ListItemIcon>
            <RouteIcon fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={showArcLayer}
                onChange={() => setShowArcLayer((on) => !on)}
              />
            }
            label="Nästa stopp"
          />
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <RouteIcon fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={showAssignedBookings}
                onChange={() => setShowAssignedBookings((on) => !on)}
              />
            }
            label="Köade bokningar"
          />
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <RouteIcon fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={showActiveDeliveries}
                onChange={() => setShowActiveDeliveries((on) => !on)}
              />
            }
            label="Pågående leveranser"
          />
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <Map fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={activeLayers.municipalityLayer}
                onChange={() => activeLayers.setMunicipalityLayer((on) => !on)}
              />
            }
            label="Kommungränser"
          />
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <DirectionsCarIcon fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={activeLayers.carLayer}
                onChange={() => activeLayers.setCarLayer((on) => !on)}
              />
            }
            label="Visa fordon"
          />
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <DirectionsCarIcon fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={activeLayers.useIcons}
                onChange={() => activeLayers.setUseIcons((on) => !on)}
              />
            }
            label="Använd ikoner för fordon"
          />
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <LegendToggleIcon fontSize="small" />
          </ListItemIcon>
          <FormControlLabel
            control={
              <Switch
                checked={activeLayers.showBookingLegend}
                onChange={() => activeLayers.setShowBookingLegend((on) => !on)}
              />
            }
            label="Visa färgförklaring för bokningar"
          />
        </MenuItem>
        <Divider />

        <MenuItem
          sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}
        >
          <ListItemIcon
            sx={{ minWidth: 'auto', mr: 1, display: 'inline-flex' }}
          >
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Välj datafil" sx={{ mb: 1 }} />

          <FormControl fullWidth size="small">
            <Select
              value={selectedDataFile || ''}
              onChange={handleFileSelect}
              displayEmpty
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="" disabled>
                Välj datafil
              </MenuItem>
              {uploadedFiles &&
                uploadedFiles.map((file) => (
                  <MenuItem key={file} value={file}>
                    {file}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <IconButton component="label" size="small" sx={{ mt: 1 }}>
            <UploadFileIcon fontSize="small" />
            <input
              type="file"
              hidden
              accept=".json"
              onChange={handleFileChange}
            />
          </IconButton>
        </MenuItem>

        <Divider />
        <MenuItem onClick={() => setShowEditExperimentModal((on) => !on)}>
          <ListItemIcon>
            <ContentPaste fontSize="small" />
          </ListItemIcon>
          <ListItemText>Redigera experiment</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <Info fontSize="small" />
          </ListItemIcon>
          <ListItemText>Experiment: {experimentId}</ListItemText>
        </MenuItem>
      </Menu>
    </React.Fragment>
  )
}
