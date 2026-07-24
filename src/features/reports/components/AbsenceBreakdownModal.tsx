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

  const [activeTab, setActiveTab] = React.useState<'missed' | 'otherServer'>('missed')
  const missedCount = memberRow.missedSchedules.length
  const otherServerCount = memberRow.otherServerCount || 0
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

  const activeSchedules = activeTab === 'missed' ? memberRow.missedSchedules : memberRow.otherServerSchedules || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 font-sans overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">{memberRow.name}</h3>
              <p className="text-[11px] text-gray-500 font-medium">Rank: {memberRow.rank} • Attendance Breakdown</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors">✕</button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 my-3 pr-1 space-y-3">
          {/* Policy & Status Summary Banner */}
          <div className="p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/80 border-gray-200">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Evaluation Policy</div>
              <p className="text-[11px] text-gray-700 font-medium mt-0.5">
                Warning @ <strong className="text-amber-700">{warningThreshold}</strong> • Suspension @ <strong className="text-red-700">{suspensionThreshold} Absences</strong>
                {policy && (
                  <span className="text-gray-500"> ({policyDayLabel}, {policy.evaluationMonths === 0 ? 'All Time' : `${policy.evaluationMonths}mo`})</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 ${
                memberRow.warningStatus === 'suspended'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : memberRow.warningStatus === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : memberRow.warningStatus === 'inactive'
                  ? 'bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {memberRow.warningStatus === 'suspended' ? (
                  <>
                    <svg className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Suspended</span>
                  </>
                ) : memberRow.warningStatus === 'warning' ? (
                  <>
                    <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Warning</span>
                  </>
                ) : memberRow.warningStatus === 'inactive' ? (
                  <>
                    <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                    </svg>
                    <span>Inactive</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Active</span>
                  </>
                )}
              </span>
              {/* Per-category absence counts */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">
                  Sun: {memberRow.sundayAbsences}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 border border-teal-200 text-teal-700">
                  Wkday: {memberRow.weekdayAbsences}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 border border-purple-200 text-purple-700">
                  Mtg: {memberRow.meetingAbsences}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                  Other Server: {otherServerCount}
                </span>
              </div>
            </div>
          </div>

          {/* Inactive Status Banner */}
          {memberRow.warningStatus === 'inactive' && (
            <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-100 text-slate-800 text-[11px] flex items-start gap-2">
              <svg className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong className="font-semibold">Inactive Status:</strong> This member has 0 serves (0% Attendance Rate) in the evaluated period and is marked Inactive.
              </div>
            </div>
          )}

          {/* Other Server Consideration Banner */}
          {otherServerCount > 0 && (
            <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-900 text-[11px] flex items-start gap-2">
              <svg className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong className="font-semibold">Leniency Context:</strong> This member has <strong>{otherServerCount} extra service(s) logged as Other Server</strong>. Admins may consider these additional services for leniency.
              </div>
            </div>
          )}

          {/* Tab Selection */}
          <div className="flex border-b border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('missed')}
              className={`pb-1.5 px-3 border-b-2 transition-colors cursor-pointer text-xs ${
                activeTab === 'missed'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Missed Schedules ({missedCount})
            </button>
            <button
              onClick={() => setActiveTab('otherServer')}
              className={`pb-1.5 px-3 border-b-2 transition-colors cursor-pointer text-xs ${
                activeTab === 'otherServer'
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Other Server Services ({otherServerCount})
            </button>
          </div>

          {/* Schedules Table */}
          <div className="border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="max-h-48 sm:max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2">Schedule Date</th>
                    <th className="px-3 py-2">Service / Meeting Title</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2 text-right">Category</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {activeSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-400 italic">
                        {activeTab === 'missed'
                          ? 'No recorded absences for this member within evaluation period.'
                          : 'No records as Other Server for this member within evaluation period.'}
                      </td>
                    </tr>
                  ) : (
                    activeSchedules.map((item, idx) => (
                      <tr key={`${item.scheduleId}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap text-[11px]">
                          {item.date}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap text-[11px]">
                          {item.title}
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-[10px] whitespace-nowrap">
                          {item.startTime ? `${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}` : '--'}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2.5 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
