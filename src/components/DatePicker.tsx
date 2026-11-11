import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'

export interface DatePickerProps {
  value: string // 'YYYY-MM-DD' or ''
  onChange: (dateStr: string) => void
  placeholder?: string
  minDate?: string // 'YYYY-MM-DD'
  maxDate?: string // 'YYYY-MM-DD'
  disabled?: boolean
  className?: string
  inputClassName?: string
  align?: 'left' | 'right'
  size?: 'sm' | 'md' | 'dense'
  showTodayButton?: boolean
  clearable?: boolean
  id?: string
  name?: string
  ariaLabel?: string
  error?: string
  ariaDescribedBy?: string
  portal?: boolean
  selectionMode?: 'date' | 'month'
  formatDisplay?: 'long' | 'short' | 'iso' | 'month' // 'month' = October 2026
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const parseYYYYMMDD = (str: string): { year: number; month: number; day: number } | null => {
  if (!str) return null
  const parts = str.split('-')
  if (parts.length !== 3) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return { year, month, day }
}

const formatYYYYMMDD = (year: number, month: number, day: number): string => {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const getTodayYYYYMMDD = (): string => {
  const d = new Date()
  return formatYYYYMMDD(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  minDate,
  maxDate,
  disabled = false,
  className = '',
  inputClassName = '',
  align = 'left',
  size = 'md',
  showTodayButton = true,
  clearable = false,
  id,
  name,
  ariaLabel,
  error,
  ariaDescribedBy,
  portal = false,
  selectionMode = 'date',
  formatDisplay = 'long'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const calendarId = useId()
  const errorId = `${calendarId}-error`
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  // Internal view year and month for calendar popover navigation ONLY
  // Changing viewYear/viewMonth does NOT call onChange or cause parent data reloads!
  const [viewYear, setViewYear] = useState(() => {
    const parsed = parseYYYYMMDD(value)
    return parsed ? parsed.year : new Date().getFullYear()
  })

  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseYYYYMMDD(value)
    return parsed ? parsed.month - 1 : new Date().getMonth()
  })

  useLayoutEffect(() => {
    if (!isOpen || !portal) return
    const updatePosition = () => {
      const trigger = triggerRef.current
      const calendar = calendarRef.current
      if (!trigger || !calendar) return
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportWidth = viewport?.width ?? window.innerWidth
      const viewportHeight = viewport?.height ?? window.innerHeight
      const margin = 8
      const gap = 6
      const width = Math.max(0, Math.min(288, viewportWidth - margin * 2))
      const rect = trigger.getBoundingClientRect()
      const below = viewportTop + viewportHeight - rect.bottom - gap - margin
      const above = rect.top - viewportTop - gap - margin
      const opensBelow = below >= Math.min(calendar.scrollHeight, 320) || below >= above
      const maxHeight = Math.max(0, Math.min(opensBelow ? below : above, viewportHeight - margin * 2))
      const height = Math.min(calendar.scrollHeight, maxHeight)
      const left = Math.max(viewportLeft + margin, Math.min(
        align === 'right' ? rect.right - width : rect.left,
        viewportLeft + viewportWidth - width - margin
      ))
      const top = Math.max(viewportTop + margin, Math.min(
        opensBelow ? rect.bottom + gap : rect.top - gap - height,
        viewportTop + viewportHeight - height - margin
      ))
      setPopoverStyle({ position: 'fixed', left, top, width, maxHeight, overflowY: 'auto' })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.visualViewport?.addEventListener('resize', updatePosition)
    window.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [isOpen, portal, align, viewYear, viewMonth, showTodayButton, clearable, value])

  useEffect(() => {
    if (isOpen && portal && !disabled) {
      const calendar = calendarRef.current
      const selectedDay = calendar?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)')
      const firstDay = calendar?.querySelector<HTMLButtonElement>('[data-calendar-day]:not(:disabled)')
      const dayToFocus = selectedDay || firstDay
      dayToFocus?.focus({ preventScroll: true })
    }
  }, [isOpen, portal, disabled])

  // Sync internal view month/year when popover is opened or value is updated
  useEffect(() => {
    if (value) {
      const parsed = parseYYYYMMDD(value)
      if (parsed) {
        setViewYear(parsed.year)
        setViewMonth(parsed.month - 1)
      }
    }
  }, [value])

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node) && !calendarRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        if (portal) triggerRef.current?.focus()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, portal])

  useEffect(() => {
    if (disabled) setIsOpen(false)
  }, [disabled])

  // Navigation handlers (internal view changes ONLY)
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(prev => prev - 1)
    } else {
      setViewMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(prev => prev + 1)
    } else {
      setViewMonth(prev => prev + 1)
    }
  }

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewYear(prev => prev - 1)
  }

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewYear(prev => prev + 1)
  }

  const handleSelectDay = (dateStr: string) => {
    if (disabled || (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate)) return
    onChange(dateStr)
    setIsOpen(false)
    if (portal) triggerRef.current?.focus()
  }

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    const today = getTodayYYYYMMDD()
    if (disabled || (minDate && today < minDate) || (maxDate && today > maxDate)) return
    onChange(today)
    const parsed = parseYYYYMMDD(today)
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month - 1)
    }
    setIsOpen(false)
    if (portal) triggerRef.current?.focus()
  }

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    onChange('')
    setIsOpen(false)
    if (portal) triggerRef.current?.focus()
  }

  // Display text computation
  const displayText = useMemo(() => {
    if (!value) return ''
    const parsed = parseYYYYMMDD(value)
    if (!parsed) return value
    if (formatDisplay === 'iso') {
      return value
    }
    if (formatDisplay === 'month') return `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`
    if (formatDisplay === 'short') {
      return `${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}/${parsed.year}`
    }
    // 'long' default (e.g. Sep 24, 2026)
    const monthShort = MONTH_NAMES_SHORT[parsed.month - 1] || ''
    return `${monthShort} ${parsed.day}, ${parsed.year}`
  }, [value, formatDisplay])

  // Generate calendar grid cells
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const todayStr = getTodayYYYYMMDD()
    const cells: {
      dateStr: string
      dayNum: number
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      isDisabled: boolean
    }[] = []

    // Trailing days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const m = viewMonth === 0 ? 12 : viewMonth
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      const dateStr = formatYYYYMMDD(y, m, dayNum)
      const isDisabled = (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false)
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled
      })
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = formatYYYYMMDD(viewYear, viewMonth + 1, d)
      const isDisabled = (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false)
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled
      })
    }

    // Leading days from next month (fill up 35 or 42 grid slots)
    const totalSlots = cells.length > 35 ? 42 : 35
    const remaining = totalSlots - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 1 : viewMonth + 2
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      const dateStr = formatYYYYMMDD(y, m, d)
      const isDisabled = (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false)
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        isDisabled
      })
    }


    return cells
  }, [viewYear, viewMonth, value, minDate, maxDate])

  const sizeClasses = {
    sm: 'h-8 text-xs px-2.5 rounded-lg',
    dense: 'h-9 text-xs px-3 rounded-xl',
    md: 'h-10 text-xs px-3 rounded-xl'
  }[size]

  const calendar = (
    <div
      ref={calendarRef}
      id={calendarId}
      role="dialog"
      aria-label={ariaLabel || placeholder}
      style={portal ? popoverStyle : undefined}
      className={`${portal ? 'fixed z-[110]' : 'absolute top-full mt-1.5 z-50'} bg-white rounded-2xl border border-slate-200 shadow-xl p-3 w-72 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 select-none ${
        portal ? '' : align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {/* Calendar Header with Navigation Controls (Month & Year) */}
      <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handlePrevYear}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Previous Year"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            hidden={selectionMode === 'month'}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Previous Month"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="text-center font-black text-xs text-slate-800 tracking-tight">
          {selectionMode === 'date' && <span>{MONTH_NAMES[viewMonth]} </span>}
          <span className="text-slate-500 font-bold">{viewYear}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleNextMonth}
            hidden={selectionMode === 'month'}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Next Month"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNextYear}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Next Year"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {selectionMode === 'month' ? (
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES_SHORT.map((month, index) => {
            const dateStr = formatYYYYMMDD(viewYear, index + 1, 1)
            const isSelected = value.slice(0, 7) === dateStr.slice(0, 7)
            const isDisabled = (minDate && dateStr.slice(0, 7) < minDate.slice(0, 7)) || (maxDate && dateStr.slice(0, 7) > maxDate.slice(0, 7))
            return <button key={month} type="button" data-calendar-day data-calendar-month aria-label={dateStr.slice(0, 7)} aria-pressed={isSelected}
              disabled={disabled || Boolean(isDisabled)} onClick={() => handleSelectDay(dateStr)}
              className={`h-9 rounded-xl text-xs font-bold transition cursor-pointer ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed`}>{month}</button>
          })}
        </div>
      ) : <>
      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
          <span key={idx} className="text-[10px] font-extrabold text-slate-400 uppercase">
            {w}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell) => {
          const { dateStr, dayNum, isCurrentMonth, isToday, isSelected, isDisabled } = cell
          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled || isDisabled}
              aria-label={dateStr}
              aria-pressed={isSelected}
              data-calendar-day
              onClick={() => !isDisabled && handleSelectDay(dateStr)}
              className={`h-7 w-7 mx-auto rounded-xl flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-blue-600 text-white font-black shadow-sm ring-2 ring-blue-600/30'
                  : isToday
                  ? 'border border-blue-400 bg-blue-50/70 text-blue-700 font-extrabold'
                  : isCurrentMonth
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-50 hover:text-slate-400'
              } ${isDisabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
      </>}

      {/* Bottom Toolbar (Today & Clear Buttons) */}
      {(showTodayButton || clearable) && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-bold">
          {showTodayButton ? (
            <button
              type="button"
              onClick={handleSelectToday}
              disabled={disabled || Boolean((minDate && getTodayYYYYMMDD() < minDate) || (maxDate && getTodayYYYYMMDD() > maxDate))}
              className="px-2.5 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Today
            </button>
          ) : <div />}

          {clearable && value && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input button trigger */}
      <button
        type="button"
        id={id}
        name={name}
        ref={triggerRef}
        aria-expanded={isOpen && !disabled}
        aria-controls={isOpen ? calendarId : undefined}
        aria-haspopup="dialog"
        aria-invalid={Boolean(error)}
        aria-describedby={[ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 border bg-white transition cursor-pointer select-none shadow-2xs font-medium text-left ${sizeClasses} ${
          error
            ? 'border-rose-500 ring-rose-500/20 text-slate-900'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 text-blue-950 font-bold'
            : value
            ? 'border-slate-200 hover:border-slate-300 text-slate-900 font-bold'
            : 'border-slate-200 hover:border-slate-300 text-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''} ${inputClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          <svg className={`w-4 h-4 shrink-0 transition-colors ${isOpen || value ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="truncate">
            {displayText || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e)
                }
              }}
              className="p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear date"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Popover Calendar Grid */}
      {isOpen && !disabled && (portal ? createPortal(calendar, document.body) : calendar)}
      {error && <p id={errorId} className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}
