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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
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
                Roster Addition
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Add Other Altar Server</h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex-1 flex flex-col overflow-hidden text-xs">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active servers by name..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Members List Container */}
          <div className="flex-1 overflow-y-auto mt-3 border border-slate-200 rounded-2xl bg-slate-50 divide-y divide-slate-100 min-h-[200px] p-1 space-y-1">
            {availableMembers.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-slate-400 font-bold">No active servers found</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Check search query or server statuses.</span>
              </div>
            ) : (
              availableMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id)
                return (
                  <label
                    key={member.id}
                    className={`flex items-center space-x-3 p-2.5 rounded-xl text-xs cursor-pointer transition-colors border ${
                      isSelected ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 font-bold shadow-2xs' : 'border-transparent hover:bg-white text-slate-700 font-medium'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(member.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 focus:outline-none"
                    />
                    <div className="flex-1 truncate">
                      <div className="font-extrabold text-slate-900">{getFullName(member)}</div>
                      {member.rank && <div className="text-[10px] text-slate-400 font-semibold">{member.rank}</div>}
                    </div>
                  </label>
                )
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4 bg-white sticky bottom-0">
            <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {selectedIds.length} Selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-5 py-2.5 text-xs font-black text-white transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
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
