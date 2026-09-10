import React, { useState, useEffect, useMemo } from 'react'
import type { SchedulePublication } from '@/types/publication'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { scheduleService } from '@/services/scheduleService'
import { getFullName } from '@/utils/member'
import { formatTime12Hour, isSundayOrAnticipatedMass, isScheduleIncludedInPublication } from '@/utils/scheduleUtils'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'

interface Props {
  isOpen: boolean
  onClose: () => void
  publication: SchedulePublication | null
  member: Member | null
  allEligibleMembers: Member[]
  onSuccess: () => void
}

interface ScheduleSlotPattern {
  id: string
  dayOfWeek: number
  dayName: string
  startTime: string
  formattedTime: string
  title: string
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
  onSuccess
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMember?.id || '')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [markAsSubmitted, setMarkAsSubmitted] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    setMessage(null)
    try {
      const schedList = await scheduleService.getSchedulesByDateRange(publication.startDate, publication.endDate)
      const valid = schedList.filter(s => isScheduleIncludedInPublication(s, publication))
      setSchedules(valid)
    } catch (err: any) {
      console.error('Failed to load schedules for editing:', err)
      setMessage({ type: 'error', text: 'Failed to load publication schedules.' })
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
      const patternId = `${dayOfWeek}-${s.startTime}-${s.title}`

      if (!patternMap.has(patternId)) {
        patternMap.set(patternId, {
          id: patternId,
          dayOfWeek,
          dayName,
          startTime: s.startTime,
          formattedTime: formatTime12Hour(s.startTime),
          title: s.title,
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
  }, [schedules, publication])

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
    setSelectedScheduleIds(initialAssigned)

    const isAlreadySubmitted = publication?.submittedMembers?.includes(selectedMemberId) || false
    setMarkAsSubmitted(isAlreadySubmitted || initialAssigned.size > 0)
  }, [selectedMemberId, schedules, publication])

  // Count current draft selections
  const selectedSundayCount = useMemo(() => {
    return sundayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [sundayPatterns, selectedScheduleIds])

  const selectedWeekdayCount = useMemo(() => {
    return weekdayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [weekdayPatterns, selectedScheduleIds])

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
    setMessage(null)
  }

  const handleClearSundays = () => {
    const sundayIds = new Set(sundayPatterns.flatMap(p => p.scheduleIds))
    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      sundayIds.forEach(id => next.delete(id))
      return next
    })
    setMessage(null)
  }

  const handleClearWeekdays = () => {
    const weekdayIds = new Set(weekdayPatterns.flatMap(p => p.scheduleIds))
    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      weekdayIds.forEach(id => next.delete(id))
      return next
    })
    setMessage(null)
  }

  const handleClearAll = () => {
    setSelectedScheduleIds(new Set())
    setMessage(null)
  }

  const handleSave = async () => {
    if (!selectedMemberId || !publication) return
    setIsSaving(true)
    setMessage(null)

    try {
      const selections = schedules.map(s => ({
        scheduleId: s.id,
        isSelected: selectedScheduleIds.has(s.id)
      }))

      await scheduleService.adminUpdateMemberPublicationSchedules(
        publication.id,
        selectedMemberId,
        selections,
        markAsSubmitted,
        'Admin'
      )

      setMessage({
        type: 'success',
        text: `Schedule successfully updated for ${currentMember ? getFullName(currentMember) : 'member'}!`
      })

      onSuccess()
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err: any) {
      console.error('Failed to save admin schedule assignment:', err)
      setMessage({ type: 'error', text: err.message || 'Failed to save schedule.' })
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
            <span className={`px-1.5 py-0.2 rounded-md font-extrabold ${
              totalCount >= maxCapacity
                ? 'bg-amber-100 text-amber-900'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {totalCount} / {maxCapacity} {totalCount >= maxCapacity && '(Full)'}
            </span>
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

        {/* Content Body: Slot Selection */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {message && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {message.text}
            </div>
          )}

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
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={markAsSubmitted}
              onChange={e => setMarkAsSubmitted(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
            />
            <span>Mark as Submitted / Finalized in Publication</span>
          </label>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || loading || !selectedMemberId}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{isSaving ? 'Saving Changes...' : `Save Schedule (${selectedSundayCount + selectedWeekdayCount} slots)`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
