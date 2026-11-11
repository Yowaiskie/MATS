import React, { useState, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import type { Member, MemberRank } from '@/types/member'
import { MEMBER_RANKS, ORDER_GROUPS, getOrderBadgeStyle, getMemberOrders } from '@/types/member'
import { getFullName } from '@/utils/member'
import type { RenewalCycle, RenewalMembershipStatus } from '@/types/renewal'
import { RENEWAL_STATUS_OPTIONS } from '@/types/renewal'
import { renewalService } from '@/services/renewalService'

interface EnrollMemberModalProps {
  isOpen: boolean
  onClose: () => void
  cycle: RenewalCycle
  availableMembers: Member[]
  onEnrollSuccess: () => Promise<void>
  actor: string
}

export const EnrollMemberModal: React.FC<EnrollMemberModalProps> = ({
  isOpen,
  onClose,
  cycle,
  availableMembers,
  onEnrollSuccess,
  actor
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [orderFilter, setOrderFilter] = useState<string>('all')
  const [rankFilter, setRankFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Enrollment options
  const [rankStrategy, setRankStrategy] = useState<'preserve' | 'override'>('preserve')
  const [overrideRank, setOverrideRank] = useState<MemberRank>('Paladins')
  const [initialStatus, setInitialStatus] = useState<RenewalMembershipStatus>('active')
  const [enrollmentNotes, setEnrollmentNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter members
  const filteredMembers = useMemo(() => {
    return availableMembers.filter(member => {
      const query = searchTerm.toLowerCase().trim()
      const fullName = getFullName(member).toLowerCase()
      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        member.rank.toLowerCase().includes(query) ||
        (member.order || '').toLowerCase().includes(query) ||
        (member.phoneNumber || '').includes(query)

      const memberOrders = getMemberOrders(member.order)
      const matchesOrder =
        orderFilter === 'all' ||
        (orderFilter === 'none' ? memberOrders.length === 0 : memberOrders.includes(orderFilter))

      const matchesRank = rankFilter === 'all' || member.rank === rankFilter

      return matchesSearch && matchesOrder && matchesRank
    })
  }, [availableMembers, searchTerm, orderFilter, rankFilter])

  const allFilteredSelected =
    filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.has(m.id))

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredMembers.forEach(m => next.delete(m.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredMembers.forEach(m => next.add(m.id))
        return next
      })
    }
  }

  const handleToggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(filteredMembers.map(m => m.id)))
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.size === 0) {
      setError('Please select at least one member to enroll.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const selectedMembers = availableMembers.filter(m => selectedIds.has(m.id))
      const enrollments = selectedMembers.map(m => ({
        memberId: m.id,
        cycleRank: rankStrategy === 'override' ? overrideRank : m.rank,
        membershipStatus: initialStatus,
        notes: enrollmentNotes.trim() || undefined
      }))

      await renewalService.bulkEnrollMembersInCycle(cycle.id, enrollments, actor)
      await onEnrollSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to enroll selected members in cycle.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Enroll Members into ${cycle.name}`}
      subtitle={`Select permanent members to include in the ${cycle.year} renewal cycle roster.`}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Configuration Bar: Rank Strategy & Status */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cycle Roster Settings for Selected ({selectedIds.size} selected)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Rank strategy */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cycle Classification (Rank)
              </label>
              <select
                value={rankStrategy}
                onChange={e => setRankStrategy(e.target.value as 'preserve' | 'override')}
                className="w-full text-xs font-medium rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="preserve">Keep Permanent Rank</option>
                <option value="override">Assign Specific Rank...</option>
              </select>
            </div>

            {/* Override rank selector if chosen */}
            {rankStrategy === 'override' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Cycle Rank
                </label>
                <select
                  value={overrideRank}
                  onChange={e => setOverrideRank(e.target.value as MemberRank)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {MEMBER_RANKS.map(rank => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Permanent Rank Behavior
                </label>
                <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium truncate">
                  Chevalier / Paladin preserved
                </div>
              </div>
            )}

            {/* Cycle Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cycle Membership Status
              </label>
              <select
                value={initialStatus}
                onChange={e => setInitialStatus(e.target.value as RenewalMembershipStatus)}
                className="w-full text-xs font-medium rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {RENEWAL_STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enrollment Notes (Optional)
              </label>
              <input
                type="text"
                value={enrollmentNotes}
                onChange={e => setEnrollmentNotes(e.target.value)}
                placeholder="e.g. Regular renewal"
                className="w-full text-xs font-medium rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search available members by name, rank, phone..."
              className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Order Filter */}
          <select
            value={orderFilter}
            onChange={e => setOrderFilter(e.target.value)}
            className="w-full sm:w-44 text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Orders</option>
            <option value="none">No Order</option>
            {ORDER_GROUPS.map(ord => (
              <option key={ord} value={ord}>
                {ord}
              </option>
            ))}
          </select>

          {/* Rank Filter */}
          <select
            value={rankFilter}
            onChange={e => setRankFilter(e.target.value)}
            className="w-full sm:w-36 text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Ranks</option>
            {MEMBER_RANKS.map(rank => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </div>

        {/* Selection summary row */}
        <div className="flex items-center justify-between text-xs px-1 text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800">{filteredMembers.length}</strong> available member(s)
            </span>
            {selectedIds.size > 0 && (
              <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filteredMembers.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                Select visible ({filteredMembers.length})
              </button>
            )}
            {selectedIds.size > 0 && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Clear selection
                </button>
              </>
            )}
          </div>
        </div>

        {/* Member list container */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0 z-10 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAll}
                    disabled={filteredMembers.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Member Name</th>
                <th className="p-3">Permanent Rank</th>
                <th className="p-3">Order / Group</th>
                <th className="p-3">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length > 0 ? (
                filteredMembers.map(member => {
                  const isChecked = selectedIds.has(member.id)
                  const orders = getMemberOrders(member.order)
                  return (
                    <tr
                      key={member.id}
                      onClick={() => handleToggleMember(member.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/70' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMember(member.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {getFullName(member)}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {member.rank}
                        </span>
                      </td>
                      <td className="p-3">
                        {orders.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {orders.map(ord => (
                              <span
                                key={ord}
                                className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${getOrderBadgeStyle(ord)}`}
                              >
                                {ord}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">--</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">
                        {member.phoneNumber || '--'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic text-xs">
                    {availableMembers.length === 0
                      ? 'All active members are already enrolled in this renewal cycle.'
                      : 'No available members matched your search criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal actions footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Enrolling <strong className="text-slate-800">{selectedIds.size}</strong> member(s) into{' '}
            <span className="font-semibold text-slate-700">{cycle.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || selectedIds.size === 0}
            >
              {loading
                ? 'Enrolling...'
                : `Enroll ${selectedIds.size} Member${selectedIds.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
