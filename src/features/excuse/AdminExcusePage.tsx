import React, { useState, useEffect } from 'react'
import { excuseService } from '@/services/excuseService'
import type { ExcuseRequest } from '@/types/excuse'
import { ReviewExcuseModal } from './ReviewExcuseModal'
import { AlertModal } from '@/components/Dialog'
import { Pagination } from '@/components/Pagination'

const PAGE_SIZE = 10

export const AdminExcusePage: React.FC = () => {
  const [requests, setRequests] = useState<ExcuseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<ExcuseRequest | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant: 'error' | 'success' | 'info' } | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    const data = await excuseService.getExcuseRequests()
    setRequests(data)
    setLoading(false)
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const paginatedRequests = requests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Excuse Requests</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Review and manage member excuse submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const url = `${window.location.origin}/public/excuse`;
              navigator.clipboard.writeText(url);
              setAlertModal({ variant: 'success', title: 'Link Copied', message: 'Public excuse link copied to clipboard!' });
            }}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer border border-indigo-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copy Public Link
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-semibold text-xs">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-semibold text-xs">No excuse requests found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase text-slate-400 font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Tracking #</th>
                    <th className="px-6 py-4">Member ID</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {paginatedRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-black text-indigo-600">{req.trackingNumber}</td>
                      <td className="px-6 py-4 font-bold">{req.memberId}</td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{req.reason}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200/80' 
                          : req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                          : 'bg-rose-50 text-rose-700 border-rose-200/80'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedRequest(req)}
                          className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-2xs cursor-pointer"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={requests.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      <ReviewExcuseModal 
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        onUpdated={loadRequests}
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
