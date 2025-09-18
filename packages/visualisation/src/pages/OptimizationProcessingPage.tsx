import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Truck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
// Removed lottie-react to avoid extra dependency
// No API polling; simple timed loading

const TOTAL_DURATION_MS = 5000 // ~5 sekunder (enkel väntetid)

// Simple loading icon (no Lottie)
const LottieAnimation: React.FC = () => {
  return <Truck className="text-primary animate-pulse" size={40} />
}

const phases = [
  'Projektet sparas',
  'Ser över fordon',
  'Håll ut det här kommer ta ett tag...',
  'Skapar kluster över hämtområden',
  'Schemalägger raster',
  'Snart där! Bara några steg kvar...',
  'Planerar upphämtningar',
  'Optimerar körtur',
]

const OptimizationProcessingPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Vidarebefordra incoming state efter slutförd process
  const forwardedState = useMemo(() => {
    return (location.state as any) || {}
  }, [location.state])

  const [percent, setPercent] = useState<number>(5)
  const [phaseIndex, setPhaseIndex] = useState<number>(0)
  const [experimentId] = useState<string | null>(() => {
    const st = (location.state as any) || {}
    return st.experimentId || null
  })
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const completedRef = useRef<boolean>(false)

  // SEO basics
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Optimering pågår – skapa optimering'
    return () => {
      document.title = prevTitle
    }
  }, [])

  // Blockera bakåtknapp och scroll
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Förhindra back/forward på denna sida
    const push = () => window.history.pushState(null, '', window.location.href)
    push()
    const onPopState = () => {
      push()
    }
    window.addEventListener('popstate', onPopState)

    // Varning vid stäng/ladda om
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  // Animera procent/faser (~3s) och navigera när klar
  useEffect(() => {
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress01 = Math.min(1, Math.max(0, elapsed / TOTAL_DURATION_MS))
      const pct = Math.max(5, Math.round(5 + progress01 * 95))
      setPercent(pct)

      const idx = Math.min(
        phases.length - 1,
        Math.floor(progress01 * phases.length)
      )
      setPhaseIndex(idx)

      if (progress01 < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else if (!completedRef.current) {
        completedRef.current = true
        if (experimentId) {
          navigate(`/experiment/${experimentId}`, { replace: true })
        } else {
          // fallback om vi saknar id – skicka vidare ev. state (t.ex. activeTab)
          navigate('/routes', { replace: true, state: forwardedState })
        }
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [navigate, experimentId, forwardedState])

  const handleCancel = () => {
    // Avbryt och gå tillbaka eller till en säker fallback
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    completedRef.current = true
    // Försök gå tillbaka, annars till /routes
    if (window.history.length > 1) navigate(-1)
    else navigate('/routes')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <header className="w-full max-w-2xl mx-auto text-center space-y-6">
        <div
          aria-hidden
          className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-enter"
        >
          <LottieAnimation />
        </div>
        <h1 className="text-3xl font-normal break-words hyphens-auto">
          Optimering pågår
        </h1>
        <p
          className="text-muted-foreground break-words hyphens-auto"
          aria-live="polite"
        >
          {phases[phaseIndex]} — {percent}%
        </p>
      </header>

      <main className="w-full max-w-2xl mx-auto mt-8">
        <Progress value={percent} />
      </main>

      <footer className="w-full max-w-2xl mx-auto mt-12 text-center">
        <Button variant="outline" onClick={handleCancel}>
          Avbryt
        </Button>
      </footer>
    </div>
  )
}

export default OptimizationProcessingPage
