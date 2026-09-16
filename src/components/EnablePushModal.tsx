import React, { useState, useEffect } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { notificationService } from '@/services/notificationService'
import { useToast } from '@/components'
import { Button } from '@/components/Button'

export const EnablePushModal: React.FC = () => {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [permissionState, setPermissionState] = useState(notificationService.getPermissionState())

  // Check if push notifications are fully active
  const isSupported = notificationService.isSupported()
  const isPushActive = profile?.pushEnabled === true && permissionState === 'granted'
  const handleDismiss = () => {
    setIsOpen(false)
    try {
      localStorage.setItem('mats_push_prompt_dismissed_at', String(Date.now()))
    } catch {}
  }

  useEffect(() => {
    // Only check if user is logged in and browser supports notifications
    if (!user?.uid || !isSupported) return

    const currentPermission = notificationService.getPermissionState()
    setPermissionState(currentPermission)

    // 1. If browser permission is ALREADY granted, automatically sync & activate in background!
    if (currentPermission === 'granted') {
      if (profile?.pushEnabled !== true) {
        notificationService.requestPermissionAndSaveToken(user.uid).catch((err) => {
          console.warn('Auto-sync push token error:', err)
        })
      }
      setIsOpen(false)
      return
    }

    // 2. If browser permission is denied, do not pop up modal automatically
    if (currentPermission === 'denied') {
      setIsOpen(false)
      return
    }

    // 3. If user previously dismissed the prompt, suppress it for 7 days
    try {
      const dismissedAt = localStorage.getItem('mats_push_prompt_dismissed_at')
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10)
        if (!isNaN(dismissedTime) && Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
          setIsOpen(false)
          return
        }
      }
    } catch {}

    // 4. Prompt only if permission is 'default' (undecided)
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 1500)

    return () => clearTimeout(timer)
  }, [user?.uid, profile?.pushEnabled, isSupported])

  if (!isOpen || isPushActive || !isSupported) return null

  const handleEnablePush = async () => {
    if (!user?.uid || isRequesting) return
    setIsRequesting(true)
    try {
      const token = await notificationService.requestPermissionAndSaveToken(user.uid)
      const updatedPermission = notificationService.getPermissionState()
      setPermissionState(updatedPermission)

      if (token && updatedPermission === 'granted') {
        toast.success(
          'Notifications Enabled!',
          'You will now receive instant schedule alerts, attendance reminders, and ministry broadcasts.'
        )
        await notificationService.showLocalNotification('Push Notifications Active! 🎉', {
          body: 'You are now ready to receive ministry assignments and schedule reminders.',
          tag: 'mats-activated'
        })
        setIsOpen(false)
      } else if (updatedPermission === 'denied') {
        toast.warning(
          'Permission Blocked',
          'Notifications are currently blocked in your browser settings. Please allow notifications in site settings.'
        )
      }
    } catch (err: any) {
      console.error('Failed to enable push notifications:', err)
      toast.error('Setup Error', err.message || 'Failed to enable push notifications.')
    } finally {
      setIsRequesting(false)
    }
  }

  const isDenied = permissionState === 'denied'

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={handleDismiss}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 fade-in duration-200">
        {/* Decorative Top Accent Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white text-center relative overflow-hidden">
          {/* Subtle background circles */}
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full blur-lg pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/10 rounded-full blur-lg pointer-events-none" />

          {/* Animated Glowing Bell Icon */}
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg mb-3">
            <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-white/30 opacity-75" />
            <svg className="w-8 h-8 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>

          <h3 className="text-xl font-black tracking-tight">
            Turn On Push Notifications
          </h3>
          <p className="text-xs text-blue-100 mt-1 max-w-sm mx-auto leading-relaxed">
            Stay connected with your ministry assignments, instant schedule updates, and urgent notices.
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Feature Benefit Cards */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/60 border border-blue-100">
              <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Assigned Schedule Alerts</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Get notified whenever you are scheduled to serve for Mass or special events.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Pending Attendance Reminders</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Receive targeted alerts to finalize attendance on your assigned schedules.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Ministry Announcements</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Instant updates for urgent notices, assembly bulletins, and formation schedules.
                </div>
              </div>
            </div>
          </div>

          {/* Blocked Permission Visual Helper */}
          {isDenied && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 animate-in fade-in">
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-[11px] text-rose-800 space-y-1">
                <div className="font-black">Notifications are blocked in your browser</div>
                <p className="text-rose-700 leading-tight">
                  To enable: Click the <strong>lock / site settings icon (🔒)</strong> on your browser search bar beside the URL, change <strong>Notifications</strong> to <strong>Allow</strong>, and then click Retry below.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <Button
              variant="primary"
              size="default"
              fullWidth
              loading={isRequesting}
              onClick={handleEnablePush}
              className="py-3 text-sm font-black shadow-md shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              icon={
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }
            >
              {isDenied ? 'Check & Retry Permission' : 'Enable Push Notifications'}
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
