import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import { ORDER_GROUPS } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { getFullName } from '@/utils/member'
import { isTimeOverlapping } from '@/utils/scheduleUtils'

interface AssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: Schedule | null
  activeMembers: Member[]
  allSchedules: Schedule[]
  onSave: (scheduleId: string, assignedIds: string[]) => Promise<void>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (schedule) {
      setSelectedIds(schedule.assignedMembers || [])
      setError(null)
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
        s.assignedMembers.includes(memberId) && 
        isTimeOverlapping(schedule.startTime, schedule.endTime, s.startTime, s.endTime)
    )
    return overlappingSchedule ? overlappingSchedule.title : null
  }

  const handleToggle = (memberId: string) => {
    setError(null)
    setSelectedIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
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
        .filter(m => !getConflictDetails(m.id) || selectedIds.includes(m.id))
        .map(m => m.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...selectableIds])))
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      await onSave(schedule.id, selectedIds)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update assignments.')
    } finally {
      setLoading(false)
    }
  }

  const filteredMembers = activeMembers.filter((m) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      getFullName(m).toLowerCase().includes(q) ||
      (m.order && m.order.toLowerCase().includes(q))
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Assign Servers</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Select members for "{schedule.title}" ({schedule.startTime} - {schedule.endTime})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                      allSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
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
                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                          {member.rank}
                        </span>
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
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 mt-4 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 cursor-pointer shadow-sm animate-none"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  )
}
