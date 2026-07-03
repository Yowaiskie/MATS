import React from 'react'
import { Link } from 'react-router-dom'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'

interface ScheduleDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: Schedule | null
  activeMembers: Member[]
  onEdit: (s: Schedule) => void
  onDelete: (id: string) => void
  onManageAssignments: (s: Schedule) => void
}

export const ScheduleDetailsModal: React.FC<ScheduleDetailsModalProps> = ({
  isOpen,
  onClose,
  schedule,
  activeMembers,
  onEdit,
  onDelete,
  onManageAssignments,
}) => {
  if (!isOpen || !schedule) return null

  const status = getScheduleStatus(schedule)

  // Status styling
  const statusConfig = {
    upcoming: { label: 'Upcoming', badge: 'bg-green-500/10 border-green-500/20 text-green-400' },
    ongoing: { label: 'Ongoing', badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
    completed: { label: 'Completed', badge: 'bg-gray-500/10 border-gray-500/20 text-gray-400' },
    cancelled: { label: 'Cancelled', badge: 'bg-red-500/10 border-red-500/20 text-red-400' },
  }[status]

  // Map assigned members' full names
  const assignedProfiles = activeMembers.filter((m) =>
    (schedule.assignedMembers || []).includes(m.id)
  )

  const handleEditClick = () => {
    onEdit(schedule)
    onClose()
  }

  const handleDeleteClick = () => {
    onDelete(schedule.id)
    onClose()
  }

  const handleManageClick = () => {
    onManageAssignments(schedule)
    onClose()
  }

  // Format date helper: converts "YYYY-MM-DD" to human readable format
  const formatHeaderDate = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const y = parts[0]
    const m = months[parseInt(parts[1], 10) - 1] || parts[1]
    const d = parseInt(parts[2], 10)
    return `${m} ${d}, ${y}`
  }

  // Format 12-hour time format helper
  const formatTime12 = (timeStr: string) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let h = parseInt(parts[0], 10)
    const m = parts[1].padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12
    return `${h}:${m} ${ampm}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-900">
          <div>
            <h3 className="text-base font-bold text-white">Service Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">Schedule details and assigned server profiles.</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
          {/* Main Info */}
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-lg font-bold text-white leading-tight">{schedule.title}</h4>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusConfig.badge}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              📅 {formatHeaderDate(schedule.date)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              🕒 {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
            </p>
          </div>

          {/* Assigned Members */}
          <div className="border-t border-gray-900 pt-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Assigned Altar Servers</h5>
            <div className="mt-2 space-y-1.5">
              {assignedProfiles.length === 0 ? (
                <p className="text-xxs text-gray-500 italic">No servers assigned to this schedule yet.</p>
              ) : (
                assignedProfiles.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded bg-gray-900/40 border border-gray-900">
                    <span className="font-medium text-white">{getFullName(m)}</span>
                    <span className="text-[10px] text-indigo-400 uppercase font-semibold">{m.rank}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-900 mt-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEditClick}
              className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={handleDeleteClick}
              className="rounded border border-red-950 bg-red-950/10 hover:bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleManageClick}
              className="rounded border border-indigo-900 bg-indigo-950/20 hover:bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-400 transition-colors cursor-pointer"
            >
              Manage Assignments
            </button>
            <Link
              to={`/attendance?scheduleId=${schedule.id}`}
              className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors text-center cursor-pointer"
            >
              Take Attendance
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
