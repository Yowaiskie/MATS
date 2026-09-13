import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { MemberCombobox } from '@/components/MemberCombobox'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import type { EventFinanceCategory, PaymentMethod, EventIncome } from '@/types/eventFinance'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  onSuccess: () => void
  editItem?: EventIncome
  allocations: string[]
}

export const EventIncomeModal: React.FC<Props> = ({ isOpen, onClose, eventId, onSuccess, editItem, allocations }) => {
  const { user, profile } = useAuth()
  const [categories, setCategories] = useState<EventFinanceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [amount, setAmount] = useState('')
  const [receivedFrom, setReceivedFrom] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [encashmentStatus, setEncashmentStatus] = useState<'pending' | 'encashed'>('pending')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [allocation, setAllocation] = useState('')
  const [heldBy, setHeldBy] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
      if (editItem) {
        const parts = editItem.amount.toString().split('.')
        if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        setAmount(parts.join('.'))
        setReceivedFrom(editItem.receivedFrom)
        setCategoryId(editItem.categoryId || '')
        setPaymentMethod(editItem.paymentMethod || 'Cash')
        setEncashmentStatus(editItem.encashmentStatus || 'pending')
        setDate(editItem.date || new Date().toISOString().split('T')[0])
        setDescription(editItem.description || '')
        setAllocation(editItem.allocation || '')
        setHeldBy(editItem.heldBy || '')
        setNewCategoryName('')
        setError(null)
      } else {
        resetForm()
      }
    }
  }, [isOpen, editItem])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const catsData = await eventFinanceService.getEventFinanceCategories(eventId, 'income')
      setCategories(catsData.filter(c => !c.isArchived))
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setAmount('')
    setReceivedFrom('')
    setCategoryId('')
    setPaymentMethod('Cash')
    setEncashmentStatus('pending')
    setDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setAllocation('')
    setHeldBy('')
    setNewCategoryName('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const numAmount = Number(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    if (!date || !receivedFrom.trim()) {
      setError('Received From and Date are required.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      let finalCategoryId = categoryId
      const uName = profile.displayName || user.email || 'Unknown User'

      // Handle new category creation on the fly
      if (categoryId === 'new') {
        if (!newCategoryName.trim()) {
          setError('New category name is required.')
          setSubmitting(false)
          return
        }
        finalCategoryId = await eventFinanceService.addEventFinanceCategory(
          eventId,
          newCategoryName.trim(),
          'income',
          user.uid,
          uName
        )
      }

      if (editItem) {
        const payload: any = {
          amount: numAmount,
          receivedFrom: receivedFrom.trim(),
          paymentMethod,
          categoryId: finalCategoryId,
          allocation: allocation.trim() || null,
          heldBy: heldBy.trim() || null,
          date,
          description: description.trim()
        }
        if (paymentMethod === 'Cheque') {
          payload.encashmentStatus = encashmentStatus
        } else {
          payload.encashmentStatus = null
        }

        await eventFinanceService.updateEventIncome(
          editItem.id,
          payload,
          eventId,
          user.uid,
          uName
        )
      } else {
        const payload: any = {
          eventId,
          amount: numAmount,
          receivedFrom: receivedFrom.trim(),
          paymentMethod,
          categoryId: finalCategoryId,
          allocation: allocation.trim() || null,
          heldBy: heldBy.trim() || null,
          date,
          description: description.trim()
        }
        if (paymentMethod === 'Cheque') {
          payload.encashmentStatus = encashmentStatus
        } else {
          payload.encashmentStatus = null
        }

        await eventFinanceService.addEventIncome(
          payload,
          user.uid,
          uName
        )
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to save income:', err)
      setError(err.message || 'Failed to save income record.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? "Edit Event Income" : "Add Event Income"}
      subtitle={editItem ? "Update event collection or sponsor revenue" : "Record funds received for this event"}
      badge="Event Income"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-bold animate-fade-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount (₱) *</label>
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Received From *</label>
          <input
            type="text"
            required
            maxLength={100}
            value={receivedFrom}
            onChange={(e) => setReceivedFrom(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            placeholder="e.g. John Doe, Sponsor Name"
          />
        </div>

        <div>
          <MemberCombobox
            label="Held By (Hawak ni / Custodian)"
            placeholder="Search masterlist officer or enter custom name..."
            value={heldBy}
            officersOnly
            onChange={(name) => setHeldBy(name)}
            helperText="Select active officer holding the funds, or type a custom name if external."
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fund Allocation (Optional)</label>
          <input
            type="text"
            list="allocations-list"
            maxLength={50}
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            placeholder="e.g. AGAPE, Pilgrimage, General"
          />
          <datalist id="allocations-list">
            {allocations.map(a => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category</label>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-11 pl-3.5 pr-10 border border-slate-300 rounded-xl shadow-2xs text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white cursor-pointer"
              >
                <option value="">Select Category (Optional)</option>
                {loading ? (
                  <option disabled>Loading...</option>
                ) : (
                  categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
                <option value="new" className="font-semibold text-blue-600">+ Add New Category</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
            <div className="relative">
              <select
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full h-11 pl-3.5 pr-10 border border-slate-300 rounded-xl shadow-2xs text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white cursor-pointer"
              >
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Cheque">Cheque</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {paymentMethod === 'Cheque' && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-amber-600 mb-1.5">Cheque Encashment Status</label>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="encashmentStatus"
                  value="pending"
                  checked={encashmentStatus === 'pending'}
                  onChange={() => setEncashmentStatus('pending')}
                  className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm font-semibold text-slate-700">Pending</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="encashmentStatus"
                  value="encashed"
                  checked={encashmentStatus === 'encashed'}
                  onChange={() => setEncashmentStatus('encashed')}
                  className="text-green-600 focus:ring-green-500 h-4 w-4"
                />
                <span className="text-sm font-semibold text-slate-700">Encashed</span>
              </label>
            </div>
          </div>
        )}

        {categoryId === 'new' && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-blue-600 mb-1.5">New Category Name *</label>
            <input
              type="text"
              required
              maxLength={50}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full border-blue-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-blue-50"
              placeholder="e.g. Sponsorship"
              autoFocus
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description (Optional)</label>
          <textarea
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            placeholder="Additional notes about this income..."
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
            {submitting ? 'Saving...' : editItem ? 'Update Income' : 'Save Income'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
