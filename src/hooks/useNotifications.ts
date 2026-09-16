import { useState, useEffect, useCallback } from 'react'
import { notificationService, type NotificationPermissionState } from '@/services/notificationService'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/components'

export function useNotifications() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [permission, setPermission] = useState<NotificationPermissionState>('default')
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Initialize status on mount
  useEffect(() => {
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
  }, [user?.uid])

  // Setup foreground message listener
  useEffect(() => {
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
  }, [toast])

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Not Supported', 'Web Push notifications are not supported by this browser.')
      return false
    }

    setLoading(true)
    try {
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
        // Even without FCM VAPID key configured yet, local web notifications still work
        setIsSubscribed(true)
        toast.success(
          'Notifications Enabled',
          'Browser notifications are enabled for this device.'
        )
        return true
      }
    } catch (err: any) {
      console.error('Error enabling notifications:', err)
      toast.error('Setup Error', err.message || 'Could not enable push notifications.')
      return false
    } finally {
      setLoading(false)
    }
  }, [isSupported, user?.uid, toast])

  const disableNotifications = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      if (user?.uid && token) {
        await notificationService.removeTokenFromFirestore(user.uid, token)
      }
      setToken(null)
      setIsSubscribed(false)
      toast.info('Notifications Disabled', 'Push notifications have been disabled on this device.')
    } catch (err: any) {
      console.error('Error disabling notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.uid, token, toast])

  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (permission !== 'granted') {
      toast.warning('Enable First', 'Please enable notifications before testing.')
      return
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
  }, [permission, toast])

  return {
    isSupported,
    permission,
    isSubscribed,
    token,
    loading,
    enableNotifications,
    disableNotifications,
    sendTestNotification
  }
}
