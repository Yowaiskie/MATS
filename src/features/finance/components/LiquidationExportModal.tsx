import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig, SignatoryItem } from '@/types/signature'
import type { FinanceFundRequest } from '@/types/finance'
import { downloadLiquidationReportPdf } from '@/utils/liquidationReportPdf'

interface LiquidationExportModalProps {
  isOpen: boolean
  onClose: () => void
  request: FinanceFundRequest | null
}

export const LiquidationExportModal: React.FC<LiquidationExportModalProps> = ({
  isOpen,
  onClose,
  request
}) => {
  const [docDate, setDocDate] = useState('')
  const [toName, setToName] = useState('Rev. Fr. ILDEFONSO DE GUZMAN JR.')
  const [toTitle, setToTitle] = useState('Parish Priest')
  const [fromName, setFromName] = useState('MINISTRY OF ALTAR SERVERS')
  const [subject, setSubject] = useState('Liquidation Report')

  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: []
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (request) {
      setDocDate(request.liquidationDate || new Date().toISOString().slice(0, 10))
      setToName(request.liquidationTo || 'Rev. Fr. ILDEFONSO DE GUZMAN JR.')
      setToTitle('Parish Priest')
      setFromName(request.liquidationFrom || 'MINISTRY OF ALTAR SERVERS')
      setSubject('Liquidation Report')

      const defaultSignatories: SignatoryItem[] = [
        {
          id: 'sig-liq-1',
          label: 'Prepared by:',
          name: request.liquidatedByName || request.requestedByName || 'Bro. CHRYSLER DAVID',
          title: 'Treasurer, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 1
        },
        {
          id: 'sig-liq-2',
          label: 'Noted by:',
          name: request.approvedByName || 'Bro. KYLE VINCENT MADRIAGA',
          title: 'Coordinator, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 2
        },
        {
          id: 'sig-liq-3',
          label: 'Approved by:',
          name: request.liquidationTo || 'Rev. Fr. ILDEFONSO DE GUZMAN JR.',
          title: 'Parish Priest',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 2
        }
      ]

      setSignatureConfig({
        enabled: true,
        signatories: defaultSignatories
      })
    }
  }, [request])

  if (!isOpen || !request) return null

  const budgetSources = request.budgetSources !== undefined
    ? request.budgetSources
    : [
        {
          id: 'b1',
          description: `Parish (Request - ${request.referenceNumber})`,
          amount: Number(request.releasedAmount || request.requestedAmount || 0)
        }
      ]

  const totalBudget = budgetSources.reduce((sum, b) => sum + (Number(String(b.amount || 0).replace(/,/g, '')) || 0), 0)

  const expenses = request.liquidationExpenses !== undefined
    ? request.liquidationExpenses
    : (request.expectedExpenses && request.expectedExpenses.length > 0)
    ? request.expectedExpenses.map(e => ({
        id: e.id,
        orNumber: 'NO O.R',
        description: e.intendedUse,
        amount: Number(String(e.amount || 0).replace(/,/g, '')) || 0
      }))
    : request.totalSpent
    ? [
        {
          id: 'e1',
          orNumber: 'NO O.R',
          description: request.purpose || request.title || 'Total Spent Expenditures',
          amount: Number(request.totalSpent || 0)
        }
      ]
    : []

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(String(e.amount || 0).replace(/,/g, '')) || 0), 0)
  const returnedAmount = Math.max(0, totalBudget - totalExpenses)
  const reimbursedAmount = Math.max(0, totalExpenses - totalBudget)

  const handleDownload = async () => {
    setIsGenerating(true)
    setErrorMsg(null)
    try {
      await downloadLiquidationReportPdf(request, {
        liquidationDate: docDate,
        liquidationTo: toName.trim(),
        liquidationToTitle: toTitle.trim(),
        liquidationFrom: fromName.trim(),
        liquidationSubject: subject.trim(),
        signatureConfig: signatureConfig.enabled ? signatureConfig : undefined
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Liquidation Report PDF:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Official Liquidation Report PDF"
      subtitle="Generate official liquidation statement with itemized expenses & sukli/abono"
      badge="Liquidation Report"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs">
            {errorMsg}
          </div>
        )}

        {/* Liquidation Header Setup */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                Official Liquidation Statement
              </span>
              <h4 className="text-sm font-black text-slate-900 mt-1">{request.title}</h4>
              <p className="text-[11px] font-mono text-slate-500">Ref: {request.referenceNumber}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] text-emerald-600 font-bold block uppercase">Total Budget</span>
                <span className="text-xs font-black text-emerald-800 font-mono">₱{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-2 bg-slate-100 border border-slate-300 rounded-xl text-center">
                <span className="text-[10px] text-slate-600 font-bold block uppercase">Total Spent</span>
                <span className="text-xs font-black text-slate-900 font-mono">₱{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                To (Parish Priest / Addressee)
              </label>
              <input
                type="text"
                value={toName}
                onChange={e => setToName(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={toTitle}
                onChange={e => setToTitle(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                From
              </label>
              <input
                type="text"
                value={fromName}
                onChange={e => setFromName(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Report Date
              </label>
              <input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Subject / Re:
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Live Summary Calculation Box */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
          <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">1. Total Budget</span>
            <span className="text-sm font-black text-indigo-900 font-mono">₱{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">2. Expenses</span>
            <span className="text-sm font-black text-rose-700 font-mono">₱{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">3. Returned (Sukli)</span>
            <span className={`text-sm font-black font-mono ${returnedAmount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
              ₱{returnedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">4. Reimbursed (Abono)</span>
            <span className={`text-sm font-black font-mono ${reimbursedAmount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
              ₱{reimbursedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Section 1 & 2 Tables Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Budget Sources */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
            <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Budget Info | Sponsors</span>
              </span>
              <span className="text-slate-500 font-mono">({budgetSources.length})</span>
            </h5>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {budgetSources.map((b, i) => (
                    <tr key={b.id || i}>
                      <td className="p-2 text-slate-800 font-medium">{b.description}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        ₱{Number(b.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actual Expenses */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
            <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Actual Expenses ({expenses.length})</span>
              </span>
              <span className="text-slate-500 font-mono">Total: ₱{totalExpenses.toLocaleString()}</span>
            </h5>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 text-center w-24">O.R. No</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((e, i) => (
                    <tr key={e.id || i}>
                      <td className="p-2 text-center font-mono text-[10px] text-slate-600">{e.orNumber || 'NO O.R'}</td>
                      <td className="p-2 text-slate-800 font-medium">{e.description}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        ₱{Number(e.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Dynamic Signatures Config */}
        <DynamicSignatureConfig
          value={signatureConfig}
          onChange={setSignatureConfig}
          defaultPresetName="Liquidation (3 Signatures)"
        />

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Liquidation Report PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
