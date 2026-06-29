import React from 'react'
import { Card } from '@/components/Card'

interface PlaceholderPageProps {
  title: string
  phase: string
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, phase }) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">This module is planned for a later phase.</p>
      </div>

      <Card title="Under Development" description="Feature Placeholder">
        <div className="py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/10 text-indigo-400 mb-4">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white">Coming Soon</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            The {title} module will be implemented in {phase} of the development breakdown.
          </p>
        </div>
      </Card>
    </div>
  )
}
