import React, { useState, useEffect } from 'react'
import type { CalendarEvent, CalendarEventInput } from '@/types/calendarEvent'

interface CalendarEventModalProps {
  isOpen: boolean
  defaultDate: string // YYYY-MM-DD
  editingEvent: CalendarEvent | null
  isSaving: boolean
  isDeleting: boolean
  onClose: () => void
  onSave: (input: CalendarEventInput, editingId?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  defaultDate,
  editingEvent,
  isSaving,
  isDeleting,
  onClose,
  onSave,
  onDelete
}) => {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setConfirmDelete(false)
    if (editingEvent) {
      setTitle(editingEvent.title || '')
      setStartDate(editingEvent.startDate || defaultDate)
      setEndDate(editingEvent.endDate || '')
      setStartTime(editingEvent.startTime || '')
      setEndTime(editingEvent.endTime || '')
      setLocation(editingEvent.location || '')
      setNotes(editingEvent.notes || '')
    } else {
      setTitle('')
      setStartDate(defaultDate)
      setEndDate('')
      setStartTime('')
      setEndTime('')
      setLocation('')
      setNotes('')
    }
  }, [isOpen, editingEvent, defaultDate])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Please enter an event title.')
      return
    }
    if (!startDate) {
      setError('Please choose a start date.')
      return
    }
    if (endDate && endDate < startDate) {
      setError('End date cannot be earlier than start date.')
      return
    }

    setError(null)
    try {
      await onSave(
        {
          title: cleanTitle,
          startDate,
          endDate: endDate || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined
        },
        editingEvent?.id
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar event.')
    }
  }

  const handleDelete = async () => {
    if (!editingEvent || !onDelete) return
    setError(null)
    try {
      await onDelete(editingEvent.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete calendar event.')
    }
  }

  const busy = isSaving || isDeleting

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 id="calendar-event-modal-title" className="text-base font-extrabold text-slate-900">
              {editingEvent ? 'Edit Calendar Event' : 'Add Calendar Event'}
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Shown on Dashboard Calendar only (does not create an Events workspace)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="cal-ev-title" className="block text-xs font-bold text-slate-700 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="cal-ev-title"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Monthly Officers Meeting"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cal-ev-start-date" className="block text-xs font-bold text-slate-700 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="cal-ev-start-date"
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="cal-ev-end-date" className="block text-xs font-bold text-slate-700 mb-1">
                End Date <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="cal-ev-end-date"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cal-ev-start-time" className="block text-xs font-bold text-slate-700 mb-1">
                Start Time <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="cal-ev-start-time"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="cal-ev-end-time" className="block text-xs font-bold text-slate-700 mb-1">
                End Time <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="cal-ev-end-time"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cal-ev-location" className="block text-xs font-bold text-slate-700 mb-1">
              Location <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="cal-ev-location"
              type="text"
              maxLength={200}
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g., Parish Hall / Sacristy"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="cal-ev-notes" className="block text-xs font-bold text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="cal-ev-notes"
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reminders, attire, or short details..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            {editingEvent && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Delete
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSaving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
