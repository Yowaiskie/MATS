import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { AlertModal } from '@/components/Dialog'
import type { EventIncome, EventExpense, EventFundTransfer } from '@/types/eventFinance'
import { downloadEventFinanceReportPdf } from '@/utils/eventFinancePdfReport'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: [
      {
        id: 'ef-sig-1',
        label: 'Prepared by:',
        name: '',
        title: DEFAULT_MINISTRY_NAME,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'ef-sig-2',
        label: 'Noted by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  })

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
    setIsGenerating(true)
    try {
      await downloadEventFinanceReportPdf(
        {
          eventName,
          totalIncome,
          totalExpense,
          totalTransfer,
          balance,
          incomeByCategory,
          expenseByCategory
        },
        {
          signatureConfig: signatureConfig.enabled ? signatureConfig : undefined
        }
      )
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      setIsAlertOpen(true)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Event Financial Statement"
        subtitle={`Complete financial summary and statements for ${eventName}`}
        badge="Financial Report"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        maxWidth="2xl"
      >
        <div className="p-1 space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-xs" id="finance-report">
          
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-1">
              Official Event Statement
            </span>
            <h1 className="text-base font-black text-slate-900 tracking-tight uppercase">{eventName}</h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">Generated on {new Date().toLocaleString()}</p>
          </div>

          {/* Executive Summary */}
          <div className={`grid gap-2.5 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 ${totalTransfer > 0 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Income</p>
              <p className="text-base font-black text-emerald-700 font-mono">₱{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Expenses</p>
              <p className="text-base font-black text-rose-700 font-mono">₱{totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            {totalTransfer > 0 && (
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Transfer to Fund</p>
                <p className="text-base font-black text-blue-700 font-mono">₱{totalTransfer.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
            <div className={`p-3 rounded-xl border shadow-2xs ${balance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Remaining Balance</p>
              <p className={`text-base font-black font-mono ${balance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Income Breakdown */}
          {Object.keys(incomeByCategory).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1.5">
                Income Breakdown (Sources / Sponsors)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(incomeByCategory).sort((a,b) => b[1] - a[1]).map(([source, amount]) => (
                  <div key={source} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">{source}</span>
                    <span className="text-xs font-black text-green-600">₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expense Breakdown */}
          {Object.keys(expenseByCategory).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1.5">
                Expense Breakdown (Items / Services)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(expenseByCategory).sort((a,b) => b[1] - a[1]).map(([item, amount]) => (
                  <div key={item} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">{item}</span>
                    <span className="text-xs font-black text-red-600">₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Signature Configuration */}
          <DynamicSignatureConfig
            value={signatureConfig}
            onChange={setSignatureConfig}
            defaultPresetName="General"
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white print:hidden">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 active:scale-95 transition flex items-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <span>Generating PDF...</span>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download PDF Report</span>
                </>
              )}
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
