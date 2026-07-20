import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'

interface RouteProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export const ProtectedRoute: React.FC<RouteProps> = ({ children, adminOnly = false }) => {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading MATS...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Redirect to login but save the current location they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/schedules" replace />
  }

  return <>{children}</>
}

export const PublicRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()
  
  // Retrieve target location from state or default to dashboard ("/")
  const from = (location.state as any)?.from?.pathname || '/'

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading MATS...</p>
        </div>
      </div>
    )
  }

  if (user) {
    // If already logged in, redirect away from public login page
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}
