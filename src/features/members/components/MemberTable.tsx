import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, getOrderBadgeStyle, MEMBER_RANKS, getMemberOrders } from '@/types/member'
import { getFullName } from '@/utils/member'
import { Pagination } from '@/components/Pagination'
import { useAuth } from '@/features/authentication/AuthContext'

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
  onBulkEditRank?: () => void
  onBulkEditOrder?: () => void
  onClearSelection: () => void
  onExportSelected?: () => void
  bulkProcessing?: boolean
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
  onBulkEditRank,
  onBulkEditOrder,
  onClearSelection,
  onExportSelected,
  bulkProcessing,
}) => {
  const { isAdmin, canAction } = useAuth()
  const canManage = isAdmin || canAction('canManageMembers')
  const canDelete = isAdmin || canAction('canDeleteMembers')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all')
  const [orderFilter, setOrderFilter] = useState<string>('all')
  const [rankFilter, setRankFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Dropdown popover open states
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false)
  const [rankDropdownOpen, setRankDropdownOpen] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  // Close dropdowns on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOrderDropdownOpen(false)
        setRankDropdownOpen(false)
        setStatusDropdownOpen(false)
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.filter-popover-container')) {
        setOrderDropdownOpen(false)
        setRankDropdownOpen(false)
        setStatusDropdownOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [showArchived, searchTerm, statusFilter, orderFilter, rankFilter])

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
        (member.order || '').toLowerCase().includes(query) ||
        (member.phoneNumber || '').includes(query)

      const matchesStatus =
        showArchived ||
        statusFilter === 'all' ||
        member.status === statusFilter

      const memberOrders = getMemberOrders(member.order)
      const matchesOrder =
        orderFilter === 'all' ||
        (orderFilter === 'none' ? memberOrders.length === 0 : memberOrders.includes(orderFilter))

      const matchesRank = 
        rankFilter === 'all' ||
        member.rank === rankFilter

      return matchesSearch && matchesStatus && matchesOrder && matchesRank
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

  // Dynamic filter count calculations
  const activeFiltersCount = (searchTerm ? 1 : 0) + (orderFilter !== 'all' ? 1 : 0) + (rankFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  const handleResetFilters = () => {
    setSearchTerm('')
    setOrderFilter('all')
    setRankFilter('all')
    setStatusFilter('all')
  }

  const allFiltered = filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.has(m.id))
  const someSelected = selectedIds.size > 0

  const handleHeaderCheckbox = () => {
    if (allFiltered) {
      onClearSelection()
    } else {
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

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / 10))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedMembers = filteredMembers.slice((safeCurrentPage - 1) * 10, safeCurrentPage * 10)

  return (
    <div className="space-y-4">
      {/* Rich Filter Bar Standard (Phase 2 Design System Engine) */}
      <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 text-xs filter-popover-container">
        {/* Main Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Search Input (5 cols) */}
          <div className="relative sm:col-span-4">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full h-10 pl-10 pr-9 border border-slate-300 bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs"
              placeholder="Search name, rank, phone..."
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {!showArchived && (
            <>
              {/* Order / Group Custom Dropdown Popover (3 cols) */}
              <div className="relative sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setOrderDropdownOpen(!orderDropdownOpen)
                    setRankDropdownOpen(false)
                    setStatusDropdownOpen(false)
                  }}
                  className={`w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition text-xs shadow-2xs cursor-pointer ${
                    orderFilter !== 'all' || orderDropdownOpen
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-950 font-bold'
                      : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 pr-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      orderFilter === 'all' ? 'bg-slate-400' : 'bg-blue-600'
                    }`} />
                    <span className="truncate">
                      {orderFilter === 'all' ? 'All Orders / Groups' : orderFilter === 'none' ? 'No Order' : orderFilter}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${orderDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {orderDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 min-w-[200px] max-h-60 overflow-y-auto">
                    <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Select Order / Group
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderFilter('all')
                        setOrderDropdownOpen(false)
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                        orderFilter === 'all' ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs' : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                        <span>All Orders</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">({members.length})</span>
                    </button>
                    {ORDER_GROUPS.map((grp) => {
                      const isSelected = orderFilter === grp
                      const count = members.filter(m => getMemberOrders(m.order).includes(grp)).length
                      return (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => {
                            setOrderFilter(grp)
                            setOrderDropdownOpen(false)
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs' : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0 pr-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            <span className="truncate">{grp}</span>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setOrderFilter('none')
                        setOrderDropdownOpen(false)
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                        orderFilter === 'none' ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs' : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span>Unassigned / No Order</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">({members.filter(m => getMemberOrders(m.order).length === 0).length})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Rank Custom Dropdown Popover (3 cols) */}
              <div className="relative sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setRankDropdownOpen(!rankDropdownOpen)
                    setOrderDropdownOpen(false)
                    setStatusDropdownOpen(false)
                  }}
                  className={`w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition text-xs shadow-2xs cursor-pointer ${
                    rankFilter !== 'all' || rankDropdownOpen
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-950 font-bold'
                      : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 pr-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      rankFilter === 'all' ? 'bg-slate-400' : 'bg-indigo-600'
                    }`} />
                    <span className="truncate">
                      {rankFilter === 'all' ? 'All Ranks' : rankFilter}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${rankDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {rankDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 min-w-[180px] max-h-60 overflow-y-auto">
                    <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Select Rank
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRankFilter('all')
                        setRankDropdownOpen(false)
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                        rankFilter === 'all' ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs' : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                        <span>All Ranks</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">({members.length})</span>
                    </button>
                    {MEMBER_RANKS.map((r) => {
                      const isSelected = rankFilter === r
                      const count = members.filter(m => m.rank === r).length
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setRankFilter(r)
                            setRankDropdownOpen(false)
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs' : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0 pr-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <span className="truncate">{r}</span>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Status Custom Dropdown Popover (2 cols) */}
              <div className="relative sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusDropdownOpen(!statusDropdownOpen)
                    setOrderDropdownOpen(false)
                    setRankDropdownOpen(false)
                  }}
                  className={`w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition text-xs shadow-2xs cursor-pointer ${
                    statusFilter !== 'all' || statusDropdownOpen
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-950 font-bold'
                      : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 pr-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      statusFilter === 'active' ? 'bg-emerald-500' :
                      statusFilter === 'inactive' ? 'bg-amber-500' :
                      statusFilter === 'suspended' ? 'bg-rose-500' :
                      'bg-slate-400'
                    }`} />
                    <span className="truncate capitalize">
                      {statusFilter === 'all' ? 'All Status' : statusFilter}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {statusDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 min-w-[160px]">
                    <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Select Status
                    </div>
                    {[
                      { key: 'all', label: 'All Status', dot: 'bg-slate-400', count: members.length },
                      { key: 'active', label: 'Active', dot: 'bg-emerald-500', count: members.filter(m => m.status === 'active').length },
                      { key: 'inactive', label: 'Inactive', dot: 'bg-amber-500', count: members.filter(m => m.status === 'inactive').length },
                      { key: 'suspended', label: 'Suspended', dot: 'bg-rose-500', count: members.filter(m => m.status === 'suspended').length },
                    ].map((s) => {
                      const isSelected = statusFilter === s.key
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            setStatusFilter(s.key as any)
                            setStatusDropdownOpen(false)
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs' : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                            <span>{s.label}</span>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono">({s.count})</span>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Quick Filter Pills Row */}
        {!showArchived && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-1 border-t border-slate-200/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pr-1 shrink-0">Quick Filter:</span>
            {[
              { label: 'All', active: orderFilter === 'all' && rankFilter === 'all' && statusFilter === 'all', onClick: () => { setOrderFilter('all'); setRankFilter('all'); setStatusFilter('all'); } },
              { label: 'Active', active: statusFilter === 'active', onClick: () => setStatusFilter(statusFilter === 'active' ? 'all' : 'active') },
              { label: 'Inactive', active: statusFilter === 'inactive', onClick: () => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive') },
              { label: 'Suspended', active: statusFilter === 'suspended', onClick: () => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended') },
              ...ORDER_GROUPS.slice(0, 4).map(grp => ({
                label: grp,
                active: orderFilter === grp,
                onClick: () => setOrderFilter(orderFilter === grp ? 'all' : grp)
              })),
            ].map((pill, idx) => (
              <button
                key={idx}
                type="button"
                onClick={pill.onClick}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  pill.active
                    ? 'bg-blue-600 text-white shadow-2xs shadow-blue-500/30'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        {/* Active Filter Tags & Reset Action Bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Filtered by:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-900 text-[11px] font-semibold border border-blue-200/60">
                  Search: "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-blue-600 cursor-pointer">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {orderFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-900 text-[11px] font-semibold border border-blue-200/60">
                  Order: {orderFilter === 'none' ? 'Unassigned' : orderFilter}
                  <button type="button" onClick={() => setOrderFilter('all')} className="hover:text-blue-600 cursor-pointer">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {rankFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-900 text-[11px] font-semibold border border-indigo-200/60">
                  Rank: {rankFilter}
                  <button type="button" onClick={() => setRankFilter('all')} className="hover:text-indigo-600 cursor-pointer">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-900 text-[11px] font-semibold border border-emerald-200/60 capitalize">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter('all')} className="hover:text-emerald-600 cursor-pointer">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shadow-2xs"
            >
              <svg className="w-3 h-3 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reset ({activeFiltersCount})</span>
            </button>
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

          {/* Bulk action buttons */}
          {showArchived ? (
            <div className="flex items-center gap-2 flex-wrap">
              {onExportSelected && (
                <button
                  disabled={bulkProcessing}
                  onClick={onExportSelected}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-slate-700/20"
                >
                  {bulkProcessing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Export ({selectedIds.size})</span>
                    </>
                  )}
                </button>
              )}
              <button
                disabled={bulkProcessing}
                onClick={onBulkDelete} // triggers bulk permanent delete in parent
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-rose-600/20"
              >
                {bulkProcessing ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Permanent Delete {selectedIds.size} Selected</span>
                  </>
                )}
              </button>
              <button
                disabled={bulkProcessing}
                onClick={onSelectAll}   // triggers bulk restore in parent
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {bulkProcessing ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Restore {selectedIds.size} Selected</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {onExportSelected && (
                <button
                  disabled={bulkProcessing}
                  onClick={onExportSelected}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-slate-800/20"
                >
                  {bulkProcessing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Export ({selectedIds.size})</span>
                    </>
                  )}
                </button>
              )}
              {onBulkEditRank && (
                <button
                  disabled={bulkProcessing}
                  onClick={onBulkEditRank}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {bulkProcessing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Change Rank ({selectedIds.size})</span>
                    </>
                  )}
                </button>
              )}
              {onBulkEditOrder && (
                <button
                  disabled={bulkProcessing}
                  onClick={onBulkEditOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {bulkProcessing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Change Order ({selectedIds.size})</span>
                    </>
                  )}
                </button>
              )}
              <button
                disabled={bulkProcessing}
                onClick={onSelectAll}   // triggers bulk archive in parent
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-75 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-amber-500/20"
              >
                {bulkProcessing ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span>Archive {selectedIds.size} Selected</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 uppercase tracking-wider text-[11px] select-none font-black">
              <tr>
                {/* Select-all checkbox header */}
                <th className="p-4 w-10">
                  <button
                    onClick={handleHeaderCheckbox}
                    className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                      allFiltered
                        ? 'bg-indigo-600 border-indigo-600'
                        : someSelected
                        ? 'bg-indigo-200 border-indigo-400'
                        : 'border-slate-300 hover:border-indigo-400 bg-white'
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
                <th className="p-4 text-gray-400">Order / Group</th>
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
              {paginatedMembers.length > 0 ? (
                paginatedMembers.map((member) => {
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
                        {getMemberOrders(member.order).length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getMemberOrders(member.order).map((ord) => (
                              <span
                                key={ord}
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getOrderBadgeStyle(ord)}`}
                              >
                                {ord}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">--</span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold capitalize border ${
                            member.status === 'active'
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                              : member.status === 'inactive'
                              ? 'bg-amber-50 border border-amber-200 text-amber-700'
                              : member.status === 'suspended'
                              ? 'bg-rose-50 border border-rose-200 text-rose-700'
                              : 'bg-gray-50 border border-gray-200 text-gray-600'
                          }`}>
                            {member.status}
                          </span>
                          {member.status === 'suspended' && (
                            <span 
                              className="text-[9.5px] font-semibold text-rose-600/90 max-w-[140px] truncate cursor-help"
                              title={member.suspensionReason ? `Reason: ${member.suspensionReason}${member.suspensionEndDate ? ` (Until ${member.suspensionEndDate})` : ''}` : undefined}
                            >
                              {member.suspensionEndDate 
                                ? `Until ${member.suspensionEndDate}` 
                                : (member.suspensionReason || 'Indefinite')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 hidden sm:table-cell">
                        {member.phoneNumber || '--'}
                      </td>
                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                        {canManage ? (
                          member.status !== 'archived' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onEdit(member)}
                                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => onArchive(member.id)}
                                  className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                >
                                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onRestore(member.id)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold px-2.5 py-1 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Restore</span>
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => onDelete(member.id)}
                                  className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                >
                                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium italic">Read-only</span>
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

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredMembers.length}
          pageSize={10}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
}
