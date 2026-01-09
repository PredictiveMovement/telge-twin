import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderOpen, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { getRouteDatasets, type RouteDataset } from '@/api/simulator'
import { toast } from 'sonner'

const PaperIcon: React.FC<{ className?: string }> = ({ className }) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  const restartAnimation = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsAnimating(false)
    requestAnimationFrame(() => {
      setIsAnimating(true)
      timeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false)
        timeoutRef.current = null
      }, 4100)
    })
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div className={className} onMouseEnter={restartAnimation}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 45 45"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
      >
        <title>Formulärikon</title>
        <style>{`
          #epundSciBLx1 * {animation: none}
          #epundSciBLx1.animating #epundSciBLx2_to {animation: epundSciBLx2_to__to 4000ms linear 1 forwards}
          #epundSciBLx1.animating #epundSciBLx3_to {animation: epundSciBLx3_to__to 4000ms linear 1 forwards}
          #epundSciBLx1.animating #epundSciBLx3_tr {animation: epundSciBLx3_tr__tr 4000ms linear 1 forwards}
          #epundSciBLx1.animating #epundSciBLx10 {animation: epundSciBLx10_s_do 4000ms linear 1 forwards}
          #epundSciBLx1.animating #epundSciBLx20_to {animation: epundSciBLx20_to__to 4000ms linear 1 forwards}
          #epundSciBLx1.animating #epundSciBLx20_tr {animation: epundSciBLx20_tr__tr 4000ms linear 1 forwards}
          
          @keyframes epundSciBLx2_to__to { 0% {transform: translate(24.494028px,22.75px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 25% {transform: translate(24.494028px,22px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: translate(24.494028px,22.75px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 75% {transform: translate(24.494028px,22px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {transform: translate(24.494028px,22.75px)}}
          @keyframes epundSciBLx3_to__to { 0% {transform: translate(20.700001px,35.800001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: translate(10.211945px,34.000001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: translate(12.852286px,32.456992px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: translate(14.263224px,35.336498px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: translate(15.704784px,32.211426px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: translate(17.41px,35.470889px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: translate(19.07px,32.316876px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: translate(20.2px,35.576742px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: translate(21.57px,33.663683px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: translate(20.700001px,35.800001px)} 100% {transform: translate(20.700001px,35.800001px)}}
          @keyframes epundSciBLx3_tr__tr { 0% {transform: rotate(0deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: rotate(2.249643deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: rotate(6.499893deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: rotate(-0.360917deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: rotate(7.38431deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: rotate(-6.099067deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: rotate(2.463685deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: rotate(-2.719139deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: rotate(4.395867deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: rotate(0deg)} 100% {transform: rotate(0deg)}}
          @keyframes epundSciBLx10_s_do { 0% {stroke-dashoffset: 0;animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 7.5% {stroke-dashoffset: 10;animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 15% {stroke-dashoffset: 10;animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {stroke-dashoffset: 0}}
          @keyframes epundSciBLx20_to__to { 0% {transform: translate(20.700001px,35.800001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: translate(10.211945px,34.000001px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: translate(12.85px,32.46px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: translate(14.26px,35.336498px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: translate(15.7px,32.21px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: translate(17.729278px,35.47px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: translate(19.201224px,32.32px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: translate(20.786097px,35.58px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: translate(21.194263px,33.66px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: translate(20.700001px,35.800001px)} 100% {transform: translate(20.700001px,35.800001px)}}
          @keyframes epundSciBLx20_tr__tr { 0% {transform: rotate(0deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 10% {transform: rotate(2.249643deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 20% {transform: rotate(6.499893deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: rotate(-0.360917deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 40% {transform: rotate(7.38431deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 50% {transform: rotate(-6.099067deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: rotate(2.463685deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 70% {transform: rotate(-2.719139deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 80% {transform: rotate(4.395867deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 92.5% {transform: rotate(0deg)} 100% {transform: rotate(0deg)}}
        `}</style>
        <g id="epundSciBLx1" className={isAnimating ? 'animating' : ''}>
          <g id="epundSciBLx2_to" transform="translate(24.494028,22.75)">
            <g id="epundSciBLx2" transform="translate(-24.494028,-22.75)">
              <g
                id="epundSciBLx3_to"
                transform="translate(20.700001,35.800001)"
              >
                <g id="epundSciBLx3_tr" transform="rotate(0)">
                  <g id="epundSciBLx3" transform="translate(-20.699997,-35.8)">
                    <path
                      id="epundSciBLx4"
                      d="M25.4,34.1L20.7,35.8L22.4,31.1L36.8,16.7C37.7,15.8,39.1,15.8,39.9,16.6L39.9,16.6C40.7,17.4,40.7,18.8,39.8,19.7L25.4,34.1Z"
                      fill="none"
                      stroke="rgb(34,34,34)"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeMiterlimit="1"
                    />
                    <path
                      id="epundSciBLx5"
                      d="M36.469474,17.360784L39.3,20.1"
                      fill="none"
                      stroke="rgb(34,34,34)"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeMiterlimit="1"
                    />
                    <path
                      id="epundSciBLx6"
                      d="M35.376777,18.376777L38.2,21.2"
                      fill="none"
                      stroke="rgb(34,34,34)"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeMiterlimit="1"
                    />
                    <path
                      id="epundSciBLx7"
                      d="M23.076777,30.676778L25.9,33.5"
                      fill="none"
                      stroke="rgb(34,34,34)"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeMiterlimit="1"
                    />
                  </g>
                </g>
              </g>
              <g id="epundSciBLx8" mask="url(#epundSciBLx19)">
                <g id="epundSciBLx9">
                  <path
                    id="epundSciBLx10"
                    d="M12,34.100001L21.560604,34.100001"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeMiterlimit="1"
                    strokeDasharray="10"
                  />
                  <line
                    id="epundSciBLx11"
                    x1="12"
                    y1="11"
                    x2="30"
                    y2="11"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeMiterlimit="1"
                  />
                  <line
                    id="epundSciBLx12"
                    x1="12"
                    y1="15"
                    x2="30"
                    y2="15"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeMiterlimit="1"
                  />
                  <line
                    id="epundSciBLx13"
                    x1="12"
                    y1="19"
                    x2="30"
                    y2="19"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeMiterlimit="1"
                  />
                  <line
                    id="epundSciBLx14"
                    x1="12"
                    y1="23"
                    x2="25"
                    y2="23"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeMiterlimit="1"
                  />
                  <line
                    id="epundSciBLx15"
                    x1="12"
                    y1="27"
                    x2="21"
                    y2="27"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeMiterlimit="1"
                  />
                  <line
                    id="epundSciBLx16"
                    display="none"
                    x1="12"
                    y1="34"
                    x2="23"
                    y2="34"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeMiterlimit="1"
                    strokeDashoffset="11"
                  />
                  <polyline
                    id="epundSciBLx17"
                    points="33.5,27.000001 33.5,6.5 8.5,6.5 8.5,39"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeMiterlimit="1"
                  />
                  <path
                    id="epundSciBLx18"
                    d="M13,38.5L28.5,38.5C31.3,38.5,33.5,36.2,33.5,33.5L33.5,26"
                    fill="none"
                    stroke="rgb(34,34,34)"
                    strokeWidth="1"
                    strokeMiterlimit="1"
                  />
                </g>
                <mask id="epundSciBLx19" mask-type="luminance">
                  <g
                    id="epundSciBLx20_to"
                    transform="translate(20.700001,35.800001)"
                  >
                    <g id="epundSciBLx20_tr" transform="rotate(0)">
                      <path
                        id="epundSciBLx20"
                        d="M-0.00317,0.0039L45.00317,0.0039L45.00317,44.9961L-0.00317,44.9961L-0.00317,0.0039ZM25.4,34C34.3098,25.16284,39.14313,20.39617,39.9,19.7C41.0353,18.65575,40.48745,17.67771,39.9,16.6C39.50837,15.88153,38.62886,15.68571,37.26149,16.01255L22.4,30.5L20.7,35.8L25.4,34Z"
                        transform="translate(-20.700004,-35.800001)"
                        fill="rgb(255,255,255)"
                        stroke="none"
                        strokeWidth="0"
                        strokeMiterlimit="1"
                      />
                    </g>
                  </g>
                </mask>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

interface SavedOptimization {
  id: string
  name: string
  description: string
  selectedRoutes?: string[]
  filters?: any
  createdAt: string
  archived?: boolean
}

const SavedOptimizationsCard: React.FC = () => {
  const navigate = useNavigate()
  const [optimizations, setOptimizations] = useState<SavedOptimization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOptimizations()
  }, [])

  const loadOptimizations = async () => {
    try {
      setLoading(true)
      const datasets = await getRouteDatasets()

      // Map RouteDataset to SavedOptimization format and get 3 most recent
      const mapped: SavedOptimization[] = datasets
        .map((dataset: RouteDataset) => ({
          id: dataset.id,
          name: dataset.name,
          description: dataset.description || '',
          filters: dataset.filterCriteria,
          createdAt: dataset.uploadTimestamp,
          archived: false,
        }))
        .slice(0, 3)

      setOptimizations(mapped)
    } catch (error) {
      console.error('Error loading saved optimizations:', error)
      toast.error('Fel vid hämtning av optimeringar')
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizationClick = (_opt: SavedOptimization) => {
    // Navigate to datasets tab where user can start simulation
    navigate('/routes?tab=datasets')
  }

  if (loading) {
    return (
      <Card className="shadow-sm flex items-center justify-center min-h-[400px]">
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="text-muted-foreground">Laddar optimeringar...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (optimizations.length === 0) {
    return (
      <Card className="shadow-sm flex items-center justify-center min-h-[400px]">
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="flex items-center justify-center">
              <PaperIcon className="h-20 w-20" />
            </div>
            <div>
              <h3 className="text-lg font-medium">
                Inga sparade optimeringsprojekt
              </h3>
              <p className="text-muted-foreground">
                När du sparat ditt första projekt kommer det visas här
              </p>
            </div>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/routes?tab=upload')}
            >
              Optimera körtur
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="font-normal text-xl">
          Sparade optimeringar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {optimizations.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleOptimizationClick(opt)}
            className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <FolderOpen
                size={18}
                className="text-muted-foreground shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate group-hover:text-secondary transition-colors">
                  {opt.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(opt.createdAt), 'dd MMM yyyy', {
                    locale: sv,
                  })}
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="lg"
            className="mt-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/routes?tab=datasets')}
          >
            Se alla optimeringar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default SavedOptimizationsCard
