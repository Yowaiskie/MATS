import React, { useState, useEffect, useMemo } from 'react'
import type { SchedulePublication } from '@/types/publication'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { publicationService } from '@/services/publicationService'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { autoAssignService, type AutoAssignResult } from '@/services/autoAssignService'
import { isSundayOrAnticipatedMass, formatTime12Hour } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'

interface ManageSubmissionsModalProps {
  isOpen: boolean
  onClose: () => void
  publication: SchedulePublication | null
  onSuccess: () => void
}

type FilterTab = 'all' | 'submitted' | 'unsubmitted'

export interface GroupedMemberSlot {
  key: string
  dayName: string
  dayOfWeek: number
  startTime: string
  formattedTime: string
  title: string
  isSunday: boolean
  datesCount: number
}

interface MemberWithScheduleStatus {
  member: Member
  isSubmitted: boolean
  hasSchedule: boolean
  totalSchedules: number
  sundaysCount: number
  weekdaysCount: number
  assignedScheduleIds: string[]
  groupedSlots: GroupedMemberSlot[]
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const ManageSubmissionsModal: React.FC<ManageSubmissionsModalProps> = ({
  isOpen,
  onClose,
  publication,
  onSuccess
}) => {
  const [members, setMembers] = useState<Member[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set())
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-Assign Modal State
  const [showAutoAssignConfirm, setShowAutoAssignConfirm] = useState(false)
  const [autoAssignMode, setAutoAssignMode] = useState<'both' | 'sundays_only' | 'weekdays_only'>('both')
  const [assignTargetScope, setAssignTargetScope] = useState<'all_unsubmitted' | 'selected_only'>('all_unsubmitted')
  const [autoAssignResult, setAutoAssignResult] = useState<AutoAssignResult | null>(null)

  const loadData = async () => {
    if (!publication) return
    setIsLoading(true)
    setMessage(null)
    try {
      const [allMembers, schedList] = await Promise.all([
        memberService.getMembers(),
        scheduleService.getSchedulesByDateRange(publication.startDate, publication.endDate)
      ])

      // Eligible altar servers (active & not squires)
      const eligible = allMembers.filter(m => {
        if (m.status !== 'active') return false
        const r = (m.rank || '').toLowerCase()
        const o = (m.order || '').toLowerCase()
        const p = (m.position || '').toLowerCase()
        return !(r.includes('squire') || o.includes('squire') || p.includes('squire'))
      })

      setMembers(eligible)
      setSchedules(schedList.filter(s => s.status !== 'cancelled'))
    } catch (err) {
      console.error('Failed to load submissions and schedules:', err)
      setMessage({ type: 'error', text: 'Failed to load member and schedule data.' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set())
      setExpandedMemberIds(new Set())
      setAutoAssignResult(null)
      setShowAutoAssignConfirm(false)
      setAutoAssignMode('both')
      setAssignTargetScope('all_unsubmitted')
      loadData()
    }
  }, [isOpen, publication])

  // Compute stats and statuses for each member (grouped by Day of Week & Time)
  const membersWithStatus = useMemo<MemberWithScheduleStatus[]>(() => {
    if (!publication) return []
    const submittedSet = new Set(publication.submittedMembers || [])

    return members.map(member => {
      let sundaysCount = 0
      let weekdaysCount = 0
      const assignedIds: string[] = []
      const slotsMap = new Map<string, GroupedMemberSlot>()

      schedules.forEach(s => {
        if (s.assignedMembers?.includes(member.id)) {
          assignedIds.push(s.id)
          const isSun = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
          if (isSun) {
            sundaysCount++
          } else {
            weekdaysCount++
          }

          // Parse day of week
          const [y, m, d] = s.date.split('-').map(Number)
          const dayOfWeek = new Date(y, m - 1, d).getDay()
          const dayName = DAY_NAMES[dayOfWeek]
          const key = `${dayOfWeek}-${s.startTime}-${s.title}`

          if (!slotsMap.has(key)) {
            slotsMap.set(key, {
              key,
              dayName,
              dayOfWeek,
              startTime: s.startTime,
              formattedTime: formatTime12Hour(s.startTime),
              title: s.title,
              isSunday: isSun,
              datesCount: 1
            })
          } else {
            const existing = slotsMap.get(key)!
            existing.datesCount++
          }
        }
      })

      // Sort grouped slots by day of week, then start time
      const groupedSlots = Array.from(slotsMap.values()).sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.startTime.localeCompare(b.startTime)
      })

      const totalSchedules = assignedIds.length
      const isSubmitted = submittedSet.has(member.id)
      const hasSchedule = totalSchedules > 0

      return {
        member,
        isSubmitted,
        hasSchedule,
        totalSchedules,
        sundaysCount,
        weekdaysCount,
        assignedScheduleIds: assignedIds,
        groupedSlots
      }
    })
  }, [members, schedules, publication])

  // Deadline calculation
  const deadlineInfo = useMemo(() => {
    if (!publication?.submissionDeadline) {
      return { hasDeadline: false, isPast: false, formatted: null }
    }
    const deadlineDate = new Date(publication.submissionDeadline)
    const now = new Date()
    const isPast = now > deadlineDate
    const formatted = deadlineDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    return { hasDeadline: true, isPast, formatted }
  }, [publication])

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return membersWithStatus.filter(item => {
      // Tab filter
      if (filterTab === 'submitted' && !item.isSubmitted && !item.hasSchedule) return false
      if (filterTab === 'unsubmitted' && (item.isSubmitted || item.hasSchedule)) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fullName = getFullName(item.member).toLowerCase()
        const rank = (item.member.rank || '').toLowerCase()
        const order = (item.member.order || '').toLowerCase()
        if (!fullName.includes(q) && !rank.includes(q) && !order.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [membersWithStatus, filterTab, searchQuery])

  // Quick stats
  const stats = useMemo(() => {
    const total = membersWithStatus.length
    const withScheduleOrSubmitted = membersWithStatus.filter(m => m.isSubmitted || m.hasSchedule).length
    const unsubmitted = membersWithStatus.filter(m => !m.isSubmitted && !m.hasSchedule).length
    
    // Compute total open slots in schedules
    const maxSun = publication?.maxServersPerSundaySlot ?? 5
    const maxWk = publication?.maxServersPerWeekdaySlot ?? 5
    let openSlots = 0
    schedules.forEach(s => {
      const isSunday = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
      const cap = isSunday ? maxSun : maxWk
      const curr = s.assignedMembers?.length || 0
      if (curr < cap) openSlots += (cap - curr)
    })

    return { total, withScheduleOrSubmitted, unsubmitted, openSlots }
  }, [membersWithStatus, schedules, publication])

  // Selected members categorized into With Schedule vs Pending
  const selectedMembersWithSchedule = useMemo(() => {
    return membersWithStatus.filter(m => selectedIds.has(m.member.id) && (m.hasSchedule || m.isSubmitted))
  }, [membersWithStatus, selectedIds])

  const selectedPendingMembers = useMemo(() => {
    return membersWithStatus.filter(m => selectedIds.has(m.member.id) && !m.hasSchedule && !m.isSubmitted)
  }, [membersWithStatus, selectedIds])

  if (!isOpen || !publication) return null

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMembers.map(item => item.member.id)))
    }
  }

  const toggleExpandMember = (memberId: string) => {
    setExpandedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const handleReset = async () => {
    const ids = selectedMembersWithSchedule.map(m => m.member.id)
    if (ids.length === 0) return
    setIsSubmitting(true)
    setMessage(null)

    try {
      // 1. Remove from schedules
      await scheduleService.removeMembersFromSchedules(publication.startDate, publication.endDate, ids)
      
      // 2. Remove from publication submissions
      await publicationService.resetMembersSubmission(publication.id, ids)

      setMessage({ type: 'success', text: `Successfully reset schedule submissions for ${ids.length} member(s).` })
      setSelectedIds(new Set())
      await loadData()
      onSuccess()
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Failed to reset submissions.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRunAutoAssign = async () => {
    setShowAutoAssignConfirm(false)
    setIsSubmitting(true)
    setMessage(null)

    try {
      const targetIds = assignTargetScope === 'selected_only' ? Array.from(selectedIds) : undefined
      const result = await autoAssignService.autoAssignUnsubmittedMembers({
        publication,
        targetMemberIds: targetIds,
        mode: autoAssignMode,
        performedBy: 'Coordinator'
      })

      setAutoAssignResult(result)
      await loadData()
      onSuccess()
    } catch (err: any) {
      console.error('Auto-assign failed:', err)
      setMessage({ type: 'error', text: err.message || 'Auto-assignment failed.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] border border-slate-200">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-purple-50 border border-purple-200/80 rounded-xl sm:rounded-2xl text-purple-600 shrink-0 shadow-2xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-black text-slate-900 truncate">Submission Monitor</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 shrink-0">
                  {publication.status}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-0.5 truncate">
                {publication.name} ({publication.startDate} to {publication.endDate})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
          
          {/* Deadline Alert Banner */}
          {deadlineInfo.hasDeadline && (
            <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 text-[11px] sm:text-xs font-bold ${
              deadlineInfo.isPast 
                ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${deadlineInfo.isPast ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span>
                  {deadlineInfo.isPast 
                    ? `Deadline Passed on: ${deadlineInfo.formatted}`
                    : `Submission Deadline: ${deadlineInfo.formatted}`}
                </span>
              </div>
              {deadlineInfo.isPast && stats.unsubmitted > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignTargetScope(selectedIds.size > 0 ? 'selected_only' : 'all_unsubmitted')
                    setShowAutoAssignConfirm(true)
                  }}
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black shadow-xs cursor-pointer whitespace-nowrap active:scale-95 transition-all self-end sm:self-auto"
                >
                  🎲 Auto-Assign ({stats.unsubmitted})
                </button>
              )}
            </div>
          )}

          {/* Quick Stats Grid: Compact on mobile */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <div className="p-2 sm:p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl text-center sm:text-left">
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">Total</span>
              <div className="text-sm sm:text-xl font-black text-slate-800 mt-0.5">{stats.total}</div>
            </div>
            <div className="p-2 sm:p-3.5 bg-emerald-50/60 border border-emerald-200/70 rounded-xl sm:rounded-2xl text-center sm:text-left">
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block truncate">With Sched</span>
              <div className="text-sm sm:text-xl font-black text-emerald-700 mt-0.5">{stats.withScheduleOrSubmitted}</div>
            </div>
            <div className="p-2 sm:p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl sm:rounded-2xl text-center sm:text-left">
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block truncate">Pending</span>
              <div className="text-sm sm:text-xl font-black text-amber-700 mt-0.5">{stats.unsubmitted}</div>
            </div>
          </div>

          {message && (
            <div className={`p-3.5 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {message.text}
            </div>
          )}

          {/* Auto-Assignment Result Summary Toast */}
          {autoAssignResult && (
            <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200 text-indigo-900 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-indigo-600 text-white text-xs">✓</span>
                  <span className="text-xs font-black">
                    Auto-Assignment Complete: Assigned {autoAssignResult.assignedMembersCount} member(s) across unfilled slots!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoAssignResult(null)}
                  className="text-xs text-indigo-500 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <div className="text-[11px] text-indigo-700 max-h-36 overflow-y-auto divide-y divide-indigo-100/80 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                {autoAssignResult.memberSummaries.map(ms => (
                  <div key={ms.memberId} className="py-1.5 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-950">{ms.memberName}</span>
                      <span className="font-semibold text-indigo-600 text-[10px]">
                        {ms.sundaysAssigned} Sundays, {ms.weekdaysAssigned} Weekdays ({ms.assignedScheduleTitles.length} slots)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 pl-2">
                      {ms.assignedScheduleTitles.join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar: Filters, Search, and Auto-Assign CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
            
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                  filterTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('submitted')}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                  filterTab === 'submitted'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                With Sched ({stats.withScheduleOrSubmitted})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unsubmitted')}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                  filterTab === 'unsubmitted'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                Pending ({stats.unsubmitted})
              </button>
            </div>

            {/* Search Input & Action */}
            <div className="flex items-center gap-2 flex-1 sm:max-w-sm sm:ml-auto">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search name or rank..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 sm:pl-8 pr-2.5 sm:pr-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                <svg className="w-3.5 h-3.5 absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {stats.unsubmitted > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignTargetScope(selectedIds.size > 0 ? 'selected_only' : 'all_unsubmitted')
                    setShowAutoAssignConfirm(true)
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Assign members randomly to available open slots"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>{selectedIds.size > 0 ? `Auto-Assign (${selectedIds.size})` : 'Auto-Assign'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Members Table */}
          <div className="border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 flex items-center justify-between">
              <label className="flex items-center gap-2 sm:gap-3 cursor-pointer text-[11px] sm:text-xs font-black text-slate-700">
                <input
                  type="checkbox"
                  checked={filteredMembers.length > 0 && selectedIds.size === filteredMembers.length}
                  onChange={handleToggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-600 cursor-pointer"
                />
                <span>ALL FILTERED ({filteredMembers.length})</span>
              </label>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                {selectedIds.size} Selected
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-56 sm:max-h-72 overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-xs font-bold text-slate-400">Loading members and schedules...</div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-6 text-center text-xs font-semibold text-slate-400">
                  No members match the current filter.
                </div>
              ) : (
                filteredMembers.map(item => {
                  const isExpanded = expandedMemberIds.has(item.member.id)
                  const isChecked = selectedIds.has(item.member.id)
                  const slotsCount = item.groupedSlots.length

                  return (
                    <div key={item.member.id} className={`transition-colors ${isChecked ? 'bg-purple-50/30' : 'hover:bg-slate-50/70'}`}>
                      {/* Main Member Row */}
                      <div className="flex items-center justify-between p-2.5 sm:p-3.5 gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(item.member.id)}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-600 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {item.member.lastName}, {item.member.firstName}
                              </span>
                              {item.member.rank && (
                                <span className="px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  {item.member.rank}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{item.member.order || 'Altar Server'}</span>
                              {item.hasSchedule && (
                                <span className="text-slate-500 font-bold">
                                  • {slotsCount} {slotsCount === 1 ? 'Slot' : 'Slots'} ({item.sundaysCount} Sun, {item.weekdaysCount} Wk)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Dropdown Action or Pending Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.hasSchedule ? (
                            <button
                              type="button"
                              onClick={() => toggleExpandMember(item.member.id)}
                              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                                isExpanded
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20'
                                  : 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                              title="Click to view scheduled mass slots for this member"
                            >
                              <span>{slotsCount} {slotsCount === 1 ? 'Slot' : 'Slots'}</span>
                              <svg 
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white' : 'text-emerald-600'}`} 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor" 
                                strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Drawer: Grouped by Day & Time */}
                      {isExpanded && item.hasSchedule && (
                        <div className="bg-slate-50/90 border-t border-slate-200/60 p-2.5 sm:p-3.5 pl-8 sm:pl-10 pr-3 sm:pr-4 space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            <span>Mass Schedule Slots for {item.member.firstName}</span>
                            <span>{slotsCount} {slotsCount === 1 ? 'Slot' : 'Slots'}</span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2">
                            {item.groupedSlots.map(slot => (
                              <div 
                                key={slot.key} 
                                className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between text-[11px] sm:text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${slot.isSunday ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                  <div className="min-w-0">
                                    <div className="font-black text-slate-900 truncate">
                                      {slot.dayName} • {slot.formattedTime}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">
                                      {slot.title}
                                    </div>
                                  </div>
                                </div>
                                <span className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-extrabold uppercase shrink-0 ${
                                  slot.isSunday ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  {slot.isSunday ? 'Sunday' : 'Weekday'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-3 py-2.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-[11px] sm:text-xs font-bold text-slate-500 text-center sm:text-left">
            {selectedIds.size > 0 ? (
              <span className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-slate-800 font-black">{selectedIds.size} selected</span>
                <span>•</span>
                <span className="text-emerald-700 font-semibold">{selectedMembersWithSchedule.length} with sched</span>
                <span>•</span>
                <span className="text-amber-700 font-semibold">{selectedPendingMembers.length} pending</span>
              </span>
            ) : (
              'Select members to reset or auto-assign'
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer text-center"
            >
              Close
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || selectedMembersWithSchedule.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer text-center"
              title={selectedMembersWithSchedule.length === 0 ? 'Only members who have existing schedules can be reset.' : 'Reset schedule for selected members'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{isSubmitting ? 'Resetting...' : `Reset Selected (${selectedMembersWithSchedule.length})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Auto-Assignment */}
      {showAutoAssignConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-3 sm:space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" className="sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">Auto-Assign Schedule</h3>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-0.5">Fair Random Slot Distribution</p>
              </div>
            </div>

            {/* Target Members Selector */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                1. Target Members to Assign:
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setAssignTargetScope('all_unsubmitted')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                    assignTargetScope === 'all_unsubmitted'
                      ? 'bg-purple-50 border-purple-600 text-purple-900 ring-2 ring-purple-500/20 font-black shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs font-black">All Unsubmitted</span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">({stats.unsubmitted} members)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignTargetScope('selected_only')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                    assignTargetScope === 'selected_only'
                      ? 'bg-purple-50 border-purple-600 text-purple-900 ring-2 ring-purple-500/20 font-black shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs font-black">Selected Only</span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">({selectedIds.size} checked)</span>
                </button>
              </div>
            </div>

            {/* Selected members list preview if selected_only */}
            {assignTargetScope === 'selected_only' && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                {selectedIds.size === 0 ? (
                  <p className="text-amber-700 font-semibold text-[11px] text-center">
                    ⚠️ No members selected in the table. Please check members first or switch to &quot;All Unsubmitted&quot;.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Assigned to {selectedIds.size} Selected Member(s):
                    </span>
                    <div className="max-h-20 overflow-y-auto divide-y divide-slate-100 text-[11px] font-bold text-slate-700">
                      {members
                        .filter(m => selectedIds.has(m.id))
                        .map(m => (
                          <div key={m.id} className="py-0.5">{getFullName(m)}</div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mass Selection Mode Toggle */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                2. Select Mass Types to Assign:
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setAutoAssignMode('both')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                    autoAssignMode === 'both'
                      ? 'bg-purple-50 border-purple-600 text-purple-900 ring-2 ring-purple-500/20 font-black shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs font-black">All Masses</span>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium block mt-0.5">Sun & Wk</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoAssignMode('sundays_only')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                    autoAssignMode === 'sundays_only'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20 font-black shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs font-black">Sundays</span>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium block mt-0.5">+ Anticipated</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoAssignMode('weekdays_only')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                    autoAssignMode === 'weekdays_only'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-2 ring-emerald-500/20 font-black shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs font-black">Weekdays</span>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium block mt-0.5">Mon to Fri</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
              <p className="font-semibold text-slate-700 text-[11px]">
                System distribution rules applied:
              </p>
              <ul className="list-disc list-inside space-y-0.5 font-medium text-slate-600 text-[10px] sm:text-[11px]">
                {autoAssignMode !== 'weekdays_only' && (
                  <li>Max {publication.maxSundaysPerServer ?? 4} Sundays / server quota</li>
                )}
                {autoAssignMode !== 'sundays_only' && (
                  <li>Max {publication.maxWeekdaysPerServer ?? 8} Weekdays / server quota</li>
                )}
                <li>Slot capacities ({publication.maxServersPerSundaySlot ?? 5} Sunday, {publication.maxServersPerWeekdaySlot ?? 5} Weekday)</li>
                <li>No same-day overlapping time conflicts</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAutoAssignConfirm(false)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunAutoAssign}
                disabled={isSubmitting || (assignTargetScope === 'selected_only' && selectedIds.size === 0)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-purple-600/25 active:scale-95 transition cursor-pointer"
              >
                <span>{isSubmitting ? 'Assigning...' : 'Yes, Assign Randomly'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
