import React from 'react'
import type { OverallSummary } from '@/services/reportService'

interface SummaryCardsProps {
  summary: OverallSummary
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {/* Attendance rate card */}
      <div className="p-4 rounded border border-indigo-950 bg-indigo-950/5 text-center">
        <span className="block text-xxs font-semibold uppercase tracking-wider text-indigo-400">Attendance Rate</span>
        <span className="text-xl font-bold text-white mt-1 block">
          {summary.total > 0 ? `${summary.rate}%` : '0%'}
        </span>
      </div>

      {/* Present count */}
      <div className="p-4 rounded border border-green-950 bg-green-950/5 text-center">
        <span className="block text-xxs font-semibold uppercase tracking-wider text-green-400">Total Present</span>
        <span className="text-xl font-bold text-green-500 mt-1 block">{summary.present}</span>
      </div>

      {/* Late count */}
      <div className="p-4 rounded border border-yellow-950 bg-yellow-950/5 text-center">
        <span className="block text-xxs font-semibold uppercase tracking-wider text-yellow-400">Total Late</span>
        <span className="text-xl font-bold text-yellow-500 mt-1 block">{summary.late}</span>
      </div>

      {/* Absent count */}
      <div className="p-4 rounded border border-red-950 bg-red-950/5 text-center">
        <span className="block text-xxs font-semibold uppercase tracking-wider text-red-400">Total Absent</span>
        <span className="text-xl font-bold text-red-500 mt-1 block">{summary.absent}</span>
      </div>

      {/* Excused count */}
      <div className="p-4 rounded border border-gray-800 bg-gray-950/10 text-center col-span-2 sm:col-span-1">
        <span className="block text-xxs font-semibold uppercase tracking-wider text-gray-400">Total Excused</span>
        <span className="text-xl font-bold text-gray-300 mt-1 block">{summary.excused}</span>
      </div>
    </div>
  )
}
