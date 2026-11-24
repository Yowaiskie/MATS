import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/authentication/AuthContext'
import { dashboardService } from '@/services/dashboardService'
import { scheduleService } from '@/services/scheduleService'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import {
  buildMonthGrid,
  expandEventToCalendarItems,
  getMonthDateRange,
  groupCalendarItemsByDate,
  mapMassScheduleToCalendarItem,
  mapTaskToCalendarItem,
  resolveUserMemberIds,
  type DashboardCalendarItem,
  type DashboardCalendarItemType
} from '@/utils/dashboardCalendar'

interface DashboardCalendarCardProps {
  monthSchedules: Schedule[]
  members: Member[]
  parishToday: string // YYYY-MM-DD
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type FilterKey = 'all' | DashboardCalendarItemType

export const DashboardCalendarCard: React.FC<DashboardCalendarCardProps> = ({
  monthSchedules,
  members,
  parishToday
}) => {
  const { profile, canAction } = useAuth()
  const canManageEvents = Boolean(canAction('canManageEvents'))
  const canOpenAttendance = Boolean(
    canAction('canTakeAttendance') ||
    canAction('canFinalizeAttendance') ||
    profile?.role === 'admin' ||
    profile?.role === 'coordinator' ||
    profile?.role === 'order_leader'
  )

  const [todayYear, todayMonth] = useMemo(() => {
    const parts = parishToday.split('-').map(Number)
    return [parts[0] || new Date().getFullYear(), parts[1] || (new Date().getMonth() + 1)]
  }, [parishToday])

  const [viewYear, setViewYear] = useState<number>(todayYear)
  const [viewMonth, setViewMonth] = useState<number>(todayMonth)
  const [selectedDate, setSelectedDate] = useState<string>(parishToday)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  const isViewingCurrentMonth = viewYear === todayYear && viewMonth === todayMonth
  const { startDate: monthStart, endDate: monthEnd } = useMemo(
    () => getMonthDateRange(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  // Fetch events, team assignments, and assigned event tasks (cached 5 min, zero onSnapshot)
  const { data: calendarSource, isLoading: loadingCalendarSource } = useQuery({
    queryKey: ['dashboard-calendar-source', profile?.uid, profile?.memberId, canManageEvents],
    queryFn: () =>
      dashboardService.getMyDashboardCalendarSourceData({
        uid: profile?.uid || '',
        displayName: profile?.displayName || '',
        email: profile?.email || '',
        memberId: profile?.memberId,
        canManageEvents
      }),
    enabled: Boolean(profile?.uid),
    staleTime: 1000 * 60 * 5
  })

  // Only fetch schedules for another month when navigating away from the already-loaded current month
  const { data: extraMonthSchedules } = useQuery({
    queryKey: ['dashboard-calendar-schedules', monthStart, monthEnd],
    queryFn: () => scheduleService.getSchedulesByDateRange(monthStart, monthEnd),
    enabled: !isViewingCurrentMonth && Boolean(profile?.uid),
    staleTime: 1000 * 60 * 5
  })

  const userMemberIds = useMemo(
    () => resolveUserMemberIds(profile, members),
    [profile, members]
  )

  const allItems = useMemo<DashboardCalendarItem[]>(() => {
    const items: DashboardCalendarItem[] = []
    const uid = profile?.uid || ''

    if (calendarSource) {
      const myEventSet = new Set(calendarSource.myEventIds)

      for (const ev of calendarSource.events) {
        const isTeamOrLeader =
          canManageEvents ||
          ev.createdByUid === uid ||
          ev.headUid === uid ||
          myEventSet.has(ev.id)
        const isSharedByAdmin = Boolean(ev.showOnDashboardCalendar)

        items.push(
          ...expandEventToCalendarItems(ev, {
            canOpenWorkspace: isTeamOrLeader,
            isSharedByAdmin
          })
        )
      }

      for (const task of calendarSource.tasks) {
        const mapped = mapTaskToCalendarItem(task, calendarSource.eventTitles[task.eventId])
        if (mapped) items.push(mapped)
      }
    }

    // Merge current monthSchedules and any extra fetched month schedules without duplicates
    const scheduleMap = new Map<string, Schedule>()
    monthSchedules.forEach(s => scheduleMap.set(s.id, s))
    if (extraMonthSchedules) {
      extraMonthSchedules.forEach(s => scheduleMap.set(s.id, s))
    }

    if (userMemberIds.size > 0) {
      scheduleMap.forEach(schedule => {
        const assigned = schedule.assignedMembers || []
        const isAssignedToMe = assigned.some(id => userMemberIds.has(id))
        if (!isAssignedToMe) return
        const mapped = mapMassScheduleToCalendarItem(schedule, canOpenAttendance)
        if (mapped) items.push(mapped)
      })
    }

    return items
  }, [
    calendarSource,
    canManageEvents,
    canOpenAttendance,
    extraMonthSchedules,
    monthSchedules,
    profile?.uid,
    userMemberIds
  ])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allItems
    return allItems.filter(item => item.type === activeFilter)
  }, [allItems, activeFilter])

  const itemsByDate = useMemo(
    () => groupCalendarItemsByDate(filteredItems),
    [filteredItems]
  )

  // Counts for the currently displayed month
  const monthCounts = useMemo(() => {
    const counts = { all: 0, event: 0, task: 0, mass: 0 }
    for (const item of allItems) {
      if (item.date >= monthStart && item.date <= monthEnd) {
        counts.all += 1
        counts[item.type] += 1
      }
    }
    return counts
  }, [allItems, monthStart, monthEnd])

  const gridCells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  const selectedDayItems = itemsByDate[selectedDate] || []

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(y => y - 1)
      setViewMonth(12)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(y => y + 1)
      setViewMonth(1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const handleJumpToday = () => {
    setViewYear(todayYear)
    setViewMonth(todayMonth)
    setSelectedDate(parishToday)
  }

  const formatSelectedDateLabel = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
  }

  const filterPills: { key: FilterKey; label: string; count: number; dotClass: string }[] = [
    { key: 'all', label: 'All', count: monthCounts.all, dotClass: 'bg-slate-500' },
    { key: 'event', label: 'Events', count: monthCounts.event, dotClass: 'bg-indigo-500' },
    { key: 'task', label: 'My Tasks', count: monthCounts.task, dotClass: 'bg-amber-500' },
    { key: 'mass', label: 'Mass Duties', count: monthCounts.mass, dotClass: 'bg-emerald-500' }
  ]

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">My Ministry Calendar</h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Your team events, admin-shared events, assigned tasks, and mass duties
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterPills.map(pill => {
            const isActive = activeFilter === pill.key
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setActiveFilter(pill.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : pill.dotClass}`} />
                <span>{pill.label}</span>
                <span className={`text-[10px] font-extrabold ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  {pill.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2-Column Split: Monthly Grid (Left) + Selected Day Agenda (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Monthly Calendar Grid */}
        <div className="lg:col-span-7 space-y-3">
          {/* Month Navigation */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </h4>
              {loadingCalendarSource && (
                <span className="text-[10px] font-semibold text-slate-400">Syncing...</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-2.5 py-1.5 min-h-[36px] rounded-xl text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-2 min-h-[36px] min-w-[36px] rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-2 min-h-[36px] min-w-[36px] rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map(dayName => (
              <div key={dayName} className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 py-1">
                {dayName}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map(cell => {
              const dayItems = itemsByDate[cell.dateStr] || []
              const hasEvent = dayItems.some(i => i.type === 'event')
              const hasTask = dayItems.some(i => i.type === 'task')
              const hasMass = dayItems.some(i => i.type === 'mass')
              const isToday = cell.dateStr === parishToday
              const isSelected = cell.dateStr === selectedDate

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`min-h-[46px] sm:min-h-[52px] rounded-xl p-1.5 flex flex-col items-center justify-between transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25'
                      : isToday
                        ? 'bg-indigo-50/70 text-indigo-900 border-indigo-300 font-black'
                        : cell.isCurrentMonth
                          ? 'bg-slate-50/50 hover:bg-slate-100/80 text-slate-800 border-slate-100'
                          : 'bg-white text-slate-300 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-xs font-bold leading-none ${isSelected ? 'text-white' : ''}`}>
                    {cell.day}
                  </span>
                  <div className="flex items-center justify-center gap-1 h-2">
                    {hasEvent && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                    )}
                    {hasTask && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-500'}`} />
                    )}
                    {hasMass && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-emerald-200' : 'bg-emerald-500'}`} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap pt-1 text-[10px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Event
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Assigned Task
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Mass Duty
            </span>
          </div>
        </div>

        {/* Right: Selected Day Agenda */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
            <div className="min-w-0">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Selected Day Agenda
              </span>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate mt-0.5">
                {formatSelectedDateLabel(selectedDate)}
              </h4>
            </div>
            <span className="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200/80">
              {selectedDayItems.length} {selectedDayItems.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="pt-3 space-y-2.5 flex-1 max-h-[340px] overflow-y-auto pr-1">
            {selectedDayItems.length > 0 ? (
              selectedDayItems.map(item => {
                const styleMap: Record<DashboardCalendarItemType, {
                  badgeBg: string
                  border: string
                  label: string
                }> = {
                  event: {
                    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                    border: 'border-l-indigo-500',
                    label: 'Event'
                  },
                  task: {
                    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
                    border: 'border-l-amber-500',
                    label: 'Task'
                  },
                  mass: {
                    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    border: 'border-l-emerald-500',
                    label: 'Mass Duty'
                  }
                }
                const style = styleMap[item.type]

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl bg-white border border-slate-200/80 border-l-4 ${style.border} p-3 space-y-1.5 shadow-2xs`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${style.badgeBg}`}>
                          {style.label}
                        </span>
                        {item.isSharedByAdmin && !item.canOpenLink && (
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            Shared by Admin
                          </span>
                        )}
                      </div>
                      {item.status && (
                        <span className="text-[10px] font-bold text-slate-500">
                          {item.status}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-extrabold text-slate-900 leading-snug">
                      {item.title}
                    </div>

                    {(item.timeRange || item.location || item.subtitle) && (
                      <div className="text-[11px] font-medium text-slate-500 space-y-0.5">
                        {item.timeRange && <div>{item.timeRange}</div>}
                        {item.location && <div className="truncate">{item.location}</div>}
                        {item.subtitle && <div className="text-slate-400">{item.subtitle}</div>}
                      </div>
                    )}

                    {item.canOpenLink && item.linkTo ? (
                      <div className="pt-1">
                        <Link
                          to={item.linkTo}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          {item.type === 'event'
                            ? 'Open Event Workspace'
                            : item.type === 'task'
                              ? 'View Task'
                              : 'Open Attendance'}
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      </div>
                    ) : item.type === 'event' ? (
                      <div className="pt-0.5 text-[10px] font-semibold text-slate-400">
                        View-only announcement (not assigned to event team)
                      </div>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <div className="py-12 text-center text-xs font-medium text-slate-400 bg-white/80 rounded-2xl border border-dashed border-slate-200">
                No scheduled events, tasks, or mass duties on this date.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
