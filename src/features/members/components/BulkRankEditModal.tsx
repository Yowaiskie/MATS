import React, { useState } from 'react'
import { MEMBER_RANKS } from '@/types/member'

interface BulkRankEditModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newRank: string) => Promise<void>
  selectedCount: number
}

export const BulkRankEditModal: React.FC<BulkRankEditModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}) => {
  const [rank, setRank] = useState<string>('Squires')
  const [customRank, setCustomRank] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetRank = rank === 'custom' ? customRank.trim() : rank
    if (!targetRank) {
      setError('Please select or specify a rank.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onConfirm(targetRank)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError('Failed to update rank for selected members.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Bulk Action
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Bulk Edit Rank ({selectedCount} Member{selectedCount > 1 ? 's' : ''})
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 font-bold animate-fade-in">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="bulk-rank-select" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Select New Rank for Selected Members
            </label>
            <div className="relative">
              <select
                id="bulk-rank-select"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="block w-full h-10 pl-3.5 pr-10 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 appearance-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition cursor-pointer shadow-2xs"
                disabled={loading}
              >
                {MEMBER_RANKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="custom">Other / Custom Rank...</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>

            {rank === 'custom' && (
              <input
                type="text"
                value={customRank}
                onChange={(e) => setCustomRank(e.target.value)}
                placeholder="Enter custom rank name"
                className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                disabled={loading}
                autoFocus
              />
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-900">
            This action will update the rank of all <strong className="font-mono font-black">{selectedCount}</strong> selected member(s) to <strong className="font-extrabold text-indigo-700">{rank === 'custom' ? (customRank || '...') : rank}</strong>.
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              disabled={loading}
            >
              {loading ? 'Updating...' : `Apply to ${selectedCount} Members`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
