import { createRoot } from 'react-dom/client'
import App from './App.js'
import './index.css'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { SocketIOProvider } from './context/socketIOProvider'
import { AzureAuthProvider } from '@/auth/AzureAuthProvider'

const linkPrompt = document.createElement('link')
linkPrompt.rel = 'stylesheet'
linkPrompt.href =
  'https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap'
document.head.appendChild(linkPrompt)

const linkSaira = document.createElement('link')
linkSaira.rel = 'stylesheet'
linkSaira.href =
  'https://fonts.googleapis.com/css2?family=Saira+Stencil+One&display=swap'
document.head.appendChild(linkSaira)

const darkTheme = createTheme({
  overrides: {
    MuiStepIcon: {
      root: {
        '&$completed': {
          color: 'pink',
        },
        '&$active': {
          color: 'red',
        },
      },
      active: {},
      completed: {},
    },
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#10c57b',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <AzureAuthProvider>
    <SocketIOProvider
      url={import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:4000'}
      opts={{ withCredentials: true }}
    >
      <ThemeProvider theme={darkTheme}>
        <App />
      </ThemeProvider>
    </SocketIOProvider>
  </AzureAuthProvider>
)
