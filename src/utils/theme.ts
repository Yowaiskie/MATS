export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'mats-theme'
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1 year

export function isThemeMode(raw: unknown): raw is ThemeMode {
  return raw === 'light' || raw === 'dark' || raw === 'system'
}

export function parseStoredThemeMode(raw: string | null | undefined): ThemeMode {
  if (isThemeMode(raw)) {
    return raw
  }
  return 'light'
}

export function resolveThemeMode(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return mode
}

export function readThemeModeFromCookieString(cookieString: string): ThemeMode | null {
  if (!cookieString) return null
  const parts = cookieString.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${THEME_STORAGE_KEY}=`)) continue
    const value = decodeURIComponent(trimmed.slice(THEME_STORAGE_KEY.length + 1))
    if (isThemeMode(value)) return value
  }
  return null
}

/**
 * Reads the persisted ThemeMode from localStorage first, then falls back to the cookie.
 * Returns null if neither storage layer currently holds a valid preference.
 */
export function readStoredThemeMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeMode(raw)) return raw
  } catch {
    // Ignore localStorage access errors (private mode / quota / WebView restrictions)
  }

  try {
    if (typeof document !== 'undefined') {
      return readThemeModeFromCookieString(document.cookie || '')
    }
  } catch {
    // Ignore cookie access errors
  }

  return null
}

/**
 * Persists ThemeMode to both localStorage and a 1-year cookie for instant zero-flash
 * boot across web browsers, PWAs, and Android Capacitor WebViews.
 */
export function writeStoredThemeMode(mode: ThemeMode): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  if (typeof document !== 'undefined') {
    try {
      document.cookie = `${THEME_STORAGE_KEY}=${encodeURIComponent(mode)}; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`
    } catch {
      // Ignore cookie write errors
    }
  }
}
