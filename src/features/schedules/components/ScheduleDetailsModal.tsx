import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { ScheduleAttendanceState, AttendanceRecord } from '@/types/attendance'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { attendanceService } from '@/services/attendanceService'

interface ScheduleDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: Schedule | null
  activeMembers: Member[]
  onEdit: (s: Schedule) => void
  onDelete: (id: string) => void
  onManageAssignments: (s: Schedule) => void
  attendanceState?: ScheduleAttendanceState
}

export const ScheduleDetailsModal: React.FC<ScheduleDetailsModalProps> = ({
  isOpen,
  onClose,
  schedule,
  activeMembers,
  onEdit,
  onDelete,
  onManageAssignments,
  attendanceState = 'none',
}) => {
  const { isAdmin, canAction } = useAuth()
  const canManage = isAdmin || canAction('canManageSchedules')
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    if (!isOpen || !schedule) return

    let isMounted = true
    const loadSessionData = async () => {
      setLoadingAttendance(true)
      try {
        const sess = await attendanceService.getOrCreateSession(schedule.id)
        if (!isMounted) return
        const recs = await attendanceService.getAttendanceForSession(sess.id)
        if (!isMounted) return
        setRecords(recs)
      } catch (err) {
        console.error('Failed to load session details in modal:', err)
      } finally {
        if (isMounted) setLoadingAttendance(false)
      }
    }

    loadSessionData()
    return () => { isMounted = false }
  }, [isOpen, schedule])

  if (!isOpen || !schedule) return null

  const status = getScheduleStatus(schedule)

  // Status styling
  const statusConfig = {
    upcoming: { label: 'Upcoming', badge: 'bg-green-50 border border-green-100 text-green-600' },
    ongoing: { label: 'Ongoing', badge: 'bg-blue-50 border border-blue-100 text-blue-600' },
    completed: { label: 'Completed', badge: 'bg-gray-100 border border-gray-200 text-gray-600' },
    cancelled: { label: 'Cancelled', badge: 'bg-red-50 border border-red-100 text-red-600' },
  }[status]

  // Map assigned members
  const assignedProfiles = activeMembers.filter((m) =>
    (schedule.assignedMembers || []).includes(m.id)
  )

  // Other Servers (servers who served but are not on the default assigned list)
  const otherServerMemberIds = records.filter(r => r.isOtherServer).map(r => r.memberId)
  const otherServerProfiles = activeMembers.filter(m => otherServerMemberIds.includes(m.id) && !(schedule.assignedMembers || []).includes(m.id))

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

  // Format date helper
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

  const getStatusBadge = (statusVal?: string) => {
    if (!statusVal) return <span className="text-[10px] text-gray-400 italic">No record</span>
    switch (statusVal) {
      case 'present': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase">Present</span>
      case 'late': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">Late</span>
      case 'absent': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">Absent</span>
      case 'excused': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">Excused</span>
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">{statusVal}</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Mass Service Profile
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Service Details</h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Main Info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-black text-slate-900 leading-tight">{schedule.title}</h4>
              <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${statusConfig.badge}`}>
                {statusConfig.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 pt-1">
              <span className="inline-flex items-center gap-1.5">
                📅 {formatHeaderDate(schedule.date)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-indigo-600 font-mono">
                🕒 {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
              </span>
            </div>
          </div>

          {/* Assigned Members */}
          <div className="pt-1">
            <div className="flex items-center justify-between pb-1.5">
              <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Assigned Altar Servers ({assignedProfiles.length})</h5>
              {loadingAttendance && <span className="text-[10px] font-bold text-indigo-600 animate-pulse">Loading attendance...</span>}
            </div>
            <div className="mt-1 space-y-1.5 max-h-48 overflow-y-auto">
              {assignedProfiles.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center">
                  <p className="text-xs text-slate-400 italic">No servers assigned to this schedule yet.</p>
                </div>
              ) : (
                assignedProfiles.map((m) => {
                  const rec = records.find(r => r.memberId === m.id)
                  return (
                    <div key={m.id} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50/80 border border-slate-200">
                      <div>
                        <div className="font-extrabold text-slate-900">{getFullName(m)}</div>
                        {m.rank && <div className="text-[10px] font-semibold text-slate-500">{m.rank}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(rec?.status)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Other Servers */}
          {(otherServerProfiles.length > 0 || records.some(r => r.isOtherServer)) && (
            <div className="border-t border-gray-100 pt-3">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Other Servers ({otherServerProfiles.length})</h5>
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                {otherServerProfiles.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No other servers added.</p>
                ) : (
                  otherServerProfiles.map((m) => {
                    const rec = records.find(r => r.memberId === m.id)
                    return (
                      <div key={m.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-indigo-50/40 border border-indigo-100">
                        <div>
                          <div className="font-semibold text-gray-900">{getFullName(m)}</div>
                          {m.rank && <div className="text-[10px] text-indigo-400">{m.rank}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(rec?.status)}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4 flex-wrap gap-2 bg-white">
          <div className="flex items-center space-x-2">
            {canManage && (
              <>
                <button
                  onClick={handleEditClick}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 px-3.5 py-2 text-xs font-bold text-blue-700 transition-colors cursor-pointer shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 transition-colors cursor-pointer shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {canManage && (
              <button
                onClick={handleManageClick}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 px-3.5 py-2 text-xs font-bold text-purple-700 transition-colors cursor-pointer shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Assign</span>
              </button>
            )}
            <Link
              to={`/attendance?scheduleId=${schedule.id}`}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors text-center cursor-pointer shadow-md ${
                attendanceState === 'finalized'
                  ? 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{attendanceState === 'finalized' ? 'View Attendance' : 'Take Attendance'}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
