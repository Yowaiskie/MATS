import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { fundRequestService } from '@/services/finance/fundRequestService'
import type { FundRequestSource } from '@/types/finance'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventName: string
  onSuccess: () => void
}

export const EventFundRequestModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventId,
  eventName,
  onSuccess
}) => {
  const { user, profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fundSource, setFundSource] = useState<FundRequestSource>('main_funds')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')
  const [dateNeeded, setDateNeeded] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFundSource('main_funds')
      setTitle(`Seed Budget for ${eventName}`)
      setPurpose('Event Preparation & Initial Expenses')
      setAmount('')
      setDateNeeded(new Date().toISOString().split('T')[0])
      setDescription('')
      setError(null)
    }
  }, [isOpen, eventName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const numAmount = Number(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    if (!title.trim() || !purpose.trim() || !dateNeeded) {
      setError('Title, Purpose, and Date Needed are required.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const uName = profile.displayName || user.email || 'Unknown User'

      await fundRequestService.createFundRequest(
        {
          title: title.trim(),
          purpose: purpose.trim(),
          requestedAmount: numAmount,
          requestedByUid: user.uid,
          requestedByName: uName,
          dateNeeded,
          description: description.trim(),
          fundSource,
          targetEventId: eventId,
          targetEventName: eventName,
          createdByUid: user.uid,
          createdByName: uName
        },
        user.uid,
        uName,
        true // Submit immediately as pending for Finance approval
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to submit event fund request:', err)
      setError(err.message || 'Failed to submit fund request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Funds for Event"
      subtitle="Submit fund requisition proposal to Main Ministry treasury or Parish"
      badge="Treasury Requisition"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="p-4 mb-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-2xs">
          {fundSource === 'parish' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          )}
        </div>
        <div>
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">
            {fundSource === 'parish' ? 'Parish Requisition Workflow' : 'Main Ministry Treasury Workflow'}
          </h4>
          <p className="text-xs text-indigo-700/90 font-medium mt-0.5">
            {fundSource === 'parish' 
              ? "This request is submitted to the Parish Priest / Parish Office. Once approved and released, it will automatically be credited to this event's ledger as Parish Subsidy."
              : "This request is submitted to the Main Ministry Treasury. Once approved and released, it will automatically be credited to this event's ledger as Ministry Grant."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-bold animate-fade-in">
            {error}
          </div>
        )}

        {/* Fund Source Selector */}
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
            Request Source / Charge To *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFundSource('main_funds')}
              className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                fundSource === 'main_funds'
                  ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 text-slate-600'
              }`}
            >
              <div className={`p-2 rounded-xl ${fundSource === 'main_funds' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${fundSource === 'main_funds' ? 'text-blue-950' : 'text-slate-800'}`}>
                    Main Ministry Funds
                  </span>
                  {fundSource === 'main_funds' && (
                    <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Disbursed from MAS internal treasury
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFundSource('parish')}
              className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                fundSource === 'parish'
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 text-slate-600'
              }`}
            >
              <div className={`p-2 rounded-xl ${fundSource === 'parish' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${fundSource === 'parish' ? 'text-emerald-950' : 'text-slate-800'}`}>
                    Parish Funds
                  </span>
                  {fundSource === 'parish' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Requested from Parish Priest / Office
                </p>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Request Title *</label>
          <input
            type="text"
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder="e.g. Seed Budget for Event"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Requested Amount (₱) *</label>
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
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Date Needed *</label>
            <input
              type="date"
              required
              value={dateNeeded}
              onChange={(e) => setDateNeeded(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Purpose *</label>
          <input
            type="text"
            required
            maxLength={150}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder="e.g. Venue Downpayment, Supplies"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Additional Notes / Description</label>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder="Provide any breakdown or details for the finance team..."
          />
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Submit Request to Main Funds'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
