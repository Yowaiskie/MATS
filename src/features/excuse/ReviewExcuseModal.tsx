import React, { useState, useEffect } from 'react'
import type { ExcuseRequest, ExcuseStatus } from '@/types/excuse'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { excuseService } from '@/services/excuseService'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'
import { formatTime12Hour } from '@/utils/scheduleUtils'

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
  schedulesMap,
  onUpdated 
}) => {
  const { user, profile, isAdmin, canAction } = useAuth()
  const { toast } = useToast()
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  const canDelete = isAdmin || canAction('canDeleteExcuses')

  useEffect(() => {
    if (request) {
      setRemarks(request.adminRemarks || request.rejectionReason || '')
    }
  }, [request])

  if (!isOpen || !request) return null

  const handleUpdate = async (status: ExcuseStatus) => {
    if (status === 'rejected' && !remarks.trim()) {
      toast.error('Remarks Required', 'Please provide a reason or remarks for rejecting this excuse request.')
      return
    }

    setLoading(true)
    try {
      const uId = profile?.uid || 'system'
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
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!user?.uid || !request?.id) return
    setIsArchiving(true)
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
      setIsArchiving(false)
    }
  }

  const memberDisplayName = member 
    ? `${member.lastName}, ${member.firstName}` 
    : request.memberName || `Server #${request.memberId.substring(0, 8)}`

  const isApproved = request.status === 'approved'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={request.isArchived ? "Archived Excuse Details" : isApproved ? "Approved Excuse Details" : "Review & Process Excuse Request"}
      subtitle={request.isArchived ? "View details of this soft-deleted excuse request" : isApproved ? "Viewing finalized and approved excuse request" : "Validate reasons, view supporting documents, and approve or reject"}
      badge={request.isArchived ? "Archived" : isApproved ? "Approved" : "Excuse Processing"}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5 p-1 text-xs">
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

        {/* Approved & Locked Banner */}
        {!request.isArchived && isApproved && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2.5">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-black block">Approved & Finalized</span>
              <span className="text-[11px] text-emerald-800 font-medium">This excuse request has already been approved and attendance records have been marked. The decision is final and cannot be modified.</span>
            </div>
          </div>
        )}

        {/* Member Card */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
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

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
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

        {/* Schedules to Excuse */}
        <div>
          <span className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">
            Requested Schedules ({request.schedules?.length || 0})
          </span>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {request.schedules?.map(sId => {
              const sched = schedulesMap?.get(sId)
              if (!sched) {
                return (
                  <div key={sId} className="p-3 bg-slate-50 border rounded-xl text-xs text-slate-500 italic">
                    Schedule #{sId}
                  </div>
                )
              }

              const formattedTime = sched.startTime ? (
                sched.endTime 
                  ? `${formatTime12Hour(sched.startTime)} - ${formatTime12Hour(sched.endTime)}` 
                  : formatTime12Hour(sched.startTime)
              ) : ''

              return (
                <div key={sId} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
                  <div className="text-xs font-black text-slate-900">{sched.title || 'Church Service'}</div>
                  <div className="text-[11px] font-semibold text-indigo-600 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{sched.date}</span>
                    </span>
                    {formattedTime && (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formattedTime}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Member's Stated Reason */}
        <div>
          <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
            Reason Stated by Server
          </label>
          <div className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 leading-relaxed">
            {request.reason}
          </div>
        </div>

        {/* Admin / Coordinator Remarks */}
        <div>
          <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
            Admin / Coordinator Remarks {request.isArchived || isApproved ? '' : '(Visible to Server upon Tracking)'}
          </label>
          {request.isArchived || isApproved ? (
            <div className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700">
              {remarks || <span className="text-slate-400 italic">No remarks recorded.</span>}
            </div>
          ) : (
            <textarea 
              value={remarks} 
              onChange={e => setRemarks(e.target.value)} 
              className="w-full border border-slate-300 rounded-2xl p-3 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              rows={3} 
              placeholder="e.g. Excused due to medical certificate submitted; or specify reason if rejected..."
            />
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2 sticky bottom-0 bg-white">
          {canDelete && !request.isArchived ? (
            <Button 
              type="button"
              variant="secondary"
              size="dense"
              loading={isArchiving}
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

          <div className="flex gap-2.5 justify-end flex-wrap">
            <Button 
              type="button"
              variant="secondary"
              size="dense"
              onClick={onClose} 
            >
              {request.isArchived || isApproved ? 'Close' : 'Cancel'}
            </Button>
            {!request.isArchived && !isApproved && (
              <>
                <Button 
                  type="button"
                  variant="danger"
                  size="dense"
                  loading={loading}
                  loadingText="Processing..."
                  onClick={() => handleUpdate('rejected')} 
                >
                  Reject Request
                </Button>
                <Button 
                  type="button"
                  variant="success"
                  size="dense"
                  loading={loading}
                  loadingText="Processing..."
                  onClick={() => handleUpdate('approved')} 
                >
                  Approve Excuse
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
