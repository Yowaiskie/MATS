import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Dialog'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import { categoryService } from '@/services/finance/categoryService'
import type { FinanceCategory } from '@/types/finance'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventName: string
  availableBalance: number
  onSuccess: () => void
}

export const TransferToMainFundsModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  eventId, 
  eventName, 
  availableBalance, 
  onSuccess 
}) => {
  const { user, profile } = useAuth()
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchMainCategories()
      if (availableBalance > 0) {
        const parts = availableBalance.toString().split('.')
        if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        setAmount(parts.join('.'))
      } else {
        setAmount('')
      }
      setCategoryId('')
      setDate(new Date().toISOString().split('T')[0])
      setRemarks('')
      setError(null)
    }
  }, [isOpen, availableBalance])

  const fetchMainCategories = async () => {
    try {
      setLoading(true)
      const data = await categoryService.getCategories()
      setCategories(data)
    } catch (err) {
      console.error('Failed to load main categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const numAmount = Number(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Transfer amount must be greater than zero.')
      return
    }

    if (numAmount > availableBalance) {
      setError(`Cannot transfer more than the available balance (₱${availableBalance.toFixed(2)}).`)
      return
    }

    if (!categoryId) {
      setError('Destination category is required.')
      return
    }

    setIsConfirmOpen(true)
  }

  const handleConfirmTransfer = async () => {
    if (!user || !profile) return
    setIsConfirmOpen(false)
    const numAmount = Number(amount.replace(/,/g, ''))

    try {
      setSubmitting(true)
      setError(null)

      const uName = profile.displayName || user.email || 'Unknown User'

      await eventFinanceService.transferToMainFunds(
        eventId,
        eventName,
        numAmount,
        categoryId,
        date,
        remarks.trim(),
        user.uid,
        uName
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to execute transfer:', err)
      setError(err.message || 'Failed to execute transfer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer to Main Funds"
      subtitle="Atomically transfer event surplus/proceeds to Main Treasury"
      badge="Treasury Transfer"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      }
      maxWidth="xl"
    >
      <div className="p-4 mb-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-2xs">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
        </div>
        <div>
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Treasury Transfer Notice</h4>
          <p className="text-xs text-indigo-700/90 font-medium mt-0.5">
            This will atomically move money from this event's ledger to the main ministry funds. A corresponding Income record will be created in the main finance module.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-bold animate-fade-in">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Available Balance</span>
          <span className="text-lg font-black text-indigo-900 font-mono">₱{availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Transfer Amount (₱) *</label>
          <input
            type="text"
            required
            value={amount}
            onChange={(e) => {
              let val = e.target.value.replace(/,/g, '')
              if (val === '') { setAmount(''); return; }
              if (!/^\d*\.?\d*$/.test(val)) return;
              const parts = val.split('.')
              if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              setAmount(parts.join('.'))
            }}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Destination Main Category *</label>
          <div className="relative">
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 pl-3.5 pr-10 border border-slate-300 rounded-xl bg-white text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer shadow-2xs"
            >
              <option value="">Select Main Finance Category</option>
              {loading ? (
                <option disabled>Loading...</option>
              ) : (
                categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Date *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Remarks (Optional)</label>
          <textarea
            rows={2}
            maxLength={250}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder="Additional notes for the main ledger..."
          />
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {submitting ? 'Transferring...' : 'Transfer to Main Funds'}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmTransfer}
        title="Confirm Transfer"
        message={`Are you sure you want to transfer ₱${Number(amount.replace(/,/g, '')).toFixed(2)} to the main ministry funds? This action is atomic and irreversible.`}
        confirmLabel="Execute Transfer"
        variant="warning"
      />
    </Modal>
  )
}
