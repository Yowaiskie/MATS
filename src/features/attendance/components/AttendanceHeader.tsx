import React from 'react'
import type { Schedule } from '@/types/schedule'
import type { AttendanceSession } from '@/types/attendance'
import type { AttendanceSummary } from '@/utils/attendance'

interface AttendanceHeaderProps {
  schedule: Schedule
  session: AttendanceSession
  summary: AttendanceSummary
  onBulkAction: (action: 'present' | 'absent' | 'clear') => void
  onToggleLock: () => Promise<void>
  onGeneratePost: () => void
  isSaving: boolean
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
  schedule,
  session,
  summary,
  onBulkAction,
  onToggleLock,
  onGeneratePost,
  isSaving,
}) => {
  return (
    <div className="space-y-6">
      {/* Session details & Lock indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg border border-gray-800 bg-gray-950/40">
        <div>
          <div className="flex items-center space-x-2 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">{schedule.title}</h1>
            <span className={`inline-block px-2 py-0.5 rounded text-xxs font-bold uppercase border ${
              session.locked
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-green-500/10 border-green-500/20 text-green-400'
            }`}>
              {session.locked ? 'Finalized & Locked' : 'Open / Unlocked'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {schedule.date} • {schedule.startTime} - {schedule.endTime}
          </p>
          {session.locked && session.finalizedBy && (
            <p className="text-xxs text-gray-500 mt-0.5">
              Finalized by: {session.finalizedBy}
            </p>
          )}
        </div>

        {/* Lock/Unlock trigger */}
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          {session.locked && (
            <button
              onClick={onGeneratePost}
              className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors w-full md:w-auto"
            >
              Generate Community Post
            </button>
          )}
          <button
            onClick={onToggleLock}
            disabled={isSaving}
            className={`rounded px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 w-full md:w-auto ${
              session.locked
                ? 'border border-gray-800 bg-gray-950 hover:bg-gray-900 text-gray-400 hover:text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {session.locked ? 'Unlock Attendance Session' : 'Finalize & Lock Session'}
          </button>
        </div>
      </div>

      {/* Live summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Total assigned */}
        <div className="p-4 rounded border border-gray-850 bg-gray-950/20 text-center">
          <span className="block text-xxs font-semibold uppercase tracking-wider text-gray-400">Total Assigned</span>
          <span className="text-xl font-bold text-white mt-1 block">{summary.total}</span>
        </div>

        {/* Present */}
        <div className="p-4 rounded border border-green-950 bg-green-950/5 text-center">
          <span className="block text-xxs font-semibold uppercase tracking-wider text-green-400">Present</span>
          <span className="text-xl font-bold text-green-500 mt-1 block">{summary.present}</span>
        </div>

        {/* Late */}
        <div className="p-4 rounded border border-yellow-950 bg-yellow-950/5 text-center">
          <span className="block text-xxs font-semibold uppercase tracking-wider text-yellow-400">Late</span>
          <span className="text-xl font-bold text-yellow-500 mt-1 block">{summary.late}</span>
        </div>

        {/* Absent */}
        <div className="p-4 rounded border border-red-950 bg-red-950/5 text-center">
          <span className="block text-xxs font-semibold uppercase tracking-wider text-red-400">Absent</span>
          <span className="text-xl font-bold text-red-500 mt-1 block">{summary.absent}</span>
        </div>

        {/* Excused */}
        <div className="p-4 rounded border border-gray-800 bg-gray-950/10 text-center col-span-2 sm:col-span-1">
          <span className="block text-xxs font-semibold uppercase tracking-wider text-gray-400">Excused</span>
          <span className="text-xl font-bold text-gray-300 mt-1 block">{summary.excused}</span>
        </div>
      </div>

      {/* Bulk actions menu (only available if unlocked) */}
      {!session.locked && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-semibold mr-1">Bulk Actions:</span>
          <button
            onClick={() => onBulkAction('present')}
            disabled={isSaving || summary.total === 0}
            className="rounded border border-gray-850 bg-gray-950 hover:bg-gray-900 px-3 py-1.5 text-xxs font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
          >
            Mark All Present
          </button>
          <button
            onClick={() => onBulkAction('absent')}
            disabled={isSaving || summary.total === 0}
            className="rounded border border-gray-850 bg-gray-950 hover:bg-gray-900 px-3 py-1.5 text-xxs font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            Mark All Absent
          </button>
          <button
            onClick={() => onBulkAction('clear')}
            disabled={isSaving || summary.total === 0}
            className="rounded border border-gray-850 bg-gray-950 hover:bg-gray-900 px-3 py-1.5 text-xxs font-semibold text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Clear All Statuses
          </button>
        </div>
      )}
    </div>
  )
}
