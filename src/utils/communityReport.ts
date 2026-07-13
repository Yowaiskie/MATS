import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { AttendanceStatus } from '@/types/attendance'
import { getFullName } from '@/utils/member'

interface RowState {
  id?: string
  status: AttendanceStatus | undefined
  remarks: string
}

interface FormState {
  [memberId: string]: RowState
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
  // Helper to map status to shortcut character
  const mapStatus = (status?: AttendanceStatus): string => {
    if (status === 'present') return 'P'
    if (status === 'late') return 'L'
    if (status === 'absent') return 'A'
    if (status === 'excused') return 'E'
    return 'A' // default fallback if undefined
  }

  // Count marks and format lists
  let presentCount = 0
  let lateCount = 0
  let absentCount = 0
  let excusedCount = 0

  const assignedList = assignedMembers.length > 0
    ? assignedMembers
        .map((member, idx) => {
          const state = formState[member.id]
          const status = state?.status
          
          if (status === 'present') presentCount++
          else if (status === 'late') lateCount++
          else if (status === 'absent') absentCount++
          else if (status === 'excused') excusedCount++

          const statusShortcut = mapStatus(status)
          return `${idx + 1}. ${getFullName(member)} - ${statusShortcut}`
        })
        .join('\n')
    : 'NO SERVERS!'

  const otherList = unassignedMembers.length > 0
    ? unassignedMembers
        .map((member, idx) => `${idx + 1}. ${getFullName(member)}`)
        .join('\n')
    : ''

  // Replace placeholders dynamically with formatted values
  let result = template
  
  if (unassignedMembers.length === 0) {
    // Remove "Other Servers:" and the placeholder if there are no other servers
    result = result.replace(/\n*Other\s*Servers:\s*\{\{otherServers\}\}/i, '')
    // Fallback if the placeholder is still there
    result = result.replace(/\{\{otherServers\}\}/g, '')
  } else {
    result = result.replace(/\{\{otherServers\}\}/g, otherList)
  }
  
  result = result.replace(/\{\{scheduleDate\}\}/g, formatReadableDate(schedule.date || ''))
  result = result.replace(/\{\{scheduleTitle\}\}/g, toTitleCase(schedule.title || ''))
  result = result.replace(/\{\{startTime\}\}/g, formatReadableTime(schedule.startTime || ''))
  result = result.replace(/\{\{endTime\}\}/g, formatReadableTime(schedule.endTime || ''))
  result = result.replace(/\{\{assignedMembers\}\}/g, assignedList)
  result = result.replace(/\{\{presentCount\}\}/g, String(presentCount))
  result = result.replace(/\{\{lateCount\}\}/g, String(lateCount))
  result = result.replace(/\{\{absentCount\}\}/g, String(absentCount))
  result = result.replace(/\{\{excusedCount\}\}/g, String(excusedCount))

  return result
}
