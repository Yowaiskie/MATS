import React from 'react'
import type { Schedule } from '@/types/schedule'
import type { AttendanceSession } from '@/types/attendance'
import type { AttendanceSummary } from '@/utils/attendance'
import { formatScheduleDateWithDay } from '@/utils/scheduleUtils'
import { useAuth } from '@/features/authentication/AuthContext'

interface AttendanceHeaderProps {
  schedule: Schedule
  session: AttendanceSession
  summary: AttendanceSummary
  onBulkAction: (action: 'present' | 'absent' | 'clear') => void
  onToggleLock: () => void
  onGenerateReport: () => void
  isSaving: boolean
  isDirty: boolean
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  schedule,
  session,
  summary,
  onBulkAction,
  onToggleLock,
  onGenerateReport,
  isSaving,
  isDirty,
}) => {
  const { isAdmin, canAction } = useAuth()
  const canFinalize = isAdmin || canAction('canFinalizeAttendance')
  const markedCount = summary.present + summary.late + summary.absent + summary.excused + summary.observer + (summary.formation || 0)
  const unmarkedCount = Math.max(0, summary.total - markedCount)

  return (
    <div className="space-y-4">
      {/* Session details & Lock indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{schedule.title}</h1>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              session.locked
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-green-50 border border-green-200 text-green-600'
            }`}>
              {session.locked ? 'Finalized & Locked' : 'Open / Unlocked'}
            </span>
            {!session.locked && summary.total > 0 && unmarkedCount > 0 && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 border border-amber-200 text-amber-700">
                {unmarkedCount} Unmarked (Draft)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatScheduleDateWithDay(schedule.date)} • {schedule.startTime} - {schedule.endTime}
          </p>
          {session.locked && session.finalizedBy ? (
            <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <span>✓ Finalized by:</span>
              <strong className="font-semibold">{session.finalizedBy}</strong>
            </p>
          ) : session.lastUpdatedBy ? (
            <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
              <span>🟡 In Progress (Last edited by:</span>
              <strong className="font-semibold">{session.lastUpdatedBy}</strong>
              {session.lastUpdatedAt && (
                <span>
                  at {session.lastUpdatedAt.toDate ? session.lastUpdatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                </span>
              )}
              <span>)</span>
            </p>
          ) : null}
        </div>

        {/* Lock/Unlock & Report triggers */}
        {canFinalize && (
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            <button
              onClick={onGenerateReport}
              disabled={isDirty || isSaving}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2.5 text-xs font-bold text-white transition-all w-full md:w-auto cursor-pointer shadow-md shadow-blue-600/20"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Generate Community Report</span>
            </button>
            <button
              onClick={onToggleLock}
              disabled={isSaving}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-40 w-full md:w-auto cursor-pointer shadow-sm ${
                session.locked
                  ? 'border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700'
                  : 'border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700'
              }`}
            >
              {session.locked ? (
                <>
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <span>Unlock Attendance Session</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Finalize & Lock Session</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Live summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total assigned */}
        <div className="p-4 rounded-xl border border-gray-200 bg-white text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Assigned</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{summary.total}</span>
        </div>

        {/* Present */}
        <div className="p-4 rounded-xl border border-green-100 bg-green-50 text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-green-600">Present</span>
          <span className="text-2xl font-bold text-green-700 mt-1 block">{summary.present}</span>
        </div>

        {/* Late */}
        <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50 text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-yellow-600">Late</span>
          <span className="text-2xl font-bold text-yellow-700 mt-1 block">{summary.late}</span>
        </div>

        {/* Absent */}
        <div className="p-4 rounded-xl border border-red-100 bg-red-50 text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-red-600">Absent</span>
          <span className="text-2xl font-bold text-red-700 mt-1 block">{summary.absent}</span>
        </div>

        {/* Excused */}
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Excused</span>
          <span className="text-2xl font-bold text-gray-600 mt-1 block">{summary.excused}</span>
        </div>

        {/* Observer */}
        <div className="p-4 rounded-xl border border-purple-100 bg-purple-50 text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-purple-600">Observer</span>
          <span className="text-2xl font-bold text-purple-700 mt-1 block">{summary.observer}</span>
        </div>

        {/* Formation */}
        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50 text-center shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-600">Formation</span>
          <span className="text-2xl font-bold text-indigo-700 mt-1 block">{summary.formation || 0}</span>
        </div>
      </div>

      {/* Bulk actions menu (only available if unlocked) */}
      {!session.locked && (
        <div className="flex items-center justify-start gap-2 flex-wrap w-full">
          <span className="text-xs text-gray-500 font-bold mr-1">Bulk Actions:</span>
          <button
            onClick={() => onBulkAction('present')}
            disabled={isSaving || summary.total === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Mark All Present</span>
          </button>
          <button
            onClick={() => onBulkAction('absent')}
            disabled={isSaving || summary.total === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Mark All Absent</span>
          </button>
          <button
            onClick={() => onBulkAction('clear')}
            disabled={isSaving || summary.total === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Clear All Statuses</span>
          </button>
        </div>
      )}
    </div>
  )
}
