import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
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

  const filteredMembers = activeMembers.filter((m) =>
    getFullName(m).toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-850">
          <div>
            <h3 className="text-base font-bold text-white">Assign Servers</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Select members for "{schedule.title}" ({schedule.startTime} - {schedule.endTime})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Section */}
        <div className="mt-4 flex-1 flex flex-col overflow-hidden space-y-4">
          {error && (
            <div className="rounded border border-red-900 bg-red-950/40 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-800 bg-gray-900 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              placeholder="Filter active members by name..."
              disabled={loading}
            />
          </div>

          {/* Members checklist container */}
          <div className="flex-1 border border-gray-850 bg-gray-950/40 rounded overflow-y-auto divide-y divide-gray-900">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id)
                const conflictWith = getConflictDetails(member.id)
                const disabled = (!!conflictWith && !isSelected) || loading // disable checking if double booked or loading

                return (
                  <div 
                    key={member.id} 
                    onClick={() => !disabled && handleToggle(member.id)}
                    className={`flex items-center justify-between p-3 transition-colors ${
                      disabled 
                        ? 'opacity-40 cursor-not-allowed' 
                        : 'cursor-pointer hover:bg-gray-900/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div click
                        disabled={disabled}
                        className="h-4 w-4 rounded border-gray-800 bg-gray-900 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <div>
                        <span className="text-sm font-semibold text-white block">
                          {getFullName(member)}
                        </span>
                        <span className="text-xxs text-indigo-400 uppercase tracking-wider">
                          {member.rank}
                        </span>
                      </div>
                    </div>

                    {/* Conflict tag warning */}
                    {conflictWith && (
                      <span className="inline-block rounded bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 text-xxs font-medium max-w-[150px] truncate" title={`Assigned to ${conflictWith}`}>
                        Booked: {conflictWith}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="p-8 text-center text-sm text-gray-500">
                No active members found.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-850 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-850 bg-transparent px-4 py-2 text-xs font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  )
}
