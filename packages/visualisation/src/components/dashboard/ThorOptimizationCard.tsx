import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ThorOptimizationCard = () => {
  const navigate = useNavigate()
  const [isAnimating, setIsAnimating] = React.useState(false)
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

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <Card className="bg-telge-ljusbla50 border-0">
      <CardContent className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <div
            className="flex-shrink-0 cursor-pointer"
            onMouseEnter={restartAnimation}
          >
            <svg
              className="h-24 w-24"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              viewBox="0 0 45 45"
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
              onAnimationEnd={() => setIsAnimating(false)}
            >
              <title>Sopbilsschemaikon</title>
              <style>{`#er51aZ7ypbn1{pointer-events: all}#er51aZ7ypbn1 * {animation: none}#er51aZ7ypbn1.animating #er51aZ7ypbn4_to {animation: er51aZ7ypbn4_to__to 4000ms linear 1 forwards}#er51aZ7ypbn1.animating #er51aZ7ypbn8_tr {animation: er51aZ7ypbn8_tr__tr 4000ms linear 1 forwards}#er51aZ7ypbn1.animating #er51aZ7ypbn11_tr {animation: er51aZ7ypbn11_tr__tr 4000ms linear 1 forwards}@keyframes er51aZ7ypbn4_to__to { 0% {transform: translate(22.75px,24.5px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 3.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 7.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 11.25% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 15% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 18.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 22.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 26.25% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 30% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 33.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 37.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 41.25% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 45% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 48.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 52.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 56.25% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 60% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 63.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 67.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 71.25% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 75% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 78.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 82.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 86.25% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 90% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 93.75% {transform: translate(22.75px,24.7px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 97.5% {transform: translate(22.75px,24.3px);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {transform: translate(22.75px,24.5px)}} @keyframes er51aZ7ypbn8_tr__tr { 0% {transform: translate(22.508855px,13.1px) rotate(120.838846deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {transform: translate(22.508855px,13.1px) rotate(480.838846deg)}} @keyframes er51aZ7ypbn11_tr__tr { 0% {transform: translate(22.508855px,13.1px) rotate(0deg);animation-timing-function: cubic-bezier(0.22,0,0.34,1)} 100% {transform: translate(22.508855px,13.1px) rotate(1080deg)}}`}</style>
              <g id="er51aZ7ypbn1" className={isAnimating ? 'animating' : ''}>
                <path
                  id="er51aZ7ypbn3"
                  d="M34.3,33C33.9,32,33.1,31.2,32,31.1C32,31.1,31.6,31.1,31.5,31.1C31.4,31.1,31,31.1,31,31.1C29.9,31.3,29,32,28.7,33C28.7,33,28.6,33.2,28.6,33.5C28.5,33.8,28.5,34,28.5,34C28.5,35.7,29.8,37,31.5,37C33.2,37,34.5,35.7,34.5,34C34.5,34,34.5,33.8,34.4,33.5C34.4,33.2,34.3,33,34.3,33ZM31.5,36C30.4,36,29.5,35.1,29.5,34C29.5,32.9,30.4,32,31.5,32C32.6,32,33.5,32.9,33.5,34C33.5,35.1,32.6,36,31.5,36Z"
                  fill="rgb(34,34,34)"
                  stroke="none"
                  strokeWidth="1"
                  strokeMiterlimit="1"
                ></path>
                <g id="er51aZ7ypbn4_to" transform="translate(22.75,24.5)">
                  <g id="er51aZ7ypbn4" transform="translate(-22.75,-24.5)">
                    <path
                      id="er51aZ7ypbn5"
                      d="M32.5,18L32,18L32,15L28.6,15C28.183476,15.152365,27.863476,15.492365,28.1,16L31,16L31,28L15,28L15,16.1C15.3,16.1,15.7,16,16,16C16.1,16,16.6,16,16.9,16C17.163476,15.432365,17.043476,15.152365,16.4,15C16.2,15,16,15,16,15C10.8,15.1,6.5,18.8,6.5,23.3L6.5,25.9C6.5,30.4,8.5,33.3,12,34C12,34,11.88783,33.686949,12.415969,33.631552C12.944108,33.576155,12.2,33,12.2,33C10.9,32.6,9.8,32,9,31.1L14.1,29L14.5,29L15,29L31,29L31,31.1C31,31.1,31.4,31.1,31.5,31.1C31.6,31.1,32,31.1,32,31.1L32,26L38,26L38,33L34.5,33L34.3,33C34.3,33,34.027377,33.256773,34.027377,33.556773C34.027377,33.856773,34.5,34,34.5,34L39,34L39,24.5C39,20.9,36.1,18,32.5,18ZM8.5,30.3C7.9,29.2,7.5,27.7,7.5,25.9L12.8,28.5L8.5,30.3ZM14,27.9L7.5,24.7L7.5,23.3C7.5,20,10.3,17.1,14,16.3L14,27.9ZM38,25L32,25L32,19L32.5,19C35.5,19,38,21.5,38,24.5L38,25Z"
                      fill="rgb(34,34,34)"
                      stroke="none"
                      strokeWidth="1"
                      strokeMiterlimit="1"
                    ></path>
                    <path
                      id="er51aZ7ypbn6"
                      d="M28.7,33L20,33L20,34L28.5,34C28.5,34,28.91712,33.821993,29.01712,33.521993C29.01712,33.221993,28.7,33,28.7,33Z"
                      fill="rgb(34,34,34)"
                      stroke="none"
                      strokeWidth="1"
                      strokeMiterlimit="1"
                    ></path>
                  </g>
                </g>
                <path
                  id="er51aZ7ypbn7"
                  d="M12,34L12,34C12,35.8,13.3,37.1,15,37.1C16.7,37.1,18,35.8,18,34.1C18,32.4,16.7,31.1,15,31.1C13.7,31.1,12.7,31.9,12.2,33C12.2,33,12.1,33.3,12,33.5C12,33.7,12,34,12,34ZM15,32C16.1,32,17,32.9,17,34C17,35.1,16.1,36,15,36C13.9,36,13,35.1,13,34C13,32.9,13.9,32,15,32Z"
                  fill="rgb(34,34,34)"
                  stroke="none"
                  strokeWidth="1"
                  strokeMiterlimit="1"
                ></path>
                <g
                  id="er51aZ7ypbn8_tr"
                  transform="translate(22.508855,13.1) rotate(120.838846)"
                >
                  <g id="er51aZ7ypbn8" transform="translate(-22.508855,-13.1)">
                    <path
                      id="er51aZ7ypbn9"
                      d="M-0.491145,0C-0.491145,-0.271252,-0.271252,-0.491145,0,-0.491145C0.271252,-0.491145,0.491145,-0.271252,0.491145,0C0.491145,0.271252,0.271252,0.491145,0,0.491145C-0.271252,0.491145,-0.491145,0.271252,-0.491145,0Z"
                      transform="matrix(1 0 0 1 22.508855 13.1)"
                      fill="rgb(34,34,34)"
                      stroke="none"
                      strokeWidth="0"
                      strokeMiterlimit="1"
                    ></path>
                    <path
                      id="er51aZ7ypbn10"
                      d="M0,0L0.98229,0L0.98229,1.431145L0,1.431145L0,0Z"
                      transform="matrix(1 0 0 2.870526 22.01771 8.991861)"
                      fill="rgb(34,34,34)"
                      stroke="none"
                      strokeWidth="0"
                      strokeMiterlimit="1"
                    ></path>
                  </g>
                </g>
                <g
                  id="er51aZ7ypbn11_tr"
                  transform="translate(22.508855,13.1) rotate(0)"
                >
                  <g id="er51aZ7ypbn11" transform="translate(-22.508855,-13.1)">
                    <path
                      id="er51aZ7ypbn12"
                      d="M0,0L0.98229,0L0.98229,1.431145L0,1.431145L0,0Z"
                      transform="matrix(1 0 0 2.870526 22.01771 8.991861)"
                      fill="rgb(34,34,34)"
                      stroke="none"
                      strokeWidth="0"
                      strokeMiterlimit="1"
                    ></path>
                    <path
                      id="er51aZ7ypbn13"
                      d="M-0.491145,0C-0.491145,-0.271252,-0.271252,-0.491145,0,-0.491145C0.271252,-0.491145,0.491145,-0.271252,0.491145,0C0.491145,0.271252,0.271252,0.491145,0,0.491145C-0.271252,0.491145,-0.491145,0.271252,-0.491145,0Z"
                      transform="matrix(1 0 0 1 22.508855 13.1)"
                      fill="rgb(34,34,34)"
                      stroke="none"
                      strokeWidth="0"
                      strokeMiterlimit="1"
                    ></path>
                  </g>
                </g>
                <path
                  id="er51aZ7ypbn14"
                  d="M22.5,7.1C18.9,7.1,16,9.8,16,13.1C16,16.4,18.9,19.1,22.5,19.1C26.1,19.1,29,16.4,29,13.1C29,9.8,26.1,7.1,22.5,7.1ZM22.5,18.1C19.5,18.1,17,15.8,17,13.1C17,10.3,19.5,8.1,22.5,8.1C25.5,8.1,28,10.4,28,13.1C28,15.8,25.5,18.1,22.5,18.1Z"
                  fill="rgb(34,34,34)"
                  stroke="none"
                  strokeWidth="1"
                  strokeMiterlimit="1"
                ></path>
              </g>
            </svg>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-normal text-black">
              Optimera körtur från befintlig körtur
            </h2>
            <p className="text-base text-black/80">
              Hämta körtur från Thor och optimera automatiskt för att spara tid
              och minska körsträcka
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/routes')}
              className="mt-4 bg-white text-black hover:bg-white/90"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Hämta från Thor
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ThorOptimizationCard
