import React from 'react'
import type { OverallSummary } from '@/services/reportService'

interface SummaryCardsProps {
  summary: OverallSummary
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Attendance rate card */}
      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 text-center shadow-sm">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-600">Attendance Rate</span>
        <span className="text-2xl font-bold text-blue-700 mt-1 block">
          {summary.total > 0 ? `${summary.rate}%` : '0%'}
        </span>
      </div>

      {/* Present count */}
      <div className="p-4 rounded-xl border border-green-100 bg-green-50 text-center shadow-sm">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-green-600">Total Present</span>
        <span className="text-2xl font-bold text-green-700 mt-1 block">{summary.present}</span>
      </div>

      {/* Late count */}
      <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50 text-center shadow-sm">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-yellow-600">Total Late</span>
        <span className="text-2xl font-bold text-yellow-700 mt-1 block">{summary.late}</span>
      </div>

      {/* Absent count */}
      <div className="p-4 rounded-xl border border-red-100 bg-red-50 text-center shadow-sm">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-red-600">Total Absent</span>
        <span className="text-2xl font-bold text-red-700 mt-1 block">{summary.absent}</span>
      </div>

      {/* Excused count */}
      <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-center col-span-2 sm:col-span-1 shadow-sm">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Total Excused</span>
        <span className="text-2xl font-bold text-gray-700 mt-1 block">{summary.excused}</span>
      </div>
    </div>
  )
}
