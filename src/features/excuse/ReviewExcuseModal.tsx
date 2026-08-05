import React, { useState } from 'react'
import type { ExcuseRequest, ExcuseStatus } from '@/types/excuse'
import { excuseService } from '@/services/excuseService'

interface ReviewExcuseModalProps {
  isOpen: boolean
  onClose: () => void
  request: ExcuseRequest | null
  onUpdated: () => void
}

export const ReviewExcuseModal: React.FC<ReviewExcuseModalProps> = ({ isOpen, onClose, request, onUpdated }) => {
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen || !request) return null

  const handleUpdate = async (status: ExcuseStatus) => {
    setLoading(true)
    try {
      if (status === 'approved') {
        await excuseService.approveExcuseRequest(request.id!, request.trackingNumber, remarks, 'admin-uid', 'Admin')
      } else {
        await excuseService.rejectExcuseRequest(request.id!, request.trackingNumber, remarks, 'admin-uid', 'Admin')
      }
      onUpdated()
      onClose()
    } catch (err) {
      alert('Failed to update request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl z-10">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Review Excuse Request</h3>
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
            <p><span className="font-bold text-slate-500">Tracking:</span> {request.trackingNumber}</p>
            <p><span className="font-bold text-slate-500">Member ID:</span> {request.memberId}</p>
            <p><span className="font-bold text-slate-500">Reason:</span> {request.reason}</p>
            <p><span className="font-bold text-slate-500">Schedules:</span> {request.schedules.join(', ')}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Admin Remarks (Optional)</label>
            <textarea 
              value={remarks} 
              onChange={e => setRemarks(e.target.value)} 
              className="w-full border rounded-lg p-2 text-sm" 
              rows={3} 
            />
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">Cancel</button>
            <button disabled={loading} onClick={() => handleUpdate('rejected')} className="px-4 py-2 bg-rose-100 text-rose-700 font-bold hover:bg-rose-200 rounded-lg cursor-pointer">Reject</button>
            <button disabled={loading} onClick={() => handleUpdate('approved')} className="px-4 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-lg cursor-pointer">Approve</button>
          </div>
        </div>
      </div>
    </div>
  )
}
