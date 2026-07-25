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
import { isSundayOrAnticipatedMass } from '@/utils/scheduleUtils'
import { settingsService, DEFAULT_POLICY_SETTINGS } from '@/services/settingsService'
import type { SuspensionPolicySettings } from '@/services/settingsService'

const MEMBERS_COLLECTION = 'members'
const SCHEDULES_COLLECTION = 'schedules'
const ATTENDANCE_COLLECTION = 'attendance'

export interface ReportRawData {
  members: Member[]
  schedules: Schedule[]
  attendance: AttendanceRecord[]
  policy: SuspensionPolicySettings
}

export interface OverallSummary {
  present: number
  late: number
  absent: number
  excused: number
  total: number
  rate: number // percentage, e.g. 94.25
}

export interface MissedScheduleItem {
  scheduleId: string
  title: string
  date: string
  startTime: string
  endTime: string
  isSunday: boolean
  isMeeting: boolean
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
  warningStatus: 'active' | 'warning' | 'suspended' | 'inactive'
  warningCategory: 'none' | 'sunday' | 'weekday' | 'meeting' | 'multiple' // which category triggered warning/suspension
  missedSchedules: MissedScheduleItem[]
  sundayAbsences: number
  weekdayAbsences: number
  meetingAbsences: number
  policyAbsencesCount: number // max of the category counts
  otherServerCount: number
  otherServerSchedules: MissedScheduleItem[]
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
   * Loads members, schedules, attendance records, and system policy settings from Firestore once.
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

    let policy = DEFAULT_POLICY_SETTINGS
    try {
      policy = await settingsService.getPolicySettings()
    } catch (err) {
      console.warn('Could not load policy settings for report:', err)
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

    return { members, schedules, attendance, policy }
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
   * Generates stats grouped per member, including dynamic attendance warning & suspension calculations.
   */
  generateMemberReport(data: ReportRawData, policyOverride?: SuspensionPolicySettings): MemberReportRow[] {
    const { members, schedules, attendance, policy: defaultPolicy } = data
    const policy = policyOverride || defaultPolicy || DEFAULT_POLICY_SETTINGS

    // Map schedules by ID for quick lookup
    const schedulesMap = new Map<string, Schedule>()
    schedules.forEach(s => schedulesMap.set(s.id, s))

    // Calculate cutoff date for evaluationMonths or specific evaluationMonthStr
    let cutoffDateStr = ''
    let endDateLimitStr = ''
    if (policy.evaluationMonthStr) {
      const [yearStr, monthStr] = policy.evaluationMonthStr.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      cutoffDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDayNum = new Date(year, month, 0).getDate()
      endDateLimitStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`
    } else if (policy.evaluationMonths && policy.evaluationMonths > 0) {
      const d = new Date()
      d.setMonth(d.getMonth() - policy.evaluationMonths)
      cutoffDateStr = d.toISOString().split('T')[0]
    }

    return members.map((member) => {
      const memberRecords = attendance.filter(r => r.memberId === member.id)
      const summary = calculateAttendanceSummary(memberRecords)
      const rate = calculateAttendanceRate(summary)

      const missedSchedules: MissedScheduleItem[] = []
      const otherServerSchedules: MissedScheduleItem[] = []
      let sundayAbsentCount = 0
      let weekdayAbsentCount = 0
      let meetingAbsentCount = 0
      let sundayLateCount = 0
      let weekdayLateCount = 0
      let meetingLateCount = 0

      memberRecords.forEach(rec => {
        const schedule = schedulesMap.get(rec.scheduleId)
        const dateStr = rec.attendanceDate || schedule?.date || ''
        const title = schedule?.title || 'Mass / Meeting'

        // Check date cutoff if evaluationMonths or evaluationMonthStr is set
        if ((cutoffDateStr && dateStr < cutoffDateStr) || (endDateLimitStr && dateStr > endDateLimitStr)) {
          return
        }

        const isSunday = isSundayOrAnticipatedMass(title, dateStr, schedule?.startTime)
        const isMeeting = title.toLowerCase().includes('meeting') || title.toLowerCase().includes('assembly')
        const isWeekday = !isSunday && !isMeeting

        const shouldCountAsAbsence = rec.status === 'absent'
        const shouldCountAsLate = rec.status === 'late'

        if (rec.isOtherServer) {
          otherServerSchedules.push({
            scheduleId: rec.scheduleId,
            title,
            date: dateStr,
            startTime: schedule?.startTime || '',
            endTime: schedule?.endTime || '',
            isSunday,
            isMeeting
          })
        }

        if (shouldCountAsAbsence) {
          const item: MissedScheduleItem = {
            scheduleId: rec.scheduleId,
            title,
            date: dateStr,
            startTime: schedule?.startTime || '',
            endTime: schedule?.endTime || '',
            isSunday,
            isMeeting
          }
          missedSchedules.push(item)
        }

        // Policy absence equivalent:
        // 1 absent = 1 absence, 2 lates = 1 absence.
        if (isMeeting && policy.includeMeetings) {
          if (shouldCountAsAbsence) meetingAbsentCount++
          else if (shouldCountAsLate) meetingLateCount++
        } else if (isSunday && policy.includeSundays) {
          if (shouldCountAsAbsence) sundayAbsentCount++
          else if (shouldCountAsLate) sundayLateCount++
        } else if (isWeekday && policy.includeWeekdays) {
          if (shouldCountAsAbsence) weekdayAbsentCount++
          else if (shouldCountAsLate) weekdayLateCount++
        }
      })

      const sundayAbsences = sundayAbsentCount + Math.floor(sundayLateCount / 2)
      const weekdayAbsences = weekdayAbsentCount + Math.floor(weekdayLateCount / 2)
      const meetingAbsences = meetingAbsentCount + Math.floor(meetingLateCount / 2)

      // Sort missed and other server schedules by date descending (most recent first)
      missedSchedules.sort((a, b) => b.date.localeCompare(a.date))
      otherServerSchedules.sort((a, b) => b.date.localeCompare(a.date))

      // Determine dynamic warning / suspension / inactive status PER CATEGORY
      // Member is inactive if they have 0% attendance rate (0 assigned presents)
      const maxCategoryAbsences = Math.max(sundayAbsences, weekdayAbsences, meetingAbsences)
      let warningStatus: 'active' | 'warning' | 'suspended' | 'inactive' = 'active'
      let warningCategory: 'none' | 'sunday' | 'weekday' | 'meeting' | 'multiple' = 'none'

      const sundaySuspended = policy.includeSundays && sundayAbsences >= policy.suspensionAbsenceThreshold
      const weekdaySuspended = policy.includeWeekdays && weekdayAbsences >= policy.suspensionAbsenceThreshold
      const meetingSuspended = policy.includeMeetings && meetingAbsences >= policy.suspensionAbsenceThreshold
      const sundayWarning = policy.includeSundays && sundayAbsences >= policy.warningAbsenceThreshold
      const weekdayWarning = policy.includeWeekdays && weekdayAbsences >= policy.warningAbsenceThreshold
      const meetingWarning = policy.includeMeetings && meetingAbsences >= policy.warningAbsenceThreshold

      const suspendedCount = [sundaySuspended, weekdaySuspended, meetingSuspended].filter(Boolean).length
      const warningCount = [sundayWarning, weekdayWarning, meetingWarning].filter(Boolean).length

      const effectiveTotal = summary.total - summary.excused
      if (summary.present === 0 && summary.absent > 0 && otherServerSchedules.length === 0 && effectiveTotal > 0) {
        warningStatus = 'inactive'
      } else if (suspendedCount > 0) {
        warningStatus = 'suspended'
        if (suspendedCount > 1) warningCategory = 'multiple'
        else if (sundaySuspended) warningCategory = 'sunday'
        else if (weekdaySuspended) warningCategory = 'weekday'
        else warningCategory = 'meeting'
      } else if (warningCount > 0) {
        warningStatus = 'warning'
        if (warningCount > 1) warningCategory = 'multiple'
        else if (sundayWarning) warningCategory = 'sunday'
        else if (weekdayWarning) warningCategory = 'weekday'
        else warningCategory = 'meeting'
      }

      return {
        memberId: member.id,
        name: getFullName(member, false), // Exclude nickname from report tables
        rank: member.rank,
        status: member.status,
        totalAssigned: summary.total,
        present: summary.present,
        late: summary.late,
        absent: summary.absent,
        excused: summary.excused,
        rate,
        warningStatus,
        warningCategory,
        missedSchedules,
        sundayAbsences,
        weekdayAbsences,
        meetingAbsences,
        policyAbsencesCount: maxCategoryAbsences,
        otherServerCount: otherServerSchedules.length,
        otherServerSchedules
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
