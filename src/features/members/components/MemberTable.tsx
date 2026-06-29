import React, { useState } from 'react'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'

interface MemberTableProps {
  members: Member[]
  onEdit: (member: Member) => void
  onArchive: (id: string) => Promise<void>
  onRestore: (id: string) => Promise<void>
  showArchived: boolean
}

type SortField = 'name' | 'rank' | 'status'

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  onEdit,
  onArchive,
  onRestore,
  showArchived,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter list
  const filteredMembers = members
    .filter((member) => {
      // 1. Text search against computed full name, rank, phone number
      const query = searchTerm.toLowerCase().trim()
      const computedFullname = getFullName(member).toLowerCase()
      const matchesSearch = 
        computedFullname.includes(query) || 
        member.rank.toLowerCase().includes(query) || 
        (member.phoneNumber || '').includes(query)
      
      // 2. Status dropdown filter (only if not viewing archived sub-list)
      const matchesStatus = 
        showArchived || 
        statusFilter === 'all' || 
        member.status === statusFilter

      return matchesSearch && matchesStatus
    })
    // 3. Sort list
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

  return (
    <div className="space-y-4">
      {/* Controls Container */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-800 bg-gray-950 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="Search name, rank, phone..."
          />
        </div>

        {/* Filters */}
        {!showArchived && (
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <label htmlFor="filter-status" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Filter Status:
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="border border-gray-800 bg-gray-950 rounded text-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Responsive Table Grid */}
      <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-950 border-b border-gray-800 text-gray-400 uppercase tracking-wider text-xxs select-none">
              <tr>
                <th 
                  className="p-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center space-x-1">
                    <span>Full Name</span>
                    {sortField === 'name' && (sortDirection === 'asc' ? <span>▲</span> : <span>▼</span>)}
                  </span>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('rank')}
                >
                  <span className="flex items-center space-x-1">
                    <span>Rank</span>
                    {sortField === 'rank' && (sortDirection === 'asc' ? <span>▲</span> : <span>▼</span>)}
                  </span>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <span className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortField === 'status' && (sortDirection === 'asc' ? <span>▲</span> : <span>▼</span>)}
                  </span>
                </th>
                <th className="p-4 hidden sm:table-cell">Phone Number</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900 bg-gray-950/20">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-900/10 transition-colors">
                    <td className="p-4 font-semibold text-white whitespace-nowrap">
                      {getFullName(member)}
                    </td>
                    <td className="p-4 text-gray-300 whitespace-nowrap">
                      {member.rank}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xxs font-bold capitalize ${
                        member.status === 'active' 
                          ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                          : member.status === 'inactive'
                          ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'
                          : 'bg-gray-500/10 border border-gray-500/20 text-gray-500'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 hidden sm:table-cell">
                      {member.phoneNumber || '--'}
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      {member.status !== 'archived' ? (
                        <>
                          <button
                            onClick={() => onEdit(member)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 bg-indigo-500/5 hover:bg-indigo-500/10 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onArchive(member.id)}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 bg-red-500/5 hover:bg-red-500/10 rounded transition-colors"
                          >
                            Archive
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onRestore(member.id)}
                          className="text-xs text-green-400 hover:text-green-300 font-semibold px-2 py-1 bg-green-500/5 hover:bg-green-500/10 rounded transition-colors"
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-gray-500">
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
