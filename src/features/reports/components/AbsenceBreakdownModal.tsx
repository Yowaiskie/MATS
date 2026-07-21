import React from 'react'
import type { MemberReportRow } from '@/services/reportService'
import type { SuspensionPolicySettings } from '@/services/settingsService'

interface AbsenceBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  memberRow: MemberReportRow | null
  policy: SuspensionPolicySettings | null
}

export const AbsenceBreakdownModal: React.FC<AbsenceBreakdownModalProps> = ({
  isOpen,
  onClose,
  memberRow,
  policy,
}) => {
  if (!isOpen || !memberRow) return null

  const formatTime12 = (timeStr: string): string => {
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

  const missedCount = memberRow.missedSchedules.length
  const warningThreshold = policy?.warningAbsenceThreshold ?? 2
  const suspensionThreshold = policy?.suspensionAbsenceThreshold ?? 3
  const policyDayLabel = policy
    ? [
        policy.includeSundays && 'Sundays',
        policy.includeWeekdays && 'Weekdays',
        policy.includeMeetings && 'Meetings',
      ]
        .filter(Boolean)
        .join(', ') || 'No Days'
    : 'Configured Days'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900">{memberRow.name}</h3>
              <p className="text-xs text-gray-500 font-medium">Rank: {memberRow.rank} • Absences Breakdown</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cursor-pointer">✕</button>
        </div>

        {/* Policy & Status Summary Banner */}
        <div className="my-4 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/80 border-gray-200">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Current Evaluation Policy</div>
            <p className="text-xs text-gray-700 font-medium mt-0.5">
              Warning at <strong className="text-amber-700">{warningThreshold} Absences</strong> • Suspension at <strong className="text-red-700">{suspensionThreshold} Absences</strong>
              {policy && (
                <span className="text-gray-500"> ({policyDayLabel}, {policy.evaluationMonths === 0 ? 'All Time' : `${policy.evaluationMonths} Month(s)`})</span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
              memberRow.warningStatus === 'suspended'
                ? 'bg-red-50 border-red-200 text-red-700'
                : memberRow.warningStatus === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {memberRow.warningStatus === 'suspended' ? (
                <>
                  <svg className="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Suspended</span>
                </>
              ) : memberRow.warningStatus === 'warning' ? (
                <>
                  <svg className="h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Warning for Suspension</span>
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Active</span>
                </>
              )}
            </span>
            {/* Per-category absence counts */}
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                Sunday: {memberRow.sundayAbsences}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 border border-teal-200 text-teal-700">
                Weekday: {memberRow.weekdayAbsences}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 border border-purple-200 text-purple-700">
                Meeting: {memberRow.meetingAbsences}
              </span>
            </div>
          </div>
        </div>

        {/* Missed Schedules Table */}
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase tracking-wider text-[10px] font-bold sticky top-0">
              <tr>
                <th className="px-4 py-3">Schedule Date</th>
                <th className="px-4 py-3">Service / Meeting Title</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3 text-right">Category</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {missedCount === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                    No recorded absences for this member within evaluation period.
                  </td>
                </tr>
              ) : (
                memberRow.missedSchedules.map((item, idx) => (
                  <tr key={`${item.scheduleId}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                      {item.startTime ? `${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        item.isMeeting
                          ? 'bg-purple-50 border-purple-200 text-purple-700'
                          : item.isSunday
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-gray-100 border-gray-200 text-gray-700'
                      }`}>
                        {item.isMeeting ? 'Meeting' : item.isSunday ? 'Sunday Mass' : 'Weekday Mass'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
