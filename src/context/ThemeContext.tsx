import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import {
  THEME_STORAGE_KEY,
  parseStoredThemeMode,
  resolveThemeMode,
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
  if (typeof window === 'undefined') return 'light'
  try {
    return parseStoredThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'light'
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode)
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(getSystemPrefersDark)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

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
    setThemeModeState(mode)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }, [])

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
