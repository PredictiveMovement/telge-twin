import { createRoot } from 'react-dom/client'
import App from './App.js'
import './index.css'

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

createRoot(document.getElementById('root')!).render(<App />)
