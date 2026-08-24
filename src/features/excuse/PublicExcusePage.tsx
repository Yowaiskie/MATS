import React, { useState, useEffect, useMemo } from 'react'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import { excuseService } from '@/services/excuseService'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { ExcuseRequest } from '@/types/excuse'
import { AlertModal } from '@/components/Dialog'
import { formatTime12Hour } from '@/utils/scheduleUtils'

export const PublicExcusePage: React.FC = () => {
  const [mode, setMode] = useState<'submit' | 'track'>('submit')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  // Data State
  const [members, setMembers] = useState<Member[]>([])
  const [allSchedulesMap, setAllSchedulesMap] = useState<Map<string, Schedule>>(new Map())
  
  // Submit Step 1: Verification State & Member Picker
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [isSubmitPickerOpen, setIsSubmitPickerOpen] = useState(false)
  const [submitSearchQuery, setSubmitSearchQuery] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [verificationError, setVerificationError] = useState('')
  
  // Submit Step 2: Excuse Request State
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [loading, setLoading] = useState(false)

  // Track Status State & Member Picker
  const [trackMemberId, setTrackMemberId] = useState('')
  const [isTrackPickerOpen, setIsTrackPickerOpen] = useState(false)
  const [trackSearchQuery, setTrackSearchQuery] = useState('')
  const [memberExcuses, setMemberExcuses] = useState<ExcuseRequest[]>([])
  const [loadingMemberExcuses, setLoadingMemberExcuses] = useState(false)
  const [trackError, setTrackError] = useState('')

  // Dialog State
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant: 'error' | 'success' | 'info' } | null>(null)

  useEffect(() => {
    Promise.all([
      memberService.getMembers(),
      scheduleService.getSchedules()
    ]).then(([mems, scheds]) => {
      setMembers(mems.filter(m => m.status === 'active'))
      const map = new Map<string, Schedule>()
      scheds.forEach(s => map.set(s.id, s))
      setAllSchedulesMap(map)
    }).catch(err => {
      console.error('Failed to load initial data:', err)
    })
  }, [])

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const lastA = (a.lastName || '').toLowerCase()
      const lastB = (b.lastName || '').toLowerCase()
      if (lastA !== lastB) return lastA.localeCompare(lastB)
      return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase())
    })
  }, [members])

  // Filtered members for Submit picker
  const filteredSubmitMembers = useMemo(() => {
    if (!submitSearchQuery.trim()) return sortedMembers
    const q = submitSearchQuery.toLowerCase().trim()
    return sortedMembers.filter(m => {
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase()
      const revName = `${m.lastName}, ${m.firstName}`.toLowerCase()
      const order = (m.order || '').toLowerCase()
      const rank = (m.rank || '').toLowerCase()
      return fullName.includes(q) || revName.includes(q) || order.includes(q) || rank.includes(q)
    })
  }, [sortedMembers, submitSearchQuery])

  // Filtered members for Track picker
  const filteredTrackMembers = useMemo(() => {
    if (!trackSearchQuery.trim()) return sortedMembers
    const q = trackSearchQuery.toLowerCase().trim()
    return sortedMembers.filter(m => {
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase()
      const revName = `${m.lastName}, ${m.firstName}`.toLowerCase()
      const order = (m.order || '').toLowerCase()
      const rank = (m.rank || '').toLowerCase()
      return fullName.includes(q) || revName.includes(q) || order.includes(q) || rank.includes(q)
    })
  }, [sortedMembers, trackSearchQuery])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerificationError('')
    
    const member = members.find(m => m.id === selectedMemberId)
    if (!member) {
      setVerificationError('Please select your name from the server list.')
      return
    }
    
    // Check Date of Birth matching
    if (!member.dateOfBirth) {
      setVerificationError('No Date of Birth is registered on your profile. Please contact an Administrator or Coordinator to update your profile.')
      return
    }

    if (member.dateOfBirth !== dateOfBirth) {
      setVerificationError('Date of Birth does not match our records. Please verify and try again.')
      return
    }

    // Load member's schedules and filter out already approved excuses
    setLoading(true)
    try {
      const [allSchedules, existingExcuses] = await Promise.all([
        scheduleService.getSchedules(),
        excuseService.getExcuseRequestsByMemberId(selectedMemberId)
      ])

      // Find all schedule IDs that have ALREADY been approved as excused
      const approvedScheduleIds = new Set<string>()
      existingExcuses
        .filter(ex => ex.status === 'approved')
        .forEach(ex => ex.schedules?.forEach(sId => approvedScheduleIds.add(sId)))

      // Find upcoming schedules where member is assigned AND not already approved as excused
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const upcoming = allSchedules.filter(s => {
        const isAssigned = s.assignedMembers?.includes(selectedMemberId)
        const isFuture = new Date(s.date + 'T23:59:59') >= today
        const isNotApproved = !approvedScheduleIds.has(s.id)
        const isNotCancelled = s.status !== 'cancelled'
        return isAssigned && isFuture && isNotApproved && isNotCancelled
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setSchedules(upcoming)
      setSelectedScheduleIds(new Set())
      setReason('')
      setStep(2)
    } catch (err) {
      setVerificationError('Failed to load your assigned schedules.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedScheduleIds.size === 0) {
      setAlertModal({ variant: 'error', title: 'Missing Information', message: 'Please select at least one schedule to excuse.' })
      return
    }
    if (!reason.trim()) {
      setAlertModal({ variant: 'error', title: 'Missing Information', message: 'Please state your reason for filing an excuse.' })
      return
    }

    const member = members.find(m => m.id === selectedMemberId)

    setLoading(true)
    try {
      const trackNo = await excuseService.submitExcuseRequest({
        memberId: selectedMemberId,
        memberName: member ? `${member.firstName} ${member.lastName}`.trim() : undefined,
        memberOrder: member?.order,
        memberRank: member?.rank,
        schedules: Array.from(selectedScheduleIds),
        reason: reason.trim()
      })
      setTrackingNumber(trackNo)
      setStep(3)
    } catch (err) {
      setAlertModal({ variant: 'error', title: 'Submission Failed', message: 'Failed to submit excuse request. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const toggleSchedule = (id: string) => {
    const next = new Set(selectedScheduleIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedScheduleIds(next)
  }

  // Load all excuses for selected member in Track mode
  const handleSelectTrackMember = async (mId: string) => {
    setTrackMemberId(mId)
    setTrackError('')
    setMemberExcuses([])
    if (!mId) return

    setLoadingMemberExcuses(true)
    try {
      const list = await excuseService.getExcuseRequestsByMemberId(mId)
      setMemberExcuses(list)
    } catch (err) {
      console.error(err)
      setTrackError('Failed to load excuse requests for this member.')
    } finally {
      setLoadingMemberExcuses(false)
    }
  }

  const renderScheduleInfo = (scheduleId: string) => {
    const sched = allSchedulesMap.get(scheduleId)
    if (!sched) {
      return <span className="text-xs text-slate-500 italic">Schedule #{scheduleId.substring(0, 8)}</span>
    }
    const formattedTime = sched.startTime ? (
      sched.endTime 
        ? `${formatTime12Hour(sched.startTime)} - ${formatTime12Hour(sched.endTime)}`
        : formatTime12Hour(sched.startTime)
    ) : ''

    return (
      <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
        <div className="font-bold text-slate-900">{sched.title || 'Church Service'}</div>
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-indigo-600">{sched.date}</span>
          {formattedTime && <span>• {formattedTime}</span>}
        </div>
      </div>
    )
  }

  const selectedSubmitMember = members.find(m => m.id === selectedMemberId)
  const selectedTrackMember = members.find(m => m.id === trackMemberId)

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-6 sm:p-8 border border-slate-200/80">
        <div className="flex justify-center mb-5">
          <img src="/favicon/favicon.png" alt="Logo" className="w-16 h-16 rounded-full border border-slate-200 shadow-sm object-cover" />
        </div>
        <h1 className="text-2xl font-black text-center text-slate-900 mb-1 tracking-tight">Excuse Management</h1>
        <p className="text-xs font-semibold text-center text-slate-500 mb-6">Ministry of Altar Servers • Self-Service Portal</p>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6">
          <button 
            className={`flex-1 pb-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              mode === 'submit' 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => { setMode('submit'); setStep(1); }}
          >
            File an Excuse
          </button>
          <button 
            className={`flex-1 pb-3 text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              mode === 'track' 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
            onClick={() => { 
              setMode('track'); 
              setTrackError('');
              if (selectedMemberId && !trackMemberId) {
                handleSelectTrackMember(selectedMemberId)
              }
            }}
          >
            Track Status
          </button>
        </div>

        {/* STEP 1: VERIFY IDENTITY */}
        {mode === 'submit' && step === 1 && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                1. SELECT YOUR NAME
              </label>

              <div>
                {!isSubmitPickerOpen ? (
                  /* Trigger Button / Selected Box */
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitPickerOpen(true)
                      setSubmitSearchQuery('')
                    }}
                    className={`w-full p-4 border rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                      selectedMemberId
                        ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-600'
                    }`}
                  >
                    {selectedMemberId && selectedSubmitMember ? (
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <span className="block text-xs font-black text-slate-900">
                            {selectedSubmitMember.lastName}, {selectedSubmitMember.firstName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {selectedSubmitMember.order && (
                              <span className="text-[10px] text-indigo-700 font-bold">
                                {selectedSubmitMember.order}
                              </span>
                            )}
                            {selectedSubmitMember.rank && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                • {selectedSubmitMember.rank}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs">
                          Change Name
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-slate-500">
                          Click to search / select your name...
                        </span>
                        <span className="text-xs text-slate-400 font-bold">▼</span>
                      </div>
                    )}
                  </button>
                ) : (
                  /* Expanded Picker Card with Search Input */
                  <div className="p-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-black text-slate-900">Search & Select Your Name</span>
                      <button
                        type="button"
                        onClick={() => setIsSubmitPickerOpen(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md cursor-pointer"
                      >
                        Close ✕
                      </button>
                    </div>

                    <input
                      type="text"
                      autoFocus
                      value={submitSearchQuery}
                      onChange={e => setSubmitSearchQuery(e.target.value)}
                      placeholder="Type to search name, rank, or order..."
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    />

                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {filteredSubmitMembers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          No matching active servers found.
                        </div>
                      ) : (
                        filteredSubmitMembers.map(m => {
                          const isSelected = selectedMemberId === m.id
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                setSelectedMemberId(m.id)
                                setIsSubmitPickerOpen(false)
                                setVerificationError('')
                              }}
                              className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold">{m.lastName}, {m.firstName}</div>
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                  {m.order && <span className="text-indigo-600 font-semibold">{m.order}</span>}
                                  {m.rank && <span>• {m.rank}</span>}
                                </div>
                              </div>
                              {isSelected && (
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                2. DATE OF BIRTH (SECURITY VERIFICATION)
              </label>
              <input 
                type="date" 
                value={dateOfBirth} 
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Used to verify that you are the server submitting this excuse.</p>
            </div>

            {verificationError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                {verificationError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || !selectedMemberId || !dateOfBirth} 
              className="w-full bg-indigo-600 text-white font-extrabold py-3.5 rounded-xl mt-2 hover:bg-indigo-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loading ? 'Verifying & Loading Schedules...' : 'Verify & Proceed'}
            </button>
          </form>
        )}

        {/* STEP 2: SELECT SCHEDULES & PROVIDE REASON */}
        {mode === 'submit' && step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-indigo-500 block">Server Profile</span>
                <span className="text-xs font-bold text-indigo-950">
                  {selectedSubmitMember?.firstName} {selectedSubmitMember?.lastName}
                </span>
                {selectedSubmitMember?.order && (
                  <span className="text-[10px] text-indigo-700 font-semibold block">
                    {selectedSubmitMember.order}
                  </span>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">
                Select Upcoming Schedules to Excuse *
              </label>

              {schedules.length === 0 ? (
                <div className="p-5 border border-dashed border-slate-300 rounded-2xl text-center bg-slate-50/80 space-y-1">
                  <p className="text-xs font-bold text-slate-700">No Eligible Assigned Schedules Found</p>
                  <p className="text-[11px] text-slate-500">You have no upcoming assignments, or your assignments have already been approved as excused.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {schedules.map(s => {
                    const isSelected = selectedScheduleIds.has(s.id)
                    const formattedTime = s.startTime ? (
                      s.endTime 
                        ? `${formatTime12Hour(s.startTime)} - ${formatTime12Hour(s.endTime)}` 
                        : formatTime12Hour(s.startTime)
                    ) : ''

                    return (
                      <label 
                        key={s.id} 
                        className={`flex items-start gap-3 p-3 border rounded-2xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' 
                            : 'border-slate-200 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSchedule(s.id)}
                          className="mt-1 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-extrabold text-slate-900">{s.title || 'Church Service'}</div>
                          <div className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                            {s.date} {formattedTime && `• ${formattedTime}`}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">Reason for Absence *</label>
              <textarea 
                value={reason} 
                onChange={e => setReason(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 text-slate-800 h-24 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                placeholder="State your reason for filing an excuse (e.g. Sickness, School activity, Family emergency)..."
                required
              />
            </div>

            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="w-1/3 border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition cursor-pointer text-xs"
              >
                Back
              </button>
              <button 
                type="submit" 
                disabled={loading || selectedScheduleIds.size === 0} 
                className="w-2/3 bg-indigo-600 text-white font-extrabold py-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer text-xs shadow-sm"
              >
                {loading ? 'Submitting Request...' : `Submit Excuse (${selectedScheduleIds.size} Schedule${selectedScheduleIds.size > 1 ? 's' : ''})`}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUBMISSION SUCCESS */}
        {mode === 'submit' && step === 3 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-2xs">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Excuse Submitted Successfully</h2>
              <p className="text-slate-500 text-xs mt-1">Your excuse request has been queued for Coordinator/Admin review.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tracking Reference Number</span>
              <span className="block text-xl font-black tracking-widest text-indigo-600 select-all font-mono">{trackingNumber}</span>
              <p className="text-[10px] text-slate-500 pt-1">You can track your status anytime by selecting your name in the <strong>Track Status</strong> tab.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button 
                onClick={() => {
                  setMode('track');
                  handleSelectTrackMember(selectedMemberId);
                }} 
                className="flex-1 bg-indigo-600 text-white text-xs font-bold py-3 rounded-xl hover:bg-indigo-700 transition cursor-pointer"
              >
                View Status Now
              </button>
              <button 
                onClick={() => {
                  setSelectedScheduleIds(new Set());
                  setReason('');
                  setStep(1);
                }} 
                className="flex-1 border border-slate-300 text-slate-700 text-xs font-bold py-3 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                File Another Request
              </button>
            </div>
          </div>
        )}

        {/* MODE: TRACK STATUS */}
        {mode === 'track' && (
          <div className="space-y-5">
            {/* MEMBER PICKER FOR TRACK STATUS */}
            <div className="space-y-2">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                SELECT YOUR NAME TO VIEW EXCUSE STATUS
              </label>

              <div>
                {!isTrackPickerOpen ? (
                  /* Trigger Button / Selected Box */
                  <button
                    type="button"
                    onClick={() => {
                      setIsTrackPickerOpen(true)
                      setTrackSearchQuery('')
                    }}
                    className={`w-full p-4 border rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                      trackMemberId
                        ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-600'
                    }`}
                  >
                    {trackMemberId && selectedTrackMember ? (
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <span className="block text-xs font-black text-slate-900">
                            {selectedTrackMember.lastName}, {selectedTrackMember.firstName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {selectedTrackMember.order && (
                              <span className="text-[10px] text-indigo-700 font-bold">
                                {selectedTrackMember.order}
                              </span>
                            )}
                            {selectedTrackMember.rank && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                • {selectedTrackMember.rank}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs">
                          Change Name
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-slate-500">
                          Click to search / select your name...
                        </span>
                        <span className="text-xs text-slate-400 font-bold">▼</span>
                      </div>
                    )}
                  </button>
                ) : (
                  /* Expanded Picker Card with Search Input */
                  <div className="p-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-black text-slate-900">Search & Select Your Name</span>
                      <button
                        type="button"
                        onClick={() => setIsTrackPickerOpen(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md cursor-pointer"
                      >
                        Close ✕
                      </button>
                    </div>

                    <input
                      type="text"
                      autoFocus
                      value={trackSearchQuery}
                      onChange={e => setTrackSearchQuery(e.target.value)}
                      placeholder="Type to search name, rank, or order..."
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    />

                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {filteredTrackMembers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          No matching active servers found.
                        </div>
                      ) : (
                        filteredTrackMembers.map(m => {
                          const isSelected = trackMemberId === m.id
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                setIsTrackPickerOpen(false)
                                handleSelectTrackMember(m.id)
                              }}
                              className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold">{m.lastName}, {m.firstName}</div>
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                  {m.order && <span className="text-indigo-600 font-semibold">{m.order}</span>}
                                  {m.rank && <span>• {m.rank}</span>}
                                </div>
                              </div>
                              {isSelected && (
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {loadingMemberExcuses && (
              <div className="p-8 text-center text-xs font-bold text-slate-500">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2"></div>
                <div>Loading your excuse requests...</div>
              </div>
            )}

            {trackError && <p className="text-red-500 text-xs font-bold">{trackError}</p>}

            {!loadingMemberExcuses && trackMemberId && memberExcuses.length === 0 && (
              <div className="p-6 border border-dashed border-slate-300 rounded-2xl text-center bg-slate-50/80 space-y-1">
                <p className="text-xs font-bold text-slate-700">No Excuse Requests Found</p>
                <p className="text-[11px] text-slate-500">No excuse requests have been filed under this member account yet.</p>
              </div>
            )}

            {!loadingMemberExcuses && memberExcuses.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Found {memberExcuses.length} Excuse Request{memberExcuses.length > 1 ? 's' : ''}
                </div>

                {memberExcuses.map(excuse => {
                  const isApproved = excuse.status === 'approved'
                  const isRejected = excuse.status === 'rejected'

                  return (
                    <div key={excuse.id || excuse.trackingNumber} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-mono text-xs font-black text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                          {excuse.trackingNumber}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isApproved ? '✓ Approved' : isRejected ? '✕ Rejected' : '🟡 Pending Review'}
                        </span>
                      </div>

                      {/* Schedules List */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Excused Schedule(s)</span>
                        <div className="space-y-1.5">
                          {excuse.schedules?.map(sId => (
                            <div key={sId}>{renderScheduleInfo(sId)}</div>
                          ))}
                        </div>
                      </div>

                      {/* Reason */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Your Reason</span>
                        <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80">{excuse.reason}</p>
                      </div>

                      {/* Feedback / Remarks */}
                      {isRejected && excuse.rejectionReason && (
                        <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs text-rose-800 space-y-0.5">
                          <span className="font-bold text-[10px] uppercase tracking-wider block text-rose-900">Coordinator/Admin Feedback:</span>
                          <p>{excuse.rejectionReason}</p>
                        </div>
                      )}

                      {isApproved && excuse.adminRemarks && (
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs text-emerald-800 space-y-0.5">
                          <span className="font-bold text-[10px] uppercase tracking-wider block text-emerald-900">Coordinator/Admin Remarks:</span>
                          <p>{excuse.adminRemarks}</p>
                        </div>
                      )}

                      {excuse.reviewedByName && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          Reviewed by: <strong className="text-slate-600">{excuse.reviewedByName}</strong>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        variant={alertModal?.variant || 'error'}
        title={alertModal?.title || 'Alert'}
        message={alertModal?.message || ''}
      />
    </div>
  )
}
