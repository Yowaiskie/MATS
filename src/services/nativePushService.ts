import { Capacitor } from '@capacitor/core'
import { PushNotifications, type ActionPerformed, type PushNotificationSchema, type Token } from '@capacitor/push-notifications'
import { LocalNotifications, type ActionPerformed as LocalActionPerformed } from '@capacitor/local-notifications'
import { db } from '@/firebase/config'
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

const USERS_COLLECTION = 'users'
const LOCAL_STORAGE_KEY = 'mats_push_enabled_native'
const LAST_TOKEN_KEY = 'mats_native_fcm_token'
const CHANNEL_ID = 'mats-alerts-channel'

class NativePushService {
  private isInitialized = false
  private currentUserId: string | null = null
  private onNotificationClickCallback: ((url: string) => void) | null = null
  private onNotificationReceivedCallback: ((notification: PushNotificationSchema) => void) | null = null

  public isNative(): boolean {
    return Capacitor.isNativePlatform()
  }

  public setNotificationClickCallback(cb: (url: string) => void) {
    this.onNotificationClickCallback = cb
  }

  public setNotificationReceivedCallback(cb: (notification: PushNotificationSchema) => void) {
    this.onNotificationReceivedCallback = cb
  }

  public async init(): Promise<void> {
    if (!this.isNative() || this.isInitialized) return

    this.isInitialized = true

    // Create high-priority notification channel for Android
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'MATS Ministry Alerts',
        description: 'Schedule assignments, attendance reminders, and broadcasts',
        importance: 5, // High importance (Heads-up popup banner)
        visibility: 1, // Public on lockscreen
        vibration: true,
        lights: true,
        lightColor: '#10B981'
      })
    } catch (err) {
      console.warn('Channel creation note:', err)
    }

    // Handle Local Notification clicks
    try {
      await LocalNotifications.addListener('localNotificationActionPerformed', (action: LocalActionPerformed) => {
        console.log('Local notification action performed:', action)
        const extra = action.notification.extra || {}
        const targetUrl = extra.url || extra.actionUrl || '/'

        if (this.onNotificationClickCallback) {
          this.onNotificationClickCallback(targetUrl)
        } else if (typeof window !== 'undefined') {
          window.location.href = targetUrl
        }
      })
    } catch (err) {
      console.warn('LocalNotification click listener note:', err)
    }

    // Set up native push listeners
    try {
      await PushNotifications.addListener('registration', async (token: Token) => {
        console.log('Native Push Registration Token received:', token.value)
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(LAST_TOKEN_KEY, token.value)
        }

        if (this.currentUserId) {
          await this.saveTokenToFirestore(this.currentUserId, token.value)
        }
      })

      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Native Push registration error:', error)
      })

      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Native Push received in foreground:', notification)
        if (this.onNotificationReceivedCallback) {
          this.onNotificationReceivedCallback(notification)
        }
        // Also trigger local heads-up alert if not displayed automatically
        this.showNativeNotification({
          title: notification.title || 'MATS Ministry Alert',
          body: notification.body || 'You have a new update.',
          actionUrl: notification.data?.url || notification.data?.click_action || '/'
        })
      })

      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Native Push action performed:', action)
        const data = action.notification.data || {}
        const targetUrl = data.url || data.click_action || data.link || '/'

        if (this.onNotificationClickCallback) {
          this.onNotificationClickCallback(targetUrl)
        } else if (typeof window !== 'undefined') {
          window.location.href = targetUrl
        }
      })
    } catch (err) {
      console.warn('PushNotification listener setup note:', err)
    }
  }

  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId
  }

  public async checkPermissions(): Promise<string> {
    if (!this.isNative()) return 'unsupported'
    try {
      const status = await PushNotifications.checkPermissions()
      return status.receive
    } catch (err) {
      console.warn('Error checking native push permissions:', err)
      return 'prompt'
    }
  }

  public isDevicePushEnabled(): boolean {
    if (!this.isNative() || typeof window === 'undefined') return false
    return localStorage.getItem(LOCAL_STORAGE_KEY) === 'true'
  }

  public setDevicePushEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return
    if (enabled) {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    }
  }

  public async requestPermissionAndSaveToken(userId: string): Promise<string | null> {
    if (!this.isNative()) return null
    this.setCurrentUserId(userId)
    await this.init()

    try {
      // Request Push Notification permission
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions()
      }

      // Request Local Notification permission
      try {
        await LocalNotifications.requestPermissions()
      } catch {}

      if (permStatus.receive !== 'granted') {
        this.setDevicePushEnabled(false)
        return null
      }

      this.setDevicePushEnabled(true)
      await PushNotifications.register()

      const cachedToken = typeof window !== 'undefined' ? localStorage.getItem(LAST_TOKEN_KEY) : null
      if (cachedToken) {
        await this.saveTokenToFirestore(userId, cachedToken)
        return cachedToken
      }

      return 'android-registered'
    } catch (err) {
      console.error('Failed to request native push permission:', err)
      return null
    }
  }

  public async syncNativeTokenSilently(userId: string): Promise<void> {
    if (!this.isNative() || !userId) return
    this.setCurrentUserId(userId)
    await this.init()

    try {
      const permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'granted') {
        this.setDevicePushEnabled(true)
        await PushNotifications.register()

        const cachedToken = typeof window !== 'undefined' ? localStorage.getItem(LAST_TOKEN_KEY) : null
        if (cachedToken) {
          await this.saveTokenToFirestore(userId, cachedToken)
        }
      }
    } catch (err) {
      console.warn('Silent native push token sync note:', err)
    }
  }

  public async saveTokenToFirestore(userId: string, token: string): Promise<void> {
    if (!userId || !token) return
    try {
      const tokenDocId = btoa(token.slice(-32)).replace(/[/+=]/g, '_')
      const tokenRef = doc(db, USERS_COLLECTION, userId, 'fcmTokens', tokenDocId)

      await setDoc(
        tokenRef,
        {
          token,
          platform: 'android-native',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Capacitor Android',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        },
        { merge: true }
      )

      const userRef = doc(db, USERS_COLLECTION, userId)
      await updateDoc(userRef, {
        pushEnabled: true,
        lastPushTokenUpdated: serverTimestamp()
      }).catch(() => {})
    } catch (err) {
      console.error('Failed to save native FCM token to Firestore:', err)
    }
  }

  public async removeNativePushToken(userId: string): Promise<void> {
    if (!userId) return
    try {
      const cachedToken = typeof window !== 'undefined' ? localStorage.getItem(LAST_TOKEN_KEY) : null
      if (cachedToken) {
        const tokenDocId = btoa(cachedToken.slice(-32)).replace(/[/+=]/g, '_')
        await deleteDoc(doc(db, USERS_COLLECTION, userId, 'fcmTokens', tokenDocId))
      }

      const userRef = doc(db, USERS_COLLECTION, userId)
      await updateDoc(userRef, {
        pushEnabled: false,
        lastPushTokenUpdated: serverTimestamp()
      }).catch(() => {})

      this.setDevicePushEnabled(false)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LAST_TOKEN_KEY)
      }
    } catch (err) {
      console.error('Failed to remove native push token from Firestore:', err)
    }
  }

  /**
   * Display a native Android heads-up notification in the phone's status bar with sound and vibration
   */
  public async showNativeNotification(options: {
    id?: number
    title: string
    body: string
    actionUrl?: string
  }): Promise<boolean> {
    if (!this.isNative()) return false
    await this.init()

    try {
      // Ensure local notification permission is requested if not yet granted
      try {
        const perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions()
        }
      } catch {}

      const notifId = options.id || Math.floor(Math.random() * 1000000)
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: options.title,
            body: options.body,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_stat_notification',
            iconColor: '#10B981',
            extra: {
              url: options.actionUrl || '/'
            }
          }
        ]
      })
      return true
    } catch (err) {
      console.warn('showNativeNotification error:', err)
      return false
    }
  }
}

export const nativePushService = new NativePushService()
