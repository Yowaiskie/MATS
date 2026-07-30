import React, { useState } from 'react'
import { ORDER_GROUPS } from '@/types/member'

interface BulkOrderEditModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newOrder: string) => Promise<void>
  selectedCount: number
}

export const BulkOrderEditModal: React.FC<BulkOrderEditModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}) => {
  const [order, setOrder] = useState<string>('')
  const [customOrder, setCustomOrder] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetOrder = order === 'custom' ? customOrder.trim() : order
    // Order can be empty if unassigning
    // if (!targetOrder) { ... }

    setLoading(true)
    setError(null)
    try {
      await onConfirm(targetOrder)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError('Failed to update order group for selected members.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">
            Bulk Edit Order / Group ({selectedCount} Member{selectedCount > 1 ? 's' : ''})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="bulk-order-select" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Select New Order / Group for Selected Members
            </label>
            <select
              id="bulk-order-select"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150 cursor-pointer"
              disabled={loading}
            >
              <option value="">-- No Order / Unassigned --</option>
              {ORDER_GROUPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="custom">Other / Custom Order Name...</option>
            </select>

            {order === 'custom' && (
              <input
                type="text"
                value={customOrder}
                onChange={(e) => setCustomOrder(e.target.value)}
                placeholder="Enter custom order name"
                className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-shadow"
                disabled={loading}
                autoFocus
              />
            )}
          </div>

          <p className="text-xs text-gray-500">
            This action will update the order of all <strong className="text-gray-700">{selectedCount}</strong> selected member(s) to <strong className="text-blue-600">{order === 'custom' ? (customOrder || '...') : (order || 'Unassigned')}</strong>.
          </p>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
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
