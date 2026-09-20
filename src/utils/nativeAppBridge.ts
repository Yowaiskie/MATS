import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'

export function initializeNativeBridge(navigate?: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => {}

  // Configure Status Bar for native Android
  try {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#111827' }).catch(() => {}) // Slate-900 / dark theme
  } catch (err) {
    console.warn('StatusBar initialization note:', err)
  }

  // Handle Android Hardware Back Button
  const backListenerPromise = App.addListener('backButton', ({ canGoBack }) => {
    const currentPath = window.location.pathname

    // If at root or login page, minimize the app instead of navigating out of domain
    if (currentPath === '/' || currentPath === '/login' || currentPath === '/dashboard') {
      App.minimizeApp().catch(() => {})
    } else if (canGoBack || window.history.length > 1) {
      if (navigate) {
        window.history.back()
      } else {
        window.history.back()
      }
    } else {
      App.minimizeApp().catch(() => {})
    }
  })

  return () => {
    backListenerPromise.then(handle => handle.remove()).catch(() => {})
  }
}
