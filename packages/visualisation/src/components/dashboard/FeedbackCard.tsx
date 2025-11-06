import React from 'react'
import { Card, CardContent } from '@/components/ui/card'

const FeedbackCard = () => {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 md:p-8 flex items-start gap-12 text-left">
        <div
          className="flex-1 flex flex-col space-y-4"
          style={{ maxWidth: 'calc(100% - 276px)' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-normal">
              Hjälp oss göra Ruttger ännu bättre
            </h2>
          </div>

          <p className="text-base text-muted-foreground">
            Har du stött på något som inte funkar eller har du en idé på hur vi
            kan förbättra Ruttger ytterligare? Vi tar gärna emot dina tankar och
            förslag – allt hjälper oss att utveckla verktyget vidare.
          </p>

          <a
            href="mailto:nora.fager@iteam.se?subject=Feedback%20Ruttger"
            className="group w-fit flex items-center gap-3"
          >
            <span className="text-sm font-medium hover:text-secondary transition-colors">
              Skicka din feedback här
            </span>
          </a>
        </div>

        <img
          src="feedback-icon.svg"
          alt="Feedback"
          className="transition-transform duration-300 hover:rotate-6 hover:-translate-y-1 flex-shrink-0 self-center"
          style={{ height: '112px', width: '112px', filter: 'url(#thicken)' }}
        />

        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <filter id="thicken">
            <feMorphology operator="dilate" radius="0.15" />
          </filter>
        </svg>
      </CardContent>
    </Card>
  )
}

export default FeedbackCard
