import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import { eventAssignmentService } from '@/services/eventAssignmentService'
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
  const [eventMembers, setEventMembers] = useState<string[]>([])
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
      fetchCategoriesAndMembers()
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

  const fetchCategoriesAndMembers = async () => {
    try {
      setLoading(true)
      const [catsData, assignmentsData] = await Promise.all([
        eventFinanceService.getEventFinanceCategories(eventId, 'income'),
        eventAssignmentService.getAssignmentsByEventId(eventId)
      ])
      setCategories(catsData.filter(c => !c.isArchived))
      
      const uniqueMembers = Array.from(new Set(assignmentsData.map(a => a.memberName))).sort()
      setEventMembers(uniqueMembers)
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
    <Modal isOpen={isOpen} onClose={onClose} title={editItem ? "Edit Event Income" : "Add Event Income"} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
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
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Held By (Optional)</label>
          <input
            type="text"
            list="event-members-list"
            maxLength={100}
            value={heldBy}
            onChange={(e) => setHeldBy(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            placeholder="e.g. Bro. Juan (Type or select from team)"
          />
          <datalist id="event-members-list">
            {eventMembers.map(member => (
              <option key={member} value={member} />
            ))}
          </datalist>
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
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
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
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
            <select
              required
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
            >
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
              <option value="Cheque">Cheque</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
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
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-500/30 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-95"
          >
            {submitting ? 'Saving...' : editItem ? 'Update Income' : 'Save Income'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
