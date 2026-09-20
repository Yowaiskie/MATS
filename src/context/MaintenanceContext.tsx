import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { maintenanceService } from '@/services/maintenanceService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { MaintenanceSettings } from '@/types/maintenance'
import { DEFAULT_MAINTENANCE_SETTINGS } from '@/types/maintenance'

interface MaintenanceContextType {
  maintenanceSettings: MaintenanceSettings
  isMaintenanceActive: boolean
  loading: boolean
  isUserAllowed: (uid?: string | null, email?: string | null, role?: string | null) => boolean
  refreshMaintenanceSettings: () => Promise<void>
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined)

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE_SETTINGS)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    const init = async () => {
      try {
        const direct = await maintenanceService.getMaintenanceSettings()
        setMaintenanceSettings(direct)
      } catch (err) {
        console.warn('Initial maintenance settings fetch warning:', err)
      } finally {
        setLoading(false)
      }

      unsub = maintenanceService.subscribeToMaintenanceSettings((settings) => {
        setMaintenanceSettings(settings)
        setLoading(false)
      })
    }

    init()

    return () => {
      if (unsub) unsub()
    }
  }, [user?.uid])

  const refreshMaintenanceSettings = useCallback(async () => {
    setLoading(true)
    try {
      const freshSettings = await maintenanceService.getMaintenanceSettings()
      setMaintenanceSettings(freshSettings)
    } finally {
      setLoading(false)
    }
  }, [])

  const isUserAllowed = useCallback(
    (uid?: string | null, email?: string | null, role?: string | null): boolean => {
      // 1. If maintenance mode is OFF, everyone is allowed
      if (!maintenanceSettings.enabled) return true

      const normalizedEmail = (email || '').toLowerCase().trim()
      const normalizedRole = (role || '').toLowerCase().trim()

      // 2. Coordinator ALWAYS retains full access during maintenance
      if (normalizedRole === 'coordinator' || normalizedEmail === 'coordinator@mas.com') {
        return true
      }

      // 3. Case-insensitive matching for allowed UIDs / Emails
      const allowedListLower = maintenanceSettings.allowedUserUids.map((item) => item.toLowerCase().trim())

      if (uid && allowedListLower.includes(uid.toLowerCase().trim())) {
        return true
      }
      if (normalizedEmail && allowedListLower.includes(normalizedEmail)) {
        return true
      }

      // 4. Default: Access denied during maintenance
      return false
    },
    [maintenanceSettings]
  )

  // Automatic Logout Effect: When Maintenance Mode is active, immediately log out any unallowed user session
  const { logout, profile } = useAuth()
  useEffect(() => {
    if (maintenanceSettings.enabled && user) {
      const allowed = isUserAllowed(user.uid, user.email, profile?.role)
      if (!allowed) {
        logout().catch((err) => {
          console.warn('Auto-logout during maintenance warning:', err)
        })
      }
    }
  }, [maintenanceSettings.enabled, maintenanceSettings.allowedUserUids, user, profile?.role, isUserAllowed, logout])

  return (
    <MaintenanceContext.Provider
      value={{
        maintenanceSettings,
        isMaintenanceActive: maintenanceSettings.enabled,
        loading,
        isUserAllowed,
        refreshMaintenanceSettings
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  )
}

export const useMaintenance = (): MaintenanceContextType => {
  const context = useContext(MaintenanceContext)
  if (!context) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider')
  }
  return context
}
