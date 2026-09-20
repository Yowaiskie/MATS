import React from 'react'
import { PreviewNavigation } from '@/features/preview/PreviewNavigation'

export const ExcusePreviewPage: React.FC = () => {
  const dummyExcuses = [
    { id: '1', tracking: 'EXC-2026-001', member: 'Juan Dela Cruz', reason: 'School Examination overlap', status: 'approved' },
    { id: '2', tracking: 'EXC-2026-002', member: 'Maria Santos', reason: 'Family emergency / Out of town', status: 'pending' },
    { id: '3', tracking: 'EXC-2026-003', member: 'Carlo Reyes', reason: 'Sickness / Fever', status: 'rejected' },
  ]

  return (
    <div className="space-y-6 pb-12">
      <PreviewNavigation />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Excuse Requests</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Review member absence submissions and copy public excuse links.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 shadow-2xs active:scale-95 transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>Copy Public Excuse Link</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Tracking #</th>
                <th className="px-6 py-4">Server Name</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {dummyExcuses.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-black text-indigo-600">{item.tracking}</td>
                  <td className="px-6 py-4 font-extrabold text-slate-900">{item.member}</td>
                  <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{item.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      : item.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                      : 'bg-rose-50 text-rose-700 border-rose-200/80'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-2xs transition-all cursor-pointer">
                      Review Submission
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
