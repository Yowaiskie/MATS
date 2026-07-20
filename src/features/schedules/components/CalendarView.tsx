import React, { useState } from 'react'
import type { Schedule, ScheduleStatus } from '@/types/schedule'
import type { ScheduleAttendanceState } from '@/types/attendance'
import { getScheduleStatus } from '@/utils/scheduleUtils'

interface CalendarViewProps {
  schedules: Schedule[]
  onSelectSchedule: (schedule: Schedule) => void
  onDateClick?: (dateStr: string) => void
  getAttendanceState?: (scheduleId: string, status: string) => ScheduleAttendanceState
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  schedules,
  onSelectSchedule,
  onDateClick,
  getAttendanceState,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  const toggleExpand = (e: React.MouseEvent, dateStr: string) => {
    e.stopPropagation()
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }))
  }

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Month information
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const firstDayOfMonth = new Date(year, month, 1)
  const startWeekday = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDaysInMonth = new Date(year, month, 0).getDate()

  // Generate calendar days grid
  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = []

  // Prev Month prefix days
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevDaysInMonth - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ dateStr, dayNum: day, isCurrentMonth: false, isToday: false })
  }

  // Current Month days
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const isToday = dateStr === todayStr
    cells.push({ dateStr, dayNum: i, isCurrentMonth: true, isToday })
  }

  // Next Month suffix days
  const totalCells = cells.length > 35 ? 42 : 35
  const remaining = totalCells - cells.length
  for (let i = 1; i <= remaining; i++) {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    cells.push({ dateStr, dayNum: i, isCurrentMonth: false, isToday: false })
  }

  // Group schedules by date string
  const schedulesByDate = (schedules || []).reduce<{ [dateStr: string]: Schedule[] }>((acc, s) => {
    if (!acc[s.date]) {
      acc[s.date] = []
    }
    acc[s.date].push(s)
    return acc
  }, {})

  // Sort schedules chronologically by startTime
  Object.keys(schedulesByDate).forEach((dateKey) => {
    schedulesByDate[dateKey].sort((a, b) => a.startTime.localeCompare(b.startTime))
  })

  // Status color codes helper
  const getStatusColor = (status: ScheduleStatus) => {
    if (status === 'upcoming') return 'bg-green-500'
    if (status === 'ongoing') return 'bg-blue-500'
    if (status === 'completed') return 'bg-gray-400'
    if (status === 'cancelled') return 'bg-red-500'
    return 'bg-gray-400'
  }

  // Format 12-hour time format helper
  const formatTime12 = (timeStr: string) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let h = parseInt(parts[0], 10)
    const m = parts[1].padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12
    return `${h}:${m} ${ampm}`
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
      
      {/* Calendar Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900 tracking-wide">
          {monthNames[month]} {year}
        </h2>
        
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 p-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer shadow-xs"
            aria-label="Previous Month"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
          >
            Today
          </button>
          
          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 p-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer shadow-xs"
            aria-label="Next Month"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Weekday Names Header */}
      <div className="grid grid-cols-7 text-center border-b border-gray-100 pb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {d}
          </span>
        ))}
      </div>

      {/* Calendar Monthly Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200/80 rounded-xl overflow-hidden shadow-xs">
        {cells.map((cell, idx) => {
          const daySchedules = schedulesByDate[cell.dateStr] || []
          const isExpanded = expandedDates[cell.dateStr]
          const displayLimit = isExpanded ? daySchedules.length : 3
          const displayedSchedules = daySchedules.slice(0, displayLimit)
          const hasOverflow = daySchedules.length > 3

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              onClick={() => onDateClick?.(cell.dateStr)}
              className={`min-h-[100px] sm:min-h-[120px] bg-white p-1 flex flex-col justify-between cursor-pointer hover:bg-gray-50/80 transition-colors ${
                cell.isCurrentMonth ? '' : 'bg-gray-50/50 opacity-60 text-gray-400 hover:bg-gray-100/50'
              }`}
            >
              {/* Day Number Row */}
              <div className="flex items-center justify-between p-1">
                <span 
                  className={`text-xs font-bold leading-none ${
                    cell.isToday
                      ? 'h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-sm'
                      : cell.isCurrentMonth
                        ? 'text-gray-800'
                        : 'text-gray-400'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {daySchedules.length > 0 && (
                  <span className="text-[10px] text-gray-400 font-bold font-mono">
                    {daySchedules.length}
                  </span>
                )}
              </div>

              {/* Day Schedules List */}
              <div className="flex-1 mt-1 space-y-1 overflow-hidden flex flex-col justify-start">
                {displayedSchedules.map((s) => {
                  const status = getScheduleStatus(s)
                  const dotColor = getStatusColor(status)
                  const attendanceState = getAttendanceState?.(s.id, status) ?? 'none'

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectSchedule(s)
                      }}
                      className={`w-full text-left border rounded-lg px-2 py-1 flex items-center space-x-1.5 focus:outline-none transition-colors cursor-pointer select-none overflow-hidden ${
                        attendanceState === 'finalized'
                          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70 text-emerald-700 font-semibold shadow-2xs'
                          : attendanceState === 'in_progress'
                            ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/70 text-amber-700 font-semibold shadow-2xs'
                            : attendanceState === 'untaken'
                              ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 text-slate-700 font-semibold shadow-2xs'
                              : 'bg-gray-50 hover:bg-gray-100/60 border-gray-200 text-gray-700'
                      }`}
                      title={`${s.title} (${formatTime12(s.startTime)})`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <span className={`text-[10px] font-bold truncate block leading-tight ${
                        attendanceState === 'finalized' 
                          ? 'text-emerald-700' 
                          : attendanceState === 'in_progress'
                            ? 'text-amber-700'
                            : attendanceState === 'untaken'
                              ? 'text-slate-600'
                              : 'text-gray-700'
                      }`}>
                        {formatTime12(s.startTime)}
                      </span>
                    </button>
                  )
                })}
                
                {hasOverflow && (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(e, cell.dateStr)}
                    className="text-[9px] text-blue-600 font-bold px-1.5 py-0.5 mt-0.5 leading-none text-left hover:underline cursor-pointer"
                  >
                    {isExpanded ? 'Show less' : `+${daySchedules.length - 3} more`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
