import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import { categoryService } from '@/services/finance/categoryService'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import type { EventFinanceCategory, PaymentMethod, EventExpense } from '@/types/eventFinance'
import type { FinanceCategory } from '@/types/finance'
import type { EventAssignment } from '@/types/event'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventName?: string
  onSuccess: () => void
  editItem?: EventExpense
  allocations: string[]
}

export const EventExpenseModal: React.FC<Props> = ({ isOpen, onClose, eventId, eventName, onSuccess, editItem, allocations }) => {
  const { user, profile } = useAuth()
  const [categories, setCategories] = useState<EventFinanceCategory[]>([])
  const [mainCategories, setMainCategories] = useState<FinanceCategory[]>([])
  const [eventAssignments, setEventAssignments] = useState<EventAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [fundSource, setFundSource] = useState<'event' | 'main_funds'>('event')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState('')
  const [spentBy, setSpentBy] = useState('')
  const [spentByUid, setSpentByUid] = useState('')
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const memberDropdownRef = useRef<HTMLDivElement>(null)
  const [categoryId, setCategoryId] = useState('')
  const [mainFinanceCategoryId, setMainFinanceCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [encashmentStatus, setEncashmentStatus] = useState<'pending' | 'encashed'>('pending')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
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
        setDescription(editItem.description || '')
        setAllocation(editItem.allocation || '')
        setNewCategoryName('')
        setShowMemberDropdown(false)
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [catsData, mainCatsData, assignmentsData] = await Promise.all([
        eventFinanceService.getEventFinanceCategories(eventId, 'expense'),
        categoryService.getCategories(),
        eventAssignmentService.getAssignmentsByEventId(eventId).catch(() => [])
      ])
      setCategories(catsData.filter(c => !c.isArchived))
      setMainCategories(mainCatsData.filter(c => !c.isArchived))
      setEventAssignments(assignmentsData)
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
    setShowMemberDropdown(false)
    setCategoryId('')
    setMainFinanceCategoryId('')
    setPaymentMethod('Cash')
    setEncashmentStatus('pending')
    setDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setAllocation('')
    setNewCategoryName('')
    setError(null)
  }

  // Only Event Team Members assigned to this event
  const memberCandidates = useMemo(() => {
    const candidates: Array<{
      id: string
      name: string
      roleSubtitle: string
    }> = []

    const addedNames = new Set<string>()

    eventAssignments.forEach(a => {
      if (!a.memberName || addedNames.has(a.memberName.toLowerCase().trim())) return
      let roleLabel = a.eventRoleName || 'Team Member'
      if (a.committeeName) {
        roleLabel = `${a.committeeName} (${roleLabel})`
      }
      if (a.isOverallHead) {
        roleLabel = `Overall Head • ${roleLabel}`
      }
      candidates.push({
        id: a.memberUid,
        name: a.memberName,
        roleSubtitle: roleLabel
      })
      addedNames.add(a.memberName.toLowerCase().trim())
    })

    return candidates
  }, [eventAssignments])

  const filteredMembers = useMemo(() => {
    const query = spentBy.trim().toLowerCase()
    if (!query) {
      return memberCandidates
    }
    return memberCandidates.filter(m => 
      m.name.toLowerCase().includes(query) || 
      m.roleSubtitle.toLowerCase().includes(query)
    )
  }, [memberCandidates, spentBy])

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

      if (editItem) {
        const payload: any = {
          amount: numAmount,
          spentOn: spentOn.trim(),
          spentByName: spentBy.trim(),
          spentByUid: spentByUid || editItem.spentByUid || user.uid,
          fundSource,
          paymentMethod,
          categoryId: fundSource === 'event' ? finalCategoryId : (finalCategoryId || ''),
          mainFinanceCategoryId: fundSource === 'main_funds' ? mainFinanceCategoryId : null,
          allocation: allocation.trim() || null,
          date,
          description: description.trim()
        }
        if (paymentMethod === 'Cheque') {
          payload.encashmentStatus = encashmentStatus
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
          mainFinanceCategoryId: fundSource === 'main_funds' ? mainFinanceCategoryId : null,
          allocation: allocation.trim() || null,
          date,
          description: description.trim()
        }
        if (paymentMethod === 'Cheque') {
          payload.encashmentStatus = encashmentStatus
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
    <Modal isOpen={isOpen} onClose={onClose} title={editItem ? "Edit Event Expense" : "Add Event Expense"} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium">
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
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2">
            <span className="font-bold text-indigo-600 mt-0.5">ℹ️</span>
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
          <div className="relative" ref={memberDropdownRef}>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span>Spent By *</span>
              {eventAssignments.length > 0 && (
                <span className="text-[10px] font-semibold text-blue-600 lowercase tracking-normal">
                  ({eventAssignments.length} event {eventAssignments.length === 1 ? 'member' : 'members'})
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={100}
                value={spentBy}
                onChange={(e) => {
                  setSpentBy(e.target.value)
                  setSpentByUid('')
                  setShowMemberDropdown(true)
                }}
                onFocus={() => setShowMemberDropdown(true)}
                className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pl-9 pr-8 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
                placeholder="Search event member or enter name..."
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              {spentBy && (
                <button
                  type="button"
                  onClick={() => {
                    setSpentBy('')
                    setSpentByUid('')
                    setShowMemberDropdown(true)
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Clear name"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dropdown Menu */}
            {showMemberDropdown && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                {filteredMembers.length > 0 ? (
                  <>
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100 flex items-center justify-between">
                      <span>Event Team Members</span>
                      <span className="font-normal text-slate-400 lowercase">{filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}</span>
                    </div>
                    {filteredMembers.map((candidate) => (
                      <button
                        key={`${candidate.id}-${candidate.name}`}
                        type="button"
                        onClick={() => {
                          setSpentBy(candidate.name)
                          setSpentByUid(candidate.id)
                          setShowMemberDropdown(false)
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-xs hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-2 cursor-pointer group ${
                          spentBy.trim().toLowerCase() === candidate.name.toLowerCase() ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-blue-100 text-blue-700">
                            {candidate.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                              {candidate.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {candidate.roleSubtitle}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    <p className="font-medium text-slate-700">
                      {eventAssignments.length === 0 ? 'No members assigned to this event team' : 'No matching event team member'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {spentBy.trim() ? `Press enter or keep "${spentBy}" as custom name.` : 'You can type a custom name.'}
                    </p>
                  </div>
                )}
              </div>
            )}
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

        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-500/30 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {submitting ? 'Saving...' : editItem ? 'Update Expense' : 'Save Expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

