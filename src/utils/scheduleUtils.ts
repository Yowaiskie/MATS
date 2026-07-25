import type { Schedule, ScheduleStatus } from '@/types/schedule'

/**
 * Dynamically computes a schedule's status based on current system time,
 * unless it has been explicitly marked as 'cancelled'.
 * 
 * Note: Version 1 time comparison assumes same-day bounds.
 * Schedules crossing midnight (e.g. 23:00 to 01:00) are not supported.
 */
export const getScheduleStatus = (
  schedule: Pick<Schedule, 'date' | 'startTime' | 'endTime' | 'status'>
): ScheduleStatus => {
  if (schedule.status === 'cancelled') {
    return 'cancelled'
  }

  const now = new Date()
  
  // Format local date YYYY-MM-DD
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`
  
  // Format local time HH:MM
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const currentTimeStr = `${hours}:${minutes}`

  if (schedule.date < todayStr) {
    return 'completed'
  } else if (schedule.date > todayStr) {
    return 'upcoming'
  } else {
    // Dates are equal, check time boundaries
    if (currentTimeStr < schedule.startTime) {
      return 'upcoming'
    } else if (currentTimeStr >= schedule.startTime && currentTimeStr <= schedule.endTime) {
      return 'ongoing'
    } else {
      return 'completed'
    }
  }
}

/**
 * Core validation logic to detect overlap between two schedules on the same day.
 * Overlap formula: startA < endB && startB < endA
 * 
 * Note: Does not support schedules crossing midnight.
 */
export const isTimeOverlapping = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  return startA < endB && startB < endA
}

/**
 * Determines whether a schedule is a Sunday Mass or a Saturday Anticipated Sunday Mass.
 * Saturday masses at or after 5:00 PM (17:00), or titled with 'anticipated' or evening time (e.g. 6pm / 6:00),
 * are categorized as Sunday (Anticipated) Mass.
 */
export const isSundayOrAnticipatedMass = (
  title: string,
  dateStr: string,
  startTime?: string
): boolean => {
  const titleLower = title.toLowerCase()

  // 1. Direct title check for 'sunday' or 'anticipated'
  if (titleLower.includes('sunday') || titleLower.includes('anticipated')) {
    return true
  }

  if (!dateStr) return false

  // 2. Parse YYYY-MM-DD in local time
  const parts = dateStr.split('-')
  if (parts.length < 3) return false

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false

  const localDate = new Date(year, month - 1, day)
  const dayOfWeek = localDate.getDay() // 0 = Sunday, 6 = Saturday

  // 3. Sunday dates
  if (dayOfWeek === 0) {
    return true
  }

  // 4. Saturday evening / anticipated masses (5:00 PM / 17:00 or later, or 6pm/6:00/evening in title)
  if (dayOfWeek === 6) {
    if (startTime) {
      const timeParts = startTime.split(':')
      const hours = parseInt(timeParts[0], 10)
      if (!isNaN(hours) && hours >= 17) {
        return true
      }
    }

    if (
      titleLower.includes('6:00') ||
      titleLower.includes('6pm') ||
      titleLower.includes('6 pm') ||
      titleLower.includes('5:00') ||
      titleLower.includes('5pm') ||
      titleLower.includes('5 pm') ||
      titleLower.includes('evening')
    ) {
      return true
    }
  }

  return false
}

