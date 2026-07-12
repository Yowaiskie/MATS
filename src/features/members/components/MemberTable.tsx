import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'

interface MemberTableProps {
  members: Member[]
  onEdit: (member: Member) => void
  onArchive: (id: string) => void | Promise<void>
  onRestore: (id: string) => Promise<void>
  onDelete: (id: string) => void
  showArchived: boolean
  // Bulk selection — lifted to parent
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
}

type SortField = 'name' | 'rank' | 'status'

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchived,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onBulkDelete,
  onClearSelection,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Clear selection when tab switches
  useEffect(() => {
    onClearSelection()
  }, [showArchived])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter + sort
  const filteredMembers = members
    .filter((member) => {
      const query = searchTerm.toLowerCase().trim()
      const computedFullname = getFullName(member).toLowerCase()
      const matchesSearch =
        computedFullname.includes(query) ||
        member.rank.toLowerCase().includes(query) ||
        (member.phoneNumber || '').includes(query)

      const matchesStatus =
        showArchived ||
        statusFilter === 'all' ||
        member.status === statusFilter

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let aVal = ''
      let bVal = ''
      if (sortField === 'name') {
        aVal = getFullName(a).toLowerCase()
        bVal = getFullName(b).toLowerCase()
      } else {
        aVal = (a[sortField] || '').toLowerCase()
        bVal = (b[sortField] || '').toLowerCase()
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  const allFiltered = filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.has(m.id))
  const someSelected = selectedIds.size > 0

  const handleHeaderCheckbox = () => {
    if (allFiltered) {
      onClearSelection()
    } else {
      // Select all filtered (across all pages if any)
      filteredMembers.forEach(m => {
        if (!selectedIds.has(m.id)) onToggleSelect(m.id)
      })
    }
  }

  // Sort indicator
  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <span className="text-blue-500">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
    ) : null

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-250 bg-white rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
            placeholder="Search name, rank, phone..."
          />
        </div>

        {/* Status filter (active tab only) */}
        {!showArchived && (
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <label htmlFor="filter-status" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Filter Status:
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="border border-gray-250 bg-white rounded-lg text-xs px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Bulk actions bar — only shown when something is selected */}
      {someSelected && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-blue-700">
              {selectedIds.size} member{selectedIds.size > 1 ? 's' : ''} selected
              {filteredMembers.length > selectedIds.size && (
                <button
                  onClick={handleHeaderCheckbox}
                  className="ml-2 underline text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Select all {filteredMembers.length}
                </button>
              )}
            </span>
            <button
              onClick={onClearSelection}
              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Bulk action button */}
          {showArchived ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onBulkDelete} // triggers bulk permanent delete in parent
                className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Permanent Delete {selectedIds.size} Selected
              </button>
              <button
                onClick={onSelectAll}   // triggers bulk restore in parent
                className="flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restore {selectedIds.size} Selected
              </button>
            </div>
          ) : (
            <button
              onClick={onSelectAll}   // triggers bulk archive in parent
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive {selectedIds.size} Selected
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200/80 text-gray-400 uppercase tracking-wider text-[10px] select-none font-bold">
              <tr>
                {/* Select-all checkbox header */}
                <th className="p-4 w-10">
                  <button
                    onClick={handleHeaderCheckbox}
                    className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                      allFiltered
                        ? 'bg-blue-600 border-blue-600'
                        : someSelected
                        ? 'bg-blue-200 border-blue-400'
                        : 'border-gray-300 hover:border-blue-400 bg-white'
                    }`}
                    aria-label="Select all members"
                    title={allFiltered ? 'Deselect all' : 'Select all'}
                  >
                    {allFiltered && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {!allFiltered && someSelected && (
                      <svg className="h-2.5 w-2.5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="4" y="11" width="16" height="2" rx="1" />
                      </svg>
                    )}
                  </button>
                </th>

                <th className="p-4 cursor-pointer hover:text-gray-950 transition-colors" onClick={() => handleSort('name')}>
                  <span className="flex items-center space-x-1">
                    <span>Full Name</span>
                    <SortIcon field="name" />
                  </span>
                </th>
                <th className="p-4 cursor-pointer hover:text-gray-950 transition-colors" onClick={() => handleSort('rank')}>
                  <span className="flex items-center space-x-1">
                    <span>Rank</span>
                    <SortIcon field="rank" />
                  </span>
                </th>
                <th className="p-4 cursor-pointer hover:text-gray-950 transition-colors" onClick={() => handleSort('status')}>
                  <span className="flex items-center space-x-1">
                    <span>Status</span>
                    <SortIcon field="status" />
                  </span>
                </th>
                <th className="p-4 hidden sm:table-cell text-gray-400">Phone Number</th>
                <th className="p-4 text-right text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const isSelected = selectedIds.has(member.id)
                  return (
                    <tr
                      key={member.id}
                      className={`transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/40'}`}
                    >
                      {/* Row checkbox */}
                      <td className="p-4 w-10">
                        <button
                          onClick={() => onToggleSelect(member.id)}
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 hover:border-blue-400 bg-white'
                          }`}
                          aria-label={isSelected ? 'Deselect member' : 'Select member'}
                        >
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>

                      <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                        {getFullName(member)}
                      </td>
                      <td className="p-4 text-gray-600 whitespace-nowrap">
                        {member.rank}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold capitalize border ${
                          member.status === 'active'
                            ? 'bg-green-50 border border-green-100 text-green-600'
                            : member.status === 'inactive'
                            ? 'bg-amber-50 border border-amber-100 text-amber-600'
                            : 'bg-gray-50 border border-gray-200 text-gray-600'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 hidden sm:table-cell">
                        {member.phoneNumber || '--'}
                      </td>
                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                        {member.status !== 'archived' ? (
                          <>
                            <button
                              onClick={() => onEdit(member)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100/70 rounded-md transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onArchive(member.id)}
                              className="text-xs text-red-650 hover:text-red-750 font-semibold px-2.5 py-1 bg-red-50 hover:bg-red-100/70 rounded-md transition-colors cursor-pointer"
                            >
                              Archive
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onRestore(member.id)}
                              className="text-xs text-green-600 hover:text-green-700 font-semibold px-2.5 py-1 bg-green-50 hover:bg-green-100/70 rounded-md transition-colors cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => onDelete(member.id)}
                              className="text-xs text-red-650 hover:text-red-750 font-semibold px-2.5 py-1 bg-red-50 hover:bg-red-100/70 rounded-md transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-sm text-gray-400 italic">
                    No members found matching the current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
