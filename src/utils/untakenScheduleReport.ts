import type { Schedule } from '@/types/schedule'
import { formatReadableDate, getDayOfWeek, formatReadableTime } from './communityReport'

export interface GenerateReminderTextOptions {
  schedules: Schedule[]
  customNote?: string
  portalUrl?: string
}

/**
 * Generates an English, clean, emoji-free text template
 * containing only the schedule name, date, and time.
 */
export const generateUntakenScheduleReminderText = ({
  schedules,
  customNote,
  portalUrl = 'https://mats-c10da.web.app/attendance'
}: GenerateReminderTextOptions): string => {
  if (!schedules || schedules.length === 0) {
    return 'No untaken schedules selected.'
  }

  // Sort schedules chronologically by date and start time
  const sortedSchedules = [...schedules].sort((a, b) => {
    const dateComp = (a.date || '').localeCompare(b.date || '')
    if (dateComp !== 0) return dateComp
    return (a.startTime || '').localeCompare(b.startTime || '')
  })

  let text = 'REMINDER: UNTAKEN ATTENDANCE / PENDING SCHEDULES\n'
  text += 'Ministry of Altar Servers (MATS)\n\n'
  text += 'Please be reminded of the following schedule(s) with pending attendance:\n\n'

  sortedSchedules.forEach((s, idx) => {
    const day = getDayOfWeek(s.date)
    const dateFormatted = formatReadableDate(s.date)
    const timeFormatted = formatReadableTime(s.startTime) + (s.endTime ? ` - ${formatReadableTime(s.endTime)}` : '')

    text += `${idx + 1}. ${s.title}\n`
    text += `   Date: ${day ? `${day}, ` : ''}${dateFormatted}\n`
    if (s.startTime) {
      text += `   Time: ${timeFormatted}\n`
    }
    text += '\n'
  })

  if (customNote?.trim()) {
    text += `Note:\n${customNote.trim()}\n\n`
  }

  text += 'Please record your attendance on the MATS Portal or notify the Ministry Officers.\n'
  text += `Portal Link: ${portalUrl}\n\n`
  text += 'Thank you!'

  return text
}
