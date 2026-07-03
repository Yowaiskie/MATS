import React from 'react'
import { Link } from 'react-router-dom'
import type { Schedule } from '@/types/schedule'
import { Card } from '@/components/Card'
import { getScheduleStatus } from '@/utils/scheduleUtils'

interface ScheduleCardProps {
  schedule: Schedule
  onEdit: (schedule: Schedule) => void
  onDelete: (id: string) => void | Promise<void>
  onManageAssignments: (schedule: Schedule) => void
  totalAssigned: number
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onEdit,
  onDelete,
  onManageAssignments,
  totalAssigned,
}) => {
  const computedStatus = getScheduleStatus(schedule)

  // Status mapping matching user guidelines
  const statusColors = {
    upcoming: 'bg-green-50 border border-green-100 text-green-600',
    ongoing: 'bg-blue-50 border border-blue-100 text-blue-600',
    completed: 'bg-gray-100 border border-gray-200 text-gray-600',
    cancelled: 'bg-red-50 border border-red-100 text-red-600',
  }

  // Helper to format date nicely
  const formatCardDate = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]
    const m = months[parseInt(parts[1], 10) - 1] || parts[1]
    const d = parseInt(parts[2], 10)
    return `${m} ${d}, ${parts[0]}`
  }

  // Helper to format 12-hour clock
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
    <Card className="hover:shadow-md transition-shadow duration-200 border-gray-250/70">
      <div className="flex flex-col h-full justify-between space-y-4">
        {/* Header Title & Status */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[80%]" title={schedule.title}>
              {schedule.title}
            </h4>
            <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${statusColors[computedStatus]}`}>
              {computedStatus}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            📅 {formatCardDate(schedule.date)} • 🕒 {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
          </p>
        </div>

        {/* Assigned Counter */}
        <div className="flex items-center justify-between py-2 border-y border-gray-100 text-xs">
          <span className="text-gray-500">Assigned Servers:</span>
          <span className="font-bold text-gray-900">{totalAssigned}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 justify-end pt-1 flex-wrap">
          {/* Take Attendance Link */}
          {(computedStatus === 'ongoing' || computedStatus === 'completed') && (
            <Link
              to={`/attendance?scheduleId=${schedule.id}`}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xxs font-bold text-white transition-colors cursor-pointer"
            >
              Take Attendance
            </Link>
          )}

          {/* Manage Assignments */}
          <button
            onClick={() => onManageAssignments(schedule)}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xxs font-semibold text-blue-600 hover:text-blue-700 transition-colors shadow-sm cursor-pointer"
          >
            Assign Servers
          </button>

          {/* Edit Button */}
          <button
            onClick={() => onEdit(schedule)}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-2.5 py-1.5 text-xxs font-semibold text-gray-600 hover:text-gray-900 transition-colors shadow-sm cursor-pointer"
          >
            Edit
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(schedule.id)}
            className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100/50 px-2.5 py-1.5 text-xxs font-semibold text-red-655 transition-colors shadow-sm cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </Card>
  )
}
