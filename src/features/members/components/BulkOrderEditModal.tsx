import React, { useState } from 'react'
import { ORDER_GROUPS, ORDER_COLORS, formatMemberOrders } from '@/types/member'

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
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [customOrder, setCustomOrder] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const customOnes = customOrder
      .split(/[,/]+/)
      .map(s => s.trim())
      .filter(Boolean)
    const allOrdersCombined = Array.from(new Set([...selectedOrders, ...customOnes]))
    const targetOrder = formatMemberOrders(allOrdersCombined)

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

  const computedOrderPreview = formatMemberOrders(
    Array.from(new Set([...selectedOrders, ...customOrder.split(/[,/]+/).map(s => s.trim()).filter(Boolean)]))
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150">
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Select Order Groups (Pwedeng 2 o higit pa)
              </label>
              {(selectedOrders.length > 0 || customOrder.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrders([])
                    setCustomOrder('')
                  }}
                  className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Clear (Unassign)
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ORDER_GROUPS.map((grp) => {
                const isSelected = selectedOrders.includes(grp)
                const theme = ORDER_COLORS[grp]
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => {
                      setSelectedOrders(prev =>
                        prev.includes(grp)
                          ? prev.filter(o => o !== grp)
                          : [...prev, grp]
                      )
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? `${theme?.bg || 'bg-blue-50'} ${theme?.border || 'border-blue-300'} ${theme?.text || 'text-blue-700'} shadow-2xs ring-1 ring-blue-300/60`
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{grp}</span>
                    {isSelected ? (
                      <svg className="w-3.5 h-3.5 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 border border-gray-300 rounded-sm ml-1" />
                    )}
                  </button>
                )
              })}
            </div>

            <input
              type="text"
              value={customOrder}
              onChange={(e) => setCustomOrder(e.target.value)}
              placeholder="Other / Custom group name (optional)"
              className="mt-2.5 block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-shadow"
              disabled={loading}
            />
          </div>

          <p className="text-xs text-gray-500">
            This action will update the order of all <strong className="text-gray-700">{selectedCount}</strong> selected member(s) to <strong className="text-blue-600">{computedOrderPreview || 'Unassigned (No Order)'}</strong>.
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
