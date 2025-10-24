import React from 'react'
import Layout from '@/components/layout/Layout'
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid'
import SavedOptimizationsCard from '@/components/dashboard/SavedOptimizationsCard'
import ThorOptimizationCard from '@/components/dashboard/ThorOptimizationCard'
import DashboardStatistics from '@/components/dashboard/DashboardStatistics'
import FeedbackCard from '@/components/dashboard/FeedbackCard'

const Index = () => {
  return (
    <Layout>
      <div className="w-full max-w-5xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-normal">Välkommen till Ruttger</h1>
          <p className="text-base text-muted-foreground">
            Här kan du hämta befintliga körturer från Thor och optimera nya
            baserat på dina behov. Med hjälp av Ruttger kan vi spara tid samt
            minska både körsträckor och bränsleförbrukning.
          </p>
        </div>
        <QuickAccessGrid />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SavedOptimizationsCard />
          <ThorOptimizationCard />
        </div>
        <DashboardStatistics />
        <FeedbackCard />
      </div>
    </Layout>
  )
}

export default Index
