import React, { useState } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { useNotificationContext } from '@/context/NotificationContext'
import { RemindAttendanceModal } from './RemindAttendanceModal'

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
  const { untakenCount } = useNotificationContext()
  const canManageReminders = isAdmin || canAction('canManageSchedules') || profile?.role === 'coordinator'
  const [isRemindModalOpen, setIsRemindModalOpen] = useState(false)

  if (!canManageReminders && !isAdmin) {
    return null
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsRemindModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 transition-all shadow-2xs cursor-pointer text-xs font-bold focus:outline-none"
        title="Bumuo at kopyahin ang paalala para sa mga hindi pa nate-take na attendance"
      >
        <ClockAlertIcon className="w-3.5 h-3.5 text-amber-600" />
        <span className="hidden sm:inline">Remind Untaken</span>
        {untakenCount > 0 && (
          <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
            {untakenCount}
          </span>
        )}
      </button>

      {isRemindModalOpen && (
        <RemindAttendanceModal
          isOpen={isRemindModalOpen}
          onClose={() => setIsRemindModalOpen(false)}
        />
      )}
    </div>
  )
}
