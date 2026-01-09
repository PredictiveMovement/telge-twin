import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MapPage from './pages/MapPage'
import NotFound from './pages/NotFound'
import Index from './pages/Index'
import RoutesPage from './pages/RoutesPage'
import ExperimentDetailPage from './pages/ExperimentDetailPage'
import OptimizePage from './pages/OptimizePage'
import OptimizationProcessingPage from './pages/OptimizationProcessingPage'
import SaveOptimizationProjectPage from './pages/SaveOptimizationProjectPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/optimize/map" element={<MapPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route
          path="/experiment/:experimentId"
          element={<ExperimentDetailPage />}
        />
        <Route
          path="/optimize/:experimentId"
          element={<OptimizePage />}
        />
        <Route
          path="/optimize/processing"
          element={<OptimizationProcessingPage />}
        />
        <Route path="/optimize/save" element={<SaveOptimizationProjectPage />} />
        <Route path="/not-found" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
