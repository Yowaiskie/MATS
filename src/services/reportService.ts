import { 
  collection, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { AttendanceRecord } from '@/types/attendance'
import { calculateAttendanceSummary, calculateAttendanceRate } from '@/utils/attendance'
import { getFullName } from '@/utils/member'

const MEMBERS_COLLECTION = 'members'
const SCHEDULES_COLLECTION = 'schedules'
const ATTENDANCE_COLLECTION = 'attendance'

export interface ReportRawData {
  members: Member[]
  schedules: Schedule[]
  attendance: AttendanceRecord[]
}

export interface OverallSummary {
  present: number
  late: number
  absent: number
  excused: number
  total: number
  rate: number // percentage, e.g. 94.25
}

export interface MemberReportRow {
  memberId: string
  name: string
  rank: string
  status: string // active / inactive / archived
  totalAssigned: number
  present: number
  late: number
  absent: number
  excused: number
  rate: number
}

export interface ScheduleReportRow {
  scheduleId: string
  title: string
  date: string
  timeSpan: string
  status: string // e.g. cancelled, completed
  totalAssigned: number
  present: number
  late: number
  absent: number
  excused: number
  rate: number
}

export interface MonthlyReportRow {
  month: string // e.g. "January 2026"
  monthIndex: number // 0-11
  year: number
  totalServices: number
  totalAssigned: number
  present: number
  late: number
  absent: number
  excused: number
  rate: number
}

export const reportService = {
  /**
   * Loads members, schedules, and attendance records from Firestore once.
   * Performs date filtering at query level if range is provided.
   */
  async loadReportData(startDate?: string, endDate?: string): Promise<ReportRawData> {
    const membersRef = collection(db, MEMBERS_COLLECTION)
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const attendanceRef = collection(db, ATTENDANCE_COLLECTION)

    // Build attendance query
    let attendanceQuery = query(attendanceRef)
    if (startDate && endDate) {
      attendanceQuery = query(
        attendanceRef,
        where('attendanceDate', '>=', startDate),
        where('attendanceDate', '<=', endDate)
      )
    } else if (startDate) {
      attendanceQuery = query(
        attendanceRef,
        where('attendanceDate', '>=', startDate)
      )
    } else if (endDate) {
      attendanceQuery = query(
        attendanceRef,
        where('attendanceDate', '<=', endDate)
      )
    }

    const [membersSnap, schedulesSnap, attendanceSnap] = await Promise.all([
      getDocs(membersRef),
      getDocs(schedulesRef),
      getDocs(attendanceQuery)
    ])

    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Member[]
    let schedules = schedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Schedule[]
    const attendance = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AttendanceRecord[]

    // Filter schedules client-side
    if (startDate || endDate) {
      schedules = schedules.filter(s => {
        if (!s.date) return false
        if (startDate && s.date < startDate) return false
        if (endDate && s.date > endDate) return false
        return true
      })
    }

    // Sort schedules client-side: date ASC, then startTime ASC
    schedules.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      const dateCompare = dateA.localeCompare(dateB)
      if (dateCompare !== 0) return dateCompare

      const timeA = a.startTime || ''
      const timeB = b.startTime || ''
      return timeA.localeCompare(timeB)
    })

    return { members, schedules, attendance }
  },

  /**
   * Generates overall aggregate stats from loaded dataset.
   */
  generateOverallSummary(data: ReportRawData): OverallSummary {
    const summary = calculateAttendanceSummary(data.attendance)
    const rate = calculateAttendanceRate(summary)
    return {
      ...summary,
      rate
    }
  },

  /**
   * Generates stats grouped per member.
   */
  generateMemberReport(data: ReportRawData): MemberReportRow[] {
    const { members, attendance } = data
    
    return members.map((member) => {
      const memberRecords = attendance.filter(r => r.memberId === member.id)
      const summary = calculateAttendanceSummary(memberRecords)
      const rate = calculateAttendanceRate(summary)
      
      return {
        memberId: member.id,
        name: getFullName(member),
        rank: member.rank,
        status: member.status,
        totalAssigned: summary.total,
        present: summary.present,
        late: summary.late,
        absent: summary.absent,
        excused: summary.excused,
        rate
      }
    })
    // Sort by name alphabetically
    .sort((a, b) => a.name.localeCompare(b.name))
  },

  /**
   * Generates stats grouped per schedule.
   */
  generateScheduleReport(data: ReportRawData): ScheduleReportRow[] {
    const { schedules, attendance } = data

    return schedules.map((schedule) => {
      const scheduleRecords = attendance.filter(r => r.scheduleId === schedule.id)
      const summary = calculateAttendanceSummary(scheduleRecords)
      const rate = calculateAttendanceRate(summary)

      return {
        scheduleId: schedule.id,
        title: schedule.title,
        date: schedule.date,
        timeSpan: `${schedule.startTime} - ${schedule.endTime}`,
        status: schedule.status,
        totalAssigned: summary.total,
        present: summary.present,
        late: summary.late,
        absent: summary.absent,
        excused: summary.excused,
        rate
      }
    })
  },

  /**
   * Generates monthly aggregate summary list for a selected calendar year.
   */
  generateMonthlyReport(data: ReportRawData, year: number): MonthlyReportRow[] {
    const { attendance, schedules } = data
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    return months.map((monthName, index) => {
      // Filter schedules in that month and year
      const monthlySchedules = schedules.filter((s) => {
        const sDate = new Date(s.date)
        return sDate.getFullYear() === year && sDate.getMonth() === index
      })
      const monthlyScheduleIds = monthlySchedules.map(s => s.id)

      // Filter attendance records for that month and year
      const monthlyRecords = attendance.filter((r) => {
        const rDate = new Date(r.attendanceDate)
        return rDate.getFullYear() === year && rDate.getMonth() === index && monthlyScheduleIds.includes(r.scheduleId)
      })

      const summary = calculateAttendanceSummary(monthlyRecords)
      const rate = calculateAttendanceRate(summary)

      return {
        month: `${monthName} ${year}`,
        monthIndex: index,
        year,
        totalServices: monthlySchedules.length,
        totalAssigned: summary.total,
        present: summary.present,
        late: summary.late,
        absent: summary.absent,
        excused: summary.excused,
        rate
      }
    })
  }
}
