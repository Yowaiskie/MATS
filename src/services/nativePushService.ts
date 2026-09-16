import { Capacitor } from '@capacitor/core'
import { PushNotifications, type ActionPerformed, type PushNotificationSchema, type Token } from '@capacitor/push-notifications'
import { db } from '@/firebase/config'
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

const USERS_COLLECTION = 'users'
const LOCAL_STORAGE_KEY = 'mats_push_enabled_native'
const LAST_TOKEN_KEY = 'mats_native_fcm_token'

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

    // Set up native push listeners
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
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions()
      }

      if (permStatus.receive !== 'granted') {
        this.setDevicePushEnabled(false)
        return null
      }

      this.setDevicePushEnabled(true)
      await PushNotifications.register()

      // If we already have a cached token, persist it immediately
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
}

export const nativePushService = new NativePushService()
