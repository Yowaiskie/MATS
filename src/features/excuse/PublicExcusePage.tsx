import React, { useState, useEffect, useMemo } from 'react'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import { excuseService } from '@/services/excuseService'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { ExcuseRequest } from '@/types/excuse'
import { 
  formatTime12Hour, 
  formatScheduleDateWithDay,
  isSundayOrAnticipatedMass,
  isHolyHourSchedule,
  isMeetingSchedule
} from '@/utils/scheduleUtils'
import { Button, StatusBadge, EmptyState, useToast, CustomSelect, type CustomSelectOption } from '@/components'

const MONTH_OPTIONS: CustomSelectOption[] = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
]

const REASON_PRESETS = [
  'Illness / Medical Reason',
  'Family Emergency / Gathering',
  'School / Academic Conflict',
  'Personal / Out of Town',
  'Transportation Issue'
]

interface CategorizedScheduleGroups {
  sundays: Schedule[]
  weekdays: Schedule[]
  holyHours: Schedule[]
  baptisms: Schedule[]
  meetings: Schedule[]
  total: number
}

function categorizeScheduleList(list: Schedule[]): CategorizedScheduleGroups {
  const sundays: Schedule[] = []
  const weekdays: Schedule[] = []
  const holyHours: Schedule[] = []
  const baptisms: Schedule[] = []
  const meetings: Schedule[] = []

  list.forEach(s => {
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
    total: list.length
  }
}

export const PublicExcusePage: React.FC = () => {
  const { toast } = useToast()
  const [mode, setMode] = useState<'submit' | 'track'>('submit')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  // Data State
  const [members, setMembers] = useState<Member[]>([])
  const [allSchedulesMap, setAllSchedulesMap] = useState<Map<string, Schedule>>(new Map())
  
  // Submit Step 1: Verification State & Member Picker
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [isSubmitPickerOpen, setIsSubmitPickerOpen] = useState(false)
  const [submitSearchQuery, setSubmitSearchQuery] = useState('')
  
  // Kid-Friendly 3-part DOB (MM / DD / YYYY)
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [verificationError, setVerificationError] = useState('')
  
  // Submit Step 2: Excuse Request State
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [showAdvanceSchedules, setShowAdvanceSchedules] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  // Track Status State & Member Picker
  const [trackMemberId, setTrackMemberId] = useState('')
  const [isTrackPickerOpen, setIsTrackPickerOpen] = useState(false)
  const [trackSearchQuery, setTrackSearchQuery] = useState('')
  const [memberExcuses, setMemberExcuses] = useState<ExcuseRequest[]>([])
  const [loadingMemberExcuses, setLoadingMemberExcuses] = useState(false)
  const [trackError, setTrackError] = useState('')

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
      toast.error('Data Loading Error', 'Failed to load member records and service schedules.')
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

  // Categorize schedules into This Week vs Advance
  const { thisWeekGroup, advanceGroup } = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // End of current liturgical week (upcoming Sunday)
    const dayOfWeek = today.getDay() // 0 = Sunday
    const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : (7 - dayOfWeek)
    const endOfWeekDate = new Date(today)
    endOfWeekDate.setDate(today.getDate() + daysUntilEndOfWeek)
    const endOfWeekStr = `${endOfWeekDate.getFullYear()}-${String(endOfWeekDate.getMonth() + 1).padStart(2, '0')}-${String(endOfWeekDate.getDate()).padStart(2, '0')}`

    const thisWeekList: Schedule[] = []
    const advanceList: Schedule[] = []

    schedules.forEach(s => {
      if (s.date >= todayStr && s.date <= endOfWeekStr) {
        thisWeekList.push(s)
      } else if (s.date > endOfWeekStr) {
        advanceList.push(s)
      }
    })

    return {
      thisWeekGroup: categorizeScheduleList(thisWeekList),
      advanceGroup: categorizeScheduleList(advanceList)
    }
  }, [schedules])

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

    const cleanDay = birthDay.trim()
    const cleanYear = birthYear.trim()

    if (!birthMonth || !cleanDay || !cleanYear) {
      setVerificationError('Please enter your complete Date of Birth (Month, Day, and Year).')
      return
    }

    const dayNum = parseInt(cleanDay, 10)
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setVerificationError('Please enter a valid Day between 1 and 31.')
      return
    }

    const yearNum = parseInt(cleanYear, 10)
    const currentYear = new Date().getFullYear()
    if (isNaN(yearNum) || yearNum < 1920 || yearNum > currentYear) {
      setVerificationError('Please enter a valid 4-digit Year (e.g. 2010).')
      return
    }

    const paddedDay = String(dayNum).padStart(2, '0')
    const formattedDob = `${cleanYear}-${birthMonth}-${paddedDay}`

    if (member.dateOfBirth !== formattedDob) {
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
      }).sort((a, b) => {
        const d = (a.date || '').localeCompare(b.date || '')
        if (d !== 0) return d
        return (a.startTime || '').localeCompare(b.startTime || '')
      })

      setSchedules(upcoming)
      setSelectedScheduleIds(new Set())
      setShowAdvanceSchedules(false)
      setReason('')
      setStep(2)
    } catch {
      setVerificationError('Failed to load your assigned schedules.')
      toast.error('Schedule Load Error', 'Could not load your assigned schedules. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectAllSchedules = () => {
    const allIds = new Set<string>()
    schedules.forEach(s => allIds.add(s.id))
    setSelectedScheduleIds(allIds)
  }

  const clearAllSchedules = () => {
    setSelectedScheduleIds(new Set())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedScheduleIds.size === 0) {
      toast.error('Missing Information', 'Please select at least one schedule to excuse.')
      return
    }
    if (!reason.trim()) {
      toast.error('Missing Information', 'Please state your reason for filing an excuse.')
      return
    }

    const member = members.find(m => m.id === selectedMemberId)

    setLoading(true)
    try {
      await excuseService.submitExcuseRequest({
        memberId: selectedMemberId,
        memberName: member ? `${member.firstName} ${member.lastName}`.trim() : undefined,
        memberOrder: member?.order,
        memberRank: member?.rank,
        schedules: Array.from(selectedScheduleIds),
        reason: reason.trim()
      })
      toast.success('Excuse Request Submitted', 'Your excuse request has been successfully submitted.')
      setStep(3)
    } catch {
      toast.error('Submission Failed', 'Failed to submit excuse request. Please try again.')
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
      toast.error('Load Error', 'Failed to load excuse requests for this member.')
    } finally {
      setLoadingMemberExcuses(false)
    }
  }

  const renderScheduleCard = (s: Schedule) => {
    const isSelected = selectedScheduleIds.has(s.id)
    const formattedDate = formatScheduleDateWithDay(s.date, { shortDay: true })
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
            ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 shadow-2xs' 
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

  const renderCategorizedGroup = (group: CategorizedScheduleGroups) => {
    if (group.total === 0) return null

    return (
      <div className="space-y-3.5">
        {/* Sunday & Anticipated Masses */}
        {group.sundays.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>Sunday & Anticipated Masses ({group.sundays.length})</span>
            </div>
            <div className="space-y-1.5">
              {group.sundays.map(renderScheduleCard)}
            </div>
          </div>
        )}

        {/* Weekday Masses */}
        {group.weekdays.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Weekday Masses ({group.weekdays.length})</span>
            </div>
            <div className="space-y-1.5">
              {group.weekdays.map(renderScheduleCard)}
            </div>
          </div>
        )}

        {/* Holy Hour & Adoration */}
        {group.holyHours.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>Holy Hour & Adoration ({group.holyHours.length})</span>
            </div>
            <div className="space-y-1.5">
              {group.holyHours.map(renderScheduleCard)}
            </div>
          </div>
        )}

        {/* Baptisms / Binyag */}
        {group.baptisms.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-black uppercase text-cyan-700 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-600" />
              <span>Baptisms / Binyag ({group.baptisms.length})</span>
            </div>
            <div className="space-y-1.5">
              {group.baptisms.map(renderScheduleCard)}
            </div>
          </div>
        )}

        {/* Meetings, Formations & Practices */}
        {group.meetings.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <span>Meetings, Formation & Practices ({group.meetings.length})</span>
            </div>
            <div className="space-y-1.5">
              {group.meetings.map(renderScheduleCard)}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderScheduleInfo = (scheduleId: string) => {
    const sched = allSchedulesMap.get(scheduleId)
    if (!sched) {
      return <span className="text-xs text-slate-500 italic">Schedule #{scheduleId.substring(0, 8)}</span>
    }
    const formattedDate = formatScheduleDateWithDay(sched.date, { shortDay: true })
    const formattedTime = sched.startTime ? (
      sched.endTime 
        ? `${formatTime12Hour(sched.startTime)} - ${formatTime12Hour(sched.endTime)}`
        : formatTime12Hour(sched.startTime)
    ) : ''

    return (
      <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
        <div className="font-bold text-slate-900">{sched.title || 'Church Service'}</div>
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-indigo-600">{formattedDate}</span>
          {formattedTime && <span>• {formattedTime}</span>}
        </div>
      </div>
    )
  }

  const selectedSubmitMember = members.find(m => m.id === selectedMemberId)
  const selectedTrackMember = members.find(m => m.id === trackMemberId)

  return (
    <div className="relative min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden font-sans text-slate-800">
      {/* Sacred Ambient Mesh Glow Halos */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-gradient-to-tr from-indigo-600/25 via-blue-500/20 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 bg-white/95 backdrop-blur-2xl max-w-2xl w-full rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/80 ring-1 ring-slate-900/5 my-6 sm:my-8">
        <div className="flex justify-center mb-5">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-2xl bg-indigo-500/25 blur-md" />
            <img src="/favicon/favicon.png" alt="Logo" className="relative w-16 h-16 rounded-2xl border border-indigo-100 shadow-md object-cover" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-center text-slate-900 mb-1 tracking-tight">Excuse Management</h1>
        <p className="text-xs font-semibold text-center text-slate-500 mb-6">Ministry of Altar Servers • Self-Service Portal</p>

        {/* Sleek Modern Segmented Tabs Bar */}
        <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 mb-6">
          <button 
            type="button"
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs sm:text-sm font-extrabold rounded-xl transition-all duration-200 cursor-pointer ${
              mode === 'submit' 
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
            onClick={() => { setMode('submit'); setStep(1); }}
          >
            <svg className={`w-4 h-4 ${mode === 'submit' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>File an Excuse</span>
          </button>
          <button 
            type="button"
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs sm:text-sm font-extrabold rounded-xl transition-all duration-200 cursor-pointer ${
              mode === 'track' 
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
            onClick={() => { 
              setMode('track'); 
              setTrackError('');
              if (selectedMemberId && !trackMemberId) {
                handleSelectTrackMember(selectedMemberId)
              }
            }}
          >
            <svg className={`w-4 h-4 ${mode === 'track' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Track Status</span>
          </button>
        </div>

        {/* STEP 1: VERIFY IDENTITY */}
        {mode === 'submit' && step === 1 && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                1. Select Your Name
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
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
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
                        className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Close</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
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

            {/* Kid-Friendly 3-part Date of Birth Picker (MM / DD / YYYY) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                2. Date of Birth (Security Verification) • MM / DD / YYYY
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-start">
                {/* Month Dropdown with Full Month Names */}
                <CustomSelect
                  label="Month"
                  placeholder="Select Month..."
                  value={birthMonth}
                  options={MONTH_OPTIONS}
                  onChange={e => {
                    setBirthMonth(e.target.value)
                    setVerificationError('')
                  }}
                />

                {/* Day Direct Numeric Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Day <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={birthDay}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                      setBirthDay(val)
                      setVerificationError('')
                    }}
                    placeholder="e.g. 15"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                  />
                </div>

                {/* Year Direct Numeric Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={birthYear}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setBirthYear(val)
                      setVerificationError('')
                    }}
                    placeholder="e.g. 2010"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Select your birth month, then type your day and 4-digit year to verify your identity.</p>
            </div>

            {verificationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {verificationError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="public"
              fullWidth
              loading={loading}
              loadingText="Verifying & Loading Schedules..."
              disabled={!selectedMemberId || !birthMonth || !birthDay || !birthYear}
              className="mt-2"
            >
              Verify & Proceed
            </Button>
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
                    {selectedSubmitMember.order} • {selectedSubmitMember.rank}
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

            {/* Categorized Upcoming Schedules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Upcoming Duties ({selectedScheduleIds.size} selected) *
                </label>
                {schedules.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllSchedules}
                      className="font-extrabold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={clearAllSchedules}
                      className="font-extrabold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {schedules.length === 0 ? (
                <EmptyState
                  title="No Eligible Assigned Schedules Found"
                  description="You have no upcoming assignments, or your assignments have already been approved as excused."
                  className="py-6"
                />
              ) : (
                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {/* Section 1: This Week's Schedules */}
                  {thisWeekGroup.total > 0 ? (
                    <div className="space-y-2">
                      <div className="p-2 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs font-extrabold text-indigo-950 flex items-center justify-between">
                        <span>This Week's Duties</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-200/70 text-indigo-900 rounded-md">
                          {thisWeekGroup.total}
                        </span>
                      </div>
                      {renderCategorizedGroup(thisWeekGroup)}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
                      No assignments scheduled for this week.
                    </div>
                  )}

                  {/* Section 2: Advance Schedules (Future Weeks) */}
                  {advanceGroup.total > 0 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2.5">
                      <div
                        onClick={() => setShowAdvanceSchedules(prev => !prev)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                          showAdvanceSchedules
                            ? 'bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100/60 border-indigo-500 shadow-xs'
                            : 'bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/70 border-indigo-200/90 hover:border-indigo-400 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              showAdvanceSchedules ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-indigo-950">
                                  Advance Schedules
                                </span>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-600 text-white rounded-full shadow-2xs">
                                  {advanceGroup.total} Available
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5">
                                {showAdvanceSchedules 
                                  ? 'Showing future week & month assignments' 
                                  : 'Need to excuse for upcoming weeks? Click to show'}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all ${
                              showAdvanceSchedules
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white text-indigo-700 border border-indigo-300 shadow-2xs hover:bg-indigo-50'
                            }`}>
                              {showAdvanceSchedules ? 'Hide' : 'Show'}
                            </span>
                            <svg
                              className={`w-4 h-4 text-indigo-600 transition-transform duration-200 ${showAdvanceSchedules ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {showAdvanceSchedules && (
                        <div className="pt-2 pl-2 border-l-2 border-indigo-300 space-y-3">
                          <div className="text-[11px] font-black text-indigo-900 uppercase tracking-wider pl-1">
                            Future & Advance Schedules ({advanceGroup.total})
                          </div>
                          {renderCategorizedGroup(advanceGroup)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reason with Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                Reason for Absence *
              </label>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap gap-1.5">
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
                className="w-full p-3 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 text-slate-800 h-24 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                placeholder="State your reason for filing an excuse (e.g. Sickness, School activity, Family emergency)..."
                required
              />
            </div>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="secondary"
                size="public"
                onClick={() => setStep(1)} 
                className="w-1/3"
              >
                Back
              </Button>
              <Button 
                type="submit" 
                variant="primary"
                size="public"
                disabled={selectedScheduleIds.size === 0 || !reason.trim()} 
                loading={loading}
                loadingText="Submitting..."
                className="w-2/3"
              >
                Submit Excuse ({selectedScheduleIds.size} Schedule{selectedScheduleIds.size > 1 ? 's' : ''})
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: SUBMISSION SUCCESS */}
        {mode === 'submit' && step === 3 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-2xs">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Excuse Submitted Successfully</h2>
              <p className="text-slate-500 text-xs mt-1">Your excuse request has been queued for Coordinator/Admin review.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button 
                variant="primary"
                size="public"
                fullWidth
                onClick={() => {
                  setMode('track')
                  handleSelectTrackMember(selectedMemberId)
                }} 
              >
                View Status Now
              </Button>
              <Button 
                variant="secondary"
                size="public"
                fullWidth
                onClick={() => {
                  setSelectedScheduleIds(new Set())
                  setReason('')
                  setStep(1)
                }} 
              >
                File Another Request
              </Button>
            </div>
          </div>
        )}

        {/* MODE: TRACK STATUS */}
        {mode === 'track' && (
          <div className="space-y-5">
            {/* MEMBER PICKER FOR TRACK STATUS */}
            <div className="space-y-2">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Select Your Name to View Excuse Status
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
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
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
                        className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Close</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
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

            {trackError && <p className="text-rose-600 text-xs font-bold">{trackError}</p>}

            {!loadingMemberExcuses && trackMemberId && memberExcuses.length === 0 && (
              <EmptyState
                title="No Excuse Requests Found"
                description="No excuse requests have been filed under this member account yet."
                className="py-6"
              />
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
                    <div key={excuse.id || Math.random().toString()} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          {excuse.submittedAt?.toDate ? excuse.submittedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Excuse Request'}
                        </span>
                        <StatusBadge status={excuse.status} size="sm" />
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

                      {/* Officer filing note if filed by officer */}
                      {excuse.submittedByOfficer && (
                        <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl text-xs text-purple-900 space-y-0.5">
                          <span className="font-bold text-[10px] uppercase tracking-wider block text-purple-950">
                            Filed by Officer: {excuse.submittedByName || 'Ministry Officer'}
                          </span>
                          {excuse.officerNotes && <p>{excuse.officerNotes}</p>}
                        </div>
                      )}

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
      <div className="relative z-10 text-center mb-6 text-slate-400 text-xs font-medium">
        <span>Archdiocese of Lipa · Ministry of Altar Servers</span>
      </div>
    </div>
  )
}
