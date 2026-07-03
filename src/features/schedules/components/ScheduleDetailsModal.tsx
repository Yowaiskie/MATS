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
    upcoming: { label: 'Upcoming', badge: 'bg-green-50 border border-green-100 text-green-600' },
    ongoing: { label: 'Ongoing', badge: 'bg-blue-50 border border-blue-100 text-blue-600' },
    completed: { label: 'Completed', badge: 'bg-gray-100 border border-gray-200 text-gray-600' },
    cancelled: { label: 'Cancelled', badge: 'bg-red-50 border border-red-100 text-red-650' },
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
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Service Details</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Schedule details and assigned server profiles.</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Main Info */}
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-base font-bold text-gray-900 leading-tight">{schedule.title}</h4>
              <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${statusConfig.badge}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 font-medium">
              📅 {formatHeaderDate(schedule.date)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              🕒 {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
            </p>
          </div>

          {/* Assigned Members */}
          <div className="border-t border-gray-100 pt-3">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Assigned Altar Servers</h5>
            <div className="mt-2 space-y-1.5">
              {assignedProfiles.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No servers assigned to this schedule yet.</p>
              ) : (
                assignedProfiles.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50/50 border border-gray-150">
                    <span className="font-semibold text-gray-800">{getFullName(m)}</span>
                    <span className="text-[10px] text-blue-600 font-bold uppercase">{m.rank}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4 flex-wrap gap-2 bg-white">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleEditClick}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
            >
              Edit
            </button>
            <button
              onClick={handleDeleteClick}
              className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100/50 px-3 py-1.5 text-xs font-semibold text-red-655 transition-colors cursor-pointer shadow-sm"
            >
              Delete
            </button>
          </div>
          
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleManageClick}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer shadow-sm"
            >
              Assign
            </button>
            <Link
              to={`/attendance?scheduleId=${schedule.id}`}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors text-center cursor-pointer shadow-sm"
            >
              Take Attendance
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
