import React from 'react'
import { PreviewNavigation } from '@/features/preview/PreviewNavigation'

export const FinancePreviewPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      <PreviewNavigation />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Ministry Finance</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Track income collections, fund requests, liquidations, and treasury balance.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Record New Income</span>
        </button>
      </div>

      {/* Financial Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Total Income</span>
          <p className="text-3xl font-black text-emerald-700 mt-2">₱ 45,250.00</p>
          <p className="text-[11px] font-semibold text-emerald-600 mt-2">Collections & Dues</p>
        </div>

        <div className="p-5 rounded-2xl border border-rose-200/80 bg-rose-50/50 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Total Expenses</span>
          <p className="text-3xl font-black text-rose-700 mt-2">₱ 12,800.00</p>
          <p className="text-[11px] font-semibold text-rose-600 mt-2">Approved Fund Requests</p>
        </div>

        <div className="p-5 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Net Treasury Balance</span>
          <p className="text-3xl font-black text-indigo-700 mt-2">₱ 32,450.00</p>
          <p className="text-[11px] font-semibold text-indigo-600 mt-2">Available Ministry Funds</p>
        </div>
      </div>
    </div>
  )
}
