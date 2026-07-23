import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, browserLocalPersistence, setPersistence } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { authService } from '@/services/authService'
import type { UserProfile, UserRole, ModuleKey, UserPermissions } from '@/types/auth'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  role: UserRole
  isAdmin: boolean
  isUser: boolean
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  hasModuleAccess: (moduleKey: ModuleKey) => boolean
  canAction: (actionKey: keyof UserPermissions) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Configure local session persistence as default
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Failed to set auth persistence:', err)
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true)
      
      if (currentUser) {
        try {
          const userProfile = await authService.getUserProfile(currentUser.uid, currentUser.email)
          
          if (userProfile) {
            setUser(currentUser)
            setProfile(userProfile)
            setError(null)
          } else {
            // Unprofiled user: display unauthorized error and log out immediately
            setError('Unauthorized. This user is not registered in the system.')
            setUser(null)
            setProfile(null)
            await authService.logout()
          }
        } catch (err: any) {
          console.error('Error fetching user profile:', err)
          setError(err.message || 'Failed to load user profile.')
          setUser(null)
          setProfile(null)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      await authService.login(email, password)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify credentials.')
      setLoading(false)
      throw err
    }
  }

  const logout = async () => {
    setLoading(true)
    setError(null)
    try {
      await authService.logout()
    } catch (err: any) {
      setError(err.message || 'Failed to log out.')
      setLoading(false)
      throw err
    }
  }

  const role: UserRole = profile?.role || 'user'
  const isAdmin = role === 'admin'
  const isUser = role === 'user'

  const hasModuleAccess = (moduleKey: ModuleKey): boolean => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    if (!profile.permissions || !profile.permissions.allowedModules) {
      // Legacy user role defaults
      if (moduleKey === 'dashboard' || moduleKey === 'schedules' || moduleKey === 'attendance' || moduleKey === 'reports') return true
      return false
    }
    return profile.permissions.allowedModules.includes(moduleKey)
  }

  const canAction = (actionKey: keyof UserPermissions): boolean => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    if (!profile.permissions) {
      // Legacy default
      if (actionKey === 'canTakeAttendance' || actionKey === 'canViewSchedules' || actionKey === 'canViewReports') return true
      return false
    }
    return Boolean(profile.permissions[actionKey])
  }

  return (
    <AuthContext.Provider 
      value={{
        user,
        profile,
        role,
        isAdmin,
        isUser,
        loading,
        error,
        login,
        logout,
        clearError,
        hasModuleAccess,
        canAction
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
