import React, { useState } from 'react'
import { scheduleService } from '@/services/scheduleService'
import { useAuth } from '@/features/authentication/AuthContext'

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
      // selectedMonth is YYYY-MM
      const [yearStr, monthStr] = selectedMonth.split('-')
      const targetYear = parseInt(yearStr, 10)
      const targetMonth = parseInt(monthStr, 10)

      // Fetch all schedules
      const allSchedules = await scheduleService.getSchedules()

      // Filter schedules matching the year and month
      const idsToDelete = allSchedules
        .filter(s => {
          if (!s.date) return false
          const [sYear, sMonth] = s.date.split('-')
          return parseInt(sYear, 10) === targetYear && parseInt(sMonth, 10) === targetMonth
        })
        .map(s => s.id)

      if (idsToDelete.length === 0) {
        setError('No schedules found for this month.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={loading ? undefined : handleClose}></div>
      <div className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <div className="p-2 bg-red-100 rounded-full">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Bulk Delete Month</h2>
        </div>

        {result ? (
          <div className="mb-6 space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <span className="font-bold">Success!</span> Deleted {result.deleted} schedule(s).
            </div>
            {result.skipped > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <span className="font-bold">Note:</span> {result.skipped} schedule(s) were skipped because they have existing attendance records.
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 space-y-4">
            <p className="text-sm text-gray-600">
              Select a month to permanently delete <strong>ALL</strong> schedules within that month. Schedules with attendance records will be skipped.
            </p>
            
            {error && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Select Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || !selectedMonth}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
