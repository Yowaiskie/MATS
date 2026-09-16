import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { AttendanceStatus } from '@/types/attendance'
import { getFirstNameFirst } from '@/utils/member'

interface RowState {
  id?: string
  status: AttendanceStatus | undefined
  remarks: string
}

interface FormState {
  [memberId: string]: RowState
}

/**
 * Sorts a list of members alphabetically by Last Name, then by First Name.
 */
export const sortMembersByLastName = (list: Member[]): Member[] => {
  return [...list].sort((a, b) => {
    const lastA = (a.lastName || '').toLowerCase().trim()
    const lastB = (b.lastName || '').toLowerCase().trim()
    const comp = lastA.localeCompare(lastB)
    if (comp !== 0) return comp
    const firstA = (a.firstName || '').toLowerCase().trim()
    const firstB = (b.firstName || '').toLowerCase().trim()
    return firstA.localeCompare(firstB)
  })
}

/**
 * Formats an ISO date string (YYYY-MM-DD) to a human-readable string (e.g. "July 3, 2026").
 * Removes leading zero from the day.
 */
export const formatReadableDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr // fallback if format is unexpected
  
  const year = parts[0]
  const monthIndex = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const monthName = months[monthIndex] || parts[1]
  return `${monthName} ${day}, ${year}`
}

/**
 * Derives the day of the week name from an ISO date string (YYYY-MM-DD).
 * Parses date parts manually to avoid UTC timezone offset issues.
 * Returns e.g. "Friday", "Sunday", etc. Returns '' if dateStr is invalid.
 */
export const getDayOfWeek = (dateStr: string): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return ''
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return ''
  const date = new Date(year, month, day) // local time — no UTC offset
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[date.getDay()] || ''
}

/**
 * Formats a 24-hour time string (HH:MM) to 12-hour AM/PM format (e.g. "6:00 AM").
 */
export const formatReadableTime = (timeStr: string): string => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr // fallback if format is unexpected
  
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1].padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`
}

/**
 * Converts a string to Title Case (e.g. "SUNDAY SCHEDULE" to "Sunday Schedule").
 */
export const toTitleCase = (str: string): string => {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Generates the Facebook Community Attendance Report text based on the database-stored template,
 * replacing placeholders dynamically.
 */
export const generateCommunityReport = (
  template: string,
  schedule: Schedule,
  assignedMembers: Member[],
  formState: FormState,
  unassignedMembers: Member[]
): string => {
  const isMeetingSchedule = (schedule.title || '').toLowerCase().includes('meeting')
    || (schedule.title || '').toLowerCase().includes('assembly')

  // Helper to map status to shortcut character
  const mapStatus = (status?: AttendanceStatus): string => {
    if (status === 'present') return 'P'
    if (status === 'late') return 'L'
    if (status === 'absent') return 'A'
    if (status === 'excused') return 'E'
    if (status === 'observer') return 'O'
    if (status === 'formation') return 'F'
    return '' // Empty string if status is undefined or not provided
  }

  if (isMeetingSchedule) {
    const allMeetingMembers = sortMembersByLastName([...assignedMembers, ...unassignedMembers])
    const memberMap = new Map<string, Member>()
    allMeetingMembers.forEach((member) => {
      if (!memberMap.has(member.id)) memberMap.set(member.id, member)
    })

    const normalizeStatus = (status?: AttendanceStatus | string) => {
      return typeof status === 'string' ? status.trim().toLowerCase() : ''
    }

    const statusBuckets: Record<'present' | 'late' | 'absent' | 'excused', string[]> = {
      present: [],
      late: [],
      absent: [],
      excused: [],
    }

    Object.entries(formState).forEach(([memberId, row]) => {
      const normalized = normalizeStatus(row?.status)
      if (
        normalized !== 'present' &&
        normalized !== 'late' &&
        normalized !== 'absent' &&
        normalized !== 'excused'
      ) {
        return
      }

      const member = memberMap.get(memberId)
      const displayName = member ? getFirstNameFirst(member) : memberId
      statusBuckets[normalized].push(displayName)
    })

    const sections: string[] = []
    const addSection = (label: string, names: string[]) => {
      if (names.length === 0) return
      const lines = names.map((name, index) => `${index + 1}. ${name}`)
      sections.push(`${label}:\n${lines.join('\n')}`)
    }

    addSection('Present', statusBuckets.present)
    addSection('Late', statusBuckets.late)
    addSection('Absent', statusBuckets.absent)
    addSection('Excused', statusBuckets.excused)

    const dayLabel = getDayOfWeek(schedule.date || '')
    const meetingHeader = `${dayLabel ? dayLabel + ', ' : ''}${formatReadableDate(schedule.date || '')} ${toTitleCase(schedule.title || '')} ${formatReadableTime(schedule.startTime || '')}${schedule.endTime ? ` - ${formatReadableTime(schedule.endTime)}` : ''}`
    return [meetingHeader, ...sections].join('\n\n').trim()
  }

  // Count marks and format lists
  let presentCount = 0
  let lateCount = 0
  let absentCount = 0
  let excusedCount = 0
  let observerCount = 0
  let formationCount = 0

  // Helper to check if a member is a Squire
  const isSquire = (member: Member) => (member.rank || '').trim().toLowerCase().includes('squire')

  // Helper to accumulate status counters and format member line
  const formatMemberLine = (member: Member, idx: number) => {
    const state = formState[member.id]
    const status = state?.status

    if (status === 'present') presentCount++
    else if (status === 'late') lateCount++
    else if (status === 'absent') absentCount++
    else if (status === 'excused') excusedCount++
    else if (status === 'observer') observerCount++
    else if (status === 'formation') formationCount++

    const statusShortcut = mapStatus(status)
    const suffix = statusShortcut ? ` - ${statusShortcut}` : ''
    return `${idx + 1}. ${getFirstNameFirst(member)}${suffix}`
  }

  const visibleAssigned = sortMembersByLastName(assignedMembers.filter(member => {
    const status = formState[member.id]?.status
    return status !== 'alumni' && !isSquire(member)
  }))

  const visibleSquires = sortMembersByLastName([...assignedMembers, ...unassignedMembers].filter(member => {
    const status = formState[member.id]?.status
    return status !== 'alumni' && isSquire(member)
  }))

  const assignedList = visibleAssigned.length > 0
    ? visibleAssigned.map((member, idx) => formatMemberLine(member, idx)).join('\n')
    : 'NO SERVERS!'

  const squiresList = visibleSquires.length > 0
    ? visibleSquires.map((member, idx) => formatMemberLine(member, idx)).join('\n')
    : ''

  const visibleOther = sortMembersByLastName(unassignedMembers.filter(member => {
    const status = formState[member.id]?.status
    return status !== 'alumni' && !isSquire(member)
  }))

  const otherList = visibleOther.length > 0
    ? visibleOther
        .map((member, idx) => `${idx + 1}. ${getFirstNameFirst(member)}`)
        .join('\n')
    : ''

  // Replace placeholders dynamically with formatted values
  let result = template

  // Remove {{otherServers}} first if there are no other servers
  if (visibleOther.length === 0) {
    result = result.replace(/\n*Other\s*Servers:\s*\{\{otherServers\}\}/gi, '')
    result = result.replace(/\{\{otherServers\}\}/g, '')
  } else {
    result = result.replace(/\{\{otherServers\}\}/g, otherList)
  }

  // Handle {{squires}} placeholder or append Squires section if missing
  if (visibleSquires.length > 0) {
    if (result.includes('{{squires}}')) {
      // If template contains {{squires}}, ensure there is a "Squires:" header if not present
      if (!/Squires:\s*\{\{squires\}\}/i.test(result)) {
        result = result.replace(/\{\{squires\}\}/g, `Squires:\n${squiresList}`)
      } else {
        result = result.replace(/\{\{squires\}\}/g, squiresList)
      }
    } else {
      // Template doesn't have {{squires}}, append "Squires:" section right below assigned members
      if (result.includes('{{assignedMembers}}')) {
        result = result.replace(/\{\{assignedMembers\}\}/g, `${assignedList}\n\nSquires:\n${squiresList}`)
      } else {
        result = result + `\n\nSquires:\n${squiresList}`
      }
    }
  } else {
    result = result.replace(/\n*Squires:\s*\{\{squires\}\}/gi, '')
    result = result.replace(/\{\{squires\}\}/g, '')
  }
  
  result = result.replace(/\{\{scheduleDate\}\}/g, formatReadableDate(schedule.date || ''))
  result = result.replace(/\{\{scheduleTitle\}\}/g, toTitleCase(schedule.title || ''))
  result = result.replace(/\{\{dayOfWeek\}\}/g, getDayOfWeek(schedule.date || ''))
  result = result.replace(/\{\{startTime\}\}/g, formatReadableTime(schedule.startTime || ''))
  result = result.replace(/\{\{endTime\}\}/g, formatReadableTime(schedule.endTime || ''))
  result = result.replace(/\{\{assignedMembers\}\}/g, assignedList)
  result = result.replace(/\{\{presentCount\}\}/g, String(presentCount))
  result = result.replace(/\{\{lateCount\}\}/g, String(lateCount))
  result = result.replace(/\{\{absentCount\}\}/g, String(absentCount))
  result = result.replace(/\{\{excusedCount\}\}/g, String(excusedCount))
  result = result.replace(/\{\{observerCount\}\}/g, String(observerCount))
  result = result.replace(/\{\{formationCount\}\}/g, String(formationCount))

  return result
}
