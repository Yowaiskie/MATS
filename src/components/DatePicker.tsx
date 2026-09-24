import React, { useState, useEffect, useRef, useMemo } from 'react'

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
  formatDisplay?: 'long' | 'short' | 'iso' // 'long' = Sep 24, 2026; 'short' = 09/24/2026; 'iso' = 2026-09-24
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
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
  formatDisplay = 'long'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
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
  }, [isOpen])

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
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    const today = getTodayYYYYMMDD()
    onChange(today)
    const parsed = parseYYYYMMDD(today)
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month - 1)
    }
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setIsOpen(false)
  }

  // Display text computation
  const displayText = useMemo(() => {
    if (!value) return ''
    const parsed = parseYYYYMMDD(value)
    if (!parsed) return value
    if (formatDisplay === 'iso') {
      return value
    }
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

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input button trigger */}
      <button
        type="button"
        id={id}
        name={name}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 border bg-white transition cursor-pointer select-none shadow-2xs font-medium text-left ${sizeClasses} ${
          isOpen
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
                  handleClear(e as any)
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
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 w-72 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 select-none ${
            align === 'right' ? 'right-0' : 'left-0'
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
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Previous Month"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <div className="text-center font-black text-xs text-slate-800 tracking-tight">
              <span>{MONTH_NAMES[viewMonth]}</span>{' '}
              <span className="text-slate-500 font-bold">{viewYear}</span>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleNextMonth}
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
                  disabled={isDisabled}
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

          {/* Bottom Toolbar (Today & Clear Buttons) */}
          {(showTodayButton || clearable) && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-bold">
              {showTodayButton ? (
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="px-2.5 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
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
      )}
    </div>
  )
}
