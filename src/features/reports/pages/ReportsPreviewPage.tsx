import React from 'react'
import { PreviewNavigation } from '@/features/preview/PreviewNavigation'

export const ReportsPreviewPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      <PreviewNavigation />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Analytics & Reports</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Generate printable PDF attendance reports, monthly summaries, and server rank analytics.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span>Export Printable PDF</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Attendance Rate</span>
          <p className="text-3xl font-black text-emerald-600 mt-2">94.2%</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-2">+2.4% from last month</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Services Completed</span>
          <p className="text-3xl font-black text-indigo-600 mt-2">48 Services</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-2">100% schedule completion</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Excused Absence Rate</span>
          <p className="text-3xl font-black text-amber-600 mt-2">3.1%</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-2">Low absenteeism rate</p>
        </div>
      </div>
    </div>
  )
}
