import React from 'react'
import { Link } from 'react-router-dom'
import type { Schedule } from '@/types/schedule'
import type { ScheduleAttendanceState, AttendanceSession } from '@/types/attendance'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { useAuth } from '@/features/authentication/AuthContext'
import { ActionMenu } from '@/components'

interface ScheduleCardProps {
  schedule: Schedule
  onEdit: (schedule: Schedule) => void
  onDelete: (id: string) => void | Promise<void>
  onManageAssignments: (schedule: Schedule) => void
  onView?: (schedule: Schedule) => void
  onToggleLock?: (schedule: Schedule) => void
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
  onToggleLock,
  totalAssigned,
  isSelected = false,
  onToggleSelect,
  attendanceState = 'none',
  session = null,
}) => {
  const { isAdmin, canAction } = useAuth()
  const canManage = isAdmin || canAction('canManageSchedules')
  const computedStatus = getScheduleStatus(schedule)

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

  // 1. Is schedule locked? (attendance session finalized & locked by admin)
  const isFinalizedAttendance = attendanceState === 'finalized'
  const isLocked = isFinalizedAttendance

  // 2. Is attendance in progress (only if NOT locked)?
  const isInProgress = !isLocked && attendanceState === 'in_progress'

  // 3. Is it a past schedule with no attendance taken yet (and NOT locked)?
  const isUntakenPast = !isLocked && computedStatus === 'completed' && (attendanceState === 'untaken' || attendanceState === 'none')

  // Compute clean single primary status
  type CardStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'not_taken' | 'in_progress'

  const getEffectiveStatus = (): CardStatus => {
    if (computedStatus === 'cancelled') return 'cancelled'
    if (computedStatus === 'upcoming') return 'upcoming'
    if (computedStatus === 'ongoing') return 'ongoing'
    if (isLocked) return 'completed'
    if (isInProgress) return 'in_progress'
    if (isUntakenPast) return 'not_taken'
    return computedStatus as CardStatus
  }

  const effectiveStatus = getEffectiveStatus()

  const getCardBorderStyle = () => {
    if (isSelected) return 'ring-2 ring-blue-500 bg-blue-50/30 border-blue-400'
    if (effectiveStatus === 'completed') return 'border-emerald-400 bg-emerald-50/40 hover:border-emerald-500'
    if (effectiveStatus === 'in_progress') return 'border-amber-400 bg-gradient-to-b from-amber-50/40 via-amber-50/10 to-white shadow-xs hover:border-amber-500'
    if (effectiveStatus === 'not_taken') return 'border-rose-400 bg-rose-50/30 hover:border-rose-500 ring-1 ring-rose-400/30'
    if (effectiveStatus === 'upcoming') return 'border-indigo-300 bg-indigo-50/40 hover:border-indigo-400'
    if (effectiveStatus === 'ongoing') return 'border-blue-300 bg-blue-50/30 hover:border-blue-400'
    if (effectiveStatus === 'cancelled') return 'border-red-300 bg-red-50/30 hover:border-red-400'
    return 'border-slate-200/70 bg-white hover:border-slate-300'
  }

  return (
    <div className={`group rounded-2xl border p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between h-full ${getCardBorderStyle()}`}>
      <div className="space-y-3.5">
        {/* Top Bar: Date & Status */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {onToggleSelect && (
              <button
                onClick={() => onToggleSelect(schedule.id)}
                className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-slate-300 hover:border-indigo-400 bg-white'
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
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatCardDate(schedule.date)}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {effectiveStatus === 'upcoming' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 border border-indigo-200 text-indigo-700">
                Upcoming
              </span>
            )}
            {effectiveStatus === 'ongoing' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-700">
                Ongoing
              </span>
            )}
            {effectiveStatus === 'in_progress' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white shadow-xs animate-pulse">
                In Progress
              </span>
            )}
            {effectiveStatus === 'not_taken' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-700">
                Not Taken
              </span>
            )}
            {effectiveStatus === 'completed' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </span>
            )}
            {effectiveStatus === 'cancelled' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-50 border border-red-200 text-red-700">
                Cancelled
              </span>
            )}
          </div>
        </div>

        {/* Title Area with fixed height for equal row height alignment */}
        <div>
          <h3 
            onClick={() => onView && onView(schedule)}
            className={`text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2 h-10 flex items-center ${onView ? 'cursor-pointer' : ''}`}
          >
            {schedule.title}
          </h3>
        </div>

        {/* Metadata Stack */}
        <div className="space-y-2 text-xs font-semibold text-slate-500 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Time:</span>
            </span>
            <span className="font-extrabold text-slate-800">
              {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Assigned:</span>
            </span>
            <span className="font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
              {totalAssigned} Servers
            </span>
          </div>

          {session?.lastUpdatedBy && (
            <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-amber-800 font-bold">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Taken by: {session.lastUpdatedBy}</span>
              </span>
              {session.lastUpdatedAt && <span>{formatTime(session.lastUpdatedAt)}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 relative">
        {canManage && (
          <button
            onClick={() => onManageAssignments(schedule)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50/60 hover:bg-purple-100/80 text-purple-700 text-xs font-bold border border-purple-200/70 transition-all cursor-pointer text-center"
          >
            <svg className="w-3.5 h-3.5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Assign</span>
          </button>
        )}

        <Link
          to={`/attendance?scheduleId=${schedule.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer text-center"
        >
          <svg className="w-3.5 h-3.5 text-indigo-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>{isLocked ? 'View' : 'Attendance'}</span>
        </Link>

        {/* Management Meatball Menu */}
        {canManage && (
          <ActionMenu
            triggerVariant="meatball"
            size="sm"
            align="right"
            direction="auto"
            ariaLabel="Schedule actions"
            items={[
              {
                id: 'edit',
                label: 'Edit Schedule',
                variant: 'primary',
                onClick: () => onEdit(schedule),
                icon: (
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ),
              },
              ...(onToggleLock
                ? [
                    {
                      id: 'toggle-lock',
                      label: schedule.isLocked ? 'Unlock Schedule' : 'Finalize & Lock',
                      variant: 'success' as const,
                      onClick: () => onToggleLock(schedule),
                      icon: (
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ),
                    },
                  ]
                : []),
              {
                id: 'delete',
                label: 'Delete',
                variant: 'danger',
                onClick: () => onDelete(schedule.id),
                icon: (
                  <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}
