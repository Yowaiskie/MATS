import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { useToast } from '@/context/ToastContext'
import { fundRequestService } from '@/services/finance/fundRequestService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { LiquidationBudgetSource, LiquidationExpenseItem } from '@/types/finance'

interface DirectLiquidationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Helpers for formatted currency input
const formatCommaAmount = (val: number | string | undefined): string => {
  if (val === undefined || val === null || val === '') return ''
  const numStr = String(val).replace(/,/g, '')
  const num = Number(numStr)
  if (isNaN(num)) return String(val)
  return num.toLocaleString('en-US')
}

const parseAmount = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === '') return 0
  const clean = String(val).replace(/,/g, '').trim()
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

const getLocalYYYYMMDD = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const DirectLiquidationModal: React.FC<DirectLiquidationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [liquidationDate, setLiquidationDate] = useState(getLocalYYYYMMDD())
  const [liquidationTo, setLiqTo] = useState('Rev. Fr. ILDEFONSO DE GUZMAN JR., Parish Priest')
  const [liquidationFrom, setLiqFrom] = useState('MINISTRY OF ALTAR SERVERS')
  const [remarks, setRemarks] = useState('')

  // Budget Sources (Outside/Independent funding)
  const [budgetSources, setBudgetSources] = useState<LiquidationBudgetSource[]>([
    { id: 'b-1', description: 'Outside / Sponsor Donation', amount: '' }
  ])

  // Actual Itemized Expenditures
  const [expenses, setExpenses] = useState<LiquidationExpenseItem[]>([
    { id: 'e-1', orNumber: 'NO O.R', description: '', amount: '' }
  ])

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Calculations
  const totalBudget = budgetSources.reduce((sum, b) => sum + parseAmount(b.amount), 0)
  const totalSpent = expenses.reduce((sum, exp) => sum + parseAmount(exp.amount), 0)
  const returnedAmount = Math.max(0, totalBudget - totalSpent)
  const reimbursedAmount = Math.max(0, totalSpent - totalBudget)

  // Budget Source Row Helpers
  const handleAddBudgetSource = () => {
    setBudgetSources(prev => [
      ...prev,
      { id: `b-${Date.now()}-${prev.length + 1}`, description: '', amount: '' }
    ])
  }

  const handleRemoveBudgetSource = (idx: number) => {
    if (budgetSources.length <= 1) return
    setBudgetSources(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateBudgetSource = (idx: number, field: keyof LiquidationBudgetSource, val: string) => {
    setBudgetSources(prev => {
      const next = [...prev]
      if (field === 'amount') {
        const raw = val.replace(/[^0-9.]/g, '')
        next[idx] = { ...next[idx], amount: formatCommaAmount(raw) }
      } else {
        next[idx] = { ...next[idx], [field]: val }
      }
      return next
    })
  }

  // Expense Row Helpers
  const handleAddExpense = () => {
    setExpenses(prev => [
      ...prev,
      { id: `e-${Date.now()}-${prev.length + 1}`, orNumber: 'NO O.R', description: '', amount: '' }
    ])
  }

  const handleRemoveExpense = (idx: number) => {
    if (expenses.length <= 1) return
    setExpenses(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateExpense = (idx: number, field: keyof LiquidationExpenseItem, val: string) => {
    setExpenses(prev => {
      const next = [...prev]
      if (field === 'amount') {
        const raw = val.replace(/[^0-9.]/g, '')
        next[idx] = { ...next[idx], amount: formatCommaAmount(raw) }
      } else {
        next[idx] = { ...next[idx], [field]: val }
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !purpose.trim()) {
      setErrorMsg('Please enter a Report Title and Purpose.')
      return
    }

    if (totalBudget <= 0 && totalSpent <= 0) {
      setErrorMsg('Please provide budget sources or actual expenses for this liquidation.')
      return
    }

    const cleanBudgetSources = budgetSources
      .filter(b => b.description.trim() || parseAmount(b.amount) > 0)
      .map(b => ({ ...b, amount: parseAmount(b.amount) }))

    const cleanExpenses = expenses
      .filter(e => e.description.trim() || parseAmount(e.amount) > 0)
      .map(e => ({ ...e, amount: parseAmount(e.amount) }))

    if (cleanExpenses.length === 0) {
      setErrorMsg('Please add at least one itemized actual expenditure.')
      return
    }

    setSaving(true)
    setErrorMsg(null)

    try {
      await fundRequestService.createOutsideLiquidation(
        {
          title: title.trim(),
          purpose: purpose.trim(),
          liquidationDate,
          liquidationTo: liquidationTo.trim(),
          liquidationFrom: liquidationFrom.trim(),
          budgetSources: cleanBudgetSources,
          liquidationExpenses: cleanExpenses,
          totalSpent,
          returnedAmount,
          reimbursedAmount,
          remarks: remarks.trim()
        },
        profile?.uid || 'User',
        profile?.displayName || profile?.memberName || 'Administrator'
      )

      toast.success(
        'Outside Liquidation Recorded',
        `Liquidation report '${title}' was created and is ready for PDF export.`
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to create outside liquidation:', err)
      setErrorMsg(err.message || 'Failed to save outside liquidation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Outside / Independent Liquidation"
      subtitle="Direct liquidation report for outside donations, personal advances, or sponsor funds"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/80 flex items-start gap-3">
          <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xs text-purple-950 leading-relaxed">
            <strong className="font-extrabold">Outside / Independent Fund Record:</strong> This liquidation is <strong>completely separate</strong> from Parish and Ministry main treasury funds. It will <strong>not deduct</strong> from the General Ledger balance, and is saved directly for accounting transparency and PDF reporting.
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Basic Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Report Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Altar Servers Recollection Outside Expenses"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Liquidation Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={liquidationDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLiquidationDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Purpose / Activity Summary <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Food, materials, and tokens sponsored by alumni and outside donors"
            value={purpose}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPurpose(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Addressed To (Signatory Header) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={liquidationTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLiqTo(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              From (Ministry / Group Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={liquidationFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLiqFrom(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Dynamic Table: Budget Sources */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                1. Outside Budget Sources (Received / Advanced)
              </h4>
              <p className="text-[11px] text-slate-500">Specify outside sponsors, personal cash advances, or donor contributions.</p>
            </div>
            <button
              type="button"
              onClick={handleAddBudgetSource}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
            >
              + Add Source
            </button>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-bold">
                <tr>
                  <th className="px-3 py-2 text-left w-12">#</th>
                  <th className="px-3 py-2 text-left">Source / Donor Description</th>
                  <th className="px-3 py-2 text-right w-44">Amount (₱)</th>
                  <th className="px-2 py-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {budgetSources.map((source, idx) => (
                  <tr key={source.id}>
                    <td className="px-3 py-2 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="e.g. Alumni Sponsor Donation, Officer Cash Advance"
                        value={source.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateBudgetSource(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                        <input
                          type="text"
                          placeholder="0.00"
                          value={source.amount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateBudgetSource(idx, 'amount', e.target.value)}
                          className="w-full pl-6 pr-2.5 py-1.5 text-xs text-right font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        disabled={budgetSources.length <= 1}
                        onClick={() => handleRemoveBudgetSource(idx)}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer p-1"
                        title="Remove row"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Table: Itemized Actual Expenditures */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                2. Itemized Actual Expenditures (Receipts & Purchases)
              </h4>
              <p className="text-[11px] text-slate-500">Itemize all purchased supplies, food, transport, or materials.</p>
            </div>
            <button
              type="button"
              onClick={handleAddExpense}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            >
              + Add Item
            </button>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-bold">
                <tr>
                  <th className="px-3 py-2 text-left w-12">#</th>
                  <th className="px-3 py-2 text-left w-32">O.R. / Invoice #</th>
                  <th className="px-3 py-2 text-left">Item Description</th>
                  <th className="px-3 py-2 text-right w-44">Amount (₱)</th>
                  <th className="px-2 py-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {expenses.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="e.g. OR #1234 or NO O.R"
                        value={item.orNumber}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateExpense(idx, 'orNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="e.g. 20 pcs Candles, Certificate Printing, Snacks"
                        value={item.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateExpense(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                        <input
                          type="text"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateExpense(idx, 'amount', e.target.value)}
                          className="w-full pl-6 pr-2.5 py-1.5 text-xs text-right font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        disabled={expenses.length <= 1}
                        onClick={() => handleRemoveExpense(idx)}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer p-1"
                        title="Remove row"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">Total Budget (Outside)</span>
            <span className="text-base font-black text-purple-950 mt-0.5 block">
              ₱{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Total Actual Expenses</span>
            <span className="text-base font-black text-emerald-950 mt-0.5 block">
              ₱{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
              {returnedAmount > 0 ? 'Remaining Excess' : reimbursedAmount > 0 ? 'Reimbursement Due' : 'Balance'}
            </span>
            <span className={`text-base font-black mt-0.5 block ${returnedAmount > 0 ? 'text-blue-700' : reimbursedAmount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
              ₱{Math.max(returnedAmount, reimbursedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Additional Notes / Remarks
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Sourced from personal donation. Full receipts and physical vouchers kept on file."
            value={remarks}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving ? 'Saving Report...' : 'Save Outside Liquidation'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
