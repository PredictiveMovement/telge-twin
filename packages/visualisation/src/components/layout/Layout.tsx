import React from 'react'
import { DashboardSidebar } from '@/components/DashboardSidebar'

interface LayoutProps {
  children: React.ReactNode
  fullScreen?: boolean
}

const Layout = ({ children, fullScreen = false }: LayoutProps) => {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      <DashboardSidebar />
      <div className={`flex-1 ${fullScreen ? '' : 'px-4 pt-6 sm:px-6 sm:pt-8 md:px-8 md:pt-10 lg:px-12 lg:pt-12 xl:px-16 xl:pt-14 2xl:px-20 2xl:pt-16'} bg-background md:ml-[78px]`}>
        {children}
      </div>
    </div>
  )
}

export default Layout
