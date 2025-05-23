import React, { useState, useEffect } from 'react'
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  Button,
  Paper,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Refresh, Science } from '@mui/icons-material'
import { fetchExperimentIds, fetchPlanById } from '../api/simulator'

const ExperimentList = ({ onSelectExperiment }) => {
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedExperimentId, setSelectedExperimentId] = useState(null)

  const loadExperiments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchExperimentIds()
      setExperiments(data)
    } catch (err) {
      setError('Failed to load experiments: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExperiments()
  }, [])

  const handleSelectExperiment = async (experiment) => {
    setSelectedExperimentId(experiment.id)
    if (onSelectExperiment) {
      try {
        const planData = await fetchPlanById(experiment.id)
        onSelectExperiment({ ...experiment, planData })
      } catch (err) {
        setError('Failed to load experiment details: ' + err.message)
      }
    }
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <Paper elevation={3} sx={{ p: 2, maxHeight: '60vh', overflow: 'auto' }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          <Science /> Saved Experiments
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Refresh />}
          onClick={loadExperiments}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : experiments.length === 0 ? (
        <Typography color="text.secondary" align="center" py={3}>
          No experiments found
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {experiments.length} experiment{experiments.length !== 1 ? 's' : ''}{' '}
            found
          </Typography>
          <List dense>
            {experiments.map((experiment, index) => (
              <React.Fragment key={experiment.documentId}>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedExperimentId === experiment.id}
                    onClick={() => handleSelectExperiment(experiment)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        color: 'primary.contrastText',
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace">
                            {experiment.id}
                          </Typography>
                          <Chip
                            label={`#${index + 1}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: '20px' }}
                          />
                        </Box>
                      }
                      secondary={
                        experiment.timestamp
                          ? formatTimestamp(experiment.timestamp)
                          : 'No timestamp'
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < experiments.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </>
      )}
    </Paper>
  )
}

export default ExperimentList
