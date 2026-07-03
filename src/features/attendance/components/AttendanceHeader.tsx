import React from 'react'
import type { Schedule } from '@/types/schedule'
import type { AttendanceSession } from '@/types/attendance'
import type { AttendanceSummary } from '@/utils/attendance'

interface AttendanceHeaderProps {
  schedule: Schedule
  session: AttendanceSession
  summary: AttendanceSummary
  onBulkAction: (action: 'present' | 'absent' | 'clear') => void
  onToggleLock: () => void
  onGenerateReport: () => void
  onAddOtherServer: () => void
  isSaving: boolean
  isDirty: boolean
  hasMembers: boolean
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  schedule,
  session,
  summary,
  onBulkAction,
  onToggleLock,
  onGenerateReport,
  onAddOtherServer,
  isSaving,
  isDirty,
  hasMembers,
}) => {
  return (
    <div className="space-y-4">
      {/* Session details & Lock indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div>
          <div className="flex items-center space-x-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{schedule.title}</h1>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              session.locked
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-green-50 border border-green-200 text-green-600'
            }`}>
              {session.locked ? 'Finalized & Locked' : 'Open / Unlocked'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {schedule.date} • {schedule.startTime} - {schedule.endTime}
          </p>
          {session.locked && session.finalizedBy && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              Finalized by: {session.finalizedBy}
            </p>
          )}
        </div>

        {/* Lock/Unlock trigger */}
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          <button
            onClick={onGenerateReport}
            disabled={isDirty || isSaving || !hasMembers}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition-colors w-full md:w-auto cursor-pointer shadow-sm"
          >
            Generate Community Report
          </button>
          <button
            onClick={onToggleLock}
            disabled={isSaving}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-40 w-full md:w-auto cursor-pointer ${
              session.locked
                ? 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 shadow-sm'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
            }`}
          >
            {session.locked ? 'Unlock Attendance Session' : 'Finalize & Lock Session'}
          </button>
        </div>
      </div>

      {/* Live summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 text-center col-span-2 sm:col-span-1 shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Excused</span>
          <span className="text-2xl font-bold text-gray-600 mt-1 block">{summary.excused}</span>
        </div>
      </div>

      {/* Bulk actions menu (only available if unlocked) */}
      {!session.locked && (
        <div className="flex items-center justify-between gap-2 flex-wrap w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-semibold mr-1">Bulk Actions:</span>
            <button
              onClick={() => onBulkAction('present')}
              disabled={isSaving || summary.total === 0}
              className="rounded-lg border border-gray-200 bg-white hover:bg-green-50 hover:border-green-200 px-3 py-1.5 text-[11px] font-semibold text-green-600 hover:text-green-700 transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
            >
              Mark All Present
            </button>
            <button
              onClick={() => onBulkAction('absent')}
              disabled={isSaving || summary.total === 0}
              className="rounded-lg border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:text-red-700 transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
            >
              Mark All Absent
            </button>
            <button
              onClick={() => onBulkAction('clear')}
              disabled={isSaving || summary.total === 0}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
            >
              Clear All Statuses
            </button>
          </div>
          <button
            type="button"
            onClick={onAddOtherServer}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3.5 py-1.5 text-[11px] font-bold text-white transition-colors cursor-pointer shadow-sm"
          >
            + Add Other Server
          </button>
        </div>
      )}
    </div>
  )
}
