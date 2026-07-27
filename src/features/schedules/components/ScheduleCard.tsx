import React from 'react'
import { Link } from 'react-router-dom'
import type { Schedule } from '@/types/schedule'
import type { ScheduleAttendanceState, AttendanceSession } from '@/types/attendance'
import { Card } from '@/components/Card'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { useAuth } from '@/features/authentication/AuthContext'

interface ScheduleCardProps {
  schedule: Schedule
  onEdit: (schedule: Schedule) => void
  onDelete: (id: string) => void | Promise<void>
  onManageAssignments: (schedule: Schedule) => void
  onView?: (schedule: Schedule) => void
  totalAssigned: number
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  attendanceState?: ScheduleAttendanceState
  session?: AttendanceSession | null
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onEdit,
  onDelete,
  onManageAssignments,
  onView,
  totalAssigned,
  isSelected = false,
  onToggleSelect,
  attendanceState = 'none',
  session = null,
}) => {
  const { isAdmin } = useAuth()
  const computedStatus = getScheduleStatus(schedule)

  // Status mapping matching user guidelines
  const statusColors = {
    upcoming: 'bg-green-50 border border-green-100 text-green-600',
    ongoing: 'bg-blue-50 border border-blue-100 text-blue-600',
    completed: 'bg-gray-100 border border-gray-200 text-gray-600',
    cancelled: 'bg-red-50 border border-red-100 text-red-600',
  }

  // Format timestamp helper
  const formatTime = (ts: any) => {
    if (!ts) return ''
    try {
      let dateObj: Date | null = null
      if (typeof ts.toDate === 'function') {
        dateObj = ts.toDate()
      } else if (ts.seconds) {
        dateObj = new Date(ts.seconds * 1000)
      } else if (ts instanceof Date) {
        dateObj = ts
      } else if (typeof ts === 'string' || typeof ts === 'number') {
        dateObj = new Date(ts)
      }
      if (dateObj && !isNaN(dateObj.getTime())) {
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    } catch (e) {
      console.error(e)
    }
    return ''
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
    const m = parts[1]
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12
    return `${h}:${m} ${ampm}`
  }

  const getCardBorderStyle = () => {
    if (isSelected) return 'ring-2 ring-blue-500 bg-blue-50/20 border-blue-400'
    if (attendanceState === 'in_progress') return 'border-amber-400 bg-gradient-to-b from-amber-50/40 via-amber-50/10 to-white shadow-xs'
    if (attendanceState === 'finalized') return 'border-emerald-300 bg-emerald-50/15'
    return 'border-gray-200/70 hover:border-gray-300'
  }

  return (
    <Card className={`relative flex flex-col justify-between transition-all duration-200 hover:shadow-md ${getCardBorderStyle()}`}>
      <div className="flex flex-col h-full justify-between space-y-4">
        {/* Header Title & Status */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            {/* Checkbox for bulk selection */}
            {onToggleSelect && (
              <button
                onClick={() => onToggleSelect(schedule.id)}
                className={`shrink-0 mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 hover:border-blue-400 bg-white'
                }`}
                aria-label={isSelected ? 'Deselect schedule' : 'Select schedule'}
              >
                {isSelected && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}
            <h4 className="text-sm font-bold text-gray-900 leading-tight truncate flex-1" title={`${schedule.title} ${formatTime12(schedule.startTime)}`}>
              {schedule.title} <span className="text-blue-600 font-extrabold ml-1">{formatTime12(schedule.startTime)}</span>
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${statusColors[computedStatus]}`}>
                {computedStatus}
              </span>
              {attendanceState === 'finalized' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-xs">
                  ✓ Finalized
                </span>
              )}
              {attendanceState === 'in_progress' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white border border-amber-600 shadow-sm animate-pulse tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  IN PROGRESS
                </span>
              )}
              {attendanceState === 'untaken' && (
                <span className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-slate-100 border border-slate-200 text-slate-600 shadow-xs">
                  ⚪ Untaken
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            📅 {formatCardDate(schedule.date)} • 🕒 {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
          </p>

          {/* Last track info */}
          {session?.lastUpdatedBy ? (
            <p className="text-[11px] text-amber-900 font-semibold bg-amber-100/90 border border-amber-300/80 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between shadow-2xs">
              <span className="truncate">👤 Taken by: <strong className="font-bold text-amber-950">{session.lastUpdatedBy}</strong></span>
              {session.lastUpdatedAt && (
                <span className="text-[10px] text-amber-800 font-medium shrink-0 ml-1.5">
                  {formatTime(session.lastUpdatedAt) ? `${formatTime(session.lastUpdatedAt)}` : ''}
                </span>
              )}
            </p>
          ) : session?.finalizedBy ? (
            <p className="text-[11px] text-emerald-900 font-semibold bg-emerald-100/80 border border-emerald-300 px-2.5 py-1.5 rounded-lg mt-2 truncate shadow-2xs">
              ✓ Finalized by: <strong>{session.finalizedBy}</strong>
            </p>
          ) : null}
        </div>

        {/* Assigned Counter */}
        <div className="flex items-center justify-between py-2 border-y border-gray-100 text-xs">
          <span className="text-gray-500">Assigned Servers:</span>
          <span className="font-bold text-gray-900">{totalAssigned}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 justify-end pt-1 flex-wrap">
          {/* Attendance Link Buttons */}
          {(computedStatus === 'ongoing' || computedStatus === 'completed') && (
            <>
              {attendanceState === 'finalized' ? (
                <Link
                  to={`/attendance?scheduleId=${schedule.id}`}
                  className="rounded-lg bg-slate-700 hover:bg-slate-800 px-3 py-1.5 text-xxs font-bold text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>View Attendance</span>
                </Link>
              ) : (
                <>
                  <Link
                    to={`/attendance?scheduleId=${schedule.id}`}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xxs font-bold text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <span>Take Attendance</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onView ? onView(schedule) : onManageAssignments(schedule)}
                    className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xxs font-bold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>View</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* Admin Action Controls */}
          {isAdmin && (
            <>
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
                className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100/50 px-2.5 py-1.5 text-xxs font-semibold text-red-600 transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
