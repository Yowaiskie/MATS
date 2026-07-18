import type { AttendanceStatus } from '@/types/attendance'

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  excused: number
  observer: number
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
    observer: 0,
    total: records.length
  }

  records.forEach((record) => {
    if (record.status === 'present') summary.present++
    else if (record.status === 'late') summary.late++
    else if (record.status === 'absent') summary.absent++
    else if (record.status === 'excused') summary.excused++
    else if (record.status === 'observer') summary.observer++
  })

  return summary
}

/**
 * Computes attendance percentage rate rounded to two decimal places:
 * Present / (Present + Late + Absent + Excused) * 100
 */
export const calculateAttendanceRate = (summary: AttendanceSummary): number => {
  if (summary.total === 0) return 0
  const rate = (summary.present / summary.total) * 100
  return Number(rate.toFixed(2))
}
