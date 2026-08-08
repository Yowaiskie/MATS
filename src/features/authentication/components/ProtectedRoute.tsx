import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const DashboardSkeleton = () => (
  <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
    {/* Sidebar Skeleton */}
    <div className="hidden sm:flex flex-col w-64 max-w-xs bg-white border-r border-slate-200 p-4 space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="h-8 w-8 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-16 bg-slate-200 rounded mb-3 ml-2 animate-pulse" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="space-y-1 pt-4">
        <div className="h-3 w-16 bg-slate-200 rounded mb-3 ml-2 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
    {/* Main Content Skeleton */}
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header Skeleton */}
      <div className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center px-4 sm:px-6 lg:px-8 justify-between shrink-0">
        <div className="sm:hidden h-9 w-9 bg-slate-200 rounded-lg animate-pulse" />
        <div className="flex items-center space-x-4 ml-auto">
          <div className="h-9 w-9 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-full animate-pulse" />
        </div>
      </div>
      {/* Body Skeleton */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white border border-slate-200/60 rounded-2xl shadow-sm animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 h-96 bg-white border border-slate-200/60 rounded-2xl shadow-sm animate-pulse" />
          <div className="h-96 bg-white border border-slate-200/60 rounded-2xl shadow-sm animate-pulse" />
        </div>
      </div>
    </div>
  </div>
)

const LoginSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-[25%] -right-[10%] w-[70%] h-[70%] rounded-full bg-slate-200/50 blur-3xl" />
      <div className="absolute -bottom-[25%] -left-[10%] w-[70%] h-[70%] rounded-full bg-slate-200/50 blur-3xl" />
    </div>
    <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 space-y-8 border border-slate-200/50 relative z-10 backdrop-blur-xl">
      <div className="flex justify-center">
        <div className="h-16 w-16 bg-slate-200 rounded-2xl animate-pulse shadow-inner" />
      </div>
      <div className="space-y-3 text-center">
        <div className="h-7 w-40 bg-slate-200 rounded-lg mx-auto animate-pulse" />
        <div className="h-4 w-56 bg-slate-200 rounded mx-auto animate-pulse" />
      </div>
      <div className="space-y-5 pt-4">
        <div className="space-y-2">
          <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
          <div className="h-12 w-full bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
          <div className="h-12 w-full bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="h-12 w-full bg-slate-200 rounded-xl animate-pulse mt-8" />
      </div>
    </div>
  </div>
)
import { useAuth } from '../AuthContext'

import type { ModuleKey, UserPermissions } from '@/types/auth'

interface RouteProps {
  children: React.ReactNode
  adminOnly?: boolean
  moduleKey?: ModuleKey
  requiredPermission?: keyof UserPermissions
}

export const ProtectedRoute: React.FC<RouteProps> = ({ 
  children, 
  adminOnly = false,
  moduleKey,
  requiredPermission
}) => {
  const { user, isAdmin, hasModuleAccess, canAction, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!user) {
    // Redirect to login but save the current location they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/schedules" replace />
  }

  if (moduleKey && !hasModuleAccess(moduleKey)) {
    return <Navigate to="/" replace />
  }

  if (requiredPermission && !canAction(requiredPermission)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export const PublicRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()
  
  // Retrieve target location from state or default to dashboard ("/")
  const from = (location.state as any)?.from?.pathname || '/'

  if (loading) {
    return <LoginSkeleton />
  }

  if (user) {
    // If already logged in, redirect away from public login page
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}
