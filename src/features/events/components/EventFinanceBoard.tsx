import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventFinanceService } from '@/services/eventFinanceService'
import type { EventIncome, EventExpense, EventFundTransfer } from '@/types/eventFinance'
import { EventIncomeModal } from './EventIncomeModal'
import { EventExpenseModal } from './EventExpenseModal'
import { EventFundRequestModal } from './EventFundRequestModal'
import { TransferToMainFundsModal } from './TransferToMainFundsModal'
import { EventFinanceReportModal } from './EventFinanceReportModal'
import { PasswordConfirmModal } from '@/components/Dialog'
import { Loading } from '@/components/Loading'
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
  
  const [incomes, setIncomes] = useState<EventIncome[]>([])
  const [expenses, setExpenses] = useState<EventExpense[]>([])
  const [transfers, setTransfers] = useState<EventFundTransfer[]>([])
  const [loading, setLoading] = useState(true)

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isFundRequestModalOpen, setIsFundRequestModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 space-y-4 sm:space-y-0">
        <div className="flex space-x-6 px-1 overflow-x-auto whitespace-nowrap hide-scrollbar max-w-full">
          <button 
            onClick={() => setActiveTab('income')}
            className={`pb-2 border-b-2 text-sm font-bold px-1 transition-colors cursor-pointer ${activeTab === 'income' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Income ({incomes.length})
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`pb-2 border-b-2 text-sm font-bold px-1 transition-colors cursor-pointer ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Expenses ({expenses.length})
          </button>
          <button 
            onClick={() => setActiveTab('transfers')}
            className={`pb-2 border-b-2 text-sm font-bold px-1 transition-colors cursor-pointer ${activeTab === 'transfers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Transfers ({transfers.length})
          </button>
        </div>
        <div className="flex space-x-2 items-center">
          <label className="flex items-center gap-2 cursor-pointer mr-4">
            <input 
              type="checkbox" 
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="text-blue-600 focus:ring-blue-500 h-4 w-4 rounded cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-500">Show Archived</span>
          </label>

          {(isHeadOrCreator || canAction('canAddEventIncome')) && (
            <button
              onClick={() => setIsFundRequestModalOpen(true)}
              title="Request Funds from Main Ministry"
              aria-label="Request Funds from Main Ministry"
              className="p-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-2xs mr-2 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-sm font-medium hover:bg-indigo-100 transition mr-2 cursor-pointer"
          >
            Generate Report
          </button>

          {(activeTab === 'income' && (isHeadOrCreator || canAction('canAddEventIncome'))) && (
            <button
              onClick={() => handleOpenIncomeModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition cursor-pointer"
            >
              + Add Income
            </button>
          )}
          {(activeTab === 'expenses' && (isHeadOrCreator || canAction('canAddEventExpense'))) && (
            <button
              onClick={() => handleOpenExpenseModal()}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition cursor-pointer"
            >
              + Add Expense
            </button>
          )}
          {(activeTab === 'transfers' && (isHeadOrCreator || canAction('canTransferEventFunds'))) && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              disabled={balance <= 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Transfer to Main Funds
            </button>
          )}
        </div>
      </div>

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
              {activeTab === 'income' && activeIncomes.map(inc => (
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
                        <span className={`text-[10px] font-bold uppercase mt-0.5 ${inc.encashmentStatus === 'encashed' ? 'text-green-600' : 'text-amber-600'}`}>
                          {inc.encashmentStatus || 'pending'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {(isHeadOrCreator || canAction('canEditEventFinance')) && !inc.isArchived && (
                      <button onClick={() => handleOpenIncomeModal(inc)} className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded cursor-pointer">Edit</button>
                    )}
                    {(isHeadOrCreator || canAction('canVoidEventFinance')) && !inc.isArchived && (
                      <button onClick={() => setArchiveConfirm({ isOpen: true, id: inc.id, type: 'income' })} className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded cursor-pointer">Archive</button>
                    )}
                    {(isHeadOrCreator || canAction('canVoidEventFinance')) && inc.isArchived && (
                      <button onClick={() => setDeleteConfirm({ isOpen: true, id: inc.id, type: 'income' })} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded cursor-pointer">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {activeTab === 'expenses' && activeExpenses.map(exp => (
                <tr key={exp.id} className={exp.isArchived ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{exp.date}</td>
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        🏛️ Main Funds
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
                        <span className={`text-[10px] font-bold uppercase mt-0.5 ${exp.encashmentStatus === 'encashed' ? 'text-green-600' : 'text-amber-600'}`}>
                          {exp.encashmentStatus || 'pending'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {(isHeadOrCreator || canAction('canEditEventFinance')) && !exp.isArchived && (
                      <button onClick={() => handleOpenExpenseModal(exp)} className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded cursor-pointer">Edit</button>
                    )}
                    {(isHeadOrCreator || canAction('canVoidEventFinance')) && !exp.isArchived && (
                      <button onClick={() => setArchiveConfirm({ isOpen: true, id: exp.id, type: 'expense' })} className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded cursor-pointer">Archive</button>
                    )}
                    {(isHeadOrCreator || canAction('canVoidEventFinance')) && exp.isArchived && (
                      <button onClick={() => setDeleteConfirm({ isOpen: true, id: exp.id, type: 'expense' })} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded cursor-pointer">Delete</button>
                    )}
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
                    {trans.status === 'reversed' ? (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">Reversed</span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
              
              {activeTab === 'income' && activeIncomes.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No income records found.</td></tr>
              )}
              {activeTab === 'expenses' && activeExpenses.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No expense records found.</td></tr>
              )}
              {activeTab === 'transfers' && transfers.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No transfers found.</td></tr>
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
