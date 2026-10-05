import React, { useState, useMemo, useEffect } from 'react'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'
import { excuseService } from '@/services/excuseService'
import { 
  formatTime12Hour, 
  formatScheduleDateWithDay,
  isSundayOrAnticipatedMass,
  isHolyHourSchedule,
  isMeetingSchedule
} from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'

interface FileMemberExcuseModalProps {
  isOpen: boolean
  onClose: () => void
  members: Member[]
  schedules: Schedule[]
  onSuccess: () => void
  defaultOrderScope?: string
  canDirectlyApprove: boolean
}

const REASON_PRESETS = [
  'Illness / Medical Reason',
  'Family Emergency / Gathering',
  'School / Academic Conflict',
  'Personal / Out of Town',
  'Transportation Issue'
]

export const FileMemberExcuseModal: React.FC<FileMemberExcuseModalProps> = ({
  isOpen,
  onClose,
  members,
  schedules,
  onSuccess,
  defaultOrderScope,
  canDirectlyApprove
}) => {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('')
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false)

  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [showAllParishSchedules, setShowAllParishSchedules] = useState<boolean>(false)
  const [reason, setReason] = useState<string>('')
  const [directlyApprove, setDirectlyApprove] = useState<boolean>(canDirectlyApprove)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMemberId('')
      setMemberSearchQuery('')
      setIsPickerOpen(false)
      setSelectedScheduleIds(new Set())
      setShowAllParishSchedules(false)
      setReason('')
      setDirectlyApprove(canDirectlyApprove)
      setSubmitting(false)
    }
  }, [isOpen, canDirectlyApprove])

  // Filter members based on order scope if Order Leader
  const scopedMembers = useMemo(() => {
    let list = members.filter(m => m.status === 'active')
    if (defaultOrderScope) {
      list = list.filter(m => m.order === defaultOrderScope)
    }
    return list.sort((a, b) => {
      const lastA = (a.lastName || '').toLowerCase()
      const lastB = (b.lastName || '').toLowerCase()
      if (lastA !== lastB) return lastA.localeCompare(lastB)
      return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase())
    })
  }, [members, defaultOrderScope])

  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return scopedMembers
    const q = memberSearchQuery.toLowerCase().trim()
    return scopedMembers.filter(m => {
      const fn = `${m.firstName} ${m.lastName}`.toLowerCase()
      const rev = `${m.lastName}, ${m.firstName}`.toLowerCase()
      const ord = (m.order || '').toLowerCase()
      const rnk = (m.rank || '').toLowerCase()
      return fn.includes(q) || rev.includes(q) || ord.includes(q) || rnk.includes(q)
    })
  }, [scopedMembers, memberSearchQuery])

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId)
  }, [members, selectedMemberId])

  // Filter & categorize upcoming schedules
  const categorizedSchedules = useMemo(() => {
    if (!selectedMemberId && !showAllParishSchedules) {
      return {
        sundays: [],
        weekdays: [],
        holyHours: [],
        baptisms: [],
        meetings: [],
        total: 0
      }
    }

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const activeSchedules = schedules.filter(s => {
      if (s.status === 'cancelled') return false
      if (!s.date || s.date < todayStr) return false
      if (!showAllParishSchedules) {
        return s.assignedMembers?.includes(selectedMemberId)
      }
      return true
    }).sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '')
      if (dateComp !== 0) return dateComp
      return (a.startTime || '').localeCompare(b.startTime || '')
    })

    const sundays: Schedule[] = []
    const weekdays: Schedule[] = []
    const holyHours: Schedule[] = []
    const baptisms: Schedule[] = []
    const meetings: Schedule[] = []

    activeSchedules.forEach(s => {
      const titleLower = (s.title || '').toLowerCase()
      const isBaptism = (s.category as string) === 'binyag' || titleLower.includes('binyag') || titleLower.includes('baptism')

      if (isHolyHourSchedule(s.title)) {
        holyHours.push(s)
      } else if (isMeetingSchedule(s.title)) {
        meetings.push(s)
      } else if (isBaptism) {
        baptisms.push(s)
      } else if (isSundayOrAnticipatedMass(s.title, s.date, s.startTime)) {
        sundays.push(s)
      } else {
        weekdays.push(s)
      }
    })

    return {
      sundays,
      weekdays,
      holyHours,
      baptisms,
      meetings,
      total: activeSchedules.length
    }
  }, [schedules, selectedMemberId, showAllParishSchedules])

  const toggleSchedule = (id: string) => {
    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllSchedules = () => {
    const allIds = new Set<string>()
    const { sundays, weekdays, holyHours, baptisms, meetings } = categorizedSchedules
    ;[...sundays, ...weekdays, ...holyHours, ...baptisms, ...meetings].forEach(s => allIds.add(s.id))
    setSelectedScheduleIds(allIds)
  }

  const clearSelectedSchedules = () => {
    setSelectedScheduleIds(new Set())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedMemberId || !selectedMember) {
      toast.error('Validation Error', 'Please select an altar server.')
      return
    }

    if (selectedScheduleIds.size === 0) {
      toast.error('Validation Error', 'Please select at least one schedule to excuse.')
      return
    }

    if (!reason.trim()) {
      toast.error('Validation Error', 'Please provide a reason for the excuse.')
      return
    }

    setSubmitting(true)
    try {
      const officerUid = profile?.uid || user?.uid || 'officer'
      const officerName = profile?.displayName || user?.email || 'Ministry Officer'
      const shouldApprove = canDirectlyApprove && directlyApprove

      const result = await excuseService.fileOfficerExcuseRequest({
        memberId: selectedMember.id,
        memberName: getFullName(selectedMember),
        memberOrder: selectedMember.order,
        memberRank: selectedMember.rank,
        schedules: Array.from(selectedScheduleIds),
        reason: reason.trim(),
        directlyApprove: shouldApprove,
        officerUid,
        officerName
      })

      if (result.approved) {
        toast.success(
          'Excuse Filed & Approved',
          `Excuse for ${getFullName(selectedMember)} has been recorded and marked as Approved (${result.trackingNumber}).`
        )
      } else {
        toast.success(
          'Excuse Request Submitted',
          `Excuse request for ${getFullName(selectedMember)} submitted for review (${result.trackingNumber}).`
        )
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Submission Failed', err.message || 'Failed to file excuse request.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderScheduleCard = (s: Schedule) => {
    const isSelected = selectedScheduleIds.has(s.id)
    const formattedDate = formatScheduleDateWithDay(s.date)
    const formattedTime = s.startTime ? (
      s.endTime
        ? `${formatTime12Hour(s.startTime)} - ${formatTime12Hour(s.endTime)}`
        : formatTime12Hour(s.startTime)
    ) : ''

    return (
      <label
        key={s.id}
        className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
          isSelected
            ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
            : 'border-slate-200 hover:bg-slate-50 bg-white'
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSchedule(s.id)}
          className="mt-1 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-xs font-black text-slate-900 truncate">{s.title || 'Church Service'}</span>
            {formattedTime && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60 shrink-0">
                {formattedTime}
              </span>
            )}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {formattedDate}
          </div>
        </div>
      </label>
    )
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="File Member Excuse Request"
      maxWidth="4xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 w-full [&>button]:w-full [&>button]:sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            size="default"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="default"
            loading={submitting}
            disabled={submitting || !selectedMemberId || selectedScheduleIds.size === 0 || !reason.trim()}
            onClick={handleSubmit}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            {canDirectlyApprove && directlyApprove ? 'File & Approve Excuse' : 'Submit Excuse Request'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 font-sans">
        {/* Order Scope Notice if Order Leader */}
        {defaultOrderScope && (
          <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-900">
              Order Scoping Active: <span className="underline">{defaultOrderScope}</span>
            </span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg">
              Leader View
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN: Server Selection & Schedules */}
          <div className="space-y-5">
            {/* Step 1: Member Picker */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-600 tracking-wider mb-2">
                1. Select Altar Server *
              </label>

              {!isPickerOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsPickerOpen(true)
                    setMemberSearchQuery('')
                  }}
                  className={`w-full p-3.5 border rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    selectedMemberId
                      ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-600'
                  }`}
                >
                  {selectedMember ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div>
                        <span className="block text-xs font-black text-slate-900">
                          {getFullName(selectedMember)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {selectedMember.order && (
                            <span className="text-[10px] text-indigo-700 font-bold">
                              {selectedMember.order}
                            </span>
                          )}
                          {selectedMember.rank && (
                            <span className="text-[10px] text-slate-500 font-semibold">
                              • {selectedMember.rank}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shadow-2xs shrink-0">
                        Change
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-slate-500">
                        Click to search / pick server...
                      </span>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </button>
              ) : (
                <div className="p-3 bg-white border-2 border-indigo-500 rounded-2xl shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-xs font-black text-slate-900">Search Server</span>
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(false)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={memberSearchQuery}
                    onChange={e => setMemberSearchQuery(e.target.value)}
                    placeholder="Search by name, rank, or order..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                  />
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 italic">
                        No active members found.
                      </div>
                    ) : (
                      filteredMembers.map(m => {
                        const isSel = selectedMemberId === m.id
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedMemberId(m.id)
                              setIsPickerOpen(false)
                              setSelectedScheduleIds(new Set())
                            }}
                            className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all ${
                              isSel
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-2xs'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">{getFullName(m)}</div>
                              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                                {m.order && <span className="text-indigo-600 font-semibold">{m.order}</span>}
                                {m.rank && <span>• {m.rank}</span>}
                              </div>
                            </div>
                            {isSel && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Categorized Upcoming Schedules */}
            <div>
              <div className="flex items-center justify-between pb-1.5 flex-wrap gap-2">
                <label className="block text-xs font-black uppercase text-slate-600 tracking-wider">
                  2. Select Assigned Schedules ({selectedScheduleIds.size}) *
                </label>
                {selectedMemberId && categorizedSchedules.total > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllSchedules}
                      className="text-[11px] font-extrabold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={clearSelectedSchedules}
                      className="text-[11px] font-extrabold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Toggle to show all parish schedules */}
              {selectedMemberId && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-3 text-xs">
                  <span className="font-semibold text-slate-700">
                    {showAllParishSchedules ? 'Showing all church schedules' : 'Showing assigned schedules only'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllParishSchedules(prev => !prev)}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {showAllParishSchedules ? 'Show Assigned Only' : 'Show All Schedules'}
                  </button>
                </div>
              )}

              {!selectedMemberId ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
                  Select an altar server above to view their scheduled assignments.
                </div>
              ) : categorizedSchedules.total === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-2">
                  <p className="font-bold">No upcoming assigned schedules found for this server.</p>
                  <p className="text-[11px] text-slate-400">
                    Click "Show All Schedules" above if you need to excuse from a general schedule.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {/* Sunday & Anticipated Masses */}
                  {categorizedSchedules.sundays.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        <span>Sunday & Anticipated Masses ({categorizedSchedules.sundays.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {categorizedSchedules.sundays.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}

                  {/* Weekday Masses */}
                  {categorizedSchedules.weekdays.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span>Weekday Masses ({categorizedSchedules.weekdays.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {categorizedSchedules.weekdays.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}

                  {/* Holy Hour & Adoration */}
                  {categorizedSchedules.holyHours.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                        <span>Holy Hour & Adoration ({categorizedSchedules.holyHours.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {categorizedSchedules.holyHours.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}

                  {/* Baptisms */}
                  {categorizedSchedules.baptisms.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase text-cyan-700 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-600" />
                        <span>Baptisms / Binyag ({categorizedSchedules.baptisms.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {categorizedSchedules.baptisms.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}

                  {/* Meetings & Practices */}
                  {categorizedSchedules.meetings.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        <span>Meetings, Formation & Practices ({categorizedSchedules.meetings.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {categorizedSchedules.meetings.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Reason, Officer Channel & Approval Mode */}
          <div className="space-y-5">
            {/* Step 3: Quick Reason Pills & Text Area */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-600 tracking-wider mb-2">
                3. Reason for Absence *
              </label>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {REASON_PRESETS.map((p) => {
                  const isActive = reason === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReason(p)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="State the server's specific reason for filing an excuse..."
                className="w-full p-3 border border-slate-300 rounded-2xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 shadow-2xs"
                required
              />
            </div>

            {/* Step 4: Approval Mode */}
            <div className="pt-2">
              <label className="block text-xs font-black uppercase text-slate-600 tracking-wider mb-2">
                4. Approval Status
              </label>

              {canDirectlyApprove ? (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900">Directly Approve & Sync Attendance</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Automatically marks the excuse as approved and tags attendance records as Excused.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                      <input
                        type="checkbox"
                        checked={directlyApprove}
                        onChange={e => setDirectlyApprove(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                  {!directlyApprove && (
                    <p className="text-[11px] font-bold text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                      Note: This excuse will be submitted as Pending Review for formal evaluation.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs space-y-1">
                  <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Read / File Permission Level</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                    Your account has permission to log and monitor excuses. This request will be submitted to the <strong>Pending Review</strong> queue for Coordinator or Administrator approval.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
