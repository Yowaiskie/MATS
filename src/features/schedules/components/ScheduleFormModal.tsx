import React, { useState, useEffect } from 'react'
import type { Schedule, ScheduleInput, ScheduleStatus } from '@/types/schedule'

interface ScheduleFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: ScheduleInput) => Promise<void>
  schedule?: Schedule | null
  defaultDate?: string
}

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  schedule,
  defaultDate,
}) => {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [isCancelled, setIsCancelled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setDate(schedule.date)
      setStartTime(schedule.startTime)
      setIsCancelled(schedule.status === 'cancelled')
    } else {
      setTitle('')
      setDate(defaultDate || '')
      setStartTime('')
      setIsCancelled(false)
    }
    setErrors({})
  }, [schedule, isOpen, defaultDate])

  if (!isOpen) return null

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {}
    
    if (!title.trim() || title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters long.'
    }
    if (title.trim().length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters.'
    }
    
    if (!date) {
      newErrors.date = 'Date is required.'
    }
    
    if (!startTime) {
      newErrors.startTime = 'Start Time is required.'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const status: ScheduleStatus = isCancelled ? 'cancelled' : 'upcoming'
      
      // Auto-calculate end time as start time + 1 hour
      const calculatedEndTime = (() => {
        if (!startTime) return ''
        const parts = startTime.split(':')
        if (parts.length < 2) return startTime
        let h = parseInt(parts[0], 10)
        let m = parseInt(parts[1], 10)
        h = (h + 1) % 24
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      })()

      await onSubmit({
        title: title.trim(),
        date,
        startTime,
        endTime: calculatedEndTime,
        status
      })
      onClose()
    } catch (err: any) {
      console.error(err)
      setErrors({ submit: err.message || 'Failed to save schedule. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glassmorphic Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity animate-in fade-in duration-200" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {schedule ? 'Edit Service Schedule' : 'Create New Schedule'}
              </h3>
              <p className="text-xs font-semibold text-slate-400">Fill in the details for the mass service</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1" noValidate>
          {errors.submit && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 font-bold">
              {errors.submit}
            </div>
          )}

          {/* Service Title */}
          <div>
            <label htmlFor="schedule-title" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Service Title *
            </label>
            <input
              id="schedule-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all outline-none"
              placeholder="e.g. Sunday Morning High Mass"
              disabled={loading}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-600 font-bold">{errors.title}</p>}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="schedule-date" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Service Date *
            </label>
            <input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all outline-none"
              disabled={loading}
            />
            {errors.date && <p className="mt-1 text-xs text-rose-600 font-bold">{errors.date}</p>}
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="schedule-start" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Start Time *
            </label>
            <input
              id="schedule-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all outline-none"
              disabled={loading}
            />
            {errors.startTime && <p className="mt-1 text-xs text-rose-600 font-bold">{errors.startTime}</p>}
          </div>

          {/* Cancellation Toggle */}
          <div className="flex items-center space-x-3 pt-2">
            <input
              id="schedule-cancel"
              type="checkbox"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              disabled={loading}
            />
            <label htmlFor="schedule-cancel" className="text-xs font-extrabold uppercase tracking-wider text-slate-500 select-none cursor-pointer">
              Mark Service as Cancelled
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-extrabold text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
