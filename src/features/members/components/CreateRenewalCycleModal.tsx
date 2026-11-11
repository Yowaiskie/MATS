import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { DatePicker } from '@/components/DatePicker'
import type { RenewalCycleInput } from '@/types/renewal'

interface CreateRenewalCycleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: RenewalCycleInput) => Promise<void>
}

export const CreateRenewalCycleModal: React.FC<CreateRenewalCycleModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const currentYear = new Date().getFullYear()
  const [name, setName] = useState(`Annual Renewal Cycle ${currentYear}–${currentYear + 1}`)
  const [year, setYear] = useState(`${currentYear}–${currentYear + 1}`)
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`)
  const [endDate, setEndDate] = useState(`${currentYear + 1}-01-01`)
  const [description, setDescription] = useState('')
  const [isCurrent, setIsCurrent] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a cycle name.')
      return
    }
    if (!year.trim()) {
      setError('Please provide an annual year label (e.g. 2026–2027).')
      return
    }
    if (!startDate || !endDate) {
      setError('Please specify both start and end dates.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        year: year.trim(),
        startDate,
        endDate,
        description: description.trim(),
        isCurrent
      })
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to create renewal cycle.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Annual Renewal Cycle"
      subtitle="Establish a new independent membership cycle for annual renewals."
      badge="Renewal Cycle"
      maxWidth="lg"
      icon={
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Cycle Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Annual Renewal Cycle 2026–2027"
            required
            className="w-full text-xs px-3 h-10 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-600 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Year Label *</label>
          <input
            type="text"
            value={year}
            onChange={e => setYear(e.target.value)}
            placeholder="e.g. 2026–2027 or 2026"
            required
            className="w-full text-xs px-3 h-10 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-600 font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Start Date *</label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Start Date"
              size="dense"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">End Date *</label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="End Date"
              size="dense"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes (Optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Specific guidelines or remarks for this annual renewal..."
            className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-600 font-medium resize-none"
          />
        </div>

        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-blue-900">Set as Current Active Cycle</div>
            <p className="text-[11px] text-blue-700">
              Makes this cycle the default roster view for all officers.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={e => setIsCurrent(e.target.checked)}
            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
          />
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>Empty Roster Initialization</span>
          </div>
          <p>
            This renewal cycle will initialize with an empty roster. You can immediately select and enroll active members from the permanent directory.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="dense"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="dense"
            loading={loading}
            loadingText="Creating Cycle..."
          >
            Create Renewal Cycle
          </Button>
        </div>
      </form>
    </Modal>
  )
}
