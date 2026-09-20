import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Dialog'
import { CurrencyInput, CustomSelect, Button, useToast } from '@/components'
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
  const { toast } = useToast()
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

      toast.success('Funds Transferred', `Successfully transferred ₱${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to Main Ministry Funds.`)
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
          <CurrencyInput
            label="Transfer Amount"
            required
            value={amount}
            onChange={(formatted) => setAmount(formatted)}
            placeholder="0.00"
          />
        </div>

        <div>
          <CustomSelect
            label="Destination Main Category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[
              { value: '', label: loading ? 'Loading categories...' : 'Select Main Finance Category' },
              ...categories.map(c => ({ value: c.id, label: c.name }))
            ]}
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">Date *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 border border-slate-300 rounded-xl px-3.5 bg-white text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">Remarks (Optional)</label>
          <textarea
            rows={2}
            maxLength={250}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border border-slate-300 rounded-xl p-3 bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"
            placeholder="Additional notes for the main ledger..."
          />
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            loadingText="Transferring..."
          >
            Transfer to Main Funds
          </Button>
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

