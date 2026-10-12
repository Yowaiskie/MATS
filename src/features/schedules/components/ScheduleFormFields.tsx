import { FormInput } from '@/components/FormInput'
import type { ScheduleCategoryKey } from '@/types/attendanceCategory'
import { SCHEDULE_CATEGORIES } from '@/types/attendanceCategory'
import { CustomSelect } from '@/components'

interface ScheduleFormFieldsProps {
  title: string
  category: ScheduleCategoryKey | ''
  date: string
  startTime: string
  location: string
  isCancelled: boolean
  loading: boolean
  errors: Readonly<Record<string, string>>
  onTitleChange: (value: string) => void
  onCategoryChange: (value: ScheduleCategoryKey | '') => void
  onDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onLocationChange: (value: string) => void
  onCancelledChange: (value: boolean) => void
}

export const ScheduleFormFields = ({
  title,
  category,
  date,
  startTime,
  location,
  isCancelled,
  loading,
  errors,
  onTitleChange,
  onCategoryChange,
  onDateChange,
  onStartTimeChange,
  onLocationChange,
  onCancelledChange,
}: ScheduleFormFieldsProps) => {
  const categoryOptions = [
    { value: '', label: 'Auto-Detect from Title / Date (Default)' },
    ...SCHEDULE_CATEGORIES.map(cat => ({ value: cat.key, label: cat.label })),
  ]

  return (
    <>
      {/* Service Title */}
      <div>
        <label htmlFor="schedule-title" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Service Title *
        </label>
        <input
          id="schedule-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all outline-none"
          placeholder="e.g. Monthly Meeting & OGF / Sunday Morning Mass"
          disabled={loading}
        />
        {errors.title && <p className="mt-1 text-xs text-rose-600 font-bold">{errors.title}</p>}
      </div>

      {/* Category Tag */}
      <CustomSelect
        id="schedule-category"
        label="Attendance Category (Optional / Auto-detected)"
        helperText="Used for OGF & Meeting evaluation"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as ScheduleCategoryKey | '')}
        options={categoryOptions}
        disabled={loading}
      />

      {/* Date */}
      <div>
        <label htmlFor="schedule-date" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Service Date *
        </label>
        <FormInput
          id="schedule-date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
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
        <FormInput
          id="schedule-start"
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all outline-none"
          disabled={loading}
        />
        {errors.startTime && <p className="mt-1 text-xs text-rose-600 font-bold">{errors.startTime}</p>}
      </div>

      {/* Street / Location / Venue */}
      <div>
        <label htmlFor="schedule-location" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Street / Location / Venue (Optional)
        </label>
        <input
          id="schedule-location"
          type="text"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all outline-none"
          placeholder="e.g. Mabini St., Block 3 Chapel, Purok 2"
          disabled={loading}
        />
      </div>

      {/* Cancellation Toggle */}
      <div className="flex items-center space-x-3 pt-2">
        <input
          id="schedule-cancel"
          type="checkbox"
          checked={isCancelled}
          onChange={(e) => onCancelledChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          disabled={loading}
        />
        <label htmlFor="schedule-cancel" className="text-xs font-extrabold uppercase tracking-wider text-slate-500 select-none cursor-pointer">
          Mark Service as Cancelled
        </label>
      </div>
    </>
  )
}
