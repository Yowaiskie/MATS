import React from 'react'
import { Link } from 'react-router-dom'
import type { Schedule } from '@/types/schedule'
import { Card } from '@/components/Card'
import { getScheduleStatus } from '@/utils/scheduleUtils'

interface ScheduleCardProps {
  schedule: Schedule
  onEdit: (schedule: Schedule) => void
  onDelete: (id: string) => Promise<void>
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

  const statusColors = {
    upcoming: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    ongoing: 'bg-green-500/10 border-green-500/20 text-green-400',
    completed: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
    cancelled: 'bg-red-500/10 border-red-500/20 text-red-400',
  }

  return (
    <Card className="hover:border-gray-700 transition-colors">
      <div className="flex flex-col h-full justify-between space-y-4">
        {/* Header Title & Status */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-white leading-tight truncate max-w-[80%]" title={schedule.title}>
              {schedule.title}
            </h4>
            <span className={`inline-block px-1.5 py-0.5 rounded text-xxs font-bold uppercase border ${statusColors[computedStatus]}`}>
              {computedStatus}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {schedule.date} • {schedule.startTime} - {schedule.endTime}
          </p>
        </div>

        {/* Assigned Counter */}
        <div className="flex items-center justify-between py-2 border-y border-gray-900 text-xs">
          <span className="text-gray-400">Assigned Servers:</span>
          <span className="font-bold text-white">{totalAssigned}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 justify-end pt-1 flex-wrap">
          {/* Take Attendance Link */}
          {(computedStatus === 'ongoing' || computedStatus === 'completed') && (
            <Link
              to={`/attendance?scheduleId=${schedule.id}`}
              className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xxs font-semibold text-white transition-colors"
            >
              Take Attendance
            </Link>
          )}

          {/* Manage Assignments */}
          <button
            onClick={() => onManageAssignments(schedule)}
            className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-3 py-1.5 text-xxs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Assign Servers
          </button>

          {/* Edit Button */}
          <button
            onClick={() => onEdit(schedule)}
            className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-2 py-1.5 text-xxs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Edit
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(schedule.id)}
            className="rounded border border-red-950 bg-red-950/10 hover:bg-red-950/20 px-2 py-1.5 text-xxs font-semibold text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </Card>
  )
}
