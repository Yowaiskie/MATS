import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { BulkProgressBar } from '@/components/BulkProgressBar'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'
import { 
  notificationService, 
  type UntakenScheduleInfo, 
  type PushNotificationProgress 
} from '@/services/notificationService'
import { memberService } from '@/services/memberService'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { formatTime12Hour } from '@/utils/scheduleUtils'

interface RemindAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export type ScheduleCategoryFilter = 'all' | 'sunday' | 'weekdays' | 'meeting' | 'formation' | 'special_events'

const matchesCategory = (schedule: Schedule, filter: ScheduleCategoryFilter): boolean => {
  if (filter === 'all') return true
  
  const cat = schedule.category || ''
  const title = (schedule.title || '').toLowerCase()
  
  // Determine day of week if date is available
  let dayOfWeek = -1
  if (schedule.date) {
    const parts = schedule.date.split('-')
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      dayOfWeek = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    }
  }

  if (filter === 'sunday') {
    return (
      cat === 'mass_sunday' ||
      dayOfWeek === 0 ||
      title.includes('sunday') ||
      title.includes('anticipated')
    )
  }

  if (filter === 'weekdays') {
    return (
      cat === 'mass_weekday' ||
      (dayOfWeek >= 1 && dayOfWeek <= 6 && !title.includes('anticipated') && !title.includes('meeting') && !title.includes('formation') && !title.includes('special')) ||
      title.includes('weekday') ||
      title.includes('daily')
    )
  }

  if (filter === 'meeting') {
    return (
      cat === 'meeting' ||
      cat === 'meeting_and_formation' ||
      title.includes('meeting') ||
      title.includes('assembly') ||
      title.includes('pulong')
    )
  }

  if (filter === 'formation') {
    return (
      cat === 'formation' ||
      cat === 'meeting_and_formation' ||
      title.includes('formation') ||
      title.includes('ogf') ||
      title.includes('seminar') ||
      title.includes('recollection') ||
      title.includes('workshop')
    )
  }

  if (filter === 'special_events') {
    return (
      cat === 'special_event' ||
      cat === 'holy_hour' ||
      cat === 'practice' ||
      title.includes('special') ||
      title.includes('fiesta') ||
      title.includes('pyesta') ||
      title.includes('solemnity') ||
      title.includes('procession') ||
      title.includes('holy hour') ||
      title.includes('practice') ||
      title.includes('rehearsal')
    )
  }

  return true
}

export const RemindAttendanceModal: React.FC<RemindAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [untakenSchedules, setUntakenSchedules] = useState<UntakenScheduleInfo[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])

  // Selection states
  const [scopeMode, setScopeMode] = useState<'all' | 'selected'>('selected')
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([])
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ScheduleCategoryFilter>('all')

  // Target states
  const [targetMode, setTargetMode] = useState<'assigned_only' | 'all_officers' | 'custom_members'>('assigned_only')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  // Message state
  const [customMessage, setCustomMessage] = useState('')

  // Sending progress state
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState<PushNotificationProgress>({
    active: false,
    current: 0,
    total: 0,
    percentage: 0,
    statusLabel: ''
  })

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setLoading(true)

    Promise.all([
      notificationService.getUntakenSchedules(),
      memberService.getMembers(false)
    ])
      .then(([schedulesData, membersData]) => {
        if (!isMounted) return
        setUntakenSchedules(schedulesData)
        setAllMembers(membersData)

        // Default: pre-select schedules that have active accounts or the first few
        const idsWithAccounts = schedulesData
          .filter((s: UntakenScheduleInfo) => s.assignedAccountsCount > 0)
          .map((s: UntakenScheduleInfo) => s.schedule.id)
        
        setSelectedScheduleIds(idsWithAccounts.length > 0 ? idsWithAccounts : schedulesData.map((s: UntakenScheduleInfo) => s.schedule.id))
      })
      .catch((err) => {
        console.error('Failed to load untaken schedules:', err)
        toast.error('Load Error', 'Could not fetch untaken schedules.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<ScheduleCategoryFilter, number> = {
      all: untakenSchedules.length,
      sunday: 0,
      weekdays: 0,
      meeting: 0,
      formation: 0,
      special_events: 0
    }
    untakenSchedules.forEach(item => {
      if (matchesCategory(item.schedule, 'sunday')) counts.sunday++
      if (matchesCategory(item.schedule, 'weekdays')) counts.weekdays++
      if (matchesCategory(item.schedule, 'meeting')) counts.meeting++
      if (matchesCategory(item.schedule, 'formation')) counts.formation++
      if (matchesCategory(item.schedule, 'special_events')) counts.special_events++
    })
    return counts
  }, [untakenSchedules])

  // Filtered schedules for selection
  const filteredSchedules = useMemo(() => {
    return untakenSchedules.filter(item => {
      const s = item.schedule
      // 1. Category match
      if (!matchesCategory(s, categoryFilter)) return false

      // 2. Search match
      if (scheduleSearch.trim()) {
        const q = scheduleSearch.toLowerCase().trim()
        const matches =
          s.title.toLowerCase().includes(q) ||
          (s.date && s.date.toLowerCase().includes(q))
        if (!matches) return false
      }

      return true
    })
  }, [untakenSchedules, categoryFilter, scheduleSearch])

  // Filtered members for custom target selection
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return allMembers
    const q = memberSearch.toLowerCase().trim()
    return allMembers.filter(m => {
      const fullName = `${m.firstName} ${m.lastName} ${m.middleName || ''} ${m.nickname || ''}`.toLowerCase()
      return fullName.includes(q) || (m.order && m.order.toLowerCase().includes(q))
    })
  }, [allMembers, memberSearch])

  // Toggle single schedule selection
  const handleToggleSchedule = (id: string) => {
    setSelectedScheduleIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Select all / deselect all filtered schedules
  const handleSelectFilteredSchedules = () => {
    const filteredIds = filteredSchedules.map(item => item.schedule.id)
    if (filteredIds.length === 0) return

    const allFilteredSelected = filteredIds.every(id => selectedScheduleIds.includes(id))
    if (allFilteredSelected) {
      setSelectedScheduleIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedScheduleIds(prev => Array.from(new Set([...prev, ...filteredIds])))
    }
  }

  // Toggle single member selection
  const handleToggleMember = (id: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Calculate recipient and schedule summary
  const effectiveScheduleIds = scopeMode === 'all' 
    ? untakenSchedules.map(s => s.schedule.id) 
    : selectedScheduleIds

  const targetCountEstimate = useMemo(() => {
    if (targetMode === 'custom_members') {
      return `${selectedMemberIds.length} selected member(s)`
    }
    if (targetMode === 'all_officers') {
      return 'All Registered Officers'
    }
    // Assigned only
    const targetScheduleObjects = untakenSchedules.filter(item =>
      effectiveScheduleIds.includes(item.schedule.id)
    )
    const uniqueAssigned = new Set<string>()
    targetScheduleObjects.forEach(item => {
      item.schedule.assignedMembers?.forEach(mId => uniqueAssigned.add(mId))
    })
    return uniqueAssigned.size > 0 ? `${uniqueAssigned.size} assigned server(s)` : 'Assigned Officers'
  }, [targetMode, selectedMemberIds, effectiveScheduleIds, untakenSchedules])

  // Dispatch reminders
  const handleDispatch = async () => {
    if (effectiveScheduleIds.length === 0) {
      toast.warning('No Schedules Selected', 'Please select at least one schedule to send reminders.')
      return
    }

    if (targetMode === 'custom_members' && selectedMemberIds.length === 0) {
      toast.warning('No Members Selected', 'Please select at least one member to receive the reminder.')
      return
    }

    setIsSending(true)
    try {
      const result = await notificationService.sendBulkAttendanceReminders(
        {
          scheduleIds: scopeMode === 'all' ? undefined : effectiveScheduleIds,
          targetAudienceType: targetMode === 'assigned_only' 
            ? 'assigned_accounts_only' 
            : targetMode === 'all_officers' 
            ? 'all_officers' 
            : 'custom_members',
          customMemberIds: targetMode === 'custom_members' ? selectedMemberIds : undefined,
          customMessage: customMessage.trim() || undefined,
          performedBy: profile?.email || 'Admin'
        },
        (prog: PushNotificationProgress) => setProgress(prog)
      )

      if (result.schedulesReminded > 0) {
        toast.success(
          'Reminders Dispatched',
          `Sent attendance push reminders for ${result.schedulesReminded} schedule(s) to ${result.officersNotified} user(s).`
        )
      } else {
        toast.info('No Reminders Needed', 'No untaken schedules matched the selected criteria.')
      }

      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('Dispatch failed:', err)
      toast.error('Dispatch Failed', err.message || 'Failed to dispatch attendance reminders.')
    } finally {
      setIsSending(false)
      setProgress({ active: false, current: 0, total: 0, percentage: 0, statusLabel: '' })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remind Pending Attendance"
      subtitle="Dispatch tailored notification alerts for untaken attendance sessions"
      icon={
        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="space-y-4 p-1 text-xs text-slate-700">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-7 w-7 border-3 border-indigo-600 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-500">Scanning untaken schedules...</p>
          </div>
        ) : untakenSchedules.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800">All Attendance Up to Date!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no pending or untaken attendance sessions found across your scheduled services.
            </p>
          </div>
        ) : (
          <>
            {/* Step 1: Scope Option */}
            <div className="space-y-2">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                1. Select Schedule Scope <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {/* Option All */}
                <button
                  type="button"
                  onClick={() => setScopeMode('all')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    scopeMode === 'all'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">All Untaken Schedules</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                      {untakenSchedules.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Include all past & current schedules without finalized attendance.
                  </p>
                </button>

                {/* Option Selected */}
                <button
                  type="button"
                  onClick={() => setScopeMode('selected')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    scopeMode === 'selected'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">Choose Specific Schedules</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                      {selectedScheduleIds.length} / {untakenSchedules.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pick specific schedules to target from the list below.
                  </p>
                </button>
              </div>

              {/* Schedule List Picker (When Selected mode is active) */}
              {scopeMode === 'selected' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 mt-2">
                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {[
                      { key: 'all' as ScheduleCategoryFilter, label: 'All', count: categoryCounts.all },
                      { key: 'sunday' as ScheduleCategoryFilter, label: 'Sunday Mass', count: categoryCounts.sunday },
                      { key: 'weekdays' as ScheduleCategoryFilter, label: 'Weekdays', count: categoryCounts.weekdays },
                      { key: 'meeting' as ScheduleCategoryFilter, label: 'Meetings', count: categoryCounts.meeting },
                      { key: 'formation' as ScheduleCategoryFilter, label: 'Formation / OGF', count: categoryCounts.formation },
                      { key: 'special_events' as ScheduleCategoryFilter, label: 'Special Events', count: categoryCounts.special_events }
                    ].map((tab) => {
                      const isActive = categoryFilter === tab.key
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setCategoryFilter(tab.key)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded-md ${
                              isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Search and Quick Selection Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={scheduleSearch}
                        onChange={(e) => setScheduleSearch(e.target.value)}
                        placeholder={`Filter ${categoryFilter === 'all' ? 'all' : categoryFilter} schedules by title or date...`}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectFilteredSchedules}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 cursor-pointer"
                    >
                      {filteredSchedules.length > 0 && filteredSchedules.every(item => selectedScheduleIds.includes(item.schedule.id))
                        ? `Deselect Filtered (${filteredSchedules.length})`
                        : `Select Filtered (${filteredSchedules.length})`}
                    </button>
                  </div>

                  {/* Schedule List */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                    {filteredSchedules.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs italic">
                        No untaken schedules found under this filter.
                      </div>
                    ) : (
                      filteredSchedules.map(({ schedule: s, totalAssignedCount }) => {
                        const isChecked = selectedScheduleIds.includes(s.id)
                        const isSunday = matchesCategory(s, 'sunday')
                        const isMeeting = matchesCategory(s, 'meeting')
                        const isFormation = matchesCategory(s, 'formation')
                        const isSpecial = matchesCategory(s, 'special_events')

                        return (
                          <label
                            key={s.id}
                            className={`flex items-start gap-2.5 p-2 rounded-xl transition-colors cursor-pointer select-none ${
                              isChecked ? 'bg-indigo-50/70' : 'bg-white hover:bg-slate-100/70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSchedule(s.id)}
                              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs truncate">{s.title}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${
                                    isSunday 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : isMeeting 
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : isFormation
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : isSpecial
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {isSunday ? 'Sunday Mass' : isMeeting ? 'Meeting' : isFormation ? 'Formation' : isSpecial ? 'Special Event' : 'Weekday'}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                  {s.date}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                                <span>
                                  {formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}
                                </span>
                                <span>•</span>
                                <span className={totalAssignedCount > 0 ? 'text-indigo-600 font-semibold' : 'text-slate-400'}>
                                  {totalAssignedCount} assigned server(s)
                                </span>
                              </div>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Target / Recipient Option */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                2. Notification Recipient (Who will be alerted?) <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Assigned only */}
                <button
                  type="button"
                  onClick={() => setTargetMode('assigned_only')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    targetMode === 'assigned_only'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-slate-900 block text-xs mb-0.5">
                    Assigned Users Only
                  </span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Alert only accounts assigned to the schedule. (Recommended)
                  </p>
                </button>

                {/* All Officers */}
                <button
                  type="button"
                  onClick={() => setTargetMode('all_officers')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    targetMode === 'all_officers'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-slate-900 block text-xs mb-0.5">
                    All Officers
                  </span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Broadcast reminder to all registered officers & coordinators.
                  </p>
                </button>

                {/* Custom Members */}
                <button
                  type="button"
                  onClick={() => setTargetMode('custom_members')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    targetMode === 'custom_members'
                      ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-slate-900 block text-xs mb-0.5">
                    Select Specific Members
                  </span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Manually choose specific members to notify ({selectedMemberIds.length} selected).
                  </p>
                </button>
              </div>

              {/* Custom Member Picker (When Custom mode is active) */}
              {targetMode === 'custom_members' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 mt-2">
                  <div className="relative">
                    <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search member name or order..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {filteredMembers.map((m) => {
                      const isChecked = selectedMemberIds.includes(m.id)
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2 p-1.5 rounded-xl transition-colors cursor-pointer select-none ${
                            isChecked ? 'bg-indigo-50/70' : 'bg-white hover:bg-slate-100/70'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMember(m.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="font-semibold text-slate-800 text-xs">
                            {m.lastName}, {m.firstName}
                          </span>
                          {m.order && (
                            <span className="text-[10px] text-slate-400 font-medium">({m.order})</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Optional Custom Message */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                3. Additional Note / Message <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. Please finalize attendance records immediately before our weekend coordination check..."
                rows={2}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Summary Banner */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-2 text-indigo-900 text-xs">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Ready to dispatch for <strong>{effectiveScheduleIds.length} schedule(s)</strong>.
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg bg-indigo-200/80">
                Target: {targetCountEstimate}
              </span>
            </div>

            {/* Progress Bar (during dispatch) */}
            {progress.active && (
              <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                <BulkProgressBar
                  active={true}
                  progress={progress.percentage}
                  itemCount={progress.total}
                  label={progress.statusLabel}
                  variant="indigo"
                  size="sm"
                />
              </div>
            )}
          </>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="dense"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </Button>

          {untakenSchedules.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="dense"
              loading={isSending}
              loadingText="Dispatching..."
              onClick={handleDispatch}
              disabled={effectiveScheduleIds.length === 0}
              icon={
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            >
              Send Reminders
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
