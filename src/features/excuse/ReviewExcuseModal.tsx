import React, { useState, useEffect } from 'react'
import type { ExcuseRequest, ExcuseStatus } from '@/types/excuse'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { excuseService } from '@/services/excuseService'
import { Modal } from '@/components/Modal'
import { AlertModal } from '@/components/Dialog'
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
  const { profile } = useAuth()
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')

  useEffect(() => {
    if (request) {
      setRemarks(request.adminRemarks || request.rejectionReason || '')
    }
  }, [request])

  if (!isOpen || !request) return null

  const handleUpdate = async (status: ExcuseStatus) => {
    if (status === 'rejected' && !remarks.trim()) {
      setAlertMsg('Please provide a reason or remarks for rejecting this excuse request.')
      setIsAlertOpen(true)
      return
    }

    setLoading(true)
    try {
      const uId = profile?.uid || 'system'
      const uName = profile?.displayName || 'Coordinator / Officer'

      if (status === 'approved') {
        await excuseService.approveExcuseRequest(
          request.id!, 
          request.trackingNumber, 
          remarks.trim(), 
          uId, 
          uName
        )
      } else {
        await excuseService.rejectExcuseRequest(
          request.id!, 
          request.trackingNumber, 
          remarks.trim(), 
          uId, 
          uName
        )
      }
      onUpdated()
      onClose()
    } catch (err: any) {
      console.error(err)
      setAlertMsg(err.message || 'Failed to update excuse request status.')
      setIsAlertOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const memberDisplayName = member 
    ? `${member.lastName}, ${member.firstName}` 
    : request.memberName || `Server #${request.memberId.substring(0, 8)}`

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Review & Process Excuse Request" maxWidth="lg">
        <div className="space-y-5 p-1">
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
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Tracking Reference</span>
                <span className="font-mono font-black text-indigo-600">{request.trackingNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Status</span>
                <span className={`inline-block font-extrabold uppercase text-[11px] ${
                  request.status === 'approved' ? 'text-emerald-700' :
                  request.status === 'rejected' ? 'text-rose-700' :
                  'text-amber-700'
                }`}>
                  {request.status}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact Number</span>
                <span className="font-bold text-slate-700">{member?.phoneNumber || 'N/A'}</span>
              </div>
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
                  <div key={sId} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-0.5">
                    <div className="text-xs font-black text-slate-900">{sched.title || 'Church Service'}</div>
                    <div className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1.5 flex-wrap">
                      <span>📅 {sched.date}</span>
                      {formattedTime && <span>⏰ {formattedTime}</span>}
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
              Admin / Coordinator Remarks (Visible to Server upon Tracking)
            </label>
            <textarea 
              value={remarks} 
              onChange={e => setRemarks(e.target.value)} 
              className="w-full border border-slate-300 rounded-2xl p-3 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              rows={3} 
              placeholder="e.g. Excused due to medical certificate submitted; or specify reason if rejected..."
            />
          </div>

          {/* Modal Actions */}
          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 flex-wrap">
            <button 
              type="button"
              onClick={onClose} 
              className="px-4 py-2.5 text-slate-700 font-extrabold bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              disabled={loading} 
              onClick={() => handleUpdate('rejected')} 
              className="px-5 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 font-extrabold hover:bg-rose-100 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Reject Request'}
            </button>
            <button 
              type="button"
              disabled={loading} 
              onClick={() => handleUpdate('approved')} 
              className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Approve Excuse'}
            </button>
          </div>
        </div>
      </Modal>

      <AlertModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        title="Excuse Review Notice"
        message={alertMsg}
      />
    </>
  )
}
