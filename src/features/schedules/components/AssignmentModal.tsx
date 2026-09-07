import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, getOrderBadgeStyle } from '@/types/member'
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

  const handleToggleOrderGroup = (orderGroup: string) => {
    setError(null)
    const groupMembers = activeMembers.filter(m => m.order === orderGroup)
    const groupMemberIds = groupMembers.map(m => m.id)
    if (groupMemberIds.length === 0) return

    const allSelected = groupMemberIds.every(id => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !groupMemberIds.includes(id)))
    } else {
      const selectableIds = groupMembers
        .filter(m => (!getConflictDetails(m.id) && !isExcludedSuspended(m)) || selectedIds.includes(m.id))
        .map(m => m.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...selectableIds])))
    }
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

  const filteredMembers = activeMembers.filter((m) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      getFullName(m).toLowerCase().includes(q) ||
      (m.order && m.order.toLowerCase().includes(q))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Roster Assignment
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Assign Servers</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Select members for "{schedule.title}" ({formatTime12Hour(schedule.startTime)} - {formatTime12Hour(schedule.endTime)})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Section */}
        <div className="mt-4 flex-1 flex flex-col overflow-hidden space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-650 font-medium">
              {error}
            </div>
          )}

          {/* Quick Select by Order Group */}
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Quick Select Order / Group:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ORDER_GROUPS.map((grp) => {
                const groupMembers = activeMembers.filter(m => m.order === grp)
                if (groupMembers.length === 0) return null
                const allSelected = groupMembers.every(m => selectedIds.includes(m.id))
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => handleToggleOrderGroup(grp)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      allSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50/50 border-indigo-200/80 text-indigo-800 hover:bg-indigo-100'
                    }`}
                  >
                    {allSelected ? '✓ ' : '+ '} {grp} ({groupMembers.length})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 bg-white rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-shadow duration-150"
              placeholder="Filter members by name or order..."
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Selected: {selectedIds.length}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAssignAll}
                disabled={loading || activeMembers.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Assign All Active</span>
              </button>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                disabled={loading || filteredMembers.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Select All Visible</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={loading || selectedIds.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Members checklist container */}
          <div className="flex-1 border border-gray-200 bg-white rounded-lg overflow-y-auto divide-y divide-gray-100 shadow-xs">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id)
                const conflictWith = getConflictDetails(member.id)
                const disabled = (!!conflictWith && !isSelected) || loading // disable checking if double booked or loading

                return (
                  <label 
                    key={member.id} 
                    className={`flex items-center justify-between p-3 transition-colors ${
                      disabled 
                        ? 'opacity-40 cursor-not-allowed' 
                        : 'cursor-pointer hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !disabled && handleToggle(member.id)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-900 block">
                          {getFullName(member)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                            {member.rank}
                          </span>
                          {member.order && (
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${getOrderBadgeStyle(member.order)}`}>
                              {member.order}
                            </span>
                          )}
                          {member.status === 'suspended' && (
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                              isMeetingOrFormation
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {isMeetingOrFormation ? 'SUSPENDED (Meeting Allowed)' : 'SUSPENDED'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conflict tag warning */}
                    {conflictWith && (
                      <span className="inline-block rounded-md bg-red-50 border border-red-100 text-red-600 px-2 py-0.5 text-[10px] font-semibold max-w-[150px] truncate" title={`Assigned to ${conflictWith}`}>
                        Booked: {conflictWith}
                      </span>
                    )}
                  </label>
                )
              })
            ) : (
              <div className="p-8 text-center text-sm text-gray-400 italic">
                No active members found.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col space-y-3 pt-3 border-t border-slate-100 mt-4 bg-white sticky bottom-0">
          <label className="flex items-center space-x-2 cursor-pointer bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 hover:bg-indigo-50 transition-colors">
            <input
              type="checkbox"
              checked={applyToMonth}
              onChange={(e) => setApplyToMonth(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-extrabold text-indigo-950">
              Apply to all "{schedule.title}" schedules in this month
            </span>
          </label>
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              disabled={loading}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{loading ? 'Saving...' : 'Save Assignments'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal when assigning a suspended server */}
      <ConfirmModal
        isOpen={!!suspendedConfirmMember}
        title="Assign Suspended Server?"
        message={`Bro. ${suspendedConfirmMember ? getFullName(suspendedConfirmMember) : ''} is currently marked as SUSPENDED. Are you sure you want to override and assign them to this schedule?`}
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
