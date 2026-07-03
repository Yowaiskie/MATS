import React, { useState } from 'react'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'

interface MemberTableProps {
  members: Member[]
  onEdit: (member: Member) => void
  onArchive: (id: string) => void | Promise<void>
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
              className="border border-gray-250 bg-white rounded-lg text-xs px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Responsive Table Grid */}
      <div className="border border-gray-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200/80 text-gray-400 uppercase tracking-wider text-[10px] select-none font-bold">
              <tr>
                <th 
                  className="p-4 cursor-pointer hover:text-gray-950 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center space-x-1">
                    <span>Full Name</span>
                    {sortField === 'name' && (sortDirection === 'asc' ? <span>▲</span> : <span>▼</span>)}
                  </span>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:text-gray-950 transition-colors"
                  onClick={() => handleSort('rank')}
                >
                  <span className="flex items-center space-x-1">
                    <span>Rank</span>
                    {sortField === 'rank' && (sortDirection === 'asc' ? <span>▲</span> : <span>▼</span>)}
                  </span>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:text-gray-950 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <span className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortField === 'status' && (sortDirection === 'asc' ? <span>▲</span> : <span>▼</span>)}
                  </span>
                </th>
                <th className="p-4 hidden sm:table-cell text-gray-400">Phone Number</th>
                <th className="p-4 text-right text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/40 transition-colors">
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
                        <button
                          onClick={() => onRestore(member.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-semibold px-2.5 py-1 bg-green-50 hover:bg-green-100/70 rounded-md transition-colors cursor-pointer"
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-sm text-gray-400 italic">
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
