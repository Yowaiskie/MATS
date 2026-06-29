import type { AttendanceStatus } from '@/types/attendance'

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  excused: number
  total: number
}

/**
 * Calculates raw count totals for each status in a list of attendance records.
 */
export const calculateAttendanceSummary = (
  records: Pick<{ status: AttendanceStatus }, 'status'>[]
): AttendanceSummary => {
  const summary: AttendanceSummary = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    total: records.length
  }

  records.forEach((record) => {
    if (record.status === 'present') summary.present++
    else if (record.status === 'late') summary.late++
    else if (record.status === 'absent') summary.absent++
    else if (record.status === 'excused') summary.excused++
  })

  return summary
}

/**
 * Computes an attendance percentage rate based on Present & Late records over Total assigned.
 */
export const calculateAttendanceRate = (summary: AttendanceSummary): number => {
  if (summary.total === 0) return 0
  
  // Present and Late are considered active attendance service actions
  const activeCount = summary.present + summary.late
  return Math.round((activeCount / summary.total) * 100)
}
