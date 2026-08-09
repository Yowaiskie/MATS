import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { AlertModal } from '@/components/Dialog'
import type { EventIncome, EventExpense, EventFundTransfer } from '@/types/eventFinance'
import { downloadEventFinanceReportPdf } from '@/utils/eventFinancePdfReport'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventName: string
  incomes: EventIncome[]
  expenses: EventExpense[]
  transfers: EventFundTransfer[]
}

export const EventFinanceReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventName,
  incomes,
  expenses,
  transfers
}) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false)

  const activeIncomes = incomes.filter(i => !i.isArchived && i.encashmentStatus !== 'pending')
  const activeExpenses = expenses.filter(e => !e.isArchived && e.encashmentStatus !== 'pending')
  const activeTransfers = transfers.filter(t => t.status === 'completed')

  const { totalIncome, totalExpense, totalTransfer, balance, incomeByCategory, expenseByCategory } = useMemo(() => {
    let tIncome = 0
    let tExpense = 0
    let tTransfer = 0
    const incByCat: Record<string, number> = {}
    const expByCat: Record<string, number> = {}

    activeIncomes.forEach(i => {
      tIncome += i.amount
      // Simple fallback if categoryId is missing, though we know it references a category doc, we just group by it.
      // We don't have the category names easily here without fetching, but we can group by receivedFrom for a better "sponsor/source" breakdown!
      const source = i.receivedFrom || 'Unknown Source'
      incByCat[source] = (incByCat[source] || 0) + i.amount
    })

    activeExpenses.forEach(e => {
      tExpense += e.amount
      const spentOn = e.spentOn || 'Unknown Expense'
      expByCat[spentOn] = (expByCat[spentOn] || 0) + e.amount
    })

    activeTransfers.forEach(t => {
      tTransfer += t.amount
    })

    return {
      totalIncome: tIncome,
      totalExpense: tExpense,
      totalTransfer: tTransfer,
      balance: tIncome - tExpense - tTransfer,
      incomeByCategory: incByCat,
      expenseByCategory: expByCat
    }
  }, [activeIncomes, activeExpenses, activeTransfers])

  const handleDownloadPdf = async () => {
    try {
      await downloadEventFinanceReportPdf({
        eventName,
        totalIncome,
        totalExpense,
        totalTransfer,
        balance,
        incomeByCategory,
        expenseByCategory
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      setIsAlertOpen(true)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Event Financial Report" maxWidth="2xl">
        <div className="p-6 bg-white print:p-0" id="finance-report">
          
          <div className="text-center mb-8 border-b border-gray-200 pb-6">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{eventName}</h1>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-1">Comprehensive Financial Report</p>
            <p className="text-xs text-slate-400 mt-2">Generated on {new Date().toLocaleString()}</p>
          </div>

          {/* Executive Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Income</p>
              <p className="text-xl font-black text-green-600">₱{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Expenses</p>
              <p className="text-xl font-black text-red-600">₱{totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Transferred</p>
              <p className="text-xl font-black text-blue-600">₱{totalTransfer.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-2xl border ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Remaining Balance</p>
              <p className={`text-xl font-black ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Income Breakdown */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Income Breakdown (Sources / Sponsors)</h3>
            {Object.keys(incomeByCategory).length === 0 ? (
              <p className="text-sm text-slate-500 italic">No income recorded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(incomeByCategory).sort((a,b) => b[1] - a[1]).map(([source, amount]) => (
                  <div key={source} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">{source}</span>
                    <span className="text-sm font-black text-green-600">₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense Breakdown */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Expense Breakdown (Items / Services)</h3>
            {Object.keys(expenseByCategory).length === 0 ? (
              <p className="text-sm text-slate-500 italic">No expenses recorded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(expenseByCategory).sort((a,b) => b[1] - a[1]).map(([item, amount]) => (
                  <div key={item} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">{item}</span>
                    <span className="text-sm font-black text-red-600">₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100 print:hidden">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>

        </div>
      </Modal>

      <AlertModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        title="Error"
        message="Failed to generate PDF report."
      />
    </>
  )
}
