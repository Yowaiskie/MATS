import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/features/authentication/AuthContext'
import {
  isThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  writeStoredThemeMode,
  type ResolvedTheme,
  type ThemeMode
} from '@/utils/theme'

interface ThemeContextValue {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getInitialThemeMode(): ThemeMode {
  return readStoredThemeMode() ?? 'light'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth()
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode)
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(getSystemPrefersDark)
  const lastProfileThemeRef = useRef<ThemeMode | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Hydrate theme from user's Firestore profile (0 extra reads: reuses AuthContext profile).
  // Survives clearing app cache/data, WebView eviction, or switching devices.
  useEffect(() => {
    const profileTheme = profile?.themePreference
    if (isThemeMode(profileTheme)) {
      if (lastProfileThemeRef.current !== profileTheme) {
        lastProfileThemeRef.current = profileTheme
        setThemeModeState(profileTheme)
        writeStoredThemeMode(profileTheme)
      }
      return
    }

    // If user already chose a local theme before profile had themePreference, backfill it once
    const uid = user?.uid || profile?.uid
    const localStored = readStoredThemeMode()
    if (uid && localStored && localStored !== 'light' && lastProfileThemeRef.current !== localStored) {
      lastProfileThemeRef.current = localStored
      updateDoc(doc(db, 'users', uid), { themePreference: localStored }).catch(() => {
        // Non-blocking: local storage + cookie still retain preference
      })
    }
  }, [profile?.themePreference, profile?.uid, user?.uid])

  const resolvedTheme = useMemo<ResolvedTheme>(
    () => resolveThemeMode(themeMode, systemPrefersDark),
    [themeMode, systemPrefersDark]
  )
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0b1120' : '#2563eb')
    }

    if (Capacitor.isNativePlatform()) {
      try {
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})
        StatusBar.setBackgroundColor({ color: isDark ? '#0b1120' : '#111827' }).catch(() => {})
      } catch {
        // Non-blocking on platforms without StatusBar plugin
      }
    }
  }, [isDark])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    lastProfileThemeRef.current = mode
    setThemeModeState(mode)
    writeStoredThemeMode(mode)

    const uid = user?.uid || profile?.uid
    if (uid) {
      updateDoc(doc(db, 'users', uid), { themePreference: mode }).catch(() => {
        // Non-blocking if offline or rules reject
      })
    }
  }, [profile?.uid, user?.uid])

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark')
  }, [isDark, setThemeMode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      isDark,
      setThemeMode,
      toggleTheme
    }),
    [themeMode, resolvedTheme, isDark, setThemeMode, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
