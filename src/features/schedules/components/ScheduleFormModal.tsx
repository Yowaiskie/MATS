import { ValidatedForm } from '@/components/ValidatedForm'
import React, { useState, useEffect } from 'react'
import type { Schedule, ScheduleInput, ScheduleStatus } from '@/types/schedule'
import type { ScheduleCategoryKey } from '@/types/attendanceCategory'
import { Button } from '@/components'
import { ScheduleFormFields } from '@/features/schedules/components/ScheduleFormFields'

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
  const [category, setCategory] = useState<ScheduleCategoryKey | ''>('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [location, setLocation] = useState('')
  const [isCancelled, setIsCancelled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setCategory(schedule.category || '')
      setDate(schedule.date)
      setStartTime(schedule.startTime)
      setLocation(schedule.location || '')
      setIsCancelled(schedule.status === 'cancelled')
    } else {
      setTitle('')
      setCategory('')
      setDate(defaultDate || '')
      setStartTime('')
      setLocation('')
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
        category: category || undefined,
        date,
        startTime,
        endTime: calculatedEndTime,
        location: location.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Glassmorphic Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Service Schedule
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                {schedule ? 'Edit Service Schedule' : 'Create New Schedule'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ValidatedForm onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1" noValidate>
          {errors.submit && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 font-bold">
              {errors.submit}
            </div>
          )}

          <ScheduleFormFields
            title={title}
            category={category}
            date={date}
            startTime={startTime}
            location={location}
            isCancelled={isCancelled}
            loading={loading}
            errors={errors}
            onTitleChange={setTitle}
            onCategoryChange={setCategory}
            onDateChange={setDate}
            onStartTimeChange={setStartTime}
            onLocationChange={setLocation}
            onCancelledChange={setIsCancelled}
          />

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 bg-white">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              className="w-full sm:w-auto"
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
              loadingText="Saving..."
              className="w-full sm:w-auto !bg-indigo-600 hover:!bg-indigo-700 !shadow-indigo-500/20"
            >
              Save Schedule
            </Button>
          </div>
        </ValidatedForm>
      </div>
    </div>
  )
}
