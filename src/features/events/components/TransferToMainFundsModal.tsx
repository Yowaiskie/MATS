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
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer to Main Funds" maxWidth="md">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              This will atomically move money from this event's ledger to the main ministry funds. A corresponding Income record will be created in the main finance module.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center py-2 px-4 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Available Balance</span>
          <span className="text-xl font-black text-slate-900">₱{availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Transfer Amount (₱) *</label>
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
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Destination Main Category *</label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
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
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Remarks (Optional)</label>
          <textarea
            rows={2}
            maxLength={250}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            placeholder="Additional notes for the main ledger..."
          />
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || availableBalance <= 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-500/30 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-95"
          >
            {submitting ? 'Executing...' : 'Execute Transfer'}
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
