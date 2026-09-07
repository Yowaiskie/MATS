import React, { useState } from 'react'
import type { MemberReportRow } from '@/services/reportService'
import type { SuspensionPolicySettings } from '@/services/settingsService'
import { memberService } from '@/services/memberService'
import { AlertModal } from '@/components/Dialog'

interface AbsenceBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  memberRow: MemberReportRow | null
  policy: SuspensionPolicySettings | null
  onMemberUpdated?: () => void
}

export const AbsenceBreakdownModal: React.FC<AbsenceBreakdownModalProps> = ({
  isOpen,
  onClose,
  memberRow,
  policy,
  onMemberUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'missed' | 'otherServer'>('missed')
  const [isLifting, setIsLifting] = useState(false)
  const [showConfirmLift, setShowConfirmLift] = useState(false)
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null)

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

  const handleLiftSuspension = async () => {
    setIsLifting(true)
    setShowConfirmLift(false)
    try {
      await memberService.updateMember(memberRow.memberId, { status: 'active' })
      setAlertInfo({
        title: 'Suspension Lifted',
        message: `Bro. ${memberRow.name}'s status has been successfully restored to Active.`,
        variant: 'success'
      })
      onMemberUpdated?.()
    } catch (err: any) {
      console.error(err)
      setAlertInfo({
        title: 'Failed to Lift Suspension',
        message: err.message || 'An unexpected error occurred while updating member status.',
        variant: 'error'
      })
    } finally {
      setIsLifting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 font-sans overflow-y-auto animate-in fade-in duration-200">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

        {/* Modal Container */}
        <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                  Attendance Audit
                </span>
                <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">{memberRow.name}</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Rank: {memberRow.rank} • Detailed Record Audit</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded-xl hover:bg-slate-100 transition-colors focus:outline-none">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

            {/* Suspension Management Banner */}
            {memberRow.warningStatus === 'suspended' && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50/70 text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-black text-red-900 uppercase tracking-wider">Suspension Clearance Status</span>
                  </div>
                  <p className="text-[11px] text-red-800 leading-relaxed font-medium">
                    {policy?.unsuspensionRequiresMeeting || policy?.unsuspensionRequiresFormation ? (
                      <>
                        Clearance Requirements:{' '}
                        {policy.unsuspensionRequiresMeeting && (
                          <span className="font-bold">Attend Monthly Meetings for {policy.unsuspensionRequiredMeetingMonths ?? policy.unsuspensionRequiredMeetingCount ?? 1} Month(s) </span>
                        )}
                        {policy.unsuspensionRequiresMeeting && policy.unsuspensionRequiresFormation && <span>&bull; </span>}
                        {policy.unsuspensionRequiresFormation && (
                          <span className="font-bold">Attend {policy.unsuspensionRequiredFormationCount ?? 1} Formation Session(s)</span>
                        )}
                      </>
                    ) : (
                      'Suspension in effect. An administrator can manually lift this suspension to restore scheduling privileges.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmLift(true)}
                  disabled={isLifting}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{isLifting ? 'Lifting...' : 'Lift Suspension'}</span>
                </button>
              </div>
            )}

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
          <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0 bg-white sticky bottom-0">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmLift && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowConfirmLift(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl z-10 border border-slate-200">
            <h3 className="text-base font-black text-slate-900 mb-2">Confirm Lift Suspension</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Are you sure you want to lift the suspension for <strong>Bro. {memberRow.name}</strong>? Their status will be restored to <strong>Active</strong> and they will be eligible for scheduling.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmLift(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLiftSuspension}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Confirm & Lift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={!!alertInfo}
        onClose={() => {
          setAlertInfo(null)
          if (alertInfo?.variant === 'success') {
            onClose()
          }
        }}
        variant={alertInfo?.variant ?? 'info'}
        title={alertInfo?.title ?? ''}
        message={alertInfo?.message ?? ''}
      />
    </>
  )
}

