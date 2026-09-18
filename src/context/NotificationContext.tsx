import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { notificationService, type UntakenScheduleInfo } from '@/services/notificationService'
import type { AppNotification } from '@/types/notification'
import type { Schedule } from '@/types/schedule'

interface NotificationContextType {
  notifications: AppNotification[]
  untakenSchedules: UntakenScheduleInfo[]
  relevantUntakenSchedules: UntakenScheduleInfo[]
  unreadCount: number
  untakenCount: number
  unreadUntakenCount: number
  readUntakenIds: string[]
  loading: boolean
  markAsRead: (notificationId: string) => Promise<void>
  markUntakenAsRead: (scheduleId: string) => void
  markAllAsRead: () => Promise<void>
  refreshUntaken: () => Promise<void>
  remindSchedule: (schedule: Schedule) => Promise<{ success: boolean; notifiedCount: number }>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const IDLE_DISCONNECT_MS = 5 * 60 * 1000 // 5 minutes in background
const UNTAKEN_CHECK_INTERVAL_MS = 60 * 1000 // Check every 60 seconds for newly passed mass times

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin, canAction } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [untakenSchedules, setUntakenSchedules] = useState<UntakenScheduleInfo[]>([])
  const [readUntakenIds, setReadUntakenIds] = useState<string[]>(() => {
    try {
      const key = user?.uid ? `mats_read_untaken_ids_${user.uid}` : 'mats_read_untaken_ids'
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState<boolean>(true)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const periodicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  // Sync readUntakenIds on user switch
  useEffect(() => {
    if (!user?.uid) {
      setReadUntakenIds([])
      return
    }
    try {
      const key = `mats_read_untaken_ids_${user.uid}`
      const stored = localStorage.getItem(key)
      setReadUntakenIds(stored ? JSON.parse(stored) : [])
    } catch {
      setReadUntakenIds([])
    }
  }, [user?.uid])

  // Stable ref for profile to prevent re-subscription loops
  const profileRef = useRef(profile)
  profileRef.current = profile

  const refreshUntaken = useCallback(async () => {
    if (!user?.uid) return
    try {
      const data = await notificationService.getUntakenSchedules()
      if (isMountedRef.current) {
        setUntakenSchedules(data)
      }
    } catch (e) {
      console.warn('Failed to refresh untaken schedules in background:', e)
    }
  }, [user?.uid])

  // Periodic automatic evaluation of untaken schedules
  useEffect(() => {
    if (!user?.uid) {
      setUntakenSchedules([])
      if (periodicTimerRef.current) {
        clearInterval(periodicTimerRef.current)
        periodicTimerRef.current = null
      }
      return
    }

    refreshUntaken()
    periodicTimerRef.current = setInterval(refreshUntaken, UNTAKEN_CHECK_INTERVAL_MS)

    return () => {
      if (periodicTimerRef.current) {
        clearInterval(periodicTimerRef.current)
        periodicTimerRef.current = null
      }
    }
  }, [user?.uid, refreshUntaken])

  // Manage single persistent Firestore subscription per login session
  useEffect(() => {
    isMountedRef.current = true
    if (!user?.uid) {
      setNotifications([])
      setLoading(false)
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      return
    }

    setLoading(true)
    const currentRole = profileRef.current?.role || 'user'
    const currentMemberId = profileRef.current?.memberId
    const currentEmail = user.email

    const unsub = notificationService.subscribeToUserNotifications(
      user.uid,
      currentRole,
      currentMemberId,
      currentEmail,
      (list) => {
        if (!isMountedRef.current) return
        setNotifications(list)
        setLoading(false)
      }
    )

    unsubscribeRef.current = unsub

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUntaken()
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current)
          idleTimerRef.current = null
        }
      } else {
        // Disconnect after 5 minutes of inactivity to save quota
        if (!idleTimerRef.current) {
          idleTimerRef.current = setTimeout(() => {
            if (unsubscribeRef.current) {
              unsubscribeRef.current()
              unsubscribeRef.current = null
            }
            idleTimerRef.current = null
          }, IDLE_DISCONNECT_MS)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMountedRef.current = false
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.uid, refreshUntaken])

  // Compute role-based relevant untaken schedules
  const canManageAttendance = isAdmin || profile?.role === 'coordinator' || canAction('canTakeAttendance') || canAction('canManageSchedules')

  const relevantUntakenSchedules = untakenSchedules.filter((item) => {
    if (canManageAttendance) return true
    
    // For regular users / servers: only include if they are assigned to this schedule
    const memberId = profile?.memberId
    const uid = user?.uid
    const email = user?.email?.toLowerCase().trim()
    const assigned = item.schedule.assignedMembers || []

    if (memberId && assigned.includes(memberId)) return true
    if (uid && assigned.includes(uid)) return true
    
    // Check matched account IDs
    return item.assignedAccounts.some(
      (a) => (memberId && a.memberId === memberId) || (uid && a.userId === uid) || (email && a.email?.toLowerCase().trim() === email)
    )
  })

  const untakenCount = relevantUntakenSchedules.length
  const unreadUntakenCount = relevantUntakenSchedules.filter(
    (item) => !readUntakenIds.includes(item.schedule.id)
  ).length

  const unreadDirectCount = user?.uid
    ? notifications.filter((n) => !n.readBy || !n.readBy.includes(user.uid)).length
    : 0

  const unreadCount = unreadDirectCount

  const markUntakenAsRead = useCallback((scheduleId: string) => {
    if (!scheduleId || !user?.uid) return
    setReadUntakenIds((prev) => {
      if (prev.includes(scheduleId)) return prev
      const updated = [...prev, scheduleId]
      try {
        localStorage.setItem(`mats_read_untaken_ids_${user.uid}`, JSON.stringify(updated))
      } catch (e) {
        console.warn('Failed to save read untaken schedule ID:', e)
      }
      return updated
    })
  }, [user?.uid])

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

    // 1. Mark untaken schedules as read locally for this user
    const currentUntakenIds = relevantUntakenSchedules.map((s) => s.schedule.id)
    if (currentUntakenIds.length > 0) {
      setReadUntakenIds((prev) => {
        const set = new Set([...prev, ...currentUntakenIds])
        const updated = Array.from(set)
        try {
          localStorage.setItem(`mats_read_untaken_ids_${user.uid}`, JSON.stringify(updated))
        } catch (e) {
          console.warn('Failed to save read untaken IDs:', e)
        }
        return updated
      })
    }

    // 2. Mark direct unread notifications as read
    const unreadIds = notifications
      .filter((n) => !n.readBy || !n.readBy.includes(user.uid))
      .map((n) => n.id)

    if (unreadIds.length > 0) {
      // Optimistic local update
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readBy: n.readBy ? (n.readBy.includes(user.uid) ? n.readBy : [...n.readBy, user.uid]) : [user.uid]
        }))
      )
      await notificationService.markAllAsRead(user.uid, unreadIds)
    }
  }

  const remindSchedule = async (schedule: Schedule) => {
    const res = await notificationService.remindSingleSchedule(
      schedule,
      profile?.displayName || profile?.memberName || user?.email || 'Administrator'
    )
    await refreshUntaken()
    return res
  }

  const value: NotificationContextType = {
    notifications,
    untakenSchedules,
    relevantUntakenSchedules,
    unreadCount,
    untakenCount,
    unreadUntakenCount,
    readUntakenIds,
    loading,
    markAsRead,
    markUntakenAsRead,
    markAllAsRead,
    refreshUntaken,
    remindSchedule
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

