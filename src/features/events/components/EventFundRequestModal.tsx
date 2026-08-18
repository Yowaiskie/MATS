import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { fundRequestService } from '@/services/finance/fundRequestService'

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

  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')
  const [dateNeeded, setDateNeeded] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (isOpen) {
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
      setError(err.message || 'Failed to submit fund request to Main Finance.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Funds from Main Ministry" maxWidth="md">
      <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded-r-xl">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-lg">🏛️</span>
          </div>
          <div className="ml-3">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Main Finance Approval Workflow</h4>
            <p className="text-xs text-indigo-700 mt-0.5">
              This request will be submitted to the Main Finance / Treasury team. Once approved and released, the funds will <strong>automatically be credited to this event's ledger as Event Income</strong>.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-xs font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Request Title *</label>
          <input
            type="text"
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
            placeholder="e.g. Seed Budget for Event"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Requested Amount (₱) *</label>
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
              className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date Needed *</label>
            <input
              type="date"
              required
              value={dateNeeded}
              onChange={(e) => setDateNeeded(e.target.value)}
              className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Purpose *</label>
          <input
            type="text"
            required
            maxLength={150}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
            placeholder="e.g. Venue Downpayment, Supplies"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Additional Notes / Description</label>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-sm"
            placeholder="Provide any breakdown or details for the finance team..."
          />
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-500/30 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Submit Request to Main Funds'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
