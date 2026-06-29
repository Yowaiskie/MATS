import React, { useState, useEffect } from 'react'
import type { Schedule, ScheduleInput, ScheduleStatus } from '@/types/schedule'

interface ScheduleFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: ScheduleInput) => Promise<void>
  schedule?: Schedule | null
}

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  schedule,
}) => {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isCancelled, setIsCancelled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setDate(schedule.date)
      setStartTime(schedule.startTime)
      setEndTime(schedule.endTime)
      setIsCancelled(schedule.status === 'cancelled')
    } else {
      setTitle('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setIsCancelled(false)
    }
    setErrors({})
  }, [schedule, isOpen])

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
    
    if (!endTime) {
      newErrors.endTime = 'End Time is required.'
    }
    
    if (startTime && endTime && startTime >= endTime) {
      newErrors.timeSpan = 'Start Time must be before End Time.'
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
      await onSubmit({
        title: title.trim(),
        date,
        startTime,
        endTime,
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
      <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white">
        <div className="flex items-center justify-between pb-4 border-b border-gray-850">
          <h3 className="text-base font-bold text-white">
            {schedule ? 'Edit Service Schedule' : 'Create New Schedule'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          {errors.submit && (
            <div className="rounded border border-red-900 bg-red-950/40 p-3 text-xs text-red-400">
              {errors.submit}
            </div>
          )}

          {/* Service Title */}
          <div>
            <label htmlFor="schedule-title" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Service Title *
            </label>
            <input
              id="schedule-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="e.g. Sunday Morning Worship"
              disabled={loading}
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="schedule-date" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Service Date *
            </label>
            <input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              disabled={loading}
            />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
          </div>

          {/* Start Time & End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="schedule-start" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Start Time *
              </label>
              <input
                id="schedule-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                disabled={loading}
              />
              {errors.startTime && <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>}
            </div>

            <div>
              <label htmlFor="schedule-end" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                End Time *
              </label>
              <input
                id="schedule-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                disabled={loading}
              />
              {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>}
            </div>
          </div>
          {errors.timeSpan && <p className="text-xs text-red-500 mt-1">{errors.timeSpan}</p>}

          {/* Cancellation Toggle */}
          <div className="flex items-center space-x-3 pt-2">
            <input
              id="schedule-cancel"
              type="checkbox"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-800 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
              disabled={loading}
            />
            <label htmlFor="schedule-cancel" className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              Mark Service as Cancelled
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-850">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-850 bg-transparent px-4 py-2 text-xs font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-indigo-600 px-4 py-2 text-xs font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
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
