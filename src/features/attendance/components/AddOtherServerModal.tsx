import React, { useState } from 'react'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'

interface AddOtherServerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (members: Member[]) => void
  allMembers: Member[]
  assignedIds: string[]
  currentOtherServerIds: string[]
}

export const AddOtherServerModal: React.FC<AddOtherServerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  allMembers,
  assignedIds,
  currentOtherServerIds,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  if (!isOpen) return null

  // Filter members: active only, not assigned, and not already added as other servers
  const availableMembers = allMembers.filter((m) => {
    if (m.status !== 'active') return false
    if (assignedIds.includes(m.id)) return false
    if (currentOtherServerIds.includes(m.id)) return false
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase()
      return fullName.includes(query)
    }
    return true
  })

  // Sort alphabetically
  availableMembers.sort((a, b) => {
    const lastA = a.lastName.toLowerCase()
    const lastB = b.lastName.toLowerCase()
    if (lastA !== lastB) return lastA.localeCompare(lastB)
    return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase())
  })

  const handleToggleSelect = (memberId: string) => {
    setSelectedIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0) return

    const selectedMembers = allMembers.filter((m) => selectedIds.includes(m.id))
    onAdd(selectedMembers)
    
    // Reset selection and close
    setSelectedIds([])
    setSearchQuery('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-900">
          <div>
            <h3 className="text-base font-bold text-white">Add Other Altar Server</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select unscheduled active servers who served in this service.</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex-1 flex flex-col overflow-hidden">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active servers by name..."
              className="w-full rounded border border-gray-900 bg-gray-900 py-2 pl-9 pr-4 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Members List Container */}
          <div className="flex-1 overflow-y-auto mt-4 border border-gray-900 rounded bg-gray-900/20 divide-y divide-gray-900 min-h-[200px]">
            {availableMembers.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <svg className="h-8 w-8 text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-xxs text-gray-500 font-semibold uppercase tracking-wider">No active servers found</span>
                <span className="text-xxs text-gray-500 mt-1">Check search query or server statuses.</span>
              </div>
            ) : (
              availableMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id)
                return (
                  <label
                    key={member.id}
                    className={`flex items-center space-x-3 p-3 text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-950/20 text-white' : 'hover:bg-gray-900/50 text-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(member.id)}
                      className="h-4 w-4 rounded border-gray-800 bg-gray-905 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-950 focus:outline-none"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{getFullName(member)}</div>
                      <div className="text-xxs text-gray-400 mt-0.5">{member.rank}</div>
                    </div>
                  </label>
                )
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-900 mt-4">
            <span className="text-xxs text-gray-400 font-semibold uppercase tracking-wider">
              {selectedIds.length} Selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-850 bg-transparent px-4 py-2 text-xs font-semibold hover:bg-gray-900 text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selectedIds.length === 0}
                className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Add Selected
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
