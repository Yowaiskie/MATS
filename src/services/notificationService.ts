import { db, getFirebaseMessaging } from '@/firebase/config'
import type { MessagePayload } from 'firebase/messaging'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  limit,
  orderBy,
  onSnapshot,
  arrayUnion,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore'
import type { AppNotification, PushNotificationProgress, AssignedServerAccount } from '@/types/notification'
import type { UserProfile } from '@/types/auth'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { nativePushService } from '@/services/nativePushService'

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

const NOTIFICATIONS_COLLECTION = 'notifications'
const USERS_COLLECTION = 'users'

export type { PushNotificationProgress, AssignedServerAccount } from '@/types/notification'

export interface SendAttendanceReminderOptions {
  scheduleIds?: string[]
  targetAudienceType?: 'assigned_accounts_only' | 'all_officers' | 'custom_members'
  customMemberIds?: string[]
  additionalUserIds?: string[]
  customMessage?: string
  performedBy?: string
}

export interface UntakenScheduleInfo {
  schedule: Schedule
  assignedAccountsCount: number
  totalAssignedCount: number
  assignedAccounts: AssignedServerAccount[]
  hasAssignedAccounts: boolean
}

export const isUserMatchedWithServer = (
  user: UserProfile,
  member: Member | undefined,
  mId: string
): boolean => {
  if (!user) return false

  const cleanMid = (mId || '').toLowerCase().trim()
  const uUid = (user.uid || '').toLowerCase().trim()
  const uMemberId = (user.memberId || '').toLowerCase().trim()
  const uEmail = (user.email || '').toLowerCase().trim()

  // 1. Direct ID matches
  if (uMemberId && (uMemberId === cleanMid || (member && uMemberId === member.id.toLowerCase().trim()))) {
    return true
  }
  if (uUid && (uUid === cleanMid || (member && uUid === member.id.toLowerCase().trim()))) {
    return true
  }

  // 2. Direct Email matches
  if (uEmail && member?.email && uEmail === member.email.toLowerCase().trim()) {
    return true
  }
  if (uEmail && cleanMid === uEmail) {
    return true
  }

  // 3. Name comparisons across all name variations
  const userNames = [
    user.displayName,
    user.memberName,
    user.email ? user.email.split('@')[0] : ''
  ]
    .filter(Boolean)
    .map(n => String(n).toLowerCase().trim())

  if (member) {
    const fName = (member.firstName || '').toLowerCase().trim()
    const lName = (member.lastName || '').toLowerCase().trim()
    const mName = (member.middleName || '').toLowerCase().trim()
    const nick = (member.nickname || '').toLowerCase().trim()

    const candidates = [
      `${fName} ${lName}`.trim(),
      `${lName}, ${fName}`.trim(),
      `${lName} ${fName}`.trim(),
      `${fName} ${mName} ${lName}`.trim(),
      `${lName}, ${fName} ${mName}`.trim(),
      `${nick} ${lName}`.trim(),
      `${lName}, ${nick}`.trim(),
      fName,
      lName
    ].filter(c => c && c.length >= 2)

    for (const uN of userNames) {
      const uNAlpha = uN.replace(/[^a-z0-9]/g, '')
      // Direct string match
      for (const cand of candidates) {
        if (!cand) continue
        const candAlpha = cand.replace(/[^a-z0-9]/g, '')
        if (
          uN === cand ||
          uN.replace(/[,.]/g, '') === cand.replace(/[,.]/g, '') ||
          (uNAlpha.length >= 3 && candAlpha.length >= 3 && (uNAlpha === candAlpha || (uNAlpha.length >= 4 && candAlpha.includes(uNAlpha))))
        ) {
          return true
        }
      }

      // Token match: user displayName contains both first name and last name
      if (fName && lName) {
        const uClean = uN.replace(/[^a-z0-9\s]/g, ' ')
        const uWords = uClean.split(/\s+/).filter(Boolean)
        const fWords = fName.split(/\s+/).filter(Boolean)
        const lWords = lName.split(/\s+/).filter(Boolean)

        const hasFirst = fWords.some(fw => fw.length >= 2 && uWords.includes(fw)) || (nick && nick.length >= 2 && uWords.includes(nick))
        const hasLast = lWords.some(lw => lw.length >= 2 && uWords.includes(lw))

        if (hasFirst && hasLast) {
          return true
        }
      }
    }
  }

  // If mId itself is a name string (e.g. "Kyle Doe" or "Doe, Kyle")
  if (cleanMid && cleanMid.length >= 3) {
    const cleanMidAlpha = cleanMid.replace(/[^a-z0-9]/g, '')
    for (const uN of userNames) {
      const uNAlpha = uN.replace(/[^a-z0-9]/g, '')
      if (
        uN === cleanMid ||
        uN.replace(/[,.]/g, '') === cleanMid.replace(/[,.]/g, '') ||
        (uNAlpha.length >= 3 && cleanMidAlpha.length >= 3 && uNAlpha === cleanMidAlpha)
      ) {
        return true
      }
    }
  }

  return false
}

class NotificationService {
  private vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
  private notifiedIds = new Set<string>()

  constructor() {
    this.loadNotifiedIds()
  }

  private loadNotifiedIds() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('mats_notified_ids')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => this.notifiedIds.add(id))
          }
        }
      }
    } catch {}
  }

  public markNotified(id: string) {
    if (!id) return
    this.notifiedIds.add(id)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Retain only the latest 200 notified IDs to prevent unbounded storage
        const idsArray = Array.from(this.notifiedIds).slice(-200)
        localStorage.setItem('mats_notified_ids', JSON.stringify(idsArray))
      }
    } catch {}
  }

  public hasBeenNotified(id: string): boolean {
    return this.notifiedIds.has(id)
  }

  /**
   * Fetch list of all untaken / unfinalized schedules along with account mapping
   */
  async getUntakenSchedules(): Promise<UntakenScheduleInfo[]> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const currentTimeStr = `${hours}:${minutes}`

    const [schedulesSnap, sessionsSnap, usersSnap, membersSnap] = await Promise.all([
      getDocs(collection(db, 'schedules')),
      getDocs(collection(db, 'attendanceSessions')),
      getDocs(collection(db, USERS_COLLECTION)),
      getDocs(collection(db, 'members'))
    ])

    const usersWithAccounts = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() } as UserProfile))

    const membersList = membersSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Member))

    const memberMap: Record<string, Member> = {}
    membersList.forEach(m => { memberMap[m.id] = m })

    const finalizedScheduleIds = new Set<string>()
    sessionsSnap.docs.forEach(d => {
      const data = d.data()
      const isLocked = data.locked === true || String(data.locked) === 'true'
      const isFinalized = isLocked || data.finalizedAt != null || data.status === 'finalized' || data.attendanceStatus === 'finalized'
      if (isFinalized) {
        if (data.scheduleId) finalizedScheduleIds.add(data.scheduleId)
        finalizedScheduleIds.add(d.id)
      }
    })

    const schedules = schedulesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Schedule))
      .filter(s => {
        if (s.status === 'cancelled') return false
        if (finalizedScheduleIds.has(s.id)) return false
        if ((s as any).attendanceStatus === 'finalized' || (s as any).attendanceState === 'finalized') return false
        if (!s.date) return false
        
        // Strictly only include schedules whose scheduled end time has passed
        if (s.date < todayStr) return true
        if (s.date === todayStr) {
          const scheduleEndTime = s.endTime || s.startTime || '23:59'
          return currentTimeStr >= scheduleEndTime
        }
        return false
      })
      .sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '')
        if (dateCompare !== 0) return dateCompare
        return (b.startTime || '').localeCompare(a.startTime || '')
      })

    return schedules.map(s => {
      const assigned = s.assignedMembers || []
      const assignedAccounts: AssignedServerAccount[] = assigned.map(mId => {
        const member = memberMap[mId]
        const memberName = member ? `${member.firstName} ${member.lastName}`.trim() : mId
        
        // Match user account via comprehensive ID, email, and name matching
        const matchedUser = usersWithAccounts.find(u => isUserMatchedWithServer(u, member, mId))

        return {
          memberId: mId,
          memberName,
          hasAccount: Boolean(matchedUser),
          userId: matchedUser?.uid,
          email: matchedUser?.email
        }
      })

      const hasAccountsCount = assignedAccounts.filter(a => a.hasAccount).length

      return {
        schedule: s,
        assignedAccountsCount: hasAccountsCount,
        totalAssignedCount: assigned.length,
        assignedAccounts,
        hasAssignedAccounts: hasAccountsCount > 0
      }
    })
  }

  /**
   * Check if web notifications & service workers are supported in current environment
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return 'Notification' in window && 'serviceWorker' in navigator
  }

  /**
   * Get the current notification permission state
   */
  getPermission(): NotificationPermissionState {
    if (!this.isSupported()) return 'unsupported'
    return Notification.permission as NotificationPermissionState
  }

  /**
   * Request permission from the user
   */
  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) return 'unsupported'
    try {
      const permission = await Notification.requestPermission()
      return permission as NotificationPermissionState
    } catch (err) {
      console.error('Failed to request notification permission:', err)
      return 'denied'
    }
  }

  /**
   * Alias for getPermission
   */
  getPermissionState(): NotificationPermissionState {
    return this.getPermission()
  }

  /**
   * Check if push notifications have been enabled on this local device
   */
  isDevicePushEnabled(): boolean {
    if (typeof window === 'undefined') return false
    const localFlag = localStorage.getItem('mats_push_enabled_device') === 'true'
    return localFlag || this.getPermission() === 'granted'
  }

  /**
   * Set device push notification flag
   */
  setDevicePushEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return
    if (enabled) {
      localStorage.setItem('mats_push_enabled_device', 'true')
    } else {
      localStorage.removeItem('mats_push_enabled_device')
    }
  }

  /**
   * Request permission, retrieve FCM token, and save to Firestore
   */
  async requestPermissionAndSaveToken(userId: string): Promise<string | null> {
    const permission = await this.requestPermission()
    if (permission !== 'granted') {
      this.setDevicePushEnabled(false)
      return null
    }

    this.setDevicePushEnabled(true)

    const token = await this.getDeviceToken()
    if (token) {
      await this.saveTokenToFirestore(userId, token)
      return token
    } else {
      // If FCM Web Push VAPID key is pending in Firebase console, still mark device push active in user profile
      try {
        const userRef = doc(db, USERS_COLLECTION, userId)
        await updateDoc(userRef, {
          pushEnabled: true,
          lastPushTokenUpdated: serverTimestamp()
        })
      } catch (err) {
        console.warn('Could not update pushEnabled flag:', err)
      }
      return 'browser-local-enabled'
    }
  }

  /**
   * Silently sync device token and user pushEnabled status on login without any UI prompts
   */
  async syncDeviceTokenSilently(userId: string): Promise<void> {
    if (!userId || !this.isSupported()) return
    const permission = this.getPermission()
    if (permission !== 'granted') return

    try {
      this.setDevicePushEnabled(true)
      const token = await this.getDeviceToken()
      if (token) {
        await this.saveTokenToFirestore(userId, token)
      } else {
        const userRef = doc(db, USERS_COLLECTION, userId)
        await updateDoc(userRef, {
          pushEnabled: true,
          lastPushTokenUpdated: serverTimestamp()
        }).catch(() => {})
      }
    } catch (err) {
      console.warn('Silent push token sync note:', err)
    }
  }

  /**
   * Retrieve FCM Registration Token for current device
   */
  async getDeviceToken(): Promise<string | null> {
    try {
      const messaging = await getFirebaseMessaging()
      if (!messaging) {
        return null
      }

      let swRegistration: ServiceWorkerRegistration | undefined
      if ('serviceWorker' in navigator) {
        try {
          swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
          if (!swRegistration) {
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
          }
        } catch {
          swRegistration = await navigator.serviceWorker.ready
        }
      }

      if (!this.vapidKey) {
        // VAPID key is not set; local push and in-app alerts are active
        return null
      }

      const tokenOptions: { vapidKey?: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = {
        vapidKey: this.vapidKey
      }
      if (swRegistration) {
        tokenOptions.serviceWorkerRegistration = swRegistration
      }

      const { getToken } = await import('firebase/messaging')
      const currentToken = await getToken(messaging, tokenOptions)
      return currentToken || null
    } catch (err) {
      console.warn('FCM token retrieval note:', err)
      return null
    }
  }

  /**
   * Save device FCM token in user's profile in Firestore and mark pushEnabled
   */
  async saveTokenToFirestore(userId: string, token: string): Promise<void> {
    if (!userId || !token) return
    try {
      const tokenDocId = btoa(token.slice(-32)).replace(/[/+=]/g, '_')
      const tokenRef = doc(db, USERS_COLLECTION, userId, 'fcmTokens', tokenDocId)

      await setDoc(
        tokenRef,
        {
          token,
          platform: navigator.platform || 'unknown',
          userAgent: navigator.userAgent || 'unknown',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        },
        { merge: true }
      )

      // Also flag user document with pushEnabled = true
      const userRef = doc(db, USERS_COLLECTION, userId)
      await updateDoc(userRef, {
        pushEnabled: true,
        lastPushTokenUpdated: serverTimestamp()
      }).catch(() => {})
    } catch (err) {
      console.error('Failed to save FCM token to Firestore:', err)
      throw err
    }
  }

  /**
   * Remove device FCM token from Firestore (e.g. on disable or logout)
   */
  async removeTokenFromFirestore(userId: string, token?: string): Promise<void> {
    if (!userId) return
    try {
      let targetToken = token
      if (!targetToken) {
        targetToken = (await this.getDeviceToken()) || undefined
      }

      if (targetToken) {
        const tokenDocId = btoa(targetToken.slice(-32)).replace(/[/+=]/g, '_')
        await deleteDoc(doc(db, USERS_COLLECTION, userId, 'fcmTokens', tokenDocId))
      }

      const userRef = doc(db, USERS_COLLECTION, userId)
      await updateDoc(userRef, {
        pushEnabled: false,
        lastPushTokenUpdated: serverTimestamp()
      }).catch(() => {})
      this.setDevicePushEnabled(false)
    } catch (err) {
      console.error('Failed to remove FCM token from Firestore:', err)
    }
  }

  /**
   * Listen for foreground messages when user has MATS active
   */
  async onForegroundMessage(callback: (payload: MessagePayload) => void): Promise<(() => void) | null> {
    try {
      const messaging = await getFirebaseMessaging()
      if (!messaging) return null
      const { onMessage } = await import('firebase/messaging')
      return onMessage(messaging, callback)
    } catch (err) {
      console.warn('Foreground messaging listener error:', err)
      return null
    }
  }

  /**
   * Show a native/local browser notification (foreground fallback or PWA confirmation)
   * Guaranteed to work across mobile PWA and desktop browsers
   */
  async showLocalNotification(title: string, options?: NotificationOptions & Record<string, any>): Promise<boolean> {
    // 0. Prioritize Native Android Notification Drawer when inside Capacitor APK
    if (nativePushService.isNative()) {
      return await nativePushService.showNativeNotification({
        title,
        body: options?.body || '',
        actionUrl: options?.data?.url || (options as any)?.actionUrl || '/'
      })
    }

    if (!this.isSupported() || this.getPermission() !== 'granted') return false

    const defaultOptions: any = {
      icon: '/favicon/icon-192.png',
      badge: '/favicon/favicon-32x32.png',
      vibrate: [200, 100, 200],
      renotify: true,
      tag: options?.tag || 'mats-notification',
      ...options
    }

    try {
      // 1. Prioritize Service Worker showNotification (Mandatory for Android & mobile PWA)
      if ('serviceWorker' in navigator) {
        let registration: ServiceWorkerRegistration | null = null

        try {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<ServiceWorkerRegistration | null>((resolve) =>
              setTimeout(() => resolve(null), 1200)
            )
          ])
        } catch {}

        if (!registration) {
          try {
            registration = (await navigator.serviceWorker.getRegistration()) || null
          } catch {}
        }

        if (registration && registration.showNotification) {
          await registration.showNotification(title, defaultOptions)
          return true
        }
      }

      // 2. Desktop browser fallback constructor
      if (typeof Notification !== 'undefined') {
        new Notification(title, defaultOptions)
        return true
      }

      return false
    } catch (err) {
      console.warn('Local notification trigger notice:', err)
      return false
    }
  }

  /**
   * Dispatch an admin broadcast notification to all or target officers
   */
  async sendBroadcastNotification(
    data: {
      title: string
      message: string
      priority: 'urgent' | 'important' | 'info'
      targetAudience: 'all' | 'officers' | 'admins'
      actionUrl?: string
      actionLabel?: string
      durationHours?: number
    },
    performedBy = 'Administrator',
    performedByName = 'Admin'
  ): Promise<string> {
    const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION))
    const duration = typeof data.durationHours === 'number' ? data.durationHours : 24
    const expiresAt = duration > 0 ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : null

    const payload: Record<string, any> = {
      id: notifRef.id,
      type: 'admin_broadcast',
      title: data.title.trim(),
      message: data.message.trim(),
      priority: data.priority,
      targetAudience: data.targetAudience,
      durationHours: duration,
      expiresAt: expiresAt,
      createdBy: performedBy,
      createdByName: performedByName,
      createdAt: serverTimestamp(),
      readBy: []
    }

    if (data.actionUrl?.trim()) {
      payload.actionUrl = data.actionUrl.trim()
      payload.actionLabel = data.actionLabel?.trim() || 'View Details'
    }

    await setDoc(notifRef, payload)

    // Mark as notified locally on the sender device so the local feedback doesn't duplicate
    this.markNotified(notifRef.id)

    // Trigger local push notification for current admin session feedback
    const prefix = data.priority === 'urgent' ? '🚨 [URGENT]' : (data.priority === 'important' ? '📢 [ANNOUNCEMENT]' : 'ℹ️ [INFO]')
    await this.showLocalNotification(`${prefix} ${data.title}`, {
      body: data.message,
      tag: `mats-broadcast-${notifRef.id}`,
      data: { url: data.actionUrl || '/' }
    })

    return notifRef.id
  }

  /**
   * Dispatch an excuse request notification to officers and administrators
   */
  async sendExcuseRequestNotification(data: {
    excuseId: string
    trackingNumber: string
    memberName: string
    reason: string
    scheduleCount: number
    memberId: string
    performedBy?: string
  }): Promise<string> {
    const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION))
    const serverName = data.memberName || 'Altar Server'
    const scheduleCountStr = `${data.scheduleCount} schedule${data.scheduleCount > 1 ? 's' : ''}`
    const reasonSnippet = data.reason ? ` Reason: ${data.reason.length > 80 ? data.reason.substring(0, 80) + '...' : data.reason}` : ''

    const payload: AppNotification = {
      id: notifRef.id,
      type: 'excuse_request',
      title: `Excuse Request: ${serverName}`,
      message: `${serverName} has submitted an excuse request for ${scheduleCountStr}.${reasonSnippet}`,
      priority: 'important',
      targetAudience: 'officers',
      excuseId: data.excuseId,
      memberId: data.memberId,
      actionUrl: '/excuses',
      actionLabel: 'Review Excuse',
      createdBy: data.performedBy || 'Public Portal',
      createdByName: serverName,
      createdAt: serverTimestamp(),
      readBy: []
    }

    await setDoc(notifRef, payload)
    return notifRef.id
  }

  /**
   * Remind assigned servers for a single untaken schedule
   */
  async remindSingleSchedule(
    schedule: Schedule,
    performedBy = 'Administrator'
  ): Promise<{ success: boolean; notifiedCount: number }> {
    if (!schedule || !schedule.id) return { success: false, notifiedCount: 0 }

    const rawMemberIds = schedule.assignedMembers || []
    const [usersSnap, membersSnap] = await Promise.all([
      getDocs(collection(db, USERS_COLLECTION)),
      getDocs(collection(db, 'members'))
    ])
    const usersList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
    const membersList = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member))

    const targetIdsSet = new Set<string>()
    rawMemberIds.forEach(mId => {
      if (mId) {
        targetIdsSet.add(mId)
        targetIdsSet.add(mId.toLowerCase().trim())
      }
    })

    const assignedMemberObjs = membersList.filter(m => rawMemberIds.includes(m.id))
    const assignedNames = assignedMemberObjs.map(m => `${m.firstName || ''} ${m.lastName || ''}`.trim().toLowerCase())

    usersList.forEach(u => {
      const uMemberId = u.memberId ? String(u.memberId).trim() : ''
      const uEmail = u.email ? String(u.email).toLowerCase().trim() : ''
      const uName = (u.displayName || u.memberName || '').toLowerCase().trim()

      const matchesMemberId = Boolean(uMemberId && rawMemberIds.includes(uMemberId))
      const matchesUid = Boolean(u.uid && rawMemberIds.includes(u.uid))
      const matchesName = Boolean(uName && assignedNames.some(name => name && uName === name))
      const matchesEmail = Boolean(assignedMemberObjs.some(m => m.email && m.email.toLowerCase().trim() === uEmail))

      if (matchesMemberId || matchesUid || matchesName || matchesEmail) {
        if (u.uid) targetIdsSet.add(u.uid)
        if (uEmail) targetIdsSet.add(uEmail)
        if (uMemberId) targetIdsSet.add(uMemberId)
      }
    })

    const targetIds = Array.from(targetIdsSet)
    const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION))
    const reminderPayload: Record<string, any> = {
      id: notifRef.id,
      type: 'attendance_reminder',
      title: `Attendance Reminder: ${schedule.title}${schedule.date ? ` (${schedule.date})` : ''}`,
      message: `You are assigned to ${schedule.title} (${schedule.date || ''} • ${schedule.startTime || ''} - ${schedule.endTime || ''}). The scheduled duty has passed and attendance is pending. Please record and finalize attendance.`,
      priority: 'urgent',
      targetAudience: 'officers',
      scheduleId: schedule.id,
      actionUrl: `/attendance?scheduleId=${schedule.id}`,
      actionLabel: 'Take Attendance Now',
      createdBy: performedBy,
      createdByName: 'Admin',
      createdAt: serverTimestamp(),
      readBy: []
    }

    if (targetIds.length > 0) {
      reminderPayload.targetMemberIds = targetIds
    }

    await setDoc(notifRef, reminderPayload)

    // Trigger local push notification on sender as well
    await this.showLocalNotification(`🚨 Attendance Reminder: ${schedule.title}`, {
      body: `Reminder sent to assigned altar servers with accounts.`,
      tag: `mats-remind-${schedule.id}`,
      data: { url: `/attendance?scheduleId=${schedule.id}` }
    })

    return { success: true, notifiedCount: targetIds.length }
  }

  /**
   * Scans untaken schedules and sends bulk/targeted reminders to assigned officers
   */
  async sendBulkAttendanceReminders(
    optionsOrProgress?: SendAttendanceReminderOptions | ((progress: PushNotificationProgress) => void),
    onProgressOrPerformedBy?: ((progress: PushNotificationProgress) => void) | string
  ): Promise<{ schedulesReminded: number; officersNotified: number }> {
    let opts: SendAttendanceReminderOptions = {}
    let onProgress: ((progress: PushNotificationProgress) => void) | undefined

    if (typeof optionsOrProgress === 'function') {
      onProgress = optionsOrProgress
      if (typeof onProgressOrPerformedBy === 'string') {
        opts = { performedBy: onProgressOrPerformedBy }
      }
    } else if (typeof optionsOrProgress === 'object' && optionsOrProgress !== null) {
      opts = optionsOrProgress
      if (typeof onProgressOrPerformedBy === 'function') {
        onProgress = onProgressOrPerformedBy
      }
    }

    const adminPerformer = opts.performedBy || 'Administrator'
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const currentTimeStr = `${hours}:${minutes}`

    onProgress?.({
      active: true,
      current: 0,
      total: 100,
      percentage: 15,
      statusLabel: 'Scanning untaken schedules...'
    })

    // 1. Fetch all schedules and filter in-memory
    const schedulesSnap = await getDocs(collection(db, 'schedules'))

    let schedules = schedulesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Schedule))
      .filter(s => {
        if (s.status === 'cancelled' || s.isLocked) return false
        if (!s.date) return false
        if (s.date < todayStr) return true
        if (s.date === todayStr) {
          const scheduleEndTime = s.endTime || s.startTime || '23:59'
          return currentTimeStr >= scheduleEndTime
        }
        return false
      })

    // If specific scheduleIds are selected, filter to those
    if (opts.scheduleIds && opts.scheduleIds.length > 0) {
      const selectedSet = new Set(opts.scheduleIds)
      schedules = schedules.filter(s => selectedSet.has(s.id))
    }

    if (schedules.length === 0) {
      onProgress?.({
        active: false,
        current: 0,
        total: 0,
        percentage: 100,
        statusLabel: 'No eligible schedules found.'
      })
      return { schedulesReminded: 0, officersNotified: 0 }
    }

    // 2. Fetch attendance sessions to find unfinalized/untaken ones
    const sessionsSnap = await getDocs(collection(db, 'attendanceSessions'))
    const finalizedScheduleIds = new Set<string>()
    sessionsSnap.docs.forEach(d => {
      const data = d.data()
      const isLocked = data.locked === true || String(data.locked) === 'true'
      const isFinalized = isLocked || data.finalizedAt != null || data.status === 'finalized' || data.attendanceStatus === 'finalized'
      if (isFinalized) {
        if (data.scheduleId) finalizedScheduleIds.add(data.scheduleId)
        finalizedScheduleIds.add(d.id)
      }
    })

    // Filter schedules that are strictly untaken (not finalized, not locked, not cancelled)
    const pendingSchedules = schedules
      .filter(s => {
        if (s.status === 'cancelled') return false
        if (finalizedScheduleIds.has(s.id)) return false
        if ((s as any).attendanceStatus === 'finalized' || (s as any).attendanceState === 'finalized') return false
        return true
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    if (pendingSchedules.length === 0) {
      onProgress?.({
        active: false,
        current: 0,
        total: 0,
        percentage: 100,
        statusLabel: 'No untaken schedules found.'
      })
      return { schedulesReminded: 0, officersNotified: 0 }
    }

    // 3. Clean up previous attendance_reminder notifications
    try {
      const oldNotifsSnap = await getDocs(collection(db, NOTIFICATIONS_COLLECTION))
      const deleteOps = oldNotifsSnap.docs
        .filter(d => d.data().type === 'attendance_reminder')
        .map(d => deleteDoc(d.ref).catch(() => {}))
      if (deleteOps.length > 0) {
        await Promise.all(deleteOps)
      }
    } catch (e) {
      console.warn('Old reminder cleanup note:', e)
    }

    onProgress?.({
      active: true,
      current: 1,
      total: pendingSchedules.length,
      percentage: 40,
      statusLabel: `Found ${pendingSchedules.length} schedule(s). Preparing notifications...`
    })

    // Pre-fetch users and members to map Member IDs, names, UIDs & emails for bulletproof notification delivery
    let usersList: any[] = []
    let membersList: any[] = []
    try {
      const [usersSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, USERS_COLLECTION)),
        getDocs(collection(db, 'members'))
      ])
      usersList = usersSnap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }))
      membersList = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch (e) {
      console.warn('Could not fetch users/members for reminder mapping:', e)
    }

    // Pre-resolve additional user target IDs (e.g. Secretary, Coordinators, Admins)
    const additionalTargetIdsSet = new Set<string>()
    if (opts.additionalUserIds && opts.additionalUserIds.length > 0) {
      const additionalKeySet = new Set(opts.additionalUserIds.map(k => String(k).toLowerCase().trim()))
      usersList.forEach(u => {
        const uMemberId = u.memberId ? String(u.memberId).toLowerCase().trim() : ''
        const uUid = (u.uid || u.id || '').toLowerCase().trim()
        const uEmail = u.email ? String(u.email).toLowerCase().trim() : ''

        if (
          (uUid && additionalKeySet.has(uUid)) ||
          (uMemberId && additionalKeySet.has(uMemberId)) ||
          (uEmail && additionalKeySet.has(uEmail))
        ) {
          if (u.uid || u.id) additionalTargetIdsSet.add(u.uid || u.id)
          if (u.memberId) additionalTargetIdsSet.add(String(u.memberId).trim())
          if (u.email) additionalTargetIdsSet.add(u.email.toLowerCase().trim())
        }
      })
      // Also add raw additional IDs passed in
      opts.additionalUserIds.forEach(k => {
        if (k && String(k).trim()) {
          additionalTargetIdsSet.add(String(k).trim())
        }
      })
    }

    // 4. Create targeted attendance reminder notification for each pending schedule
    let totalReminded = 0
    let totalOfficers = 0

    for (let i = 0; i < pendingSchedules.length; i++) {
      const s = pendingSchedules[i]
      const scheduleAssignedMembers: string[] = s.assignedMembers || []
      
      // 1. Identify which active user accounts belong to this specific schedule
      const assignedUsersForThisSchedule = usersList.filter(u => {
        return scheduleAssignedMembers.some(mId => {
          const member = membersList.find(m => m.id === mId)
          return isUserMatchedWithServer(u, member, mId)
        })
      })

      // 2. If custom_members filter is selected, keep only the accounts selected by admin
      let targetUsersForThisSchedule = assignedUsersForThisSchedule
      if (opts.targetAudienceType === 'custom_members' && opts.customMemberIds && opts.customMemberIds.length > 0) {
        const selectedKeySet = new Set(opts.customMemberIds.map(k => String(k).toLowerCase().trim()))
        targetUsersForThisSchedule = assignedUsersForThisSchedule.filter(u => {
          const uMemberId = u.memberId ? String(u.memberId).toLowerCase().trim() : ''
          const uUid = (u.uid || u.id || '').toLowerCase().trim()
          const uEmail = u.email ? String(u.email).toLowerCase().trim() : ''

          return (
            (uUid && selectedKeySet.has(uUid)) ||
            (uMemberId && selectedKeySet.has(uMemberId)) ||
            (uEmail && selectedKeySet.has(uEmail))
          )
        })
      }

      // If no targeted users are assigned to THIS schedule AND no additional recipients exist, skip this schedule (unless all_officers)
      if (
        opts.targetAudienceType !== 'all_officers' &&
        targetUsersForThisSchedule.length === 0 &&
        additionalTargetIdsSet.size === 0
      ) {
        continue
      }

      // Build target IDs for users assigned to THIS schedule + additional target users (e.g. Secretary)
      const targetIdsSet = new Set<string>()
      targetUsersForThisSchedule.forEach(u => {
        const uMemberId = u.memberId ? String(u.memberId).trim() : ''
        const uUid = u.uid || u.id || ''
        const uEmail = u.email ? String(u.email).toLowerCase().trim() : ''

        if (uUid) targetIdsSet.add(uUid)
        if (uMemberId) targetIdsSet.add(uMemberId)
        if (uEmail) targetIdsSet.add(uEmail)
      })

      // Merge additional targeted accounts
      additionalTargetIdsSet.forEach(id => targetIdsSet.add(id))

      const targetIds = Array.from(targetIdsSet)

      // If targetIds is empty and we are not doing 'all_officers', do NOT send untargeted reminder
      if (opts.targetAudienceType !== 'all_officers' && targetIds.length === 0) {
        continue
      }

      const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION))
      const reminderPayload: Record<string, any> = {
        id: notifRef.id,
        type: 'attendance_reminder',
        title: `Attendance Pending: ${s.title}${s.date ? ` (${s.date})` : ''}`,
        message: opts.customMessage?.trim() 
          ? opts.customMessage.trim()
          : `Attendance has not yet been recorded for ${s.title} on ${s.date || 'scheduled date'} (${s.startTime || ''} - ${s.endTime || ''}). Please record and finalize attendance.`,
        priority: 'urgent',
        targetAudience: 'officers',
        scheduleId: s.id,
        actionUrl: `/attendance?scheduleId=${s.id}`,
        actionLabel: 'Take Attendance Now',
        createdBy: adminPerformer,
        createdByName: 'Admin',
        createdAt: serverTimestamp(),
        readBy: []
      }

      if (targetIds.length > 0) {
        reminderPayload.targetMemberIds = targetIds
      }

      await setDoc(notifRef, reminderPayload)
      totalReminded++
      const totalRecipientsCount = Math.max(1, targetUsersForThisSchedule.length + (opts.additionalUserIds?.length || 0))
      totalOfficers += totalRecipientsCount

      const percent = Math.round(40 + ((i + 1) / pendingSchedules.length) * 55)
      onProgress?.({
        active: true,
        current: i + 1,
        total: pendingSchedules.length,
        percentage: percent,
        statusLabel: `Dispatched reminder for ${s.title} (${s.date})...`
      })
    }

    onProgress?.({
      active: false,
      current: pendingSchedules.length,
      total: pendingSchedules.length,
      percentage: 100,
      statusLabel: 'Targeted attendance reminders sent successfully!'
    })

    return { schedulesReminded: totalReminded, officersNotified: totalOfficers }
  }

  /**
   * Real-time subscription to user-relevant notifications
   */
  subscribeToUserNotifications(
    _userId: string,
    userRole: string,
    memberId: string | undefined,
    userEmailOrCallback: string | null | undefined | ((notifications: AppNotification[]) => void),
    callbackMaybe?: (notifications: AppNotification[]) => void
  ): () => void {
    let userEmail: string | undefined
    let callback: (notifications: AppNotification[]) => void

    if (typeof userEmailOrCallback === 'function') {
      callback = userEmailOrCallback
      userEmail = undefined
    } else {
      userEmail = userEmailOrCallback || undefined
      callback = callbackMaybe || (() => {})
    }

    const emailClean = userEmail?.toLowerCase().trim()

    // Query collection ordered by creation date descending to ensure newest broadcasts and notifications are loaded
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(30)
    )

    return onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AppNotification)).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : Date.now())
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : Date.now())
        return timeB - timeA
      })

      // Filter notifications relevant to current user
      const relevant = allNotifs.filter(n => {
        const isAdminOrCoordinator = userRole === 'admin' || userRole === 'coordinator'

        const targetsLower = (n.targetMemberIds || []).map(t => String(t).toLowerCase().trim())
        const memberIdLower = memberId ? memberId.toLowerCase().trim() : undefined
        const userIdLower = _userId ? _userId.toLowerCase().trim() : undefined

        const isDirectTarget = Boolean(
          (memberIdLower && targetsLower.includes(memberIdLower)) ||
          (_userId && n.targetMemberIds?.includes(_userId)) ||
          (userIdLower && targetsLower.includes(userIdLower)) ||
          (emailClean && targetsLower.includes(emailClean))
        )

        // 1. If notification has targeted members, strictly deliver only to the tagged recipients
        if (n.targetMemberIds && n.targetMemberIds.length > 0) {
          return isDirectTarget
        }

        // 2. Attendance reminders without specific target members (sent only to admins/coordinators)
        if (n.type === 'attendance_reminder') {
          if (isAdminOrCoordinator) return true
          if (userRole === 'order_leader' || userRole === 'head_sacristan' || userRole === 'officer') return true
          return false
        }

        // 3. Excuse requests (sent to admins, coordinators, and officers with excuse module access)
        if (n.type === 'excuse_request') {
          if (isAdminOrCoordinator || userRole === 'order_leader' || userRole === 'head_sacristan' || userRole === 'officer') return true
          return isDirectTarget
        }

        // 4. Broadcasts and system alerts
        if (n.targetAudience === 'all') return true
        if (n.targetAudience === 'admins' && isAdminOrCoordinator) return true
        if (n.targetAudience === 'officers') {
          if (isAdminOrCoordinator || userRole === 'order_leader' || userRole === 'head_sacristan' || userRole === 'officer') return true
          return false
        }

        return isDirectTarget
      })

      // Automatically post new incoming notifications to the Device Notification Drawer / Status Bar
      const nowMs = Date.now()
      relevant.forEach((notif) => {
        const isUnread = !notif.readBy || !notif.readBy.includes(_userId)

        // Calculate creation age
        const notifTime = notif.createdAt?.toMillis
          ? notif.createdAt.toMillis()
          : (notif.createdAt ? new Date(notif.createdAt).getTime() : nowMs)
        const ageInHours = (nowMs - notifTime) / (1000 * 60 * 60)

        // Check if expired
        let isExpired = false
        if (notif.expiresAt) {
          const expTime = new Date(notif.expiresAt).getTime()
          if (!isNaN(expTime) && expTime <= nowMs) {
            isExpired = true
          }
        }

        const isAlreadyNotified = this.hasBeenNotified(notif.id)

        // If unread, not expired, recent (< 24 hrs), and not yet notified on this device:
        if (isUnread && !isExpired && ageInHours < 24 && !isAlreadyNotified) {
          this.markNotified(notif.id)

          // Formulate alert title with visual indicator
          let displayTitle = notif.title
          if (notif.type === 'excuse_request') {
            displayTitle = `[EXCUSE] ${notif.title}`
          } else if (notif.type === 'admin_broadcast') {
            const prefix = notif.priority === 'urgent' ? '[URGENT]' : (notif.priority === 'important' ? '[ANNOUNCEMENT]' : '[INFO]')
            displayTitle = `${prefix} ${notif.title}`
          }

          // Post to Device Notification Drawer / Status Bar
          this.showLocalNotification(displayTitle, {
            body: notif.message,
            tag: `mats-notif-${notif.id}`,
            renotify: true,
            data: {
              url: notif.actionUrl || '/'
            }
          })
        } else if (!isAlreadyNotified) {
          // If already read, expired, or old upon initial fetch, mark as notified so we don't alert retroactively
          this.markNotified(notif.id)
        }
      })

      callback(relevant)
    })
  }

  /**
   * Mark a notification as read by the current user
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    if (!userId || !notificationId) return
    try {
      const notifRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId)
      await updateDoc(notifRef, {
        readBy: arrayUnion(userId)
      })
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  /**
   * Mark all notifications as read by current user
   */
  async markAllAsRead(userId: string, notificationIds: string[]): Promise<void> {
    if (!userId || notificationIds.length === 0) return
    try {
      await Promise.all(
        notificationIds.map(id =>
          updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), {
            readBy: arrayUnion(userId)
          }).catch(() => {})
        )
      )
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  /**
   * Delete an individual notification document
   */
  async deleteNotification(notificationId: string): Promise<void> {
    if (!notificationId) return
    try {
      await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId))
    } catch (err) {
      console.error('Failed to delete notification:', err)
      throw err
    }
  }

  /**
   * Clear / delete notifications in batch from Firestore
   */
  async clearNotifications(notificationIds?: string[]): Promise<void> {
    try {
      if (notificationIds && notificationIds.length > 0) {
        await Promise.all(
          notificationIds.map(id => deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, id)).catch(() => {}))
        )
      } else {
        const snap = await getDocs(collection(db, NOTIFICATIONS_COLLECTION))
        await Promise.all(
          snap.docs.map(d => deleteDoc(d.ref).catch(() => {}))
        )
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err)
      throw err
    }
  }

  /**
   * Check all users and count who has push enabled vs not enabled
   */
  async getPushNotificationCoverage(): Promise<{
    totalUsers: number
    subscribedUsers: number
    unsubscribedUsers: UserProfile[]
  }> {
    try {
      const usersSnap = await getDocs(collection(db, USERS_COLLECTION))
      const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))

      const unsubscribedUsers: UserProfile[] = []
      let subscribedCount = 0

      for (const u of allUsers) {
        if (u.pushEnabled) {
          subscribedCount++
        } else {
          unsubscribedUsers.push(u)
        }
      }

      return {
        totalUsers: allUsers.length,
        subscribedUsers: subscribedCount,
        unsubscribedUsers
      }
    } catch (err) {
      console.error('Failed to get push notification coverage:', err)
      return { totalUsers: 0, subscribedUsers: 0, unsubscribedUsers: [] }
    }
  }
}

export const notificationService = new NotificationService()
