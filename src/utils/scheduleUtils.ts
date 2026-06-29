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
