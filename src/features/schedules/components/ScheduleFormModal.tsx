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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">
            {schedule ? 'Edit Service Schedule' : 'Create New Schedule'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1" noValidate>
          {errors.submit && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
              {errors.submit}
            </div>
          )}

          {/* Service Title */}
          <div>
            <label htmlFor="schedule-title" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Service Title *
            </label>
            <input
              id="schedule-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              placeholder="e.g. Sunday Morning Worship"
              disabled={loading}
            />
            {errors.title && <p className="mt-1 text-xs text-red-600 font-medium">{errors.title}</p>}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="schedule-date" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Service Date *
            </label>
            <input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              disabled={loading}
            />
            {errors.date && <p className="mt-1 text-xs text-red-600 font-medium">{errors.date}</p>}
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="schedule-start" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Start Time *
            </label>
            <input
              id="schedule-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              disabled={loading}
            />
            {errors.startTime && <p className="mt-1 text-xs text-red-600 font-medium">{errors.startTime}</p>}
          </div>

          {/* Cancellation Toggle */}
          <div className="flex items-center space-x-3 pt-2">
            <input
              id="schedule-cancel"
              type="checkbox"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
              disabled={loading}
            />
            <label htmlFor="schedule-cancel" className="text-xs font-semibold uppercase tracking-wider text-gray-500 select-none cursor-pointer">
              Mark Service as Cancelled
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 cursor-pointer shadow-sm animate-none"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
