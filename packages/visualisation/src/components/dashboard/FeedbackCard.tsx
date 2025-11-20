import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const FeedbackCard = () => {
  return (
    <Card className="shadow-sm h-full">
      <CardContent className="p-6 md:p-8 h-full">
        <div className="flex gap-6 h-full">
          {/* Vänster kolumn: titel, text, knapp */}
          <div className="flex-1 flex flex-col gap-6">
            <h2 className="text-2xl font-normal">
              Hjälp oss göra Ruttger ännu bättre
            </h2>
            
            <p className="text-base text-muted-foreground flex-1">
              Har du stött på något som inte funkar eller har du en idé på hur vi kan förbättra Ruttger ytterligare?
              <br /><br />
              Vi tar gärna emot dinas tankar och förslag – allt hjälper oss att utveckla verktyget vidare.
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
          
          {/* Höger kolumn: ikon */}
          <div className="flex items-start pt-2">
            <img 
              src="/feedback-icon.svg" 
              alt="Feedback"
              className="rotate-[7deg] transition-transform duration-300 hover:rotate-6 hover:-translate-y-1 flex-shrink-0"
              style={{ height: '80px', width: '80px', filter: 'url(#thicken)' }}
            />
          </div>
        </div>
        
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <filter id="thicken">
            <feMorphology operator="dilate" radius="0.15" />
          </filter>
        </svg>
      </CardContent>
    </Card>
  );
};

export default FeedbackCard;
