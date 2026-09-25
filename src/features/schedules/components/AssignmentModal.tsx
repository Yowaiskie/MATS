import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import { getOrderBadgeStyle } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { getFullName } from '@/utils/member'
import { isTimeOverlapping, formatTime12Hour } from '@/utils/scheduleUtils'
import { qualificationService } from '@/services/qualificationService'
import { ConfirmModal } from '@/components/Dialog'

interface AssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: Schedule | null
  activeMembers: Member[]
  allSchedules: Schedule[]
  onSave: (scheduleId: string, assignedIds: string[], applyToMonth: boolean) => Promise<void>
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  schedule,
  activeMembers,
  allSchedules,
  onSave,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [suspendedConfirmMember, setSuspendedConfirmMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [applyToMonth, setApplyToMonth] = useState(false)

  // Determine if this schedule is a Meeting or Formation
  const isMeetingOrFormation = schedule
    ? (qualificationService.scheduleMatchesCategory(schedule, 'meeting') || qualificationService.scheduleMatchesCategory(schedule, 'formation'))
    : false

  useEffect(() => {
    if (schedule) {
      setSelectedIds(schedule.assignedMembers || [])
      setSuspendedConfirmMember(null)
      setError(null)
      setApplyToMonth(false)
      setSearch('')
    }
  }, [schedule, isOpen])

  if (!isOpen || !schedule) return null

  // Find other schedules on the same day that are active (not cancelled)
  const otherSchedulesOnSameDay = allSchedules.filter(
    (s) => 
      s.id !== schedule.id && 
      s.date === schedule.date && 
      s.status !== 'cancelled'
  )

  // Identify which members have overlapping conflicts with other services today
  const getConflictDetails = (memberId: string): string | null => {
    const overlappingSchedule = otherSchedulesOnSameDay.find(
      (s) => 
        (s.assignedMembers || []).includes(memberId) && 
        isTimeOverlapping(schedule.startTime, schedule.endTime, s.startTime, s.endTime)
    )
    return overlappingSchedule ? `${overlappingSchedule.title} (${formatTime12Hour(overlappingSchedule.startTime)} - ${formatTime12Hour(overlappingSchedule.endTime)})` : null
  }

  const isExcludedSuspended = (m: Member) => m.status === 'suspended' && !isMeetingOrFormation

  const handleToggle = (memberId: string) => {
    setError(null)
    const isCurrentlySelected = selectedIds.includes(memberId)
    if (isCurrentlySelected) {
      setSelectedIds(prev => prev.filter(id => id !== memberId))
      return
    }

    const targetMember = activeMembers.find(m => m.id === memberId)
    if (targetMember && targetMember.status === 'suspended' && !isMeetingOrFormation) {
      setSuspendedConfirmMember(targetMember)
      return
    }

    setSelectedIds(prev => [...prev, memberId])
  }

  const getSelectableMemberIds = (members: Member[]) => {
    return members
      .filter((m) => (!getConflictDetails(m.id) && !isExcludedSuspended(m)) || selectedIds.includes(m.id))
      .map((m) => m.id)
  }

  const handleSelectAllVisible = () => {
    setError(null)
    const selectableVisibleIds = getSelectableMemberIds(filteredMembers)
    if (selectableVisibleIds.length === 0) return

    const allVisibleSelected = selectableVisibleIds.every((id) => selectedIds.includes(id))
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectableVisibleIds.includes(id)))
      return
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...selectableVisibleIds])))
  }

  const handleAssignAll = () => {
    setError(null)
    const selectableActiveIds = getSelectableMemberIds(activeMembers)
    setSelectedIds(Array.from(new Set(selectableActiveIds)))
  }

  const handleClearAll = () => {
    setError(null)
    setSelectedIds([])
  }

  const isSearching = search.trim().length > 0

  const filteredMembers = activeMembers.filter((m) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      getFullName(m).toLowerCase().includes(q) ||
      (m.nickname && m.nickname.toLowerCase().includes(q)) ||
      (m.order && m.order.toLowerCase().includes(q)) ||
      (m.rank && m.rank.toLowerCase().includes(q))
    )
  })

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      await onSave(schedule.id, selectedIds, applyToMonth)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update assignments.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      {/* Modal Body: Spacious layout with maximum list view */}
      <div className="relative w-full max-w-2xl h-[94dvh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl border border-slate-200/80 bg-white p-3.5 sm:p-5 shadow-2xl z-10 text-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-xs shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">Assign Servers</h3>
                <span className="text-[9px] sm:text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 truncate">
                  {formatTime12Hour(schedule.startTime)} - {formatTime12Hour(schedule.endTime)}
                </span>
              </div>
              <p className="text-[10.5px] sm:text-xs font-semibold text-slate-500 truncate">
                {schedule.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-2.5 flex-1 flex flex-col min-h-0 space-y-2 overflow-hidden">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-650 font-medium shrink-0">
              {error}
            </div>
          )}

          {/* Search bar */}
          <div className="space-y-1.5 shrink-0">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-8 pr-8 py-1.5 sm:py-2 border border-gray-200 bg-white rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all duration-150"
                placeholder="Search server name, nickname, rank, or order..."
                disabled={loading}
                autoFocus={false}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Action pills & Result Counter */}
            <div className="flex items-center justify-between gap-1 text-[10px] shrink-0">
              <span className="font-bold text-gray-500">
                {isSearching ? (
                  <>Found <span className="text-indigo-600 font-black">{filteredMembers.length}</span> results • Selected: <span className="text-indigo-600 font-black">{selectedIds.length}</span></>
                ) : (
                  <>Total: <span className="text-slate-800 font-black">{activeMembers.length}</span> • Selected: <span className="text-indigo-600 font-black">{selectedIds.length}</span></>
                )}
              </span>
              <div className="flex items-center gap-1">
                {isSearching ? (
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    disabled={loading || filteredMembers.length === 0}
                    className="rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <span>Select Filtered ({filteredMembers.length})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAssignAll}
                    disabled={loading || activeMembers.length === 0}
                    className="rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 font-bold text-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <span>Assign All</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={loading || selectedIds.length === 0}
                  className="rounded-md border border-gray-200 bg-white hover:bg-gray-100 px-2 py-0.5 font-bold text-gray-500 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>

          {/* Members Checklist / Search Results: MAXIMUM PROMINENT SCROLLABLE SPACE */}
          <div 
            className="flex-1 min-h-[240px] sm:min-h-[300px] border border-gray-200 bg-white rounded-xl overflow-y-auto overscroll-contain divide-y divide-gray-100 shadow-xs touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id)
                const conflictWith = getConflictDetails(member.id)
                const disabled = (!!conflictWith && !isSelected) || loading

                return (
                  <label 
                    key={member.id} 
                    className={`flex items-center justify-between p-2.5 sm:p-3 transition-colors select-none ${
                      disabled 
                        ? 'opacity-40 cursor-not-allowed' 
                        : isSelected
                          ? 'bg-indigo-50/50 hover:bg-indigo-50/80 cursor-pointer'
                          : 'cursor-pointer hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !disabled && handleToggle(member.id)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 accent-indigo-600 disabled:opacity-50 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">
                          {getFullName(member)}
                          {member.nickname && <span className="text-slate-400 font-normal ml-1">({member.nickname})</span>}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-[9px] sm:text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                            {member.rank}
                          </span>
                          {member.order && (
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${getOrderBadgeStyle(member.order)}`}>
                              {member.order}
                            </span>
                          )}
                          {member.status === 'suspended' && (
                            <span 
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold cursor-help ${
                                isMeetingOrFormation
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                              title={member.suspensionReason ? `Suspension Reason: ${member.suspensionReason}${member.suspensionEndDate ? ` (Until ${member.suspensionEndDate})` : ''}` : undefined}
                            >
                              {isMeetingOrFormation 
                                ? 'SUSPENDED (Meeting Allowed)' 
                                : `SUSPENDED${member.suspensionEndDate ? ` (Until ${member.suspensionEndDate})` : ''}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conflict tag warning */}
                    {conflictWith && (
                      <span className="inline-block rounded-md bg-red-50 border border-red-100 text-red-600 px-1.5 py-0.5 text-[9px] font-semibold max-w-[120px] sm:max-w-[150px] truncate shrink-0" title={`Assigned to ${conflictWith}`}>
                        Booked: {conflictWith}
                      </span>
                    )}
                  </label>
                )
              })
            ) : (
              <div className="p-8 text-center text-xs text-gray-400 italic">
                No active members match "{search}".
              </div>
            )}
          </div>
        </div>

        {/* Compact Integrated Footer */}
        <div className="flex items-center justify-between gap-2 pt-2.5 sm:pt-3 border-t border-slate-100 mt-2 bg-white shrink-0">
          <label className="flex items-center space-x-1.5 cursor-pointer bg-indigo-50/50 hover:bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100/80 transition-colors min-w-0">
            <input
              type="checkbox"
              checked={applyToMonth}
              onChange={(e) => setApplyToMonth(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer shrink-0"
            />
            <span className="text-[10px] sm:text-xs font-bold text-indigo-950 truncate">
              Apply to month
            </span>
          </label>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-black text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              disabled={loading}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{loading ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal when assigning a suspended server */}
      <ConfirmModal
        isOpen={!!suspendedConfirmMember}
        title="Assign Suspended Server?"
        message={`Bro. ${suspendedConfirmMember ? getFullName(suspendedConfirmMember) : ''} is currently marked as SUSPENDED${suspendedConfirmMember?.suspensionReason ? ` (Reason: ${suspendedConfirmMember.suspensionReason})` : ''}${suspendedConfirmMember?.suspensionEndDate ? ` until ${suspendedConfirmMember.suspensionEndDate}` : ''}. Are you sure you want to override and assign them to this schedule?`}
        confirmLabel="Yes, Override & Assign"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          if (suspendedConfirmMember) {
            setSelectedIds(prev => [...prev, suspendedConfirmMember.id])
            setSuspendedConfirmMember(null)
          }
        }}
        onClose={() => setSuspendedConfirmMember(null)}
      />
    </div>
  )
}
