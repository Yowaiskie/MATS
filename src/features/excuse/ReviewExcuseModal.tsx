import React, { useState, useEffect } from 'react'
import type { ExcuseRequest, ExcuseStatus } from '@/types/excuse'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { excuseService } from '@/services/excuseService'
import { authService } from '@/services/authService'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { PasswordConfirmModal } from '@/components/Dialog'
import { CollapsibleScheduleList } from './CollapsibleScheduleList'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'

interface ReviewExcuseModalProps {
  isOpen: boolean
  onClose: () => void
  request: ExcuseRequest | null
  member?: Member
  schedulesMap?: Map<string, Schedule>
  onUpdated: () => void
}

export const ReviewExcuseModal: React.FC<ReviewExcuseModalProps> = ({ 
  isOpen, 
  onClose, 
  request, 
  member,
  schedulesMap = new Map(),
  onUpdated 
}) => {
  const { user, profile, isAdmin, canAction } = useAuth()
  const { toast } = useToast()
  const [remarks, setRemarks] = useState('')
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | 'archive' | 'override' | null>(null)
  
  // Password-protected override states
  const [overrideTargetStatus, setOverrideTargetStatus] = useState<ExcuseStatus | null>(null)

  const canReview = isAdmin || canAction('canReviewExcuses') || canAction('canApproveExcuses')
  const canDelete = isAdmin || canAction('canDeleteExcuses')

  useEffect(() => {
    if (request) {
      setRemarks(request.adminRemarks || request.rejectionReason || '')
      setOverrideTargetStatus(null)
      setActionLoading(null)
    }
  }, [request])

  if (!isOpen || !request) return null

  const memberDisplayName = member 
    ? `${member.lastName}, ${member.firstName}` 
    : request.memberName || `Server #${request.memberId.substring(0, 8)}`

  const isPending = request.status === 'pending'
  const isApproved = request.status === 'approved'
  const isRejected = request.status === 'rejected'

  const handleUpdate = async (status: ExcuseStatus) => {
    if (status === 'rejected' && !remarks.trim()) {
      toast.error('Remarks Required', 'Please provide a reason or remarks for rejecting this excuse request.')
      return
    }

    setActionLoading(status === 'approved' ? 'approve' : 'reject')
    try {
      const uId = profile?.uid || user?.uid || 'system'
      const uName = profile?.displayName || 'Coordinator / Officer'

      if (status === 'approved') {
        await excuseService.approveExcuseRequest(
          request.id!, 
          request.trackingNumber || request.id!, 
          remarks.trim(), 
          uId, 
          uName
        )
        toast.success('Excuse Approved', `Excuse request for ${memberDisplayName} has been approved.`)
      } else {
        await excuseService.rejectExcuseRequest(
          request.id!, 
          request.trackingNumber || request.id!, 
          remarks.trim(), 
          uId, 
          uName
        )
        toast.success('Excuse Rejected', `Excuse request for ${memberDisplayName} has been rejected.`)
      }
      onUpdated()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Action Failed', err.message || 'Failed to update excuse request status.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOverrideConfirm = async (password: string) => {
    if (!overrideTargetStatus || !request.id) return

    try {
      await authService.verifyPassword(password)
      
      const uId = profile?.uid || user?.uid || 'system'
      const uName = profile?.displayName || 'Administrator'

      await excuseService.overrideExcuseStatus(
        request.id,
        request.trackingNumber || request.id,
        overrideTargetStatus,
        remarks.trim(),
        uId,
        uName
      )

      toast.success(
        'Status Overridden', 
        `Excuse request status for ${memberDisplayName} was successfully updated to ${overrideTargetStatus}.`
      )
      setOverrideTargetStatus(null)
      onUpdated()
      onClose()
    } catch (err: any) {
      console.error('Password override verification failed:', err)
      throw new Error(err.message || 'Password verification failed. Please try again.')
    }
  }

  const handleArchive = async () => {
    if (!user?.uid || !request?.id) return
    setActionLoading('archive')
    try {
      await excuseService.archiveExcuseRequest(
        request.id,
        request.trackingNumber || request.id,
        user.uid,
        profile?.displayName || 'Officer'
      )
      toast.success('Excuse Request Archived', `Excuse request for ${memberDisplayName} was moved to the Archived tab.`)
      onUpdated()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Archive Failed', err.message || 'Failed to archive excuse request.')
    } finally {
      setActionLoading(null)
    }
  }

  const getModalTitle = () => {
    if (request.isArchived) return 'Archived Excuse Details'
    if (isApproved) return 'Approved Excuse Details'
    if (isRejected) return 'Rejected Excuse Details'
    return 'Review & Process Excuse Request'
  }

  const getModalSubtitle = () => {
    if (request.isArchived) return 'View details of this soft-deleted excuse request'
    if (isApproved) return 'Viewing finalized and approved excuse request'
    if (isRejected) return 'Viewing rejected excuse request'
    return 'Validate reasons, view requested schedules, and approve or reject'
  }

  const getModalBadge = () => {
    if (request.isArchived) return 'Archived'
    if (isApproved) return 'Approved'
    if (isRejected) return 'Rejected'
    return 'Excuse Processing'
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={getModalTitle()}
        subtitle={getModalSubtitle()}
        badge={getModalBadge()}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        maxWidth="2xl"
        footer={
          <div className="w-full flex items-center justify-between flex-wrap gap-2.5">
            {/* Left Action: Archive if permitted */}
            {canDelete && !request.isArchived ? (
              <Button 
                type="button"
                variant="secondary"
                size="dense"
                loading={actionLoading === 'archive'}
                disabled={actionLoading !== null}
                loadingText="Archiving..."
                onClick={handleArchive}
                className="text-amber-700 hover:text-amber-800 border-amber-200 bg-amber-50/50 hover:bg-amber-100"
                icon={
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                }
              >
                Archive Request
              </Button>
            ) : <div />}

            {/* Right Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button 
                type="button"
                variant="secondary"
                size="dense"
                onClick={onClose}
                disabled={actionLoading !== null}
              >
                {request.isArchived || (!isPending && !canReview) ? 'Close' : 'Cancel'}
              </Button>

              {/* Pending Actions for Reviewers */}
              {!request.isArchived && isPending && canReview && (
                <>
                  <Button 
                    type="button"
                    variant="danger"
                    size="dense"
                    loading={actionLoading === 'reject'}
                    disabled={actionLoading !== null}
                    loadingText="Rejecting..."
                    onClick={() => handleUpdate('rejected')} 
                  >
                    Reject Request
                  </Button>
                  <Button 
                    type="button"
                    variant="success"
                    size="dense"
                    loading={actionLoading === 'approve'}
                    disabled={actionLoading !== null}
                    loadingText="Approving..."
                    onClick={() => handleUpdate('approved')} 
                  >
                    Approve Excuse
                  </Button>
                </>
              )}

              {/* Authorized Overrides for already Rejected Requests */}
              {!request.isArchived && isRejected && canReview && (
                <Button
                  type="button"
                  variant="success"
                  size="dense"
                  disabled={actionLoading !== null}
                  onClick={() => setOverrideTargetStatus('approved')}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  Override & Approve
                </Button>
              )}

              {/* Authorized Overrides for already Approved Requests */}
              {!request.isArchived && isApproved && canReview && (
                <Button
                  type="button"
                  variant="danger"
                  size="dense"
                  disabled={actionLoading !== null}
                  onClick={() => setOverrideTargetStatus('rejected')}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  }
                >
                  Override & Reject
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Archive Notice Banner */}
          {request.isArchived && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-semibold flex items-center gap-2.5">
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <div>
                <span className="font-black block">Archived Request (Soft-Deleted)</span>
                <span className="text-[11px] text-amber-800 font-medium">This excuse request is hidden from active review lists. You can restore it anytime from the Archived tab.</span>
              </div>
            </div>
          )}

          {/* Approved Banner */}
          {!request.isArchived && isApproved && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2.5">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-black block">Approved Excuse Request</span>
                <span className="text-[11px] text-emerald-800 font-medium">
                  This excuse request has been approved and attendance has been synchronized as Excused.
                  {canReview && ' Authorized administrators may override this decision using password confirmation.'}
                </span>
              </div>
            </div>
          )}

          {/* Rejected Banner */}
          {!request.isArchived && isRejected && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs font-semibold flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-black block">Rejected Excuse Request</span>
                <span className="text-[11px] text-rose-800 font-medium">
                  This excuse request was previously rejected.
                  {canReview && ' Authorized administrators may override this decision using password confirmation.'}
                </span>
              </div>
            </div>
          )}

          {/* Member Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Altar Server</span>
                <span className="text-base font-black text-slate-900">{memberDisplayName}</span>
              </div>
              <div className="flex items-center gap-2">
                {member?.order && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-extrabold border border-blue-100">
                    {member.order}
                  </span>
                )}
                {member?.rank && (
                  <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-lg text-xs font-extrabold">
                    {member.rank}
                  </span>
                )}
                {request.isArchived && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-extrabold border border-amber-200">
                    Archived
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Current Status</span>
                <StatusBadge status={request.status} size="sm" />
              </div>
              {request.submittedAt && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Submitted</span>
                  <span className="text-xs font-semibold text-slate-600">
                    {request.submittedAt?.toDate ? request.submittedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Requested Schedules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Requested Schedules ({request.schedules?.length || 0})
              </span>
            </div>
            <CollapsibleScheduleList 
              scheduleIds={request.schedules || []}
              schedulesMap={schedulesMap}
              maxInitialDisplay={3}
            />
          </div>

          {/* Reason Stated by Server */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason Stated by Server
            </label>
            <div className="w-full p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap break-words select-text">
              {request.reason || <span className="text-slate-400 italic">No reason specified.</span>}
            </div>
          </div>

          {/* Admin / Coordinator Remarks */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin / Coordinator Remarks {isPending ? '(Visible to Server upon Tracking)' : ''}
            </label>
            {isPending ? (
              <textarea 
                value={remarks} 
                onChange={e => setRemarks(e.target.value)} 
                className="w-full border border-slate-300 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs" 
                rows={3} 
                placeholder="e.g. Excused due to official school activity; or specify reason if rejected..."
              />
            ) : canReview ? (
              <div className="space-y-2">
                <textarea 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                  className="w-full border border-slate-300 rounded-2xl p-3.5 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs" 
                  rows={2} 
                  placeholder="Update coordinator remarks for this excuse..."
                />
              </div>
            ) : (
              <div className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700">
                {remarks || <span className="text-slate-400 italic">No remarks recorded.</span>}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Password Confirmation Modal for Protected Override */}
      <PasswordConfirmModal
        isOpen={!!overrideTargetStatus}
        onClose={() => setOverrideTargetStatus(null)}
        onConfirm={handleOverrideConfirm}
        title="Authorize Status Override"
        message={`You are about to override the status of the excuse request for ${memberDisplayName} from "${request.status}" to "${overrideTargetStatus}". Please enter your password to authorize this administrative action.`}
        confirmLabel={`Authorize & ${overrideTargetStatus === 'approved' ? 'Approve' : 'Reject'}`}
      />
    </>
  )
}
