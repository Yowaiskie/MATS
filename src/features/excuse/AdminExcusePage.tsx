import React, { useState, useEffect, useMemo } from 'react'
import { excuseService } from '@/services/excuseService'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import type { ExcuseRequest } from '@/types/excuse'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { ReviewExcuseModal } from './ReviewExcuseModal'
import { CollapsibleScheduleList } from './CollapsibleScheduleList'
import { ConfirmModal, PasswordConfirmModal } from '@/components/Dialog'
import { Pagination } from '@/components/Pagination'
import { Loading } from '@/components/Loading'
import { Button } from '@/components/Button'
import { QuickFilterPills } from '@/components/QuickFilterPills'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'
import { useNotificationContext } from '@/context/NotificationContext'
import { authService } from '@/services/authService'

const PAGE_SIZE = 10

export const AdminExcusePage: React.FC = () => {
  const { user, profile, isAdmin, canAction } = useAuth()
  const { toast } = useToast()
  const { notifications, markAsRead, markAllExcusesAsRead } = useNotificationContext()
  const [requests, setRequests] = useState<ExcuseRequest[]>([])
  const [membersMap, setMembersMap] = useState<Map<string, Member>>(new Map())
  const [schedulesMap, setSchedulesMap] = useState<Map<string, Schedule>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<ExcuseRequest | null>(null)
  
  // Archiving & Deleting states
  const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; name: string } | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState<{ id: string; name: string } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  
  const [showArchived, setShowArchived] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Permissions
  const canReview = isAdmin || canAction('canReviewExcuses') || canAction('canApproveExcuses')
  const canDelete = isAdmin || canAction('canDeleteExcuses')

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

  // Automatically mark all unread excuse_request notifications and pending excuses as read when viewing the page
  useEffect(() => {
    if (!user?.uid) return
    markAllExcusesAsRead()
    const unreadExcuseNotifs = notifications.filter(
      n => n.type === 'excuse_request' && (!n.readBy || !n.readBy.includes(user.uid))
    )
    if (unreadExcuseNotifs.length > 0) {
      unreadExcuseNotifs.forEach(n => {
        markAsRead(n.id).catch(() => {})
      })
    }
  }, [notifications, user?.uid, markAsRead, markAllExcusesAsRead])

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Archive vs Active filter
      if (showArchived) {
        if (!req.isArchived) return false
      } else {
        if (req.isArchived) return false
        if (statusFilter !== 'all' && req.status !== statusFilter) return false
      }

      // Search query filter (matches server name or reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const member = membersMap.get(req.memberId)
        const fullName = member ? `${member.firstName} ${member.lastName}`.toLowerCase() : ''
        const reason = (req.reason || '').toLowerCase()

        return fullName.includes(q) || reason.includes(q)
      }

      return true
    })
  }, [requests, showArchived, statusFilter, searchQuery, membersMap])

  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const getMemberDisplayName = (req: ExcuseRequest) => {
    const member = membersMap.get(req.memberId)
    if (member) {
      return `${member.lastName}, ${member.firstName}`
    }
    return req.memberName || `Server #${req.memberId.substring(0, 8)}`
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Excuse Requests Review</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Review, approve, reject, or archive altar server excuse submissions.</p>
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

      {/* Modern Swipeable Segmented Navigation Bar */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <QuickFilterPills
            title=""
            pills={[
              {
                label: 'All Excuses',
                active: !showArchived && statusFilter === 'all',
                onClick: () => { setShowArchived(false); setStatusFilter('all'); setCurrentPage(1); },
                count: requests.filter(r => !r.isArchived).length,
              },
              {
                label: 'Pending',
                active: !showArchived && statusFilter === 'pending',
                onClick: () => { setShowArchived(false); setStatusFilter('pending'); setCurrentPage(1); },
                count: requests.filter(r => !r.isArchived && r.status === 'pending').length,
              },
              {
                label: 'Approved',
                active: !showArchived && statusFilter === 'approved',
                onClick: () => { setShowArchived(false); setStatusFilter('approved'); setCurrentPage(1); },
                count: requests.filter(r => !r.isArchived && r.status === 'approved').length,
              },
              {
                label: 'Rejected',
                active: !showArchived && statusFilter === 'rejected',
                onClick: () => { setShowArchived(false); setStatusFilter('rejected'); setCurrentPage(1); },
                count: requests.filter(r => !r.isArchived && r.status === 'rejected').length,
              },
            ]}
          />
        </div>

        {/* Global Archive Filter Toggle */}
        <button
          type="button"
          onClick={() => {
            setShowArchived(prev => !prev)
            setCurrentPage(1)
          }}
          title={showArchived ? 'Hide Archived Records' : 'Show Archived Records'}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer ${
            showArchived
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/80 shadow-2xs'
          }`}
        >
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span className="hidden sm:inline">{showArchived ? 'Hide Archives' : 'Archives'}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
            showArchived ? 'bg-amber-200/80 text-amber-900' : 'bg-slate-100 text-slate-500'
          }`}>
            {requests.filter(r => r.isArchived).length}
          </span>
        </button>
      </div>

      {/* Filter Bar: Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search server name, reason..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-16">
            <Loading variant="spinner" label="Loading excuse submissions..." />
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title={showArchived ? "No Archived Excuse Requests" : "No Excuse Requests Found"}
            description={showArchived ? "Archived (soft-deleted) excuse requests will appear here." : "There are no excuse requests matching your current filter criteria."}
          />
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile, visible on md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] uppercase text-slate-400 font-black tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-5 py-4">Altar Server</th>
                    <th className="px-5 py-4">Requested Schedules</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {paginatedRequests.map(req => {
                    const member = membersMap.get(req.memberId)

                    return (
                      <tr key={req.id || Math.random().toString()} className="hover:bg-slate-50/60 transition-colors">
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
                            {req.isArchived && (
                              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                                Archived
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Schedules Requested with Collapsible List */}
                        <td className="px-5 py-4 align-top min-w-[240px] max-w-sm">
                          <CollapsibleScheduleList
                            scheduleIds={req.schedules || []}
                            schedulesMap={schedulesMap}
                            maxInitialDisplay={2}
                            compact
                          />
                        </td>

                        {/* Reason with non-clipped wrapping */}
                        <td className="px-5 py-4 align-top min-w-[200px] max-w-xs">
                          <div className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 break-words whitespace-pre-wrap">
                            {req.reason}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <StatusBadge status={req.status} size="sm" />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* Review/View Button for active items */}
                            {!req.isArchived && (
                              req.status === 'pending' && canReview ? (
                                <Button 
                                  variant="primary"
                                  size="xs"
                                  onClick={() => setSelectedRequest(req)}
                                  icon={
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  }
                                >
                                  Review
                                </Button>
                              ) : (
                                <Button 
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => setSelectedRequest(req)}
                                  title={req.status === 'approved' ? 'View approved excuse details' : 'View excuse details'}
                                  icon={
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  }
                                >
                                  View
                                </Button>
                              )
                            )}

                            {/* Archive Button (Soft Delete) for active items */}
                            {!req.isArchived && canDelete && (
                              <Button 
                                variant="secondary"
                                size="xs"
                                onClick={() => setArchiveConfirm({ 
                                  id: req.id!, 
                                  name: getMemberDisplayName(req) 
                                })}
                                title="Archive (Soft Delete) this excuse request"
                                className="text-amber-700 hover:text-amber-800 border-amber-200 bg-amber-50/50 hover:bg-amber-100"
                                icon={
                                  <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                }
                              >
                                Archive
                              </Button>
                            )}

                            {/* View Button for archived items */}
                            {req.isArchived && (
                              <Button 
                                variant="secondary"
                                size="xs"
                                onClick={() => setSelectedRequest(req)}
                                title="View details of this archived excuse request"
                                icon={
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                }
                              >
                                View
                              </Button>
                            )}

                            {/* Restore Button for archived items */}
                            {req.isArchived && canDelete && (
                              <Button 
                                variant="primary"
                                size="xs"
                                onClick={() => setRestoreConfirm({ 
                                  id: req.id!, 
                                  name: getMemberDisplayName(req) 
                                })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                icon={
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                }
                              >
                                Restore
                              </Button>
                            )}

                            {/* Permanent Hard Delete Button for Admins only in Archived tab */}
                            {req.isArchived && isAdmin && (
                              <Button 
                                variant="danger"
                                size="xs"
                                onClick={() => setDeleteConfirm({ 
                                  id: req.id!, 
                                  name: getMemberDisplayName(req) 
                                })}
                                title="Permanently delete from database"
                                icon={
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                }
                              >
                                Hard Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (visible on mobile < md, hidden on desktop) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedRequests.map(req => {
                const member = membersMap.get(req.memberId)

                return (
                  <div key={req.id || Math.random().toString()} className="p-4 space-y-3.5">
                    {/* Card Top Row: Name & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {getMemberDisplayName(req)}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1 flex-wrap">
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
                          {req.isArchived && (
                            <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={req.status} size="sm" />
                    </div>

                    {/* Requested Schedules */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        Requested Schedules ({req.schedules?.length || 0})
                      </span>
                      <CollapsibleScheduleList
                        scheduleIds={req.schedules || []}
                        schedulesMap={schedulesMap}
                        maxInitialDisplay={2}
                        compact
                      />
                    </div>

                    {/* Reason - Full readable wrapping on mobile */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        Reason
                      </span>
                      <div className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60 break-words whitespace-pre-wrap">
                        {req.reason}
                      </div>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 flex-wrap">
                      {!req.isArchived && (
                        req.status === 'pending' && canReview ? (
                          <Button 
                            variant="primary"
                            size="dense"
                            onClick={() => setSelectedRequest(req)}
                            icon={
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            }
                          >
                            Review
                          </Button>
                        ) : (
                          <Button 
                            variant="secondary"
                            size="dense"
                            onClick={() => setSelectedRequest(req)}
                            icon={
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            }
                          >
                            View
                          </Button>
                        )
                      )}

                      {!req.isArchived && canDelete && (
                        <Button 
                          variant="secondary"
                          size="dense"
                          onClick={() => setArchiveConfirm({ 
                            id: req.id!, 
                            name: getMemberDisplayName(req) 
                          })}
                          className="text-amber-700 hover:text-amber-800 border-amber-200 bg-amber-50/50 hover:bg-amber-100"
                        >
                          Archive
                        </Button>
                      )}

                      {req.isArchived && (
                        <Button 
                          variant="secondary"
                          size="dense"
                          onClick={() => setSelectedRequest(req)}
                        >
                          View
                        </Button>
                      )}

                      {req.isArchived && canDelete && (
                        <Button 
                          variant="primary"
                          size="dense"
                          onClick={() => setRestoreConfirm({ 
                            id: req.id!, 
                            name: getMemberDisplayName(req) 
                          })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Restore
                        </Button>
                      )}

                      {req.isArchived && isAdmin && (
                        <Button 
                          variant="danger"
                          size="dense"
                          onClick={() => setDeleteConfirm({ 
                            id: req.id!, 
                            name: getMemberDisplayName(req) 
                          })}
                        >
                          Hard Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
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

      {/* Archive (Soft Delete) Confirmation Modal */}
      <ConfirmModal
        isOpen={!!archiveConfirm}
        onClose={() => setArchiveConfirm(null)}
        onConfirm={async () => {
          if (!archiveConfirm || !user?.uid) return
          setArchiving(true)
          try {
            await excuseService.archiveExcuseRequest(
              archiveConfirm.id,
              archiveConfirm.name,
              user.uid,
              profile?.displayName || 'Officer'
            )
            setArchiveConfirm(null)
            loadData()
            toast.success('Excuse Request Archived', `Excuse request for ${archiveConfirm.name} was moved to the Archived tab.`)
          } catch (err) {
            console.error(err)
            toast.error('Archive Failed', 'Failed to archive excuse request.')
          } finally {
            setArchiving(false)
          }
        }}
        title="Archive Excuse Request"
        message={`Are you sure you want to archive the excuse request filed for ${archiveConfirm?.name}? It will be hidden from the active list and can be restored at any time.`}
        confirmLabel="Yes, Archive Request"
        loading={archiving}
        variant="warning"
      />

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={!!restoreConfirm}
        onClose={() => setRestoreConfirm(null)}
        onConfirm={async () => {
          if (!restoreConfirm) return
          setRestoring(true)
          try {
            await excuseService.restoreExcuseRequest(
              restoreConfirm.id,
              restoreConfirm.name,
              profile?.displayName || 'Officer'
            )
            setRestoreConfirm(null)
            loadData()
            toast.success('Excuse Request Restored', `Excuse request for ${restoreConfirm.name} has been restored to active list.`)
          } catch (err) {
            console.error(err)
            toast.error('Restore Failed', 'Failed to restore excuse request.')
          } finally {
            setRestoring(false)
          }
        }}
        title="Restore Excuse Request"
        message={`Restore excuse request for ${restoreConfirm?.name} back to active review list?`}
        confirmLabel="Yes, Restore Request"
        loading={restoring}
        variant="primary"
      />

      {/* Hard Delete Password Confirmation Modal */}
      <PasswordConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async (password: string) => {
          if (!deleteConfirm) return
          try {
            await authService.verifyPassword(password)
            await excuseService.deleteExcuseRequest(
              deleteConfirm.id,
              undefined,
              profile?.displayName || 'Administrator'
            )
            const deletedName = deleteConfirm.name
            setDeleteConfirm(null)
            loadData()
            toast.success('Excuse Request Permanently Deleted', `Excuse request for ${deletedName} has been permanently deleted.`)
          } catch (err: any) {
            console.error(err)
            throw new Error(err.message || 'Verification failed. Password may be incorrect.')
          }
        }}
        title="Permanently Delete Excuse Request"
        message={`Are you sure you want to permanently delete the excuse request for ${deleteConfirm?.name}? This action cannot be undone. Please enter your password to confirm.`}
        confirmLabel="Delete Permanently"
      />
    </div>
  )
}
