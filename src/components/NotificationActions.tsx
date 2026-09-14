import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { AdminBroadcastModal } from './AdminBroadcastModal'
import { RemindAttendanceModal } from './RemindAttendanceModal'

const MegaphoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.115-1.564-.442a22.25 22.25 0 01-1.332-2.918m2.031-1.314A22.5 22.5 0 0019.5 12a22.5 22.5 0 00-7.16-3.84m0 9.18A22.5 22.5 0 0119.5 12m0 0a22.5 22.5 0 00-7.16-3.84"
    />
  </svg>
)

const ClockAlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

export const NotificationActions: React.FC = () => {
  const { profile, isAdmin, canAction } = useAuth()
  const canBroadcast = isAdmin || canAction('canBroadcast') || profile?.role === 'coordinator'
  
  const [isOpen, setIsOpen] = useState(false)
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false)
  const [isRemindModalOpen, setIsRemindModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Only show for authorized roles
  if (!canBroadcast && !isAdmin) {
    return null
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all shadow-2xs cursor-pointer text-xs font-bold focus:outline-none"
        title="Create & Send Notifications"
      >
        <MegaphoneIcon className="w-3.5 h-3.5 text-indigo-600" />
        <span className="hidden sm:inline">Send Alert</span>
        <svg
          className={`w-3 h-3 text-indigo-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3 bg-slate-50/80 border-b border-slate-100">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Notification Center Actions
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Dispatch alerts or notify assigned officers
            </p>
          </div>

          <div className="p-1.5 space-y-1">
            {/* Broadcast Option */}
            {canBroadcast && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setIsBroadcastModalOpen(true)
                }}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-indigo-50/70 transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MegaphoneIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-900">
                    Broadcast Announcement
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                    Send news, urgent notices, or mass alerts to members or officers.
                  </p>
                </div>
              </button>
            )}

            {/* Remind Pending Attendance Option */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setIsRemindModalOpen(true)
              }}
              className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-amber-50/70 transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ClockAlertIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-amber-900 flex items-center gap-1.5">
                  Remind Attendance
                  <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                    Targeted
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                  Notify assigned servers for untaken & unfinalized schedules.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {isBroadcastModalOpen && (
        <AdminBroadcastModal
          isOpen={isBroadcastModalOpen}
          onClose={() => setIsBroadcastModalOpen(false)}
        />
      )}

      {/* Remind Attendance Modal */}
      {isRemindModalOpen && (
        <RemindAttendanceModal
          isOpen={isRemindModalOpen}
          onClose={() => setIsRemindModalOpen(false)}
        />
      )}
    </div>
  )
}
