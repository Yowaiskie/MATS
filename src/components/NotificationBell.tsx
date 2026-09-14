import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/authentication/AuthContext'
import { notificationService } from '@/services/notificationService'
import type { AppNotification } from '@/types/notification'
import { StatusBadge, useToast } from '@/components'

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  </svg>
)

export const NotificationBell: React.FC = () => {
  const { user, profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [permissionState, setPermissionState] = useState(notificationService.getPermissionState())
  const popoverRef = useRef<HTMLDivElement>(null)

  // Real-time listener for user-relevant notifications
  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = notificationService.subscribeToUserNotifications(
      user.uid,
      profile?.role || 'user',
      profile?.memberId,
      user.email,
      (list) => {
        setNotifications(list)
      }
    )

    return () => unsubscribe()
  }, [user?.uid, user?.email, profile?.role, profile?.memberId])

  // Close on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'reminders' | 'broadcasts'>('all')
  const [togglingPush, setTogglingPush] = useState(false)
  const { hasModuleAccess } = useAuth()
  const canAccessSettings = isAdmin || hasModuleAccess?.('settings')

  const unreadCount = notifications.filter(
    (n) => !n.readBy || !n.readBy.includes(user?.uid || '')
  ).length
  const remindersCount = notifications.filter((n) => n.type === 'attendance_reminder').length
  const broadcastsCount = notifications.filter((n) => n.type === 'admin_broadcast').length

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.readBy || !n.readBy.includes(user?.uid || '')
    if (activeTab === 'reminders') return n.type === 'attendance_reminder'
    if (activeTab === 'broadcasts') return n.type === 'admin_broadcast'
    return true
  })

  const handleMarkAllRead = async () => {
    if (!user?.uid) return
    const unreadIds = notifications
      .filter((n) => !n.readBy || !n.readBy.includes(user.uid))
      .map((n) => n.id)
    if (unreadIds.length > 0) {
      await notificationService.markAllAsRead(user.uid, unreadIds)
      toast.success('All Caught Up', 'All notifications marked as read.')
    }
  }

  const handleNotificationClick = async (notif: AppNotification) => {
    if (user?.uid && (!notif.readBy || !notif.readBy.includes(user.uid))) {
      await notificationService.markAsRead(user.uid, notif.id)
    }
    if (notif.actionUrl) {
      setIsOpen(false)
      navigate(notif.actionUrl)
    }
  }

  const isPushActive = profile?.pushEnabled === true && permissionState === 'granted'

  const handleTogglePush = async () => {
    if (!user?.uid || togglingPush) return
    setTogglingPush(true)
    try {
      if (isPushActive) {
        await notificationService.removeTokenFromFirestore(user.uid)
        setPermissionState(notificationService.getPermissionState())
        toast.info(
          'Notifications Disabled',
          'Push notifications turned off on this device.'
        )
      } else {
        const token = await notificationService.requestPermissionAndSaveToken(user.uid)
        const updatedPermission = notificationService.getPermissionState()
        setPermissionState(updatedPermission)

        if (token) {
          toast.success(
            'Notifications Enabled!',
            'You will now receive instant schedule alerts and ministry broadcasts.'
          )
          await notificationService.showLocalNotification('Notifications Active!', {
            body: 'You are all set to receive ministry assignments and schedule alerts.',
            tag: 'mats-welcome'
          })
        } else if (updatedPermission === 'denied') {
          toast.warning(
            'Permission Blocked',
            'Notifications are blocked in browser settings. Please allow notifications in site settings.'
          )
        }
      }
    } catch (err: any) {
      console.error('Push toggle error:', err)
      toast.error('Push Error', err.message || 'Failed to update push status.')
    } finally {
      setTogglingPush(false)
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setPermissionState(notificationService.getPermissionState())
          setIsOpen(!isOpen)
        }}
        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer focus:outline-none"
        title="Notifications & Alerts"
        aria-label="Notifications"
      >
        <BellIcon className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-500 text-[9px] font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          {/* Mobile backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-96 rounded-2xl border border-slate-200/90 bg-white shadow-2xl sm:shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Notification Center
                </span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1.5 bg-slate-100/80 border-b border-slate-200/70 overflow-x-auto text-[11px] font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  activeTab === 'unread'
                    ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Unread ({unreadCount})
              </button>
              {remindersCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('reminders')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                    activeTab === 'reminders'
                      ? 'bg-white text-amber-700 shadow-2xs font-extrabold'
                      : 'hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Reminders ({remindersCount})
                </button>
              )}
              {broadcastsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('broadcasts')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                    activeTab === 'broadcasts'
                      ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                      : 'hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Broadcasts ({broadcastsCount})
                </button>
              )}
            </div>

            {/* Dedicated Push Notifications Device Control Card for ALL users */}
            {notificationService.isSupported() && (
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isPushActive
                        ? 'bg-blue-100 text-blue-600'
                        : permissionState === 'denied'
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-800">Push Alerts</span>
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                          isPushActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : permissionState === 'denied'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isPushActive ? 'Active' : permissionState === 'denied' ? 'Blocked' : 'Off'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPushActive}
                  onClick={handleTogglePush}
                  disabled={togglingPush || permissionState === 'denied'}
                  className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                    isPushActive ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  title={
                    permissionState === 'denied'
                      ? 'Blocked in browser settings'
                      : isPushActive
                      ? 'Click to turn off push notifications'
                      : 'Click to turn on push notifications'
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isPushActive ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {filteredNotifications.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <BellIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No Notifications</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeTab === 'unread'
                      ? 'You have read all your notifications.'
                      : activeTab === 'reminders'
                      ? 'No active attendance reminders.'
                      : 'You are completely up to date.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isUnread = !notif.readBy || !notif.readBy.includes(user?.uid || '')
                  const isAttendanceReminder = notif.type === 'attendance_reminder'

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 text-left transition-colors cursor-pointer hover:bg-slate-50 ${
                        isUnread ? 'bg-blue-50/40' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isAttendanceReminder ? (
                            <StatusBadge status="warning" />
                          ) : notif.priority === 'urgent' ? (
                            <StatusBadge status="rejected" />
                          ) : notif.priority === 'important' ? (
                            <StatusBadge status="pending" />
                          ) : (
                            <StatusBadge status="active" />
                          )}
                          <span className="text-[10px] font-bold text-slate-400">
                            {notif.createdByName || 'System'}
                          </span>
                        </div>

                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {notif.title}
                      </h4>

                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {notif.actionUrl && (
                        <div className="mt-2 flex items-center justify-end">
                          <span className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
                            {notif.actionLabel || 'View Record'} →
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

          {/* Footer for users with Settings permission */}
          {canAccessSettings && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/60 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  navigate('/settings')
                }}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Push Notification Settings →
              </button>
            </div>
          )}
        </div>
      </>
      )}
    </div>
  )
}
