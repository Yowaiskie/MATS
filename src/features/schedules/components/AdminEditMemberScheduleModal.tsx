import React, { useState, useEffect, useMemo } from 'react'
import type { SchedulePublication } from '@/types/publication'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { ScheduleSubmission } from '@/types/submission'
import { scheduleService } from '@/services/scheduleService'
import { submissionService } from '@/services/submissionService'
import { getFullName } from '@/utils/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { 
  formatTime12Hour, 
  isSundayOrAnticipatedMass, 
  getSlotRankBreakdown, 
  isHistoricalScheduleOccurrence, 
  getParishTodayDate 
} from '@/utils/scheduleUtils'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'
import { Button, useToast } from '@/components'

interface Props {
  isOpen: boolean
  onClose: () => void
  publication: SchedulePublication | null
  member: Member | null
  allEligibleMembers: Member[]
  submissions?: ScheduleSubmission[]
  onSuccess: () => void
}

interface ScheduleSlotPattern {
  id: string
  dayOfWeek: number
  dayName: string
  startTime: string
  formattedTime: string
  title: string
  location?: string
  isSunday: boolean
  scheduleIds: string[]
  assignedMemberIds: string[]
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const AdminEditMemberScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  publication,
  member: initialMember,
  allEligibleMembers,
  submissions: initialSubmissions,
  onSuccess
}) => {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMember?.id || '')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [activeSubmissions, setActiveSubmissions] = useState<ScheduleSubmission[]>(initialSubmissions || [])
  const [markAsSubmitted, setMarkAsSubmitted] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Sync active submissions when passed or fetch if missing
  useEffect(() => {
    if (initialSubmissions) {
      setActiveSubmissions(initialSubmissions)
    } else if (isOpen && publication?.id) {
      submissionService.getSubmissionsForPublication(publication.id)
        .then(setActiveSubmissions)
        .catch(err => console.error('Failed to load submissions for edit modal:', err))
    }
  }, [isOpen, publication?.id, initialSubmissions])

  // Effective Date state (defaults to parish today, clamped to publication range)
  const [effectiveDate, setEffectiveDate] = useState<string>(() => {
    const today = getParishTodayDate()
    if (publication) {
      if (today < publication.startDate) return publication.startDate
      if (today > publication.endDate) return publication.endDate
    }
    return today
  })

  // Synchronize effectiveDate with publication boundaries if publication changes
  useEffect(() => {
    if (publication) {
      const today = getParishTodayDate()
      if (today < publication.startDate) {
        setEffectiveDate(publication.startDate)
      } else if (today > publication.endDate) {
        setEffectiveDate(publication.endDate)
      } else {
        setEffectiveDate(today)
      }
    }
  }, [publication])

  // Sync selected member when initialMember changes
  useEffect(() => {
    if (initialMember) {
      setSelectedMemberId(initialMember.id)
    } else if (allEligibleMembers.length > 0 && !selectedMemberId) {
      setSelectedMemberId(allEligibleMembers[0].id)
    }
  }, [initialMember, allEligibleMembers])

  const currentMember = useMemo(() => {
    return allEligibleMembers.find(m => m.id === selectedMemberId) || initialMember || null
  }, [allEligibleMembers, selectedMemberId, initialMember])

  // Load publication schedules
  const loadSchedules = async () => {
    if (!publication) return
    setLoading(true)
    try {
      const valid = await scheduleService.getSchedulesForPublication(publication)
      setSchedules(valid)
    } catch (err: any) {
      console.error('Failed to load schedules for editing:', err)
      toast.error('Failed to load publication schedules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && publication) {
      loadSchedules()
    }
  }, [isOpen, publication])

  // Map member names
  const memberNameMap = useMemo(() => {
    return new Map(allEligibleMembers.map(m => [m.id, getFullName(m)]))
  }, [allEligibleMembers])

  // Group schedules into recurring slot patterns
  const { sundayPatterns, weekdayPatterns } = useMemo(() => {
    if (!publication || schedules.length === 0) {
      return { sundayPatterns: [], weekdayPatterns: [] }
    }

    const patternMap = new Map<string, ScheduleSlotPattern>()

    schedules.forEach(s => {
      const [y, m, d] = s.date.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      const dayName = DAY_NAMES[dayOfWeek]
      const isSun = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
      const isEventMode = publication?.publicationType === 'special_event' || !!publication?.enableStreetLocation || (publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)
      const patternId = isEventMode 
        ? `${dayOfWeek}-${s.startTime}-${s.title}-${s.location || ''}`
        : `${dayOfWeek}-${s.startTime}`

      if (!patternMap.has(patternId)) {
        patternMap.set(patternId, {
          id: patternId,
          dayOfWeek,
          dayName,
          startTime: s.startTime,
          formattedTime: formatTime12Hour(s.startTime),
          title: s.title,
          location: s.location,
          isSunday: isSun,
          scheduleIds: [],
          assignedMemberIds: []
        })
      }

      const pattern = patternMap.get(patternId)!
      pattern.scheduleIds.push(s.id)

      s.assignedMembers?.forEach(memId => {
        if (!pattern.assignedMemberIds.includes(memId)) {
          pattern.assignedMemberIds.push(memId)
        }
      })

      // Also include servers with provisional submissions for this schedule
      activeSubmissions.forEach(sub => {
        if (sub.status === 'rejected') return
        if (sub.requestedScheduleIds?.includes(s.id) && !pattern.assignedMemberIds.includes(sub.memberId)) {
          pattern.assignedMemberIds.push(sub.memberId)
        }
      })
    })

    const allPatterns = Array.from(patternMap.values())

    const getSortWeight = (p: ScheduleSlotPattern) => {
      if (p.dayOfWeek === 6 && p.startTime >= '16:00') return -1 // Sat anticipated first
      return p.dayOfWeek
    }

    allPatterns.sort((a, b) => {
      const weightA = getSortWeight(a)
      const weightB = getSortWeight(b)
      if (weightA !== weightB) return weightA - weightB
      return a.startTime.localeCompare(b.startTime)
    })

    return {
      sundayPatterns: allPatterns.filter(p => p.isSunday),
      weekdayPatterns: allPatterns.filter(p => !p.isSunday)
    }
  }, [schedules, publication, activeSubmissions])

  // Populate draft selected slots when selected member or schedules change
  useEffect(() => {
    if (!selectedMemberId || schedules.length === 0) {
      setSelectedScheduleIds(new Set())
      return
    }

    const initialAssigned = new Set<string>()
    schedules.forEach(s => {
      if (s.assignedMembers?.includes(selectedMemberId)) {
        initialAssigned.add(s.id)
      }
    })

    // Also include requested schedule IDs from member's provisional or existing submission
    const memberSub = activeSubmissions.find(sub => sub.memberId === selectedMemberId && sub.status !== 'rejected')
    if (memberSub?.requestedScheduleIds) {
      memberSub.requestedScheduleIds.forEach(id => initialAssigned.add(id))
    }

    setSelectedScheduleIds(initialAssigned)

    const isAlreadySubmitted = publication?.submittedMembers?.includes(selectedMemberId) || Boolean(memberSub)
    setMarkAsSubmitted(isAlreadySubmitted || initialAssigned.size > 0)
  }, [selectedMemberId, schedules, publication, activeSubmissions])

  // Count current draft selections
  const selectedSundayCount = useMemo(() => {
    return sundayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [sundayPatterns, selectedScheduleIds])

  const selectedWeekdayCount = useMemo(() => {
    return weekdayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [weekdayPatterns, selectedScheduleIds])

  // Occurrence statistics: Historical Preserved vs Future to Update
  const occurrenceStats = useMemo(() => {
    if (!schedules.length || !selectedMemberId) {
      return { preservedHistoricalCount: 0, targetFutureCount: 0, totalFutureAvailable: 0 }
    }

    let preservedHistoricalCount = 0
    let targetFutureCount = 0
    let totalFutureAvailable = 0

    schedules.forEach(s => {
      const isHist = isHistoricalScheduleOccurrence(s, effectiveDate)
      const isAssigned = s.assignedMembers?.includes(selectedMemberId)
      const isSelected = selectedScheduleIds.has(s.id)

      if (isHist) {
        if (isAssigned) {
          preservedHistoricalCount++
        }
      } else {
        totalFutureAvailable++
        if (isSelected) {
          targetFutureCount++
        }
      }
    })

    return { preservedHistoricalCount, targetFutureCount, totalFutureAvailable }
  }, [schedules, selectedMemberId, effectiveDate, selectedScheduleIds])

  if (!isOpen || !publication) return null

  const handleTogglePattern = (pattern: ScheduleSlotPattern) => {
    const isSelected = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))
    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      if (isSelected) {
        pattern.scheduleIds.forEach(id => next.delete(id))
      } else {
        pattern.scheduleIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const handleClearSundays = () => {
    const sundayIds = new Set(sundayPatterns.flatMap(p => p.scheduleIds))
    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      sundayIds.forEach(id => next.delete(id))
      return next
    })
  }

  const handleClearWeekdays = () => {
    const weekdayIds = new Set(weekdayPatterns.flatMap(p => p.scheduleIds))
    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      weekdayIds.forEach(id => next.delete(id))
      return next
    })
  }

  const handleClearAll = () => {
    setSelectedScheduleIds(new Set())
  }

  const handleSave = async () => {
    if (!selectedMemberId || !publication) return
    setIsSaving(true)

    try {
      const selections = schedules.map(s => ({
        scheduleId: s.id,
        isSelected: selectedScheduleIds.has(s.id)
      }))

      const result = await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        selectedMemberId,
        selections,
        {
          effectiveDate,
          markAsSubmitted,
          adminUser: {
            uid: user?.uid || profile?.uid || 'Admin',
            email: user?.email || undefined,
            role: profile?.role || 'admin',
            permissions: { canManageSchedules: true }
          }
        }
      )

      toast.success(
        `Schedule updated for ${currentMember ? getFullName(currentMember) : 'member'}. ` +
        `(${result.updatedFutureSchedulesCount} future occurrences updated, ` +
        `${result.preservedHistoricalSchedulesCount} historical occurrences preserved)`
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to save admin schedule assignment:', err)
      toast.error(err.message || 'Failed to save schedule.')
    } finally {
      setIsSaving(false)
    }
  }

  const renderSlotCard = (pattern: ScheduleSlotPattern) => {
    const isSelected = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))
    const maxCapacity = pattern.isSunday
      ? (publication?.maxServersPerSundaySlot ?? 5)
      : (publication?.maxServersPerWeekdaySlot ?? 5)
    
    // Other servers currently assigned (excluding current selected member)
    const otherServerIds = pattern.assignedMemberIds.filter(id => id !== selectedMemberId)
    const totalCount = otherServerIds.length + (isSelected ? 1 : 0)
    const isCapacityFull = totalCount >= maxCapacity && !isSelected

    return (
      <div
        key={pattern.id}
        onClick={() => handleTogglePattern(pattern)}
        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 relative ${
          isSelected
            ? 'bg-indigo-50/90 border-indigo-600 shadow-md shadow-indigo-600/10 ring-2 ring-indigo-500/20'
            : isCapacityFull
            ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300 opacity-90'
            : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
        }`}
      >
        {/* Top: Day & Time */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                pattern.isSunday
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {pattern.dayName}
              </span>
              <span className="text-xs font-black text-slate-900 truncate">
                {pattern.formattedTime}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5 truncate">
              {pattern.title}
            </div>
            {pattern.location && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold truncate max-w-full">
                <svg className="w-2.5 h-2.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{pattern.location}</span>
              </div>
            )}
          </div>

          {/* Checkbox badge */}
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-all ${
            isSelected
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'border-2 border-slate-300 bg-white text-transparent'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Bottom: Capacity & Assigned Servers */}
        <div className="pt-2 border-t border-slate-100/90 flex flex-col gap-1.5 text-[10px]">
          <div className="flex items-center justify-between font-bold">
            <span className="text-slate-400">Assigned Servers:</span>
            <div className="flex items-center gap-1.5">
              {publication?.enableRankQuotas && (
                <div className="flex items-center gap-1">
                  {getSlotRankBreakdown(pattern.assignedMemberIds, allEligibleMembers, publication, pattern.isSunday, false).items.map(item => (
                    <span
                      key={item.rank}
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        item.isFull
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                      title={`${item.rank}: ${item.current} / ${item.limit !== undefined ? item.limit : '∞'}`}
                    >
                      {item.rank.slice(0, 4)}: {item.current}/{item.limit !== undefined ? item.limit : '∞'}
                    </span>
                  ))}
                </div>
              )}
              <span className={`px-1.5 py-0.2 rounded-md font-extrabold ${
                totalCount >= maxCapacity
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {totalCount} / {maxCapacity} {totalCount >= maxCapacity && '(Full)'}
              </span>
            </div>
          </div>

          {/* Assigned names preview */}
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {isSelected && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-extrabold">
                {currentMember?.firstName || 'This Server'} (Selected)
              </span>
            )}
            {otherServerIds.map(memId => (
              <span
                key={memId}
                className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold truncate max-w-[120px]"
                title={memberNameMap.get(memId) || memId}
              >
                {memberNameMap.get(memId) || memId}
              </span>
            ))}
            {otherServerIds.length === 0 && !isSelected && (
              <span className="text-slate-400 italic">No servers assigned yet</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                  Admin Direct Assign
                </span>
                <span className="text-xs font-bold text-slate-400 truncate">
                  {publication.name} ({publication.startDate} to {publication.endDate})
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
                Edit Member Schedule Selection
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Member Selector & Stats Ribbon */}
        <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200/70 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Member Search / Selector Dropdown */}
            <div className="flex-1 max-w-md">
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                Target Altar Server:
              </label>
              <MemberSearchDropdown
                members={allEligibleMembers}
                value={selectedMemberId}
                onChange={(id) => setSelectedMemberId(id)}
                title="Switch Altar Server"
                placeholder="Click to search / select Altar Server..."
                allowClear={false}
              />
            </div>

            {/* Quota Chips */}
            <div className="flex items-center gap-2 flex-wrap sm:self-end">
              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Sundays:</span>
                <span className={`text-xs font-black ${
                  selectedSundayCount >= (publication.maxSundaysPerServer ?? 4)
                    ? 'text-indigo-600'
                    : 'text-slate-800'
                }`}>
                  {selectedSundayCount} / {publication.maxSundaysPerServer ?? 4}
                </span>
              </div>

              <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Weekdays:</span>
                <span className={`text-xs font-black ${
                  selectedWeekdayCount >= (publication.maxWeekdaysPerServer ?? 8)
                    ? 'text-emerald-600'
                    : 'text-slate-800'
                }`}>
                  {selectedWeekdayCount} / {publication.maxWeekdaysPerServer ?? 8}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedSundayCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSundays}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer border border-indigo-200"
                    title="Reset only Sunday slots"
                  >
                    Reset Sundays
                  </button>
                )}
                {selectedWeekdayCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearWeekdays}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer border border-emerald-200"
                    title="Reset only Weekday slots"
                  >
                    Reset Weekdays
                  </button>
                )}
                {(selectedSundayCount > 0 || selectedWeekdayCount > 0) && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-rose-200/80"
                    title="Reset all slots"
                  >
                    Reset All
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Effective Date & Historical Preservation Banner */}
        <div className="px-4 py-3 sm:px-6 bg-indigo-50/50 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <label htmlFor="effective-date-input" className="text-xs font-black text-slate-800">
                  Effective Date:
                </label>
                <input
                  id="effective-date-input"
                  type="date"
                  value={effectiveDate}
                  min={publication.startDate}
                  max={publication.endDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Occurrences before this date, locked schedules, or finalized sessions remain unchanged.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-extrabold shadow-2xs" title="Occurrences that will be assigned or modified from the effective date onward">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Future to Update: {occurrenceStats.targetFutureCount}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-extrabold shadow-2xs" title="Past, locked, or finalized occurrences that are preserved intact">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Historical Preserved: {occurrenceStats.preservedHistoricalCount}
            </span>
          </div>
        </div>

        {/* Content Body: Slot Selection */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-500">Loading mass schedules...</span>
            </div>
          ) : (
            <>
              {/* 1. Sunday Masses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                      Sunday & Anticipated Masses ({sundayPatterns.length} slots)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-600">
                      {selectedSundayCount} selected
                    </span>
                    {selectedSundayCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSundays}
                        className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                        title="Clear only Sunday slots"
                      >
                        Reset Sundays
                      </button>
                    )}
                  </div>
                </div>

                {sundayPatterns.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                    No Sunday mass schedules found for this period.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sundayPatterns.map(renderSlotCard)}
                  </div>
                )}
              </div>

              {/* 2. Weekday Masses */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                      Weekday Masses ({weekdayPatterns.length} slots)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-600">
                      {selectedWeekdayCount} selected
                    </span>
                    {selectedWeekdayCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearWeekdays}
                        className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                        title="Clear only Weekday slots"
                      >
                        Reset Weekdays
                      </button>
                    )}
                  </div>
                </div>

                {weekdayPatterns.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                    No Weekday mass schedules found for this period.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {weekdayPatterns.map(renderSlotCard)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={markAsSubmitted}
              onChange={e => setMarkAsSubmitted(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
            />
            <span>Mark as Submitted / Finalized in Publication</span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="dense"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="dense"
              className="w-full sm:w-auto"
              onClick={handleSave}
              loading={isSaving}
              disabled={loading || !selectedMemberId}
            >
              Save Schedule ({selectedSundayCount + selectedWeekdayCount} slots)
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
