import { 
  collection, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { AttendanceRecord, AttendanceStatus } from '@/types/attendance'
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

export type ScheduleCategoryType = 'all' | 'holyhour' | 'sunday' | 'weekday' | 'meeting' | 'custom'

export interface ScheduleCategorySelection {
  includeSundays: boolean
  includeWeekdays: boolean
  includeHolyHour: boolean
  includeMeetings: boolean
}

export const isHolyHourSchedule = (title?: string): boolean => {
  if (!title) return false
  const lower = title.toLowerCase().trim()
  return (
    lower.includes('holy hour') ||
    lower.includes('holyhour') ||
    lower.includes('hora santa') ||
    lower.includes('adoration') ||
    lower.includes('benediction') ||
    lower.includes('santissimo') ||
    lower.includes('santissmo')
  )
}

export const isMeetingSchedule = (title?: string): boolean => {
  if (!title) return false
  const lower = title.toLowerCase().trim()
  return (
    lower.includes('meeting') ||
    lower.includes('formation') ||
    lower.includes('assembly') ||
    lower.includes('practice') ||
    lower.includes('rehearsal') ||
    lower.includes('orientation') ||
    lower.includes('pulong') ||
    lower.includes('workshop')
  )
}

export interface ServiceHistoryItem {
  scheduleId: string
  title: string
  date: string
  startTime: string
  endTime: string
  status: AttendanceStatus
  remarks?: string
  isOtherServer?: boolean
}

export interface ServiceServerStat {
  memberId: string
  name: string
  rank: string
  status: string
  order?: string
  totalAssigned: number
  present: number
  late: number
  absent: number
  excused: number
  otherServerCount: number
  totalServed: number // present + late
  rate: number
  serviceHistory: ServiceHistoryItem[]
}

export interface ServiceLeaderboardSummary {
  category: ScheduleCategoryType
  categoryLabel: string
  totalSchedules: number
  totalAssigned: number
  totalServed: number
  totalPresent: number
  totalLate: number
  totalAbsent: number
  totalExcused: number
  overallRate: number
  uniqueServersCount: number
  servers: ServiceServerStat[]
}

// Backward-compatible aliases
export type HolyHourServiceItem = ServiceHistoryItem
export type HolyHourServerStat = ServiceServerStat
export type HolyHourReportSummary = ServiceLeaderboardSummary

export const reportService = {
  /**
   * Loads members, schedules, attendance records, and system policy settings from Firestore once.
   * Performs date filtering at query level if range is provided.
   * Allows reusing already-fetched members to prevent duplicate reads.
   */
  async loadReportData(startDate?: string, endDate?: string, preloadedMembers?: Member[]): Promise<ReportRawData> {
    const membersRef = collection(db, MEMBERS_COLLECTION)
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const attendanceRef = collection(db, ATTENDANCE_COLLECTION)

    // Build schedules query with server-side date range filtering
    let schedulesQuery = query(schedulesRef)
    if (startDate && endDate) {
      schedulesQuery = query(
        schedulesRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      )
    } else if (startDate) {
      schedulesQuery = query(
        schedulesRef,
        where('date', '>=', startDate)
      )
    } else if (endDate) {
      schedulesQuery = query(
        schedulesRef,
        where('date', '<=', endDate)
      )
    }

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

    const promises: [Promise<any>, Promise<any>, Promise<any>] = [
      preloadedMembers ? Promise.resolve(null) : getDocs(membersRef),
      getDocs(schedulesQuery),
      getDocs(attendanceQuery)
    ]

    const [membersSnap, schedulesSnap, attendanceSnap] = await Promise.all(promises)

    const members = preloadedMembers || (membersSnap ? membersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Member[] : [])
    let schedules = schedulesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Schedule[]
    const attendance = attendanceSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as AttendanceRecord[]

    // Safeguard filter schedules client-side if needed
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
  },

  /**
   * Generates comprehensive attendance leaderboard & frequent server metrics
   * across any schedule category (Holy Hour, Sunday Mass, Weekdays, Meetings, All).
   */
  generateServiceLeaderboardReport(
    data: ReportRawData,
    category: ScheduleCategoryType | ScheduleCategorySelection = 'all',
    customFilterKeyword?: string
  ): ServiceLeaderboardSummary {
    const { members, schedules, attendance } = data

    // 1. Identify category label & matching schedules
    let categoryLabel = 'All Services'
    let effectiveCategory: ScheduleCategoryType = 'all'
    const keyword = customFilterKeyword?.toLowerCase().trim()
    const isSelectionObj = typeof category === 'object' && category !== null

    if (isSelectionObj) {
      const sel = category as ScheduleCategorySelection
      const activeLabels: string[] = []
      if (sel.includeSundays) activeLabels.push('Sundays')
      if (sel.includeWeekdays) activeLabels.push('Weekdays')
      if (sel.includeHolyHour) activeLabels.push('Holy Hour')
      if (sel.includeMeetings) activeLabels.push('Meetings')

      categoryLabel = activeLabels.length === 4
        ? 'All Schedules'
        : activeLabels.length > 0
        ? activeLabels.join(' + ')
        : 'No Category Selected'

      if (activeLabels.length === 1) {
        if (sel.includeSundays) effectiveCategory = 'sunday'
        else if (sel.includeWeekdays) effectiveCategory = 'weekday'
        else if (sel.includeHolyHour) effectiveCategory = 'holyhour'
        else if (sel.includeMeetings) effectiveCategory = 'meeting'
      } else if (activeLabels.length === 4) {
        effectiveCategory = 'all'
      } else {
        effectiveCategory = 'custom'
      }
    } else {
      effectiveCategory = category as ScheduleCategoryType
    }

    const targetSchedules = schedules.filter(s => {
      if (keyword) {
        return s.title.toLowerCase().includes(keyword)
      }

      if (isSelectionObj) {
        const sel = category as ScheduleCategorySelection
        if (isHolyHourSchedule(s.title)) return !!sel.includeHolyHour
        if (isSundayOrAnticipatedMass(s.title, s.date, s.startTime)) return !!sel.includeSundays
        if (isMeetingSchedule(s.title)) return !!sel.includeMeetings
        return !!sel.includeWeekdays
      }

      switch (category) {
        case 'holyhour':
          categoryLabel = 'Holy Hour & Eucharistic Adoration'
          return isHolyHourSchedule(s.title)

        case 'sunday':
          categoryLabel = 'Sunday & Anticipated Masses'
          return isSundayOrAnticipatedMass(s.title, s.date, s.startTime)

        case 'weekday':
          categoryLabel = 'Weekday Masses'
          return (
            !isSundayOrAnticipatedMass(s.title, s.date, s.startTime) &&
            !isHolyHourSchedule(s.title) &&
            !isMeetingSchedule(s.title)
          )

        case 'meeting':
          categoryLabel = 'Meetings, Formation & Practices'
          return isMeetingSchedule(s.title)

        case 'custom':
          categoryLabel = customFilterKeyword ? `Custom Filter: "${customFilterKeyword}"` : 'Custom Filter'
          return true

        case 'all':
        default:
          categoryLabel = 'All Ministry Schedules'
          return true
      }
    })

    const targetScheduleMap = new Map(targetSchedules.map(s => [s.id, s]))
    const targetScheduleIds = new Set(targetSchedules.map(s => s.id))

    // 2. Filter attendance records belonging to target schedules
    const targetRecords = attendance.filter(r => targetScheduleIds.has(r.scheduleId))

    // 3. Map member stats
    const memberStatsMap = new Map<string, ServiceServerStat>()

    // Initialize all active members
    for (const member of members) {
      memberStatsMap.set(member.id, {
        memberId: member.id,
        name: getFullName(member),
        rank: member.rank || 'N/A',
        status: member.status || 'active',
        order: member.order || undefined,
        totalAssigned: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        otherServerCount: 0,
        totalServed: 0,
        rate: 0,
        serviceHistory: []
      })
    }

    // Process attendance records
    for (const record of targetRecords) {
      const schedule = targetScheduleMap.get(record.scheduleId)
      if (!schedule) continue

      let stat = memberStatsMap.get(record.memberId)
      if (!stat) {
        const m = members.find(mem => mem.id === record.memberId)
        stat = {
          memberId: record.memberId,
          name: m ? getFullName(m) : 'Unknown Member',
          rank: m?.rank || 'N/A',
          status: m?.status || 'active',
          order: m?.order || undefined,
          totalAssigned: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          otherServerCount: 0,
          totalServed: 0,
          rate: 0,
          serviceHistory: []
        }
        memberStatsMap.set(record.memberId, stat)
      }

      stat.totalAssigned += 1
      if (record.status === 'present') stat.present += 1
      else if (record.status === 'late') stat.late += 1
      else if (record.status === 'absent') stat.absent += 1
      else if (record.status === 'excused') stat.excused += 1

      if (record.isOtherServer) {
        stat.otherServerCount += 1
      }

      stat.serviceHistory.push({
        scheduleId: schedule.id,
        title: schedule.title,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        status: record.status,
        remarks: record.remarks,
        isOtherServer: record.isOtherServer
      })
    }

    // Calculate rates and totalServed for each member
    const allStats: ServiceServerStat[] = []
    let totalPresent = 0
    let totalLate = 0
    let totalAbsent = 0
    let totalExcused = 0
    let totalAssigned = 0

    for (const stat of memberStatsMap.values()) {
      stat.totalServed = stat.present + stat.late
      const validForRate = stat.present + stat.late + stat.absent
      stat.rate = validForRate > 0 ? Math.round(((stat.present + stat.late) / validForRate) * 100) : 0

      // Sort service history by date descending
      stat.serviceHistory.sort((a, b) => b.date.localeCompare(a.date))

      totalPresent += stat.present
      totalLate += stat.late
      totalAbsent += stat.absent
      totalExcused += stat.excused
      totalAssigned += stat.totalAssigned

      allStats.push(stat)
    }

    // Sort servers:
    // 1st Priority: Most served (totalServed descending)
    // 2nd Priority: Higher attendance rate (rate descending)
    // 3rd Priority: Alphabetical name
    allStats.sort((a, b) => {
      if (b.totalServed !== a.totalServed) {
        return b.totalServed - a.totalServed
      }
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      return a.name.localeCompare(b.name)
    })

    const totalServed = totalPresent + totalLate
    const totalValidAttendance = totalPresent + totalLate + totalAbsent
    const overallRate = totalValidAttendance > 0 ? Math.round((totalServed / totalValidAttendance) * 100) : 0
    const uniqueServersCount = allStats.filter(s => s.totalServed > 0).length

    return {
      category: effectiveCategory,
      categoryLabel,
      totalSchedules: targetSchedules.length,
      totalAssigned,
      totalServed,
      totalPresent,
      totalLate,
      totalAbsent,
      totalExcused,
      overallRate,
      uniqueServersCount,
      servers: allStats
    }
  },

  /**
   * Backward-compatible helper specifically for Holy Hour.
   */
  generateHolyHourReport(data: ReportRawData, customFilterKeyword?: string): HolyHourReportSummary {
    return this.generateServiceLeaderboardReport(
      data,
      customFilterKeyword ? 'custom' : 'holyhour',
      customFilterKeyword
    )
  }
}
