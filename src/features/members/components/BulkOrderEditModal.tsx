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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Bulk Action
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Bulk Edit Order / Group ({selectedCount} Member{selectedCount > 1 ? 's' : ''})
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Select Order Groups (Pwedeng 2 o higit pa)
              </label>
              {(selectedOrders.length > 0 || customOrder.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrders([])
                    setCustomOrder('')
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
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
                        ? `${theme?.bg || 'bg-indigo-50'} ${theme?.border || 'border-indigo-300'} ${theme?.text || 'text-indigo-700'} shadow-2xs ring-1 ring-indigo-300/60`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{grp}</span>
                    {isSelected ? (
                      <svg className="w-3.5 h-3.5 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 border border-slate-300 rounded-md ml-1" />
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
              className="mt-2.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              disabled={loading}
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-900">
            This action will update the order of all <strong className="font-mono font-black">{selectedCount}</strong> selected member(s) to <strong className="font-extrabold text-indigo-700">{computedOrderPreview || 'Unassigned (No Order)'}</strong>.
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
