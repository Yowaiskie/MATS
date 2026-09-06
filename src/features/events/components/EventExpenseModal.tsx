import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { MemberCombobox } from '@/components/MemberCombobox'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import { categoryService } from '@/services/finance/categoryService'
import type { EventFinanceCategory, PaymentMethod, EventExpense, EventExpenseReceipt } from '@/types/eventFinance'
import type { FinanceCategory } from '@/types/finance'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventName?: string
  onSuccess: () => void
  editItem?: EventExpense
  allocations: string[]
}

interface ReceiptItemForm {
  id: string
  orNumber: string
  label: string
  amount: string
}

export const EventExpenseModal: React.FC<Props> = ({ isOpen, onClose, eventId, eventName, onSuccess, editItem, allocations }) => {
  const { user, profile } = useAuth()
  const [categories, setCategories] = useState<EventFinanceCategory[]>([])
  const [mainCategories, setMainCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [fundSource, setFundSource] = useState<'event' | 'main_funds'>('event')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState('')
  const [spentBy, setSpentBy] = useState('')
  const [spentByUid, setSpentByUid] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [mainFinanceCategoryId, setMainFinanceCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [encashmentStatus, setEncashmentStatus] = useState<'pending' | 'encashed'>('pending')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [receipts, setReceipts] = useState<ReceiptItemForm[]>([
    { id: '1', orNumber: '', label: '', amount: '' }
  ])
  const [description, setDescription] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [allocation, setAllocation] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchInitialData()
      if (editItem) {
        const parts = editItem.amount.toString().split('.')
        if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        setAmount(parts.join('.'))
        setSpentOn(editItem.spentOn)
        setSpentBy(editItem.spentByName)
        setSpentByUid(editItem.spentByUid || '')
        setFundSource(editItem.fundSource || 'event')
        setCategoryId(editItem.categoryId || '')
        setMainFinanceCategoryId(editItem.mainFinanceCategoryId || '')
        setPaymentMethod(editItem.paymentMethod || 'Cash')
        setEncashmentStatus(editItem.encashmentStatus || 'pending')
        setDate(editItem.date || new Date().toISOString().split('T')[0])
        
        // Hydrate receipts
        if (editItem.receipts && editItem.receipts.length > 0) {
          setReceipts(editItem.receipts.map(r => ({
            id: r.id || Date.now().toString() + Math.random().toString(36).substring(2, 5),
            orNumber: r.orNumber || '',
            label: r.label || '',
            amount: r.amount !== undefined ? r.amount.toLocaleString('en-US') : ''
          })))
        } else if (editItem.orNumber) {
          setReceipts([{
            id: '1',
            orNumber: editItem.orNumber,
            label: '',
            amount: parts.join('.')
          }])
        } else {
          setReceipts([{ id: '1', orNumber: '', label: '', amount: '' }])
        }

        setDescription(editItem.description || '')
        setAllocation(editItem.allocation || '')
        setNewCategoryName('')
        setError(null)
      } else {
        resetForm()
        if (profile?.displayName) {
          setSpentBy(profile.displayName)
          setSpentByUid(user?.uid || '')
        } else if (user?.email) {
          setSpentBy(user.email)
          setSpentByUid(user?.uid || '')
        }
      }
    }
  }, [isOpen, profile, user, editItem])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [catsData, mainCatsData] = await Promise.all([
        eventFinanceService.getEventFinanceCategories(eventId, 'expense'),
        categoryService.getCategories()
      ])
      setCategories(catsData.filter(c => !c.isArchived))
      setMainCategories(mainCatsData.filter(c => !c.isArchived))
    } catch (err) {
      console.error('Failed to load modal data:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFundSource('event')
    setAmount('')
    setSpentOn('')
    setSpentBy('')
    setSpentByUid('')
    setCategoryId('')
    setMainFinanceCategoryId('')
    setPaymentMethod('Cash')
    setEncashmentStatus('pending')
    setDate(new Date().toISOString().split('T')[0])
    setReceipts([{ id: Date.now().toString(), orNumber: '', label: '', amount: '' }])
    setDescription('')
    setAllocation('')
    setNewCategoryName('')
    setError(null)
  }

  const handleAddReceiptRow = () => {
    setReceipts(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(36).substring(2, 5), orNumber: '', label: '', amount: '' }
    ])
  }

  const handleRemoveReceiptRow = (id: string) => {
    setReceipts(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  const handleUpdateReceipt = (id: string, field: keyof ReceiptItemForm, value: string) => {
    setReceipts(prev => prev.map(r => {
      if (r.id !== id) return r
      if (field === 'amount') {
        const clean = value.replace(/[^0-9.]/g, '')
        const parts = clean.split('.')
        if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : parts.join('.')
        return { ...r, amount: formatted }
      }
      return { ...r, [field]: value }
    }))
  }

  const handleToggleNoOr = (id: string) => {
    setReceipts(prev => prev.map(r => {
      if (r.id !== id) return r
      const isNoOr = r.orNumber.trim().toUpperCase() === 'NO O.R'
      return { ...r, orNumber: isNoOr ? '' : 'NO O.R' }
    }))
  }

  const totalReceiptsAmount = receipts.reduce((sum, r) => {
    const val = Number(r.amount.replace(/,/g, ''))
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const handleApplyReceiptsTotal = () => {
    if (totalReceiptsAmount > 0) {
      const parts = totalReceiptsAmount.toString().split('.')
      if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      setAmount(parts.join('.'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const numAmount = Number(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    if (!spentOn.trim() || !date || !spentBy.trim()) {
      setError('Spent On, Spent By, and Date are required.')
      return
    }

    if (fundSource === 'main_funds' && !mainFinanceCategoryId) {
      setError('Please select a Main Finance Category for expenses funded by Main Ministry Funds.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      let finalCategoryId = categoryId
      const uName = profile.displayName || user.email || 'Unknown User'

      if (fundSource === 'event' && categoryId === 'new') {
        if (!newCategoryName.trim()) {
          setError('New category name is required.')
          setSubmitting(false)
          return
        }
        finalCategoryId = await eventFinanceService.addEventFinanceCategory(
          eventId,
          newCategoryName.trim(),
          'expense',
          user.uid,
          uName
        )
      }

      const validReceipts: EventExpenseReceipt[] = receipts
        .filter(r => r.orNumber.trim() || r.label.trim() || (r.amount && r.amount.trim()))
        .map(r => {
          const item: EventExpenseReceipt = {
            id: r.id || Date.now().toString(),
            orNumber: r.orNumber.trim() || 'NO O.R'
          }
          if (r.label.trim()) {
            item.label = r.label.trim()
          }
          const cleanAmt = r.amount.replace(/,/g, '').trim()
          if (cleanAmt && !isNaN(Number(cleanAmt))) {
            item.amount = Number(cleanAmt)
          }
          return item
        })

      const formattedOrSummary = validReceipts.length > 0
        ? validReceipts
            .map(r => {
              const or = r.orNumber || 'NO O.R'
              return r.label ? `${r.label} (${or})` : or
            })
            .join(', ')
        : 'NO O.R'

      if (editItem) {
        const payload: any = {
          amount: numAmount,
          spentOn: spentOn.trim(),
          spentByName: spentBy.trim(),
          spentByUid: spentByUid || editItem.spentByUid || user.uid,
          fundSource,
          paymentMethod,
          categoryId: fundSource === 'event' ? finalCategoryId : (finalCategoryId || ''),
          mainFinanceCategoryId: fundSource === 'main_funds' ? (mainFinanceCategoryId || null) : null,
          allocation: allocation.trim() || null,
          date,
          orNumber: formattedOrSummary,
          receipts: validReceipts,
          description: description.trim()
        }
        if (paymentMethod === 'Cheque') {
          payload.encashmentStatus = encashmentStatus || 'pending'
        } else {
          payload.encashmentStatus = null
        }

        await eventFinanceService.updateEventExpense(
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
          spentOn: spentOn.trim(),
          spentByUid: spentByUid || user.uid,
          spentByName: spentBy.trim(),
          fundSource,
          paymentMethod,
          categoryId: fundSource === 'event' ? finalCategoryId : (finalCategoryId || ''),
          mainFinanceCategoryId: fundSource === 'main_funds' ? (mainFinanceCategoryId || null) : null,
          allocation: allocation.trim() || null,
          date,
          orNumber: formattedOrSummary,
          receipts: validReceipts,
          description: description.trim()
        }
        if (paymentMethod === 'Cheque') {
          payload.encashmentStatus = encashmentStatus || 'pending'
        } else {
          payload.encashmentStatus = null
        }

        await eventFinanceService.addEventExpense(
          payload,
          user.uid,
          uName,
          eventName
        )
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to save expense:', err)
      setError(err.message || 'Failed to save expense record.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? "Edit Event Expense" : "Add Event Expense"}
      subtitle={editItem ? "Modify event disbursement record" : "Record new expenditure for this event"}
      badge="Event Expense"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
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

        {/* Funding Source Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fund Source *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFundSource('event')}
              disabled={!!editItem?.mainFinanceExpenseId}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                fundSource === 'event'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-white'
              } ${editItem?.mainFinanceExpenseId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                  fundSource === 'event' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'
                }`}>
                  {fundSource === 'event' && <span className="w-1 h-1 rounded-full bg-white" />}
                </span>
                <span className="text-xs font-bold text-slate-900">Event Funds</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 pl-5">Deducted from this event's internal collection</p>
            </button>

            <button
              type="button"
              onClick={() => setFundSource('main_funds')}
              disabled={!!editItem?.id && !editItem?.mainFinanceExpenseId}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                fundSource === 'main_funds'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-white'
              } ${editItem?.id && !editItem?.mainFinanceExpenseId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                  fundSource === 'main_funds' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                }`}>
                  {fundSource === 'main_funds' && <span className="w-1 h-1 rounded-full bg-white" />}
                </span>
                <span className="text-xs font-bold text-indigo-900">Main Ministry Funds</span>
              </div>
              <p className="text-[11px] text-indigo-700/80 mt-1 pl-5">Auto-synced directly with Main Finance</p>
            </button>
          </div>
        </div>

        {fundSource === 'main_funds' && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-bold">Main Funds Synchronization:</span> This expense will automatically be recorded as a Direct Expense in the Main Finance module and deducted from the general ministry balance.
            </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Spent On / Item *</label>
            <input
              type="text"
              required
              maxLength={100}
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white"
              placeholder="e.g. Food, Venue"
            />
          </div>

          {/* Searchable Dropdown for Spent By */}
          <div>
            <MemberCombobox
              label="Spent By"
              placeholder="Search masterlist or type spender name..."
              value={spentBy}
              required
              onChange={(name, uid) => {
                setSpentBy(name)
                setSpentByUid(uid || '')
              }}
              helperText="Select from masterlist, or type custom name if external."
            />
          </div>
        </div>

        {/* Category fields */}
        {fundSource === 'main_funds' ? (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-indigo-700 mb-1.5">Main Finance Category *</label>
            <select
              required
              value={mainFinanceCategoryId}
              onChange={(e) => setMainFinanceCategoryId(e.target.value)}
              className="w-full border-indigo-200 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all px-4 py-2.5 bg-indigo-50/50 hover:bg-white focus:bg-white"
            >
              <option value="">Select Main Ministry Category</option>
              {mainCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Event Category</label>
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
        )}

        {fundSource === 'main_funds' && (
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
        )}

        {/* Receipts & O.R. Breakdown Section */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                Official Receipts (O.R.) & Breakdown
              </label>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Add single or multiple O.R.s (e.g. Foods, Drinks) with receipt # and amounts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddReceiptRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
            >
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add Another O.R.</span>
            </button>
          </div>

          {/* Receipt Rows */}
          <div className="space-y-2.5">
            {receipts.map((r, idx) => (
              <div
                key={r.id}
                className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 transition-all hover:border-slate-300"
              >
                {/* Index badge */}
                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0 self-start sm:self-center">
                  #{idx + 1}
                </span>

                {/* Particular / Label (e.g. Foods, Drinks) */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => handleUpdateReceipt(r.id, 'label', e.target.value)}
                    placeholder={idx === 0 ? "Item / Label (e.g. Foods)" : idx === 1 ? "Item / Label (e.g. Drinks)" : "Item / Particular"}
                    className="w-full border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* OR # + Quick NO O.R */}
                <div className="flex items-center gap-1 w-full sm:w-44 shrink-0">
                  <input
                    type="text"
                    value={r.orNumber}
                    onChange={(e) => handleUpdateReceipt(r.id, 'orNumber', e.target.value)}
                    placeholder="O.R. # (e.g. OR #123)"
                    className="w-full border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleNoOr(r.id)}
                    title="Toggle NO O.R"
                    className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-colors shrink-0 cursor-pointer ${
                      r.orNumber.trim().toUpperCase() === 'NO O.R'
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    NO O.R
                  </button>
                </div>

                {/* Amount (₱) */}
                <div className="relative w-full sm:w-32 shrink-0">
                  <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400 pointer-events-none">₱</span>
                  <input
                    type="text"
                    value={r.amount}
                    onChange={(e) => handleUpdateReceipt(r.id, 'amount', e.target.value)}
                    placeholder="0.00"
                    className="w-full border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-right font-medium"
                  />
                </div>

                {/* Remove button */}
                {receipts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveReceiptRow(r.id)}
                    title="Remove this O.R."
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Subtotal & Auto-Apply Summary */}
          {receipts.length > 1 && totalReceiptsAmount > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-950">
                  Total from {receipts.length} Receipts:
                </span>
                <span className="font-mono text-xs font-black text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                  ₱{totalReceiptsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyReceiptsTotal}
                className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100/60 px-3 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span>Apply as Expense Total</span>
                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fund Allocation (Optional)</label>
          <input
            type="text"
            list="allocations-list"
            maxLength={50}
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
            placeholder="e.g. AGAPE, Pilgrimage, General"
          />
          <datalist id="allocations-list">
            {allocations.map(a => (
              <option key={a} value={a} />
            ))}
          </datalist>
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

        {fundSource === 'event' && categoryId === 'new' && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-blue-600 mb-1.5">New Category Name *</label>
            <input
              type="text"
              required
              maxLength={50}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full border-blue-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-blue-50"
              placeholder="e.g. Logistics"
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
            placeholder="Additional notes about this expense..."
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
            {submitting ? 'Saving...' : editItem ? 'Update Expense' : 'Save Expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

