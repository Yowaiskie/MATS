import React, { useState, useEffect, useMemo } from 'react'
import type { SchedulePublication } from '@/types/publication'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { scheduleService } from '@/services/scheduleService'
import { useAuth } from '@/features/authentication/AuthContext'
import { 
  formatTime12Hour, 
  isSundayOrAnticipatedMass, 
  isHistoricalScheduleOccurrence,
  getParishTodayDate,
  groupSchedulesIntoPatterns,
  getSlotRankBreakdown
} from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'
import { ConfirmModal } from '@/components/Dialog'
import { useToast } from '@/components'

interface Props {
  publication: SchedulePublication
  publicationSchedules: Schedule[]
  members: Member[]
  onSuccess: () => Promise<void> | void
}

export const AdminMassAssignmentPanel: React.FC<Props> = ({
  publication,
  publicationSchedules,
  members,
  onSuccess
}) => {
  const { toast } = useToast()
  const { user, profile } = useAuth()

  // Effective Date state (defaults to parish today, clamped within publication bounds)
  const [effectiveDate, setEffectiveDate] = useState<string>(() => {
    const today = getParishTodayDate()
    if (publication) {
      if (today < publication.startDate) return publication.startDate
      if (today > publication.endDate) return publication.endDate
    }
    return today
  })

  // Selected schedule pattern
  const [selectedPatternId, setSelectedPatternId] = useState<string>('')
  const [slots, setSlots] = useState<string[]>([])
  const [initialAssignments, setInitialAssignments] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  // Group patterns
  const { sundayPatterns, weekdayPatterns, specialPatterns } = useMemo(() => {
    return groupSchedulesIntoPatterns(publicationSchedules, publication)
  }, [publicationSchedules, publication])

  const allPatterns = useMemo(() => {
    return [...sundayPatterns, ...weekdayPatterns, ...specialPatterns]
  }, [sundayPatterns, weekdayPatterns, specialPatterns])

  // Select first pattern by default if not set
  useEffect(() => {
    if (!selectedPatternId && allPatterns.length > 0) {
      setSelectedPatternId(allPatterns[0].id)
    }
  }, [allPatterns, selectedPatternId])

  const activePattern = useMemo(() => {
    return allPatterns.find(p => p.id === selectedPatternId) || null
  }, [allPatterns, selectedPatternId])

  // Sliced upcoming occurrences for active pattern
  const { futureOccurrences, historicalOccurrences } = useMemo(() => {
    if (!activePattern) return { futureOccurrences: [], historicalOccurrences: [] }
    const patternScheds = publicationSchedules.filter(s => activePattern.scheduleIds.includes(s.id))
    const future: Schedule[] = []
    const hist: Schedule[] = []

    patternScheds.forEach(s => {
      if (isHistoricalScheduleOccurrence(s, effectiveDate, 'Asia/Manila')) {
        hist.push(s)
      } else {
        future.push(s)
      }
    })

    return { futureOccurrences: future, historicalOccurrences: hist }
  }, [activePattern, publicationSchedules, effectiveDate])

  // Max slots for active pattern
  const maxSlots = useMemo(() => {
    if (!activePattern) return 5
    if (activePattern.isSpecialEvent) {
      return publication.maxServersPerSpecialSlot ?? 6
    }
    const isSunday = isSundayOrAnticipatedMass(
      activePattern.title || '',
      activePattern.date || publication.startDate,
      activePattern.startTime
    )
    if (isSunday) {
      return publication.maxServersPerSundaySlot ?? 5
    }
    return publication.maxServersPerWeekdaySlot ?? 5
  }, [activePattern, publication])

  // When active pattern changes, load existing assignments
  useEffect(() => {
    if (!activePattern) {
      setSlots([])
      setInitialAssignments([])
      return
    }

    // Determine baseline assignments: prefer future occurrence if available, otherwise pattern default
    const existing = futureOccurrences.length > 0
      ? (futureOccurrences[0].assignedMembers || [])
      : (activePattern.assignedMembers || [])

    const newSlots: string[] = Array(maxSlots).fill('')
    existing.forEach((id, idx) => {
      if (idx < maxSlots) {
        newSlots[idx] = id
      }
    })

    setSlots(newSlots)
    setInitialAssignments([...existing])
  }, [activePattern, maxSlots, futureOccurrences])

  const handleSlotChange = (index: number, memberId: string) => {
    setSlots(prev => {
      const copy = [...prev]
      copy[index] = memberId
      return copy
    })
  }

  // Duplicate checks
  const nonBlankSlots = useMemo(() => slots.filter(Boolean), [slots])
  const duplicateMemberIds = useMemo(() => {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    nonBlankSlots.forEach(id => {
      if (seen.has(id)) {
        dupes.add(id)
      } else {
        seen.add(id)
      }
    })
    return Array.from(dupes)
  }, [nonBlankSlots])

  // Rank breakdown
  const rankBreakdown = useMemo(() => {
    if (!activePattern) return null
    const isSunday = isSundayOrAnticipatedMass(
      activePattern.title || '',
      activePattern.date || publication.startDate,
      activePattern.startTime
    )
    return getSlotRankBreakdown(
      nonBlankSlots,
      members,
      publication,
      isSunday,
      activePattern.isSpecialEvent
    )
  }, [activePattern, nonBlankSlots, members, publication])

  const memberMap = useMemo(() => {
    return new Map(members.map(m => [m.id, m]))
  }, [members])

  // Check if assignments were replaced/removed
  const isReplacingExisting = useMemo(() => {
    if (initialAssignments.length === 0) return false
    if (nonBlankSlots.length !== initialAssignments.length) return true
    return initialAssignments.some(id => !nonBlankSlots.includes(id))
  }, [initialAssignments, nonBlankSlots])

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activePattern) return

    if (duplicateMemberIds.length > 0) {
      const dupMember = memberMap.get(duplicateMemberIds[0])
      toast.error(
        `Duplicate server: ${dupMember ? getFullName(dupMember) : 'A server'} is assigned to multiple slots in this Mass.`
      )
      return
    }

    if (isReplacingExisting) {
      setConfirmModalOpen(true)
    } else {
      executeSave()
    }
  }

  const executeSave = async () => {
    if (!activePattern) return
    setSaving(true)
    setConfirmModalOpen(false)

    try {
      const result = await scheduleService.adminAssignMembersToMassPattern(
        publication.id,
        activePattern.scheduleIds,
        nonBlankSlots,
        {
          effectiveDate,
          adminUser: {
            uid: user?.uid || profile?.uid || 'Admin',
            email: user?.email || undefined,
            role: profile?.role || 'admin',
            permissions: { canManageSchedules: true }
          }
        }
      )

      toast.success(
        `Roster saved for ${activePattern.dayName} ${formatTime12Hour(activePattern.startTime)}. ` +
        `(${result.updatedFutureSchedulesCount} future occurrences updated, ` +
        `${result.preservedHistoricalSchedulesCount} historical preserved)`
      )

      await onSuccess()
    } catch (err: any) {
      console.error('Failed to save mass pattern roster:', err)
      toast.error(err.message || 'Failed to update Mass roster.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-32">
      {/* Admin Mode Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-700/60 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Admin Direct Scheduling Mode</h3>
              <p className="text-xs text-indigo-200">
                Assign and update servers for Mass schedule patterns. Changes apply to future occurrences within this publication.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs self-start sm:self-auto">
            <span className="text-indigo-200 font-semibold">Effective:</span>
            <input
              type="date"
              value={effectiveDate}
              min={publication.startDate}
              max={publication.endDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="bg-slate-900/60 text-amber-300 font-extrabold px-2 py-0.5 rounded border border-indigo-400/30 text-xs cursor-pointer focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mass Schedule Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
          Select Mass Schedule
        </label>
        
        {/* Mobile/Compact Select */}
        <div className="block sm:hidden mb-3">
          <select
            value={selectedPatternId}
            onChange={(e) => setSelectedPatternId(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
          >
            {allPatterns.map(p => (
              <option key={p.id} value={p.id}>
                {p.dayName} — {formatTime12Hour(p.startTime)} {p.location ? `(${p.location})` : ''} ({p.assignedMembers.length} assigned)
              </option>
            ))}
          </select>
        </div>

        {/* Desktop/Tablet Horizontal Pill List */}
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {allPatterns.map(p => {
            const isSelected = p.id === selectedPatternId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPatternId(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer border flex items-center gap-2 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{p.dayName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[11px] ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
                  {formatTime12Hour(p.startTime)}
                </span>
                {p.location && (
                  <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {p.location}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mass Slot Assignment Workspace */}
      {activePattern && (
        <form onSubmit={handleSaveClick} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Active Pattern Card Header */}
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-t-2xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                  {activePattern.dayName}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-sm font-black text-slate-900">
                  {formatTime12Hour(activePattern.startTime)}
                </span>
                {activePattern.location && (
                  <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {activePattern.location}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {activePattern.title || 'Holy Mass'} • {futureOccurrences.length} upcoming occurrences to update ({historicalOccurrences.length} historical preserved)
              </p>
            </div>

            {/* Rank Breakdown Pills */}
            {publication.enableRankQuotas && rankBreakdown && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                {rankBreakdown.items.map(item => (
                  <span
                    key={item.rank}
                    className={`px-2 py-1 rounded-md border ${
                      item.isFull
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {item.rank}: {item.current}{item.limit !== undefined ? ` / ${item.limit}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Slots List (Server 1 to Server N) */}
          <div className="p-4 sm:p-6 space-y-4">
            {Array.from({ length: maxSlots }).map((_, idx) => {
              const currentMemberId = slots[idx] || ''
              const currentMember = memberMap.get(currentMemberId)
              const isDupe = currentMemberId && duplicateMemberIds.includes(currentMemberId)

              return (
                <div 
                  key={idx} 
                  className={`p-3.5 rounded-xl border transition ${
                    isDupe 
                      ? 'bg-rose-50/50 border-rose-300' 
                      : currentMemberId 
                        ? 'bg-indigo-50/30 border-indigo-100' 
                        : 'bg-slate-50/40 border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-700">
                        Server {idx + 1}
                      </span>
                    </div>

                    {currentMember?.rank && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-white border border-slate-200 text-slate-700">
                        {currentMember.rank}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <MemberSearchDropdown
                        members={members}
                        value={currentMemberId}
                        onChange={(selectedId) => handleSlotChange(idx, selectedId)}
                        placeholder={`Select Server ${idx + 1}...`}
                        allowClear={true}
                        disabled={saving}
                        placement={idx >= Math.max(2, maxSlots - 2) ? 'top' : 'auto'}
                      />
                    </div>
                    {currentMemberId && (
                      <button
                        type="button"
                        onClick={() => handleSlotChange(idx, '')}
                        disabled={saving}
                        className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition border border-rose-200 cursor-pointer shrink-0"
                        title="Clear Slot"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {isDupe && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 mt-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Duplicate Server: This altar server is assigned multiple times to this Mass.</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action Footer */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-2xl">
            <div className="text-xs text-slate-500 font-semibold">
              {nonBlankSlots.length} of {maxSlots} slots configured
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const empty = Array(maxSlots).fill('')
                  setSlots(empty)
                }}
                disabled={saving || nonBlankSlots.length === 0}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition border border-slate-200 disabled:opacity-50 cursor-pointer"
              >
                Clear All Slots
              </button>

              <button
                type="submit"
                disabled={saving || duplicateMemberIds.length > 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Mass Roster'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Confirm Overwrite Dialog */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeSave}
        title="Confirm Mass Roster Replacement"
        message={
          activePattern
            ? `You are replacing or removing existing server assignments for ${activePattern.dayName} ${formatTime12Hour(activePattern.startTime)} Mass. This change will apply to ${futureOccurrences.length} upcoming occurrences. Historical occurrences will not be modified. Do you want to proceed?`
            : 'Do you want to apply these schedule changes?'
        }
        confirmLabel="Confirm & Save Roster"
        cancelLabel="Cancel"
      />
    </div>
  )
}
