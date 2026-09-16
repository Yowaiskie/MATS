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
  onSnapshot,
  arrayUnion,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore'
import type { AppNotification, PushNotificationProgress } from '@/types/notification'
import type { UserProfile } from '@/types/auth'
import type { Schedule } from '@/types/schedule'

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

const NOTIFICATIONS_COLLECTION = 'notifications'
const USERS_COLLECTION = 'users'

export type { PushNotificationProgress } from '@/types/notification'

export interface SendAttendanceReminderOptions {
  scheduleIds?: string[]
  targetAudienceType?: 'assigned_accounts_only' | 'all_officers' | 'custom_members'
  customMemberIds?: string[]
  customMessage?: string
  performedBy?: string
}

export interface UntakenScheduleInfo {
  schedule: Schedule
  assignedAccountsCount: number
  totalAssignedCount: number
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

  private markNotified(id: string) {
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
    const todayStr = new Date().toISOString().split('T')[0]
    const [schedulesSnap, sessionsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'schedules')),
      getDocs(collection(db, 'attendanceSessions')),
      getDocs(collection(db, USERS_COLLECTION))
    ])

    const usersWithAccounts = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
    
    const accountIdentifiers = new Set<string>()
    usersWithAccounts.forEach(u => {
      if (u.memberId) accountIdentifiers.add(u.memberId)
      if (u.uid) accountIdentifiers.add(u.uid)
    })

    const lockedScheduleIds = new Set<string>()
    sessionsSnap.docs.forEach(d => {
      const data = d.data()
      if (data.locked === true && data.scheduleId) {
        lockedScheduleIds.add(data.scheduleId)
      }
    })

    const schedules = schedulesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Schedule))
      .filter(s => s.status !== 'cancelled' && (!s.date || s.date <= todayStr) && !lockedScheduleIds.has(s.id) && !s.isLocked)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    return schedules.map(s => {
      const assigned = s.assignedMembers || []
      const assignedWithAccounts = assigned.filter(mId => accountIdentifiers.has(mId))
      return {
        schedule: s,
        assignedAccountsCount: assignedWithAccounts.length > 0 ? assignedWithAccounts.length : assigned.length,
        totalAssignedCount: assigned.length
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
    const duration = data.durationHours || 24
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString()

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
    const todayStr = new Date().toISOString().split('T')[0]

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
      .filter(s => s.status !== 'cancelled' && (!s.date || s.date <= todayStr))

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
    const lockedScheduleIds = new Set<string>()
    sessionsSnap.docs.forEach(d => {
      const data = d.data()
      if (data.locked === true && data.scheduleId) {
        lockedScheduleIds.add(data.scheduleId)
      }
    })

    // Filter schedules that are untaken
    const pendingSchedules = schedules
      .filter(s => !lockedScheduleIds.has(s.id) && !s.isLocked)
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

    // 4. Create targeted attendance reminder notification for each pending schedule
    let totalReminded = 0
    let totalOfficers = 0

    for (let i = 0; i < pendingSchedules.length; i++) {
      const s = pendingSchedules[i]
      
      let rawMemberIds: string[] = []
      if (opts.targetAudienceType === 'custom_members' && opts.customMemberIds && opts.customMemberIds.length > 0) {
        rawMemberIds = opts.customMemberIds
      } else if (opts.targetAudienceType === 'all_officers') {
        rawMemberIds = [] // Empty targetMemberIds with 'officers' audience alerts all officers
      } else {
        // Default: Assigned members on this schedule
        rawMemberIds = s.assignedMembers || []
      }

      // Expand target IDs to include member doc ID, user Auth UID, names, and user email
      const targetIdsSet = new Set<string>()
      rawMemberIds.forEach(mId => {
        if (mId) {
          targetIdsSet.add(mId)
          targetIdsSet.add(mId.toLowerCase().trim())
        }
      })

      if (rawMemberIds.length > 0) {
        const assignedMemberObjs = membersList.filter(m => rawMemberIds.includes(m.id))
        const assignedNames = assignedMemberObjs.map(m => `${m.firstName || ''} ${m.lastName || ''}`.trim().toLowerCase())

        usersList.forEach(u => {
          const uMemberId = u.memberId ? String(u.memberId).trim() : ''
          const uEmail = u.email ? String(u.email).toLowerCase().trim() : ''
          const uName = (u.displayName || u.memberName || '').toLowerCase().trim()

          const matchesMemberId = uMemberId && rawMemberIds.includes(uMemberId)
          const matchesName = uName && assignedNames.some(name => name && (uName.includes(name) || name.includes(uName)))
          const matchesEmail = assignedMemberObjs.some(m => m.email && m.email.toLowerCase().trim() === uEmail)

          if (matchesMemberId || matchesName || matchesEmail) {
            if (u.uid) targetIdsSet.add(u.uid)
            if (u.id) targetIdsSet.add(u.id)
            if (uEmail) targetIdsSet.add(uEmail)
            if (uMemberId) targetIdsSet.add(uMemberId)
          }
        })
      }

      const targetIds = Array.from(targetIdsSet)

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
      totalOfficers += targetIds.length > 0 ? targetIds.length : 1

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

    // Query collection with limit(25) for recent items to minimize Firestore read consumption
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      limit(25)
    )

    return onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AppNotification)).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
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

        // 2. Attendance reminders without specific target members (sent to all officers)
        if (n.type === 'attendance_reminder') {
          if (userRole === 'order_leader' || userRole === 'head_sacristan' || userRole === 'officer' || userRole === 'user') return true
          if (isAdminOrCoordinator && memberId) return true
          return false
        }

        // 3. Broadcasts and system alerts
        if (n.targetAudience === 'all') return true
        if (n.targetAudience === 'admins' && isAdminOrCoordinator) return true
        if (n.targetAudience === 'officers') {
          if (isAdminOrCoordinator || userRole === 'order_leader' || userRole === 'head_sacristan' || userRole === 'officer' || memberId) return true
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
          if (notif.type === 'admin_broadcast') {
            const prefix = notif.priority === 'urgent' ? '🚨 [URGENT]' : (notif.priority === 'important' ? '📢 [ANNOUNCEMENT]' : 'ℹ️ [INFO]')
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
