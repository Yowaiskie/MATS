import React, { useState } from 'react'
import { MEMBER_RANKS } from '@/types/member'
import { CustomSelect, Button, BulkProgressBar } from '@/components'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Change Rank ({selectedCount} Selected)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Batch update the designated rank of selected members.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <CustomSelect
              label="Select New Rank for Selected Members"
              id="bulk-rank-select"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              options={[
                ...MEMBER_RANKS.map((r) => ({ value: r, label: r })),
                { value: 'custom', label: 'Other / Custom Rank...' }
              ]}
              disabled={loading}
            />

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

          {loading && (
            <BulkProgressBar
              active={true}
              label={`Updating rank to "${rank === 'custom' ? customRank : rank}"...`}
              itemCount={selectedCount}
              variant="blue"
            />
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="default"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="default"
              disabled={loading}
            >
              Update {selectedCount} Members
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
