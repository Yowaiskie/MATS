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
  isOpen?: boolean
  onClose?: () => void
  initialPatternId?: string
  initialSlotIndex?: number | null
  effectiveDate?: string
  onEffectiveDateChange?: (date: string) => void
}

export const AdminMassAssignmentPanel: React.FC<Props> = ({
  publication,
  publicationSchedules,
  members,
  onSuccess,
  isOpen,
  onClose,
  initialPatternId,
  initialSlotIndex,
  effectiveDate: controlledEffectiveDate,
  onEffectiveDateChange
}) => {
  const { toast } = useToast()
  const { user, profile } = useAuth()

  // Effective Date state (defaults to parish today, clamped within publication bounds)
  const [internalEffectiveDate, setInternalEffectiveDate] = useState<string>(() => {
    const today = getParishTodayDate()
    if (publication) {
      if (today < publication.startDate) return publication.startDate
      if (today > publication.endDate) return publication.endDate
    }
    return today
  })

  const effectiveDate = controlledEffectiveDate ?? internalEffectiveDate
  const setEffectiveDate = (date: string) => {
    setInternalEffectiveDate(date)
    if (onEffectiveDateChange) onEffectiveDateChange(date)
  }

  // Selected schedule pattern
  const [selectedPatternId, setSelectedPatternId] = useState<string>(initialPatternId || '')
  const [highlightedSlotIndex, setHighlightedSlotIndex] = useState<number | null>(initialSlotIndex ?? null)
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

  // Sync with initialPatternId when modal opens or target pattern changes
  useEffect(() => {
    if (initialPatternId) {
      setSelectedPatternId(initialPatternId)
    }
  }, [initialPatternId, isOpen])

  useEffect(() => {
    setHighlightedSlotIndex(initialSlotIndex ?? null)
  }, [initialSlotIndex, initialPatternId, isOpen])

  // Select first pattern by default if not set
  useEffect(() => {
    if (!selectedPatternId && allPatterns.length > 0) {
      setSelectedPatternId(allPatterns[0].id)
    } else if (selectedPatternId && allPatterns.length > 0 && !allPatterns.some(p => p.id === selectedPatternId)) {
      setSelectedPatternId(allPatterns[0].id)
    }
  }, [allPatterns, selectedPatternId])

  const activePatternIndex = useMemo(() => {
    return allPatterns.findIndex(p => p.id === selectedPatternId)
  }, [allPatterns, selectedPatternId])

  const activePattern = useMemo(() => {
    return activePatternIndex >= 0 ? allPatterns[activePatternIndex] : null
  }, [allPatterns, activePatternIndex])

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
    setHighlightedSlotIndex(null)
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
      if (onClose) onClose()
    } catch (err: any) {
      console.error('Failed to save mass pattern roster:', err)
      toast.error(err.message || 'Failed to update Mass roster.')
    } finally {
      setSaving(false)
    }
  }

  if (isOpen === false) return null

  const content = (
    <div className="flex flex-col h-full max-h-[92dvh] bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden">
      {/* Top Modal / Drawer Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                Manage Mass Roster
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate">
              Assign altar servers directly to recurring Mass slots
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Effective Date Pill on Desktop */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-bold text-[11px]">Effective:</span>
            <input
              type="date"
              value={effectiveDate}
              min={publication.startDate}
              max={publication.endDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="bg-transparent text-indigo-700 font-extrabold text-xs cursor-pointer focus:outline-none"
            />
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Pattern Switcher Bar */}
      <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50/80 border-b border-slate-200/80 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activePatternIndex <= 0}
              onClick={() => {
                if (activePatternIndex > 0) {
                  setSelectedPatternId(allPatterns[activePatternIndex - 1].id)
                  setHighlightedSlotIndex(null)
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition shadow-2xs"
              title="Previous Mass"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={activePatternIndex < 0 || activePatternIndex >= allPatterns.length - 1}
              onClick={() => {
                if (activePatternIndex < allPatterns.length - 1) {
                  setSelectedPatternId(allPatterns[activePatternIndex + 1].id)
                  setHighlightedSlotIndex(null)
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition shadow-2xs"
              title="Next Mass"
            >
              Next →
            </button>

            {/* Mobile Effective Date */}
            <div className="flex sm:hidden items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px]">
              <span className="text-slate-500 font-bold">From:</span>
              <input
                type="date"
                value={effectiveDate}
                min={publication.startDate}
                max={publication.endDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="bg-transparent text-indigo-700 font-extrabold text-[10px] cursor-pointer focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Select Dropdown */}
          <div className="w-full sm:w-auto sm:flex-1 sm:max-w-xs sm:ml-auto">
            <select
              value={selectedPatternId}
              onChange={(e) => {
                setSelectedPatternId(e.target.value)
                setHighlightedSlotIndex(null)
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {allPatterns.map(p => {
                const filledCount = (p.assignedMembers || []).filter(Boolean).length
                return (
                  <option key={p.id} value={p.id}>
                    {p.dayName} • {formatTime12Hour(p.startTime)} {p.location ? `(${p.location})` : ''} [{filledCount} assigned]
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Active Mass Pattern Workspace */}
      {activePattern ? (
        <form onSubmit={handleSaveClick} className="flex flex-col flex-1 min-h-0">
          {/* Active Pattern Subheader */}
          <div className="px-5 py-3.5 sm:px-6 bg-indigo-50/40 border-b border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider shadow-2xs">
                  {activePattern.dayName}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {formatTime12Hour(activePattern.startTime)}
                </span>
                {activePattern.location && (
                  <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                    {activePattern.location}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-1 font-semibold">
                {activePattern.title || 'Holy Mass'} •{' '}
                <span className="text-indigo-700 font-bold">{futureOccurrences.length} upcoming occurrence(s)</span>
                {historicalOccurrences.length > 0 && ` (${historicalOccurrences.length} past preserved)`}
              </p>
            </div>

            {/* Rank Breakdown Pills */}
            {publication.enableRankQuotas && rankBreakdown && (
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-extrabold">
                {rankBreakdown.items.map(item => (
                  <span
                    key={item.rank}
                    className={`px-2.5 py-1 rounded-lg border shadow-2xs ${
                      item.isFull
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.rank}: {item.current}{item.limit !== undefined ? ` / ${item.limit}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable Slots List */}
          <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1">
            {Array.from({ length: maxSlots }).map((_, idx) => {
              const currentMemberId = slots[idx] || ''
              const currentMember = memberMap.get(currentMemberId)
              const isDupe = currentMemberId && duplicateMemberIds.includes(currentMemberId)
              const isFocusedSlot = highlightedSlotIndex === idx

              return (
                <div 
                  key={idx} 
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isDupe 
                      ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200' 
                      : isFocusedSlot
                        ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-300 shadow-sm'
                        : currentMemberId 
                          ? 'bg-white border-indigo-200/80 shadow-2xs' 
                          : 'bg-slate-50/60 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        currentMemberId
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        Slot S-{idx + 1}
                      </span>
                      {isFocusedSlot && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          Selected Slot
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {currentMember?.rank && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          currentMember.rank === 'Chevaliers'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : currentMember.rank === 'Paladins'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {currentMember.rank}
                        </span>
                      )}
                      {!currentMemberId && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Vacant
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <MemberSearchDropdown
                        members={members}
                        value={currentMemberId}
                        onChange={(selectedId) => handleSlotChange(idx, selectedId)}
                        placeholder={`Search & assign server for Slot S-${idx + 1}...`}
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
                        className="px-2.5 sm:px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition border border-rose-200 cursor-pointer shrink-0"
                        title="Remove Server from Slot"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {isDupe && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 mt-2">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Duplicate Server: This altar server is assigned more than once in this Mass.</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                nonBlankSlots.length === maxSlots
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : nonBlankSlots.length > 0
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {nonBlankSlots.length} / {maxSlots} Filled
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {maxSlots - nonBlankSlots.length} vacant
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  const empty = Array(maxSlots).fill('')
                  setSlots(empty)
                }}
                disabled={saving || nonBlankSlots.length === 0}
                className="flex-1 sm:flex-none px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition border border-rose-200 disabled:opacity-40 cursor-pointer"
              >
                Clear All
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={saving || duplicateMemberIds.length > 0}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Save Roster'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-10 text-center text-xs font-bold text-slate-400">
          No Mass patterns available for this publication.
        </div>
      )}

      {/* Confirm Overwrite Dialog */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeSave}
        title="Confirm Mass Roster Update"
        message={
          activePattern
            ? `You are replacing or removing existing server assignments for ${activePattern.dayName} ${formatTime12Hour(activePattern.startTime)} Mass. This change will apply to ${futureOccurrences.length} upcoming occurrence(s). Historical occurrences will not be modified. Do you want to proceed?`
            : 'Do you want to apply these schedule changes?'
        }
        confirmLabel="Confirm & Save Roster"
        cancelLabel="Cancel"
      />
    </div>
  )

  if (isOpen !== undefined) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 animate-in fade-in duration-150">
        <div className="w-full max-w-2xl">
          {content}
        </div>
      </div>
    )
  }

  return content
}
