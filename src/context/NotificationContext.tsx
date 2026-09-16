import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { notificationService } from '@/services/notificationService'
import { nativePushService } from '@/services/nativePushService'
import type { AppNotification } from '@/types/notification'

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  activeBroadcast: AppNotification | null
  loading: boolean
  isPushActive: boolean
  permissionState: string
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissBroadcast: (broadcastId: string) => void
  togglePushNotifications: () => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const IDLE_DISCONNECT_MS = 5 * 60 * 1000 // 5 minutes in background

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [activeBroadcast, setActiveBroadcast] = useState<AppNotification | null>(null)
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<boolean>(true)
  const [permissionState, setPermissionState] = useState<string>(() => {
    return nativePushService.isNative()
      ? (nativePushService.isDevicePushEnabled() ? 'granted' : 'prompt')
      : notificationService.getPermissionState()
  })

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  // Determine if push is active
  const isPushActive = nativePushService.isNative()
    ? (nativePushService.isDevicePushEnabled() || profile?.pushEnabled === true)
    : ((profile?.pushEnabled === true || notificationService.isDevicePushEnabled()) && permissionState === 'granted')

  // Silent auto-sync device token on login
  useEffect(() => {
    if (user?.uid) {
      if (nativePushService.isNative()) {
        nativePushService.syncNativeTokenSilently(user.uid)
        nativePushService.checkPermissions().then(setPermissionState).catch(() => {})
      } else {
        notificationService.syncDeviceTokenSilently(user.uid)
        setPermissionState(notificationService.getPermissionState())
      }
    }
  }, [user?.uid])

  // Helper to recompute active broadcast
  const updateActiveBroadcast = useCallback((notifsList: AppNotification[], dismissed: Set<string>) => {
    const now = Date.now()
    const validBroadcasts = notifsList.filter((n) => {
      if (n.type !== 'admin_broadcast') return false
      if (dismissed.has(n.id)) return false
      if (typeof window !== 'undefined' && sessionStorage.getItem(`mats_dismissed_broadcast_${n.id}`) === 'true') {
        return false
      }
      if (n.expiresAt) {
        const expTime = new Date(n.expiresAt).getTime()
        if (!isNaN(expTime) && expTime <= now) return false
      }
      return true
    })

    setActiveBroadcast(validBroadcasts[0] || null)
  }, [])

  // Start single real-time Firestore listener
  const startSubscription = useCallback(() => {
    if (!user?.uid) {
      setNotifications([])
      setActiveBroadcast(null)
      setLoading(false)
      return
    }

    // If already subscribed, don't duplicate
    if (unsubscribeRef.current) return

    setLoading(true)
    const unsub = notificationService.subscribeToUserNotifications(
      user.uid,
      profile?.role || 'user',
      profile?.memberId,
      user.email,
      (list) => {
        if (!isMountedRef.current) return
        setNotifications(list)
        setLoading(false)
        updateActiveBroadcast(list, dismissedBroadcastIds)
      }
    )

    unsubscribeRef.current = unsub
  }, [user?.uid, user?.email, profile?.role, profile?.memberId, dismissedBroadcastIds, updateActiveBroadcast])

  // Stop real-time listener
  const stopSubscription = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }, [])

  // Manage subscription lifecycle & visibility change
  useEffect(() => {
    isMountedRef.current = true
    startSubscription()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear any pending idle disconnect timer
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current)
          idleTimerRef.current = null
        }
        // Reconnect if paused
        if (!unsubscribeRef.current && user?.uid) {
          startSubscription()
        }
      } else {
        // App went to background / hidden; start timer to disconnect after 5 mins to save reads
        if (!idleTimerRef.current) {
          idleTimerRef.current = setTimeout(() => {
            stopSubscription()
            idleTimerRef.current = null
          }, IDLE_DISCONNECT_MS)
        }
      }
    }

    const handleWindowFocus = () => {
      if (!unsubscribeRef.current && user?.uid) {
        startSubscription()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      isMountedRef.current = false
      stopSubscription()
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [user?.uid, startSubscription, stopSubscription])

  // Recalculate active broadcast whenever notifications or dismissed IDs change
  useEffect(() => {
    updateActiveBroadcast(notifications, dismissedBroadcastIds)
  }, [notifications, dismissedBroadcastIds, updateActiveBroadcast])

  const unreadCount = user?.uid
    ? notifications.filter((n) => !n.readBy || !n.readBy.includes(user.uid)).length
    : 0

  const markAsRead = async (notificationId: string) => {
    if (!user?.uid || !notificationId) return
    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, readBy: n.readBy ? [...n.readBy, user.uid] : [user.uid] }
          : n
      )
    )
    await notificationService.markAsRead(user.uid, notificationId)
  }

  const markAllAsRead = async () => {
    if (!user?.uid) return
    const unreadIds = notifications
      .filter((n) => !n.readBy || !n.readBy.includes(user.uid))
      .map((n) => n.id)

    if (unreadIds.length === 0) return

    // Optimistic local update
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        readBy: n.readBy ? (n.readBy.includes(user.uid) ? n.readBy : [...n.readBy, user.uid]) : [user.uid]
      }))
    )

    await notificationService.markAllAsRead(user.uid, unreadIds)
  }

  const dismissBroadcast = (broadcastId: string) => {
    if (!broadcastId) return
    try {
      sessionStorage.setItem(`mats_dismissed_broadcast_${broadcastId}`, 'true')
    } catch {}
    setDismissedBroadcastIds((prev) => {
      const updated = new Set([...prev, broadcastId])
      updateActiveBroadcast(notifications, updated)
      return updated
    })
  }

  const togglePushNotifications = async (): Promise<boolean> => {
    if (!user?.uid) return false
    if (nativePushService.isNative()) {
      if (isPushActive) {
        await nativePushService.removeNativePushToken(user.uid)
        const state = await nativePushService.checkPermissions()
        setPermissionState(state)
        return false
      } else {
        const token = await nativePushService.requestPermissionAndSaveToken(user.uid)
        const state = await nativePushService.checkPermissions()
        setPermissionState(state)
        return !!token
      }
    } else {
      if (isPushActive) {
        await notificationService.removeTokenFromFirestore(user.uid)
        setPermissionState(notificationService.getPermissionState())
        return false
      } else {
        const token = await notificationService.requestPermissionAndSaveToken(user.uid)
        setPermissionState(notificationService.getPermissionState())
        return !!token
      }
    }
  }

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    activeBroadcast,
    loading,
    isPushActive,
    permissionState,
    markAsRead,
    markAllAsRead,
    dismissBroadcast,
    togglePushNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider')
  }
  return context
}
