import React, { useState, useEffect, useMemo } from 'react'
import { excuseService } from '@/services/excuseService'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import type { ExcuseRequest } from '@/types/excuse'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { ReviewExcuseModal } from './ReviewExcuseModal'
import { ConfirmModal } from '@/components/Dialog'
import { Pagination } from '@/components/Pagination'
import { Loading } from '@/components/Loading'
import { Button } from '@/components/Button'
import { QuickFilterPills } from '@/components/QuickFilterPills'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/context/ToastContext'
import { formatTime12Hour } from '@/utils/scheduleUtils'
import { useAuth } from '@/features/authentication/AuthContext'

const PAGE_SIZE = 10

export const AdminExcusePage: React.FC = () => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<ExcuseRequest[]>([])
  const [membersMap, setMembersMap] = useState<Map<string, Member>>(new Map())
  const [schedulesMap, setSchedulesMap] = useState<Map<string, Schedule>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<ExcuseRequest | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; trackingNumber: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [excusesData, membersData, schedulesData] = await Promise.all([
        excuseService.getExcuseRequests(),
        memberService.getMembers(),
        scheduleService.getSchedules()
      ])

      setRequests(excusesData)

      const memMap = new Map<string, Member>()
      membersData.forEach(m => memMap.set(m.id, m))
      setMembersMap(memMap)

      const schedMap = new Map<string, Schedule>()
      schedulesData.forEach(s => schedMap.set(s.id, s))
      setSchedulesMap(schedMap)
    } catch (err) {
      console.error('Failed to load excuse requests data:', err)
      toast.error('Data Load Error', 'Failed to load excuse requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Status filter
      if (statusFilter !== 'all' && req.status !== statusFilter) return false

      // Search query filter (matches server name, tracking number, or reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const member = membersMap.get(req.memberId)
        const fullName = member ? `${member.firstName} ${member.lastName}`.toLowerCase() : ''
        const tracking = (req.trackingNumber || '').toLowerCase()
        const reason = (req.reason || '').toLowerCase()

        return fullName.includes(q) || tracking.includes(q) || reason.includes(q)
      }

      return true
    })
  }, [requests, statusFilter, searchQuery, membersMap])

  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const getMemberDisplayName = (req: ExcuseRequest) => {
    const member = membersMap.get(req.memberId)
    if (member) {
      return `${member.lastName}, ${member.firstName}`
    }
    return req.memberName || `Server #${req.memberId.substring(0, 8)}`
  }

  const renderScheduleBadge = (scheduleId: string) => {
    const sched = schedulesMap.get(scheduleId)
    if (!sched) {
      return (
        <span key={scheduleId} className="inline-block text-[11px] text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded">
          Schedule #{scheduleId.substring(0, 8)}
        </span>
      )
    }

    const timeStr = sched.startTime ? (
      sched.endTime 
        ? `${formatTime12Hour(sched.startTime)} - ${formatTime12Hour(sched.endTime)}` 
        : formatTime12Hour(sched.startTime)
    ) : ''

    return (
      <div key={scheduleId} className="text-xs bg-slate-50 p-2 rounded-xl border border-slate-200/80 space-y-0.5">
        <div className="font-bold text-slate-900 leading-tight">{sched.title || 'Church Service'}</div>
        <div className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
          <span>{sched.date}</span>
          {timeStr && <span>• {timeStr}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Excuse Requests Review</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Review, approve, or reject altar server excuse submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary"
            size="dense"
            onClick={() => {
              const url = `${window.location.origin}/public/excuse`
              navigator.clipboard.writeText(url)
              toast.success('Link Copied', 'Public excuse submission portal link copied to clipboard!')
            }}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
          >
            Copy Public Portal Link
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <QuickFilterPills
          title="Status:"
          pills={[
            {
              label: 'All Requests',
              active: statusFilter === 'all',
              onClick: () => { setStatusFilter('all'); setCurrentPage(1); },
              count: requests.length,
            },
            {
              label: 'Pending',
              active: statusFilter === 'pending',
              onClick: () => { setStatusFilter('pending'); setCurrentPage(1); },
              count: requests.filter(r => r.status === 'pending').length,
            },
            {
              label: 'Approved',
              active: statusFilter === 'approved',
              onClick: () => { setStatusFilter('approved'); setCurrentPage(1); },
              count: requests.filter(r => r.status === 'approved').length,
            },
            {
              label: 'Rejected',
              active: statusFilter === 'rejected',
              onClick: () => { setStatusFilter('rejected'); setCurrentPage(1); },
              count: requests.filter(r => r.status === 'rejected').length,
            },
          ]}
        />

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search server name, tracking #..."
            className="w-full h-9 px-3.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-16">
            <Loading variant="spinner" label="Loading excuse submissions..." />
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title="No Excuse Requests Found"
            description="There are no excuse requests matching your current filter criteria."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] uppercase text-slate-400 font-black tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-5 py-4">Altar Server</th>
                    <th className="px-5 py-4">Requested Schedules</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Tracking #</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {paginatedRequests.map(req => {
                    const member = membersMap.get(req.memberId)

                    return (
                      <tr key={req.id || req.trackingNumber} className="hover:bg-slate-50/60 transition-colors">
                        {/* Member Name */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-extrabold text-slate-900 text-sm">
                            {getMemberDisplayName(req)}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {member?.order && (
                              <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                                {member.order}
                              </span>
                            )}
                            {member?.rank && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                {member.rank}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Schedules Requested */}
                        <td className="px-5 py-4 align-top min-w-[240px]">
                          <div className="space-y-1.5">
                            {req.schedules?.map(sId => renderScheduleBadge(sId))}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="px-5 py-4 align-top max-w-xs">
                          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                            {req.reason}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <StatusBadge status={req.status} size="sm" />
                        </td>

                        {/* Tracking # */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <span className="font-mono text-xs font-black text-indigo-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                            {req.trackingNumber}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="primary"
                              size="xs"
                              onClick={() => setSelectedRequest(req)}
                            >
                              Review
                            </Button>
                            <Button 
                              variant="danger"
                              size="xs"
                              onClick={() => setDeleteConfirm({ 
                                id: req.id!, 
                                trackingNumber: req.trackingNumber, 
                                name: getMemberDisplayName(req) 
                              })}
                              title="Delete excuse request"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredRequests.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Review Excuse Modal */}
      <ReviewExcuseModal 
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        member={selectedRequest ? membersMap.get(selectedRequest.memberId) : undefined}
        schedulesMap={schedulesMap}
        onUpdated={loadData}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (!deleteConfirm) return
          setDeleting(true)
          try {
            await excuseService.deleteExcuseRequest(
              deleteConfirm.id,
              deleteConfirm.trackingNumber,
              profile?.displayName || 'Officer'
            )
            setDeleteConfirm(null)
            loadData()
            toast.success('Excuse Request Deleted', `Excuse request ${deleteConfirm.trackingNumber} has been permanently deleted.`)
          } catch (err) {
            console.error(err)
            toast.error('Deletion Failed', 'Failed to delete excuse request.')
          } finally {
            setDeleting(false)
          }
        }}
        title="Delete Excuse Request"
        message={`Are you sure you want to permanently delete the excuse request ${deleteConfirm?.trackingNumber} filed for ${deleteConfirm?.name}?`}
        confirmLabel="Yes, Delete"
        loading={deleting}
        variant="danger"
      />
    </div>
  )
}
