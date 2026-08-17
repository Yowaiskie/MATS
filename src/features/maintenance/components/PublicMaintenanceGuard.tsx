import React from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { useMaintenance } from '@/context/MaintenanceContext'
import { MaintenanceScreen } from './MaintenanceScreen'

interface PublicMaintenanceGuardProps {
  children: React.ReactNode
}

export const PublicMaintenanceGuard: React.FC<PublicMaintenanceGuardProps> = ({ children }) => {
  const { user, profile } = useAuth()
  const { isMaintenanceActive, isUserAllowed, loading } = useMaintenance()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  // If maintenance mode is active AND current user (or visitor) is NOT allowed:
  if (isMaintenanceActive && !isUserAllowed(user?.uid, user?.email, profile?.role)) {
    return <MaintenanceScreen isPublicRoute />
  }

  return <>{children}</>
}
