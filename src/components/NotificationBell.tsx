import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/authentication/AuthContext'
import { useNotificationContext } from '@/context/NotificationContext'
import type { AppNotification } from '@/types/notification'
import { useToast } from '@/context/ToastContext'

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  </svg>
)

const CheckDoubleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

export const NotificationBell: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationContext()

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [showAllNotifications, setShowAllNotifications] = useState(false)

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

  // Parse notification createdAt timestamp safely
  const getNotificationDate = (createdAt: any): Date | null => {
    if (!createdAt) return null
    if (typeof createdAt.toDate === 'function') {
      return createdAt.toDate()
    }
    if (createdAt instanceof Date) {
      return createdAt
    }
    if (typeof createdAt === 'object' && typeof createdAt.seconds === 'number') {
      return new Date(createdAt.seconds * 1000)
    }
    if (typeof createdAt === 'number') {
      return new Date(createdAt > 1e11 ? createdAt : createdAt * 1000)
    }
    if (typeof createdAt === 'string') {
      const d = new Date(createdAt)
      return isNaN(d.getTime()) ? null : d
    }
    return null
  }

  const isNotificationWithinDays = (createdAt: any, days: number): boolean => {
    const d = getNotificationDate(createdAt)
    if (!d) return true
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays <= days
  }

  const handleMarkAllRead = async () => {
    if (!user?.uid) return
    await markAllAsRead()
    toast.success('All Marked as Read', 'All unread notifications have been marked as read.')
  }

  const handleNotificationClick = async (notif: AppNotification) => {
    if (user?.uid && (!notif.readBy || !notif.readBy.includes(user.uid))) {
      await markAsRead(notif.id)
    }
    if (notif.actionUrl) {
      setIsOpen(false)
      navigate(notif.actionUrl)
    }
  }

  // 3-Day Slicing Logic for Notifications (Direct Alerts)
  const recentNotifications = notifications.filter((n) => isNotificationWithinDays(n.createdAt, 3))
  const olderNotifications = notifications.filter((n) => !isNotificationWithinDays(n.createdAt, 3))
  
  const baseNotifications = showAllNotifications || olderNotifications.length === 0 ? notifications : recentNotifications
  const filteredNotifications = baseNotifications.filter((n) => {
    if (activeTab === 'unread') return !n.readBy || !n.readBy.includes(user?.uid || '')
    return true
  })

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-500 text-[9px] font-black text-white shadow-xs">
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

          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-[400px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl sm:shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Notification Center
                </span>
                {unreadCount > 0 ? (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    {unreadCount} pending
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Up to date
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    title="Mark all notifications as read"
                  >
                    <CheckDoubleIcon className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1.5 bg-slate-100/80 border-b border-slate-200/70 overflow-x-auto text-[11px] font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                All Alerts ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                  activeTab === 'unread'
                    ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
              </button>
            </div>

            {/* Main Content Area */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {filteredNotifications.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <BellIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No Notifications</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeTab === 'unread'
                      ? 'You have read all your notifications.'
                      : olderNotifications.length > 0 && !showAllNotifications
                      ? `No notifications in the last 3 days. (${olderNotifications.length} older notifications available)`
                      : 'You are completely up to date.'}
                  </p>
                  {olderNotifications.length > 0 && !showAllNotifications && (
                    <button
                      type="button"
                      onClick={() => setShowAllNotifications(true)}
                      className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer"
                    >
                      <span>View All Alerts ({olderNotifications.length})</span>
                      <span>↓</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {filteredNotifications.map((notif) => {
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Reminder
                              </span>
                            ) : notif.priority === 'urgent' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Urgent
                              </span>
                            ) : notif.priority === 'important' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                Announcement
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Notice
                              </span>
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
                  })}

                  {/* 3-Day Slicing Toggle Footer for Notifications */}
                  {olderNotifications.length > 0 && (
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllNotifications(!showAllNotifications)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-800 bg-blue-100/70 hover:bg-blue-100 border border-blue-200/80 transition-all cursor-pointer shadow-2xs"
                      >
                        {showAllNotifications ? (
                          <>
                            <span>Show recent alerts only (Last 3 days)</span>
                            <span>↑</span>
                          </>
                        ) : (
                          <>
                            <span>View older alerts ({olderNotifications.length} hidden)</span>
                            <span>↓</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
