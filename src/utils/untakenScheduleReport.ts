import type { Schedule } from '@/types/schedule'
import { formatReadableDate, getDayOfWeek, formatReadableTime } from './communityReport'
import { DEFAULT_REMINDER_TEMPLATE } from '@/services/settingsService'

export interface GenerateReminderTextOptions {
  schedules: Schedule[]
  customNote?: string
  portalUrl?: string
  template?: string
  ministryName?: string
}

/**
 * Generates an untaken schedule reminder text based on a customizable template.
 */
export const generateUntakenScheduleReminderText = ({
  schedules,
  customNote,
  portalUrl = 'https://mats-c10da.web.app/attendance',
  template,
  ministryName = 'Ministry of Altar Servers (MATS)'
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

  // Format schedules list
  const scheduleItemsText = sortedSchedules.map((s, idx) => {
    const day = getDayOfWeek(s.date)
    const dateFormatted = formatReadableDate(s.date)
    const timeFormatted = s.startTime
      ? formatReadableTime(s.startTime) + (s.endTime ? ` - ${formatReadableTime(s.endTime)}` : '')
      : ''

    let item = `${idx + 1}. ${s.title}\n`
    item += `   Date: ${day ? `${day}, ` : ''}${dateFormatted}\n`
    if (timeFormatted) {
      item += `   Time: ${timeFormatted}\n`
    }
    return item.trimEnd()
  }).join('\n\n')

  const noteText = customNote?.trim()
    ? `Paalala / Note:\n${customNote.trim()}`
    : ''

  const today = new Date()
  const todayFormatted = formatReadableDate(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )

  let result = (template && template.trim() !== '' ? template : DEFAULT_REMINDER_TEMPLATE)
    .replace(/\{\{schedules\}\}/g, scheduleItemsText)
    .replace(/\{\{scheduleCount\}\}/g, String(sortedSchedules.length))
    .replace(/\{\{customNote\}\}/g, noteText)
    .replace(/\{\{portalUrl\}\}/g, portalUrl)
    .replace(/\{\{ministryName\}\}/g, ministryName)
    .replace(/\{\{currentDate\}\}/g, todayFormatted)

  // Clean up excessive blank lines (3 or more) down to double newlines
  result = result.replace(/\n{3,}/g, '\n\n').trim()

  return result
}
