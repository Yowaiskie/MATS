import { useState, useEffect, useCallback } from 'react'
import { notificationService, type NotificationPermissionState } from '@/services/notificationService'
import { nativePushService } from '@/services/nativePushService'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/components'

export function useNotifications() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isNative = nativePushService.isNative()
  const [permission, setPermission] = useState<NotificationPermissionState>('default')
  const [isSupported, setIsSupported] = useState<boolean>(true)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Initialize status on mount
  useEffect(() => {
    if (isNative) {
      setIsSupported(true)
      nativePushService.checkPermissions().then((status) => {
        const perm = (status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'default') as NotificationPermissionState
        setPermission(perm)
        const isDeviceActive = nativePushService.isDevicePushEnabled() || perm === 'granted'
        setIsSubscribed(isDeviceActive)

        const cachedToken = typeof window !== 'undefined' ? localStorage.getItem('mats_native_fcm_token') : null
        if (cachedToken) {
          setToken(cachedToken)
        }

        if (user?.uid && isDeviceActive) {
          nativePushService.syncNativeTokenSilently(user.uid)
        }
      })
    } else {
      const supported = notificationService.isSupported()
      setIsSupported(supported)
      if (supported) {
        const currentPerm = notificationService.getPermission()
        setPermission(currentPerm)
        if (currentPerm === 'granted') {
          setIsSubscribed(true)
          if (user?.uid) {
            notificationService.requestPermissionAndSaveToken(user.uid).then((retrievedToken) => {
              if (retrievedToken) {
                setToken(retrievedToken)
              }
            }).catch(() => {})
          }
        }
      }
    }
  }, [isNative, user?.uid])

  // Setup foreground message listener
  useEffect(() => {
    if (isNative) {
      nativePushService.setNotificationReceivedCallback((notification) => {
        const title = notification.title || 'MATS Notification'
        const body = notification.body || 'You have a new update.'
        toast.info(title, body)
      })
    } else {
      let unsubscribe: (() => void) | null = null

      notificationService.onForegroundMessage((payload) => {
        const title = payload.notification?.title || payload.data?.title || 'MATS Notification'
        const body = payload.notification?.body || payload.data?.body || 'You have a new update.'
        toast.info(title, body)
      }).then((unsub) => {
        unsubscribe = unsub
      })

      return () => {
        if (unsubscribe) {
          unsubscribe()
        }
      }
    }
  }, [isNative, toast])

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Not Supported', 'Push notifications are not supported on this device/browser.')
      return false
    }

    setLoading(true)
    try {
      if (isNative) {
        if (!user?.uid) {
          toast.warning('Authentication Required', 'Please log in to enable notifications.')
          return false
        }
        const res = await nativePushService.requestPermissionAndSaveToken(user.uid)
        const check = await nativePushService.checkPermissions()
        const perm = (check === 'granted' ? 'granted' : check === 'denied' ? 'denied' : 'default') as NotificationPermissionState
        setPermission(perm)

        if (check !== 'granted') {
          toast.warning(
            'Permission Denied',
            'Please allow notification permissions in your Android App Settings.'
          )
          setIsSubscribed(false)
          return false
        }

        const cachedToken = typeof window !== 'undefined' ? localStorage.getItem('mats_native_fcm_token') : null
        setToken(cachedToken || res)
        setIsSubscribed(true)
        toast.success(
          'Android Notifications Enabled',
          'You will now receive native alerts and reminders on this device.'
        )
        return true
      } else {
        const newPerm = await notificationService.requestPermission()
        setPermission(newPerm)

        if (newPerm !== 'granted') {
          toast.warning(
            'Permission Denied',
            'Please allow notifications in your browser or device settings to receive updates.'
          )
          setIsSubscribed(false)
          return false
        }

        const deviceToken = await notificationService.getDeviceToken()
        if (deviceToken) {
          setToken(deviceToken)
          setIsSubscribed(true)

          if (user?.uid) {
            await notificationService.saveTokenToFirestore(user.uid, deviceToken)
          }

          toast.success(
            'Push Notifications Active',
            'You will now receive service and schedule alerts on this device.'
          )
          return true
        } else {
          setIsSubscribed(true)
          toast.success(
            'Notifications Enabled',
            'Browser notifications are enabled for this device.'
          )
          return true
        }
      }
    } catch (err: any) {
      console.error('Error enabling notifications:', err)
      toast.error('Setup Error', err.message || 'Could not enable push notifications.')
      return false
    } finally {
      setLoading(false)
    }
  }, [isNative, isSupported, user?.uid, toast])

  const disableNotifications = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      if (isNative) {
        if (user?.uid) {
          await nativePushService.removeNativePushToken(user.uid)
        }
        setToken(null)
        setIsSubscribed(false)
        toast.info('Notifications Disabled', 'Android push notifications have been disabled on this device.')
      } else {
        if (user?.uid && token) {
          await notificationService.removeTokenFromFirestore(user.uid, token)
        }
        setToken(null)
        setIsSubscribed(false)
        toast.info('Notifications Disabled', 'Push notifications have been disabled on this device.')
      }
    } catch (err: any) {
      console.error('Error disabling notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [isNative, user?.uid, token, toast])

  const sendTestNotification = useCallback(async (): Promise<void> => {
    try {
      if (isNative) {
        if (user?.uid) {
          await nativePushService.requestPermissionAndSaveToken(user.uid)
        }
        const check = await nativePushService.checkPermissions()
        const perm = (check === 'granted' ? 'granted' : check === 'denied' ? 'denied' : 'default') as NotificationPermissionState
        setPermission(perm)
        setIsSubscribed(perm === 'granted' || nativePushService.isDevicePushEnabled())

        const ok = await nativePushService.showNativeNotification({
          title: '🔔 MATS System Test',
          body: 'Push notifications and sound alerts are working smoothly on your phone!',
          actionUrl: '/settings'
        })

        if (ok) {
          toast.success('Test Alert Sent', 'Look at your Android status bar for the notification!')
        } else {
          toast.error('Test Failed', 'Please enable notification permissions in Android settings.')
        }
      } else {
        if (permission !== 'granted') {
          const newPerm = await notificationService.requestPermission()
          setPermission(newPerm)
          if (newPerm !== 'granted') {
            toast.warning('Enable First', 'Please enable notifications before testing.')
            return
          }
        }

        const shown = await notificationService.showLocalNotification('MATS System Test', {
          body: 'Push notifications are working smoothly on your device / PWA!',
          tag: 'mats-test-alert'
        })

        if (shown) {
          toast.success('Test Sent', 'A sample push notification was triggered.')
        } else {
          toast.error('Test Failed', 'Could not display test notification.')
        }
      }
    } catch (err: any) {
      console.error('Error sending test notification:', err)
      toast.error('Test Failed', err.message || 'Could not send test notification.')
    }
  }, [isNative, permission, user?.uid, toast])

  return {
    isSupported,
    isNative,
    permission,
    isSubscribed,
    token,
    loading,
    enableNotifications,
    disableNotifications,
    sendTestNotification
  }
}
