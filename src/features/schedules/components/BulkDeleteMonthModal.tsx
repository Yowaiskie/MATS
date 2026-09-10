import React, { useState } from 'react'
import { scheduleService } from '@/services/scheduleService'
import { useAuth } from '@/features/authentication/AuthContext'
import { isSundayOrAnticipatedMass } from '@/utils/scheduleUtils'

interface BulkDeleteMonthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const BulkDeleteMonthModal: React.FC<BulkDeleteMonthModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState('')
  const [deleteScope, setDeleteScope] = useState<'all' | 'sunday' | 'weekday'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ deleted: number; skipped: number } | null>(null)

  if (!isOpen) return null

  const handleDelete = async () => {
    if (!selectedMonth) {
      setError('Please select a month.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Fetch schedules strictly for the selected month using server-side query
      const startDate = `${selectedMonth}-01`
      const endDate = `${selectedMonth}-31`
      const monthSchedules = await scheduleService.getSchedulesByDateRange(startDate, endDate)
      
      const filtered = monthSchedules.filter(s => {
        if (deleteScope === 'all') return true
        const isSun = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
        return deleteScope === 'sunday' ? isSun : !isSun
      })

      const idsToDelete = filtered.map(s => s.id)

      if (idsToDelete.length === 0) {
        const scopeLabel = deleteScope === 'sunday' ? 'Sunday ' : deleteScope === 'weekday' ? 'Weekday ' : ''
        setError(`No ${scopeLabel}schedules found for this month.`)
        setLoading(false)
        return
      }

      const { deletedCount, skippedIds } = await scheduleService.bulkDeleteSchedules(
        idsToDelete,
        profile?.email || 'Admin'
      )

      setResult({ deleted: deletedCount, skipped: skippedIds.length })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to delete schedules.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (result && result.deleted > 0) {
      onSuccess()
    }
    setResult(null)
    setError(null)
    setSelectedMonth('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={loading ? undefined : handleClose}></div>
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 inline-block mb-0.5">
                Danger Zone
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Bulk Delete Month</h2>
            </div>
          </div>
          <button onClick={handleClose} disabled={loading} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          <div className="mb-6 space-y-3">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 animate-fade-in">
              <span className="font-black">Success!</span> Deleted {result.deleted} schedule(s).
            </div>
            {result.skipped > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900 animate-fade-in">
                <span className="font-black">Note:</span> {result.skipped} schedule(s) were skipped because they have existing attendance records.
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 space-y-4 text-xs">
            <p className="text-slate-600 font-medium leading-relaxed">
              Select a month to permanently delete <strong>ALL</strong> schedules within that month. Schedules with attendance records will be skipped.
            </p>
            
            {error && (
              <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800 font-bold animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                Select Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                Target Schedules to Delete:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteScope('all')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    deleteScope === 'all'
                      ? 'bg-rose-50 border-rose-500 text-rose-950 font-black shadow-xs ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs">All Slots</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Sun & Wkday</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteScope('sunday')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    deleteScope === 'sunday'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs">Sundays</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Sun & Anticipated</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteScope('weekday')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    deleteScope === 'weekday'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <span className="block text-xs">Weekdays</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Mon to Sat</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || !selectedMonth}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-rose-500/20 active:scale-95"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                'Permanently Delete Month'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
