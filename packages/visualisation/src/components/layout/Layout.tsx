import React from 'react'
import { DashboardSidebar } from '@/components/DashboardSidebar'
import TopBar from './TopBar'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen w-full">
      <DashboardSidebar />
      <div className="ml-[78px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  )
}

export default Layout
