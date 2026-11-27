import type { CalendarEvent } from '../types/calendarEvent.ts'
import type { Event, EventTask } from '../types/event.ts'
import type { Member } from '../types/member.ts'
import type { Schedule } from '../types/schedule.ts'

export type DashboardCalendarItemType = 'event' | 'task' | 'mass'

export interface DashboardCalendarItem {
  id: string
  type: DashboardCalendarItemType
  date: string // YYYY-MM-DD
  title: string
  subtitle?: string
  timeRange?: string
  location?: string
  notes?: string
  status?: string
  priority?: string
  eventId?: string
  calendarEventId?: string
  taskId?: string
  scheduleId?: string
  isSharedByAdmin?: boolean
  isStandaloneCalendarEvent?: boolean
  canOpenLink: boolean
  linkTo?: string
}

export interface CalendarGridCell {
  dateStr: string // YYYY-MM-DD
  day: number
  isCurrentMonth: boolean
}

const MAX_EVENT_SPAN_DAYS = 60

function isValidIsoDate(value?: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export function formatTime12Hour(timeStr?: string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let h = parseInt(parts[0], 10)
  if (Number.isNaN(h)) return timeStr
  const m = parts[1].padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  h = h || 12
  return `${h}:${m} ${ampm}`
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function diffDaysIso(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const [ey, em, ed] = endIso.split('-').map(Number)
  const startUtc = Date.UTC(sy, sm - 1, sd)
  const endUtc = Date.UTC(ey, em - 1, ed)
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24))
}

/**
 * Expands an Event (single-day or multi-day) into per-date DashboardCalendarItems.
 */
export function expandEventToCalendarItems(
  event: Event,
  options: {
    canOpenWorkspace: boolean
    isSharedByAdmin: boolean
  }
): DashboardCalendarItem[] {
  if (!isValidIsoDate(event.startDate) || event.isArchived) return []

  const endIso =
    isValidIsoDate(event.endDate) && event.endDate >= event.startDate
      ? event.endDate
      : event.startDate

  const rawSpan = Math.max(0, diffDaysIso(event.startDate, endIso))
  const totalDays = Math.min(rawSpan, MAX_EVENT_SPAN_DAYS - 1) + 1

  const timeRange = event.startTime
    ? event.endTime
      ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}`
      : formatTime12Hour(event.startTime)
    : undefined

  const items: DashboardCalendarItem[] = []
  for (let offset = 0; offset < totalDays; offset++) {
    const dateStr = addDaysIso(event.startDate, offset)
    const daySuffix = totalDays > 1 ? `Day ${offset + 1} of ${totalDays}` : undefined
    items.push({
      id: `event-${event.id}-${dateStr}`,
      type: 'event',
      date: dateStr,
      title: event.title,
      subtitle: daySuffix || (event.headName ? `Head: ${event.headName}` : undefined),
      timeRange,
      location: event.location || undefined,
      status: event.stage,
      priority: event.priority,
      eventId: event.id,
      isSharedByAdmin: options.isSharedByAdmin,
      canOpenLink: options.canOpenWorkspace,
      linkTo: options.canOpenWorkspace ? `/events/${event.id}` : undefined
    })
  }
  return items
}

/**
 * Expands a standalone Dashboard Calendar Event (single-day or multi-day)
 * into per-date DashboardCalendarItems. Uses type='event' so it shares the
 * indigo Event dot & filter without requiring a full Events module workspace.
 */
export function expandStandaloneCalendarEventToItems(
  event: CalendarEvent
): DashboardCalendarItem[] {
  if (!isValidIsoDate(event.startDate) || !event.title?.trim()) return []

  const endIso =
    isValidIsoDate(event.endDate) && event.endDate >= event.startDate
      ? event.endDate
      : event.startDate

  const rawSpan = Math.max(0, diffDaysIso(event.startDate, endIso))
  const totalDays = Math.min(rawSpan, MAX_EVENT_SPAN_DAYS - 1) + 1

  const timeRange = event.startTime
    ? event.endTime
      ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}`
      : formatTime12Hour(event.startTime)
    : undefined

  const items: DashboardCalendarItem[] = []
  for (let offset = 0; offset < totalDays; offset++) {
    const dateStr = addDaysIso(event.startDate, offset)
    const daySuffix = totalDays > 1 ? `Day ${offset + 1} of ${totalDays}` : undefined
    items.push({
      id: `cal-event-${event.id}-${dateStr}`,
      type: 'event',
      date: dateStr,
      title: event.title.trim(),
      subtitle: daySuffix,
      timeRange,
      location: event.location?.trim() || undefined,
      notes: event.notes?.trim() || undefined,
      calendarEventId: event.id,
      isStandaloneCalendarEvent: true,
      canOpenLink: false
    })
  }
  return items
}

/**
 * Maps an assigned EventTask into a DashboardCalendarItem using dueDate (preferred) or startDate.
 */
export function mapTaskToCalendarItem(
  task: EventTask,
  eventTitle?: string
): DashboardCalendarItem | null {
  if (task.isArchived || task.status === 'Cancelled') return null
  const dateStr = isValidIsoDate(task.dueDate)
    ? task.dueDate
    : isValidIsoDate(task.startDate)
      ? task.startDate
      : null
  if (!dateStr) return null

  const dateLabel = isValidIsoDate(task.dueDate) ? 'Due' : 'Starts'

  return {
    id: `task-${task.id}`,
    type: 'task',
    date: dateStr,
    title: task.title,
    subtitle: eventTitle ? `${eventTitle} · ${dateLabel}` : dateLabel,
    status: task.status,
    priority: task.priority,
    eventId: task.eventId,
    taskId: task.id,
    canOpenLink: true,
    linkTo: `/events/${task.eventId}?task=${encodeURIComponent(task.id)}`
  }
}

/**
 * Maps an assigned Mass Duty Schedule into a DashboardCalendarItem.
 */
export function mapMassScheduleToCalendarItem(
  schedule: Schedule,
  canOpenAttendance: boolean
): DashboardCalendarItem | null {
  if (!isValidIsoDate(schedule.date) || schedule.status === 'cancelled') return null
  const timeRange = schedule.startTime
    ? schedule.endTime
      ? `${formatTime12Hour(schedule.startTime)} - ${formatTime12Hour(schedule.endTime)}`
      : formatTime12Hour(schedule.startTime)
    : undefined

  return {
    id: `mass-${schedule.id}`,
    type: 'mass',
    date: schedule.date,
    title: schedule.title,
    subtitle: 'Assigned Mass Duty',
    timeRange,
    location: schedule.location || undefined,
    status: schedule.status,
    scheduleId: schedule.id,
    canOpenLink: canOpenAttendance,
    linkTo: canOpenAttendance ? `/attendance?scheduleId=${encodeURIComponent(schedule.id)}` : undefined
  }
}

/**
 * Resolves all member document IDs that represent the currently logged-in user
 * so Mass Schedule assignments (`assignedMembers: string[]`) match reliably.
 */
export function resolveUserMemberIds(
  profile: { uid?: string; memberId?: string; email?: string; displayName?: string } | null | undefined,
  members: Member[]
): Set<string> {
  const ids = new Set<string>()
  if (!profile) return ids
  if (profile.memberId) ids.add(profile.memberId)
  if (profile.uid) ids.add(profile.uid)

  const normName = (profile.displayName || '').trim().toLowerCase()
  const normEmail = (profile.email || '').trim().toLowerCase()

  if (members.length > 0 && (normName || normEmail)) {
    const matched = members.filter(m => {
      const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim().toLowerCase()
      const fullWithMid = `${m.firstName || ''} ${m.middleName ? `${m.middleName[0]}. ` : ''}${m.lastName || ''}`.trim().toLowerCase()
      const memberEmail = ((m as unknown as { email?: string }).email || '').trim().toLowerCase()
      if (normEmail && memberEmail && memberEmail === normEmail) return true
      if (normName && (fullName === normName || fullWithMid === normName)) return true
      return false
    })
    if (matched.length === 1) {
      ids.add(matched[0].id)
    }
  }

  return ids
}

/**
 * Builds a Sunday-to-Saturday calendar grid for a given year and 1-based month (1-12).
 */
export function buildMonthGrid(year: number, month: number): CalendarGridCell[] {
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const totalCells = firstDayOfWeek + daysInMonth <= 35 ? 35 : 42

  const cells: CalendarGridCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstDayOfWeek
    const dt = new Date(Date.UTC(year, month - 1, 1 + dayOffset))
    const y = dt.getUTCFullYear()
    const m = dt.getUTCMonth() + 1
    const d = dt.getUTCDate()
    cells.push({
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
      isCurrentMonth: y === year && m === month
    })
  }
  return cells
}

const TYPE_SORT_ORDER: Record<DashboardCalendarItemType, number> = {
  event: 0,
  mass: 1,
  task: 2
}

/**
 * Groups items by YYYY-MM-DD and sorts each day's agenda cleanly (Events -> Mass Duties -> Tasks, then time/title).
 */
export function groupCalendarItemsByDate(
  items: DashboardCalendarItem[]
): Record<string, DashboardCalendarItem[]> {
  const grouped: Record<string, DashboardCalendarItem[]> = {}
  for (const item of items) {
    if (!grouped[item.date]) grouped[item.date] = []
    grouped[item.date].push(item)
  }
  for (const dateKey of Object.keys(grouped)) {
    grouped[dateKey].sort((a, b) => {
      const typeDiff = TYPE_SORT_ORDER[a.type] - TYPE_SORT_ORDER[b.type]
      if (typeDiff !== 0) return typeDiff
      const timeDiff = (a.timeRange || '').localeCompare(b.timeRange || '')
      if (timeDiff !== 0) return timeDiff
      return a.title.localeCompare(b.title)
    })
  }
  return grouped
}

export function getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
  }
}
