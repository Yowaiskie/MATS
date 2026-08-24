import React, { useState, useEffect, useMemo } from 'react'
import { excuseService } from '@/services/excuseService'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import type { ExcuseRequest } from '@/types/excuse'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { ReviewExcuseModal } from './ReviewExcuseModal'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { Pagination } from '@/components/Pagination'
import { formatTime12Hour } from '@/utils/scheduleUtils'
import { useAuth } from '@/features/authentication/AuthContext'

const PAGE_SIZE = 10

export const AdminExcusePage: React.FC = () => {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<ExcuseRequest[]>([])
  const [membersMap, setMembersMap] = useState<Map<string, Member>>(new Map())
  const [schedulesMap, setSchedulesMap] = useState<Map<string, Schedule>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<ExcuseRequest | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; trackingNumber: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant: 'error' | 'success' | 'info' } | null>(null)
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
          <button 
            onClick={() => {
              const url = `${window.location.origin}/public/excuse`;
              navigator.clipboard.writeText(url);
              setAlertModal({ variant: 'success', title: 'Link Copied', message: 'Public excuse submission portal link copied to clipboard!' });
            }}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border border-indigo-100 shadow-2xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copy Public Portal Link
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {st === 'all' ? `All Requests (${requests.length})` : `${st} (${requests.filter(r => r.status === st).length})`}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search server name, tracking #..."
            className="w-full px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold text-xs">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2"></div>
            <div>Loading excuse submissions...</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs space-y-1">
            <p className="font-bold text-slate-700">No Excuse Requests Found</p>
            <p className="text-slate-400">There are no excuse requests matching your current filter criteria.</p>
          </div>
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
                    const isApproved = req.status === 'approved'
                    const isRejected = req.status === 'rejected'
                    const isPending = !isApproved && !isRejected

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
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isPending ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isApproved ? '✓ Approved' : isRejected ? '✕ Rejected' : '🟡 Pending'}
                          </span>
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
                            <button 
                              onClick={() => setSelectedRequest(req)}
                              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-extrabold hover:bg-indigo-700 transition shadow-2xs cursor-pointer"
                            >
                              Review
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm({ 
                                id: req.id!, 
                                trackingNumber: req.trackingNumber, 
                                name: getMemberDisplayName(req) 
                              })}
                              className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-extrabold border border-rose-200 transition cursor-pointer"
                              title="Delete excuse request"
                            >
                              Delete
                            </button>
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
            setAlertModal({
              variant: 'success',
              title: 'Excuse Deleted',
              message: `Excuse request ${deleteConfirm.trackingNumber} has been permanently deleted.`
            })
          } catch (err) {
            console.error(err)
            setAlertModal({
              variant: 'error',
              title: 'Deletion Failed',
              message: 'Failed to delete excuse request.'
            })
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

      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        variant={alertModal?.variant || 'info'}
        title={alertModal?.title || 'Alert'}
        message={alertModal?.message || ''}
      />
    </div>
  )
}
