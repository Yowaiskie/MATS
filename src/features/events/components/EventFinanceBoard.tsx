import React, { useState, useEffect, useMemo } from 'react'
import { Card, Loading, StatusBadge, EmptyState, CustomSelect } from '@/components'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import type { EventIncome, EventExpense, EventFundTransfer } from '@/types/eventFinance'
import { EventIncomeModal } from './EventIncomeModal'
import { EventExpenseModal } from './EventExpenseModal'
import { EventFundRequestModal } from './EventFundRequestModal'
import { TransferToMainFundsModal } from './TransferToMainFundsModal'
import { EventFinanceReportModal } from './EventFinanceReportModal'
import { EventLiquidationModal } from './EventLiquidationModal'
import { PasswordConfirmModal } from '@/components/Dialog'
import { authService } from '@/services/authService'

interface Props {
  eventId: string
  eventName: string
  isHeadOrCreator?: boolean
}

type TabType = 'income' | 'expenses' | 'transfers'

export const EventFinanceBoard: React.FC<Props> = ({ eventId, eventName, isHeadOrCreator }) => {
  const { user, profile, canAction } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('income')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedHeldBy, setSelectedHeldBy] = useState('all')
  const [incomeSearchQuery, setIncomeSearchQuery] = useState('')
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const [incomes, setIncomes] = useState<EventIncome[]>([])
  const [expenses, setExpenses] = useState<EventExpense[]>([])
  const [transfers, setTransfers] = useState<EventFundTransfer[]>([])
  const [loading, setLoading] = useState(true)

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isFundRequestModalOpen, setIsFundRequestModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isLiquidationModalOpen, setIsLiquidationModalOpen] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string, type: 'income' | 'expense' }>({ isOpen: false, id: '', type: 'income' })
  const [archiveConfirm, setArchiveConfirm] = useState<{ isOpen: boolean, id: string, type: 'income' | 'expense' }>({ isOpen: false, id: '', type: 'income' })

  const [editIncomeItem, setEditIncomeItem] = useState<EventIncome | undefined>()
  const [editExpenseItem, setEditExpenseItem] = useState<EventExpense | undefined>()

  const handleOpenIncomeModal = (item?: EventIncome) => {
    setEditIncomeItem(item)
    setIsIncomeModalOpen(true)
  }

  const handleOpenExpenseModal = (item?: EventExpense) => {
    setEditExpenseItem(item)
    setIsExpenseModalOpen(true)
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const [inc, exp, trans] = await Promise.all([
        eventFinanceService.getEventIncomes(eventId),
        eventFinanceService.getEventExpenses(eventId),
        eventFinanceService.getEventFundTransfers(eventId)
      ])
      setIncomes(inc)
      setExpenses(exp)
      setTransfers(trans)
    } catch (err) {
      console.error('Failed to load event finances:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [eventId])

  const activeIncomes = incomes.filter(i => showArchived ? true : !i.isArchived)
  const activeExpenses = expenses.filter(e => showArchived ? true : !e.isArchived)

  const pendingIncome = incomes.filter(i => !i.isArchived && i.encashmentStatus === 'pending').reduce((sum, i) => sum + i.amount, 0)
  const totalIncome = incomes.filter(i => !i.isArchived && i.encashmentStatus !== 'pending').reduce((sum, i) => sum + i.amount, 0)
  const eventFundedExpenses = expenses.filter(e => !e.isArchived && e.encashmentStatus !== 'pending' && e.fundSource !== 'main_funds').reduce((sum, e) => sum + e.amount, 0)
  const mainFundedExpenses = expenses.filter(e => !e.isArchived && e.encashmentStatus !== 'pending' && e.fundSource === 'main_funds').reduce((sum, e) => sum + e.amount, 0)
  const totalExpenses = expenses.filter(e => !e.isArchived && e.encashmentStatus !== 'pending').reduce((sum, e) => sum + e.amount, 0)
  const totalTransfers = transfers.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0)
  const balance = totalIncome - eventFundedExpenses - totalTransfers

  const uniqueAllocations = Array.from(new Set([
    ...incomes.filter(i => !i.isArchived && i.allocation).map(i => i.allocation!),
    ...expenses.filter(e => !e.isArchived && e.allocation).map(e => e.allocation!)
  ])).sort()

  const uniqueCustodians = useMemo(() => {
    const set = new Set<string>()
    incomes.forEach(i => {
      if (!i.isArchived && i.heldBy?.trim()) {
        set.add(i.heldBy.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [incomes])

  const filteredIncomes = useMemo(() => {
    return activeIncomes.filter(i => {
      // Filter by Held By
      if (selectedHeldBy !== 'all') {
        if (selectedHeldBy === 'unassigned') {
          if (i.heldBy?.trim()) return false
        } else {
          if ((i.heldBy || '').trim().toLowerCase() !== selectedHeldBy.trim().toLowerCase()) {
            return false
          }
        }
      }

      // Filter by search query
      if (incomeSearchQuery.trim()) {
        const q = incomeSearchQuery.trim().toLowerCase()
        const matchFrom = (i.receivedFrom || '').toLowerCase().includes(q)
        const matchDesc = (i.description || '').toLowerCase().includes(q)
        const matchHeld = (i.heldBy || '').toLowerCase().includes(q)
        const matchAlloc = (i.allocation || '').toLowerCase().includes(q)
        if (!matchFrom && !matchDesc && !matchHeld && !matchAlloc) {
          return false
        }
      }

      // Filter by date range
      if (startDate && i.date && i.date < startDate) return false
      if (endDate && i.date && i.date > endDate) return false

      return true
    })
  }, [activeIncomes, selectedHeldBy, incomeSearchQuery, startDate, endDate])

  const filteredExpenses = useMemo(() => {
    return activeExpenses.filter(e => {
      // Filter by search query
      if (expenseSearchQuery.trim()) {
        const q = expenseSearchQuery.trim().toLowerCase()
        const matchSpentOn = (e.spentOn || '').toLowerCase().includes(q)
        const matchSpentBy = (e.spentByName || '').toLowerCase().includes(q)
        const matchOr = (e.orNumber || '').toLowerCase().includes(q)
        const matchAlloc = (e.allocation || '').toLowerCase().includes(q)
        const matchReceipts = e.receipts?.some(r => 
          (r.orNumber || '').toLowerCase().includes(q) || 
          (r.label || '').toLowerCase().includes(q)
        )
        if (!matchSpentOn && !matchSpentBy && !matchOr && !matchAlloc && !matchReceipts) {
          return false
        }
      }

      // Filter by date range
      if (startDate && e.date && e.date < startDate) return false
      if (endDate && e.date && e.date > endDate) return false

      return true
    })
  }, [activeExpenses, expenseSearchQuery, startDate, endDate])

  const handleConfirmDelete = async (password: string) => {
    if (!user || !profile || !deleteConfirm.id) return
    try {
      await authService.verifyPassword(password)

      if (deleteConfirm.type === 'income') {
        await eventFinanceService.deleteEventIncome(deleteConfirm.id, eventId, user.uid, profile.displayName || user.email || '')
      } else {
        await eventFinanceService.deleteEventExpense(deleteConfirm.id, eventId, user.uid, profile.displayName || user.email || '')
      }
      setDeleteConfirm({ isOpen: false, id: '', type: 'income' })
      fetchData()
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    }
  }

  const handleConfirmArchive = async (password: string) => {
    if (!user || !profile || !archiveConfirm.id) return
    try {
      await authService.verifyPassword(password)

      if (archiveConfirm.type === 'income') {
        await eventFinanceService.archiveEventIncome(archiveConfirm.id, eventId, user.uid, profile.displayName || user.email || '')
      } else {
        await eventFinanceService.archiveEventExpense(archiveConfirm.id, eventId, user.uid, profile.displayName || user.email || '')
      }
      setArchiveConfirm({ isOpen: false, id: '', type: 'income' })
      fetchData()
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    }
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-gray-200 shadow-xs">
        <Loading variant="spinner" label="Loading financial records..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className={`grid gap-4 ${totalTransfers > 0 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
        {/* Card 1: Net / Current Balance (Highlighted) */}
        <div className={`p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
          balance > 0
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            : balance < 0
            ? 'bg-rose-50/60 border-rose-200 text-rose-950'
            : 'bg-slate-50/70 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Current Balance</span>
            <div className={`p-2 rounded-xl border ${
              balance > 0
                ? 'bg-emerald-100/80 border-emerald-200 text-emerald-700'
                : balance < 0
                ? 'bg-rose-100/80 border-rose-200 text-rose-700'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black ${
              balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-rose-700' : 'text-slate-900'
            }`}>
              ₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block mt-1">
              Net Available (Income − Expenses)
            </span>
          </div>
        </div>

        {/* Card 2: Total Income */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Income</span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              ₱{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-semibold text-slate-400">Total collections</span>
              {pendingIncome > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  +₱{pendingIncome.toLocaleString()} pending
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Total Expenses */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Expenses</span>
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-600">
              ₱{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium truncate">
              {eventFundedExpenses > 0 || mainFundedExpenses > 0 ? (
                <>Event: ₱{eventFundedExpenses.toLocaleString()} • Main: ₱{mainFundedExpenses.toLocaleString()}</>
              ) : (
                'Total disbursements'
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Transfers to Fund (Displayed only if > 0) */}
        {totalTransfers > 0 && (
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Transfer to Fund</span>
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-blue-600">
                ₱{totalTransfers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                Remitted to treasury
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs & Actions Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full sm:w-auto">
          {[
            { key: 'income', label: 'Income', count: incomes.length },
            { key: 'expenses', label: 'Expenses', count: expenses.length },
            { key: 'transfers', label: 'Transfers', count: transfers.length }
          ].map((t) => {
            const isActive = activeTab === t.key
            return (
              <button 
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key as any)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <span className="whitespace-nowrap">{t.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                  isActive ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex space-x-2 items-center flex-wrap gap-2">
          <label className="flex items-center gap-2 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            <input 
              type="checkbox" 
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="text-blue-600 focus:ring-blue-500 h-4 w-4 rounded cursor-pointer"
            />
            <span>Show Archived</span>
          </label>

          {(isHeadOrCreator || canAction('canAddEventIncome')) && (
            <button
              onClick={() => setIsFundRequestModalOpen(true)}
              title="Request Funds from Main Ministry"
              aria-label="Request Funds from Main Ministry"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
              <span className="hidden sm:inline">Request Funds</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Generate Event Financial Report"
          >
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Financial Report</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLiquidationModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Generate Official Event Liquidation Report (PDF)"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>Liquidation PDF</span>
          </button>

          {(activeTab === 'income' && (isHeadOrCreator || canAction('canAddEventIncome'))) && (
            <button
              onClick={() => handleOpenIncomeModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Income</span>
            </button>
          )}
          {(activeTab === 'expenses' && (isHeadOrCreator || canAction('canAddEventExpense'))) && (
            <button
              onClick={() => handleOpenExpenseModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Expense</span>
            </button>
          )}
          {(activeTab === 'transfers' && (isHeadOrCreator || canAction('canTransferEventFunds'))) && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              disabled={balance <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Transfer to Main Funds</span>
            </button>
          )}
        </div>
      </div>

      {/* Income Filter Toolbar */}
      {activeTab === 'income' && (
        <div className="bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="sm:col-span-2 lg:col-span-5 relative">
              <input
                type="text"
                placeholder="Search received from, description, custodian..."
                value={incomeSearchQuery}
                onChange={(e) => setIncomeSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 pl-8.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {incomeSearchQuery && (
                <button
                  type="button"
                  onClick={() => setIncomeSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Held By Filter Dropdown */}
            <div className="lg:col-span-3">
              <CustomSelect
                value={selectedHeldBy}
                onChange={(e) => setSelectedHeldBy(e.target.value)}
                options={[
                  { value: 'all', label: 'All Custodians (Lahat ng may hawak)' },
                  { value: 'unassigned', label: 'Not Specified (Walang nakatalaga)' },
                  ...uniqueCustodians.map(c => ({ value: c, label: c }))
                ]}
              />
            </div>

            {/* Date Range Filter */}
            <div className="lg:col-span-4 flex items-center gap-1.5 sm:gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 min-w-0 text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs font-bold shrink-0">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 min-w-0 text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                title="End Date"
              />
            </div>
          </div>

          {/* Reset / Count Display */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-500">
              Showing <strong className="text-slate-900">{filteredIncomes.length}</strong> of {activeIncomes.length} income entries
            </span>
            {(selectedHeldBy !== 'all' || incomeSearchQuery.trim() || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedHeldBy('all')
                  setIncomeSearchQuery('')
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expense Filter Toolbar */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="sm:col-span-2 lg:col-span-7 relative">
              <input
                type="text"
                placeholder="Search spent on, spent by, O.R. #, allocation..."
                value={expenseSearchQuery}
                onChange={(e) => setExpenseSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 pl-8.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {expenseSearchQuery && (
                <button
                  type="button"
                  onClick={() => setExpenseSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Date Range Filter */}
            <div className="lg:col-span-5 flex items-center gap-1.5 sm:gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 min-w-0 text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs font-bold shrink-0">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 min-w-0 text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                title="End Date"
              />
            </div>
          </div>

          {/* Reset & Summary Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-500">
              Showing <strong className="text-slate-900">{filteredExpenses.length}</strong> of {activeExpenses.length} expense entries
            </span>
            {(expenseSearchQuery.trim() || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setExpenseSearchQuery('')
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tables */}
      <Card className="overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {activeTab === 'income' && (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Received From</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Held By</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              )}
              {activeTab === 'expenses' && (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">O.R. No.</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Spent On</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fund Source</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Spent By</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Allocation</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              )}
              {activeTab === 'transfers' && (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Destination</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTab === 'income' && filteredIncomes.map(inc => (
                <tr key={inc.id} className={inc.isArchived ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{inc.date}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 min-w-[120px]">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{inc.receivedFrom}</span>
                        {(inc.sourceType === 'main_fund_release' || inc.sourceFundRequestId) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                            </svg>
                            Ministry Grant
                          </span>
                        )}
                      </div>
                      {inc.description && (
                        <span className="text-[11px] text-gray-500 line-clamp-1">{inc.description}</span>
                      )}
                      {inc.lastEditedBy && (
                        <span className="text-[10px] text-gray-400 mt-0.5">Edited by {inc.lastEditedBy} at {new Date(inc.lastEditedAt!).toLocaleString()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {inc.heldBy ? (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-semibold text-gray-700">{inc.heldBy}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Not specified</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">₱{inc.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{inc.paymentMethod || 'Cash'}</span>
                      {inc.paymentMethod === 'Cheque' && (
                        <div className="mt-1">
                          <StatusBadge status={inc.encashmentStatus || 'pending'} size="sm" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-bold">
                    <div className="flex items-center justify-end gap-1.5">
                      {(isHeadOrCreator || canAction('canEditEventFinance')) && !inc.isArchived && (
                        <button 
                          onClick={() => handleOpenIncomeModal(inc)} 
                          className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                      )}
                      {(isHeadOrCreator || canAction('canVoidEventFinance')) && !inc.isArchived && (
                        <button 
                          onClick={() => setArchiveConfirm({ isOpen: true, id: inc.id, type: 'income' })} 
                          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-bold px-2.5 py-1 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archive</span>
                        </button>
                      )}
                      {(isHeadOrCreator || canAction('canVoidEventFinance')) && inc.isArchived && (
                        <button 
                          onClick={() => setDeleteConfirm({ isOpen: true, id: inc.id, type: 'income' })} 
                          className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 'expenses' && filteredExpenses.map(exp => (
                <tr key={exp.id} className={exp.isArchived ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{exp.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-600">
                    {exp.receipts && exp.receipts.length > 1 ? (
                      <div className="flex flex-col gap-1 items-start">
                        {exp.receipts.map((r, rIdx) => (
                          <span
                            key={r.id || rIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700"
                          >
                            {r.label && <span className="font-sans font-bold text-slate-900">{r.label}:</span>}
                            <span>{r.orNumber || 'NO O.R'}</span>
                            {r.amount !== undefined && (
                              <span className="text-emerald-700 font-bold font-mono text-[9.5px]">
                                (₱{r.amount.toLocaleString('en-US')})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 uppercase text-[10px]">
                        {exp.orNumber || 'NO O.R'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 min-w-[120px]">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{exp.spentOn}</span>
                      {exp.lastEditedBy && (
                        <span className="text-[10px] text-gray-400 mt-0.5">Edited by {exp.lastEditedBy} at {new Date(exp.lastEditedAt!).toLocaleString()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {exp.fundSource === 'main_funds' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <svg className="w-3 h-3 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                        <span>Main Funds</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Event Funds
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 min-w-[120px]">{exp.spentByName}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {exp.allocation ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {exp.allocation}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-red-600">₱{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{exp.paymentMethod || 'Cash'}</span>
                      {exp.paymentMethod === 'Cheque' && (
                        <div className="mt-1">
                          <StatusBadge status={exp.encashmentStatus || 'pending'} size="sm" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-bold">
                    <div className="flex items-center justify-end gap-1.5">
                      {(isHeadOrCreator || canAction('canEditEventFinance')) && !exp.isArchived && (
                        <button 
                          onClick={() => handleOpenExpenseModal(exp)} 
                          className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                      )}
                      {(isHeadOrCreator || canAction('canVoidEventFinance')) && !exp.isArchived && (
                        <button 
                          onClick={() => setArchiveConfirm({ isOpen: true, id: exp.id, type: 'expense' })} 
                          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-bold px-2.5 py-1 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archive</span>
                        </button>
                      )}
                      {(isHeadOrCreator || canAction('canVoidEventFinance')) && exp.isArchived && (
                        <button 
                          onClick={() => setDeleteConfirm({ isOpen: true, id: exp.id, type: 'expense' })} 
                          className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 'transfers' && transfers.map(trans => (
                <tr key={trans.id} className={trans.status === 'reversed' ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{trans.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">Main Funds</td>
                  <td className="px-4 py-3 text-sm text-gray-500 min-w-[150px]">{trans.remarks || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-600">₱{trans.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <StatusBadge status={trans.status === 'reversed' ? 'reversed' : 'completed'} size="sm" />
                  </td>
                </tr>
              ))}
              
              {activeTab === 'income' && filteredIncomes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <EmptyState
                      title={activeIncomes.length === 0 ? 'No income records' : 'No matching income records'}
                      description={activeIncomes.length === 0 ? 'There are no income records found for this event.' : 'Try adjusting your search query or filter options.'}
                    />
                  </td>
                </tr>
              )}
              {activeTab === 'expenses' && filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12">
                    <EmptyState
                      title={activeExpenses.length === 0 ? 'No expense records' : 'No matching expense records'}
                      description={activeExpenses.length === 0 ? 'There are no expense records found for this event.' : 'Try adjusting your search query or filter options.'}
                    />
                  </td>
                </tr>
              )}
              {activeTab === 'transfers' && transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12">
                    <EmptyState
                      title="No fund transfers"
                      description="No funds have been transferred to the main treasury yet."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <EventIncomeModal 
        isOpen={isIncomeModalOpen} 
        onClose={() => setIsIncomeModalOpen(false)} 
        eventId={eventId}
        onSuccess={fetchData}
        editItem={editIncomeItem}
        allocations={uniqueAllocations}
      />
      <EventExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        eventId={eventId}
        eventName={eventName}
        onSuccess={fetchData}
        editItem={editExpenseItem}
        allocations={uniqueAllocations}
      />
      <EventFundRequestModal
        isOpen={isFundRequestModalOpen}
        onClose={() => setIsFundRequestModalOpen(false)}
        eventId={eventId}
        eventName={eventName}
        onSuccess={fetchData}
      />
      <TransferToMainFundsModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        eventId={eventId}
        eventName={eventName}
        availableBalance={balance}
        onSuccess={fetchData}
      />
      <EventFinanceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        eventName={eventName}
        incomes={incomes}
        expenses={expenses}
        transfers={transfers}
      />
      <EventLiquidationModal
        isOpen={isLiquidationModalOpen}
        onClose={() => setIsLiquidationModalOpen(false)}
        eventId={eventId}
        eventName={eventName}
        incomes={incomes}
        expenses={expenses}
      />
      <PasswordConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={`Permanently Delete ${deleteConfirm.type === 'income' ? 'Income' : 'Expense'}`}
        message={`Are you sure you want to permanently delete this ${deleteConfirm.type} record? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
      />
      <PasswordConfirmModal
        isOpen={archiveConfirm.isOpen}
        onClose={() => setArchiveConfirm({ ...archiveConfirm, isOpen: false })}
        onConfirm={handleConfirmArchive}
        title={`Archive ${archiveConfirm.type === 'income' ? 'Income' : 'Expense'}`}
        message={`This will move the ${archiveConfirm.type} to the archive. Please verify your password to proceed.`}
        confirmLabel="Archive"
      />
    </div>
  )
}
