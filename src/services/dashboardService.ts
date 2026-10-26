import { 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { db } from '../firebase/config.ts'
import type { Schedule } from '../types/schedule.ts'
import type { AttendanceSession } from '../types/attendance.ts'
import type { Member } from '../types/member.ts'
import { getScheduleStatus, getParishTodayDate } from '../utils/scheduleUtils.ts'
import { publicationService } from './publicationService.ts'
import type { SuspensionPolicySettings } from './settingsService.ts'
import { scheduleService } from './scheduleService.ts'
import { resolveEvaluationContext } from '../utils/evaluationContext.ts'

export interface BirthdayCelebrant {
  id: string
  memberId: string
  fullName: string
  nickname?: string
  rank: string
  order?: string
  dateOfBirth: string
  birthMonth: number
  birthDay: number
  formattedDate: string
  isToday: boolean
  isUpcoming: boolean
  daysRemaining: number
  turningAge?: number
}

export interface DashboardStats {
  activeMembers: number
  archivedMembers: number
  suspendedMembersCount: number
  userOrderSuspendedCount: number
  warningMembersCount: number
  userOrderWarningCount: number
  userOrder?: string
  upcomingSchedules: number
  ongoingSchedules: number
  completedSchedules: number
  attendanceSessionsCount: number
  operatingCycleTitle?: string
  operatingCycleMonths?: number
  evaluationPeriodLabel?: string
  evaluationPeriodType?: 'regular_publication' | 'calendar_month'
}

export interface ActivityLog {
  id: string
  description: string
  timestamp: Date
}

const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date()
  if (typeof timestamp.toDate === 'function') return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000)
  return new Date(timestamp)
}

export interface DashboardDataDependencies {
  db?: any
  getAttendanceSessions?: () => Promise<AttendanceSession[]>
  getMembers?: (includeArchived?: boolean) => Promise<Member[]>
  getPublications?: () => Promise<any[]>
  getActivePublication?: (options?: any) => Promise<any>
  getPolicySettings?: () => Promise<SuspensionPolicySettings>
  loadReportData?: (startDate: string, endDate: string, members: Member[]) => Promise<any>
  generateMemberReport?: (data: any, policy: any) => any[]
  getSchedulesByDate?: (date: string) => Promise<Schedule[]>
  getSchedules?: () => Promise<Schedule[]>
}

export const dashboardService = {
  /**
   * Retrieves all dashboard statistics and recent activities efficiently.
   */
  async getDashboardData(userOrder?: string, deps: DashboardDataDependencies = {}): Promise<{
    stats: DashboardStats
    todaySchedules: Schedule[]
    activities: ActivityLog[]
    monthBirthdays: BirthdayCelebrant[]
    members: Member[]
  }> {
    let attendanceSessions: AttendanceSession[] = []
    if (deps.getAttendanceSessions) {
      try {
        attendanceSessions = await deps.getAttendanceSessions()
      } catch (err) {
        console.warn('Could not load attendanceSessions for dashboard:', err)
      }
    } else {
      try {
        const firestoreDb = deps.db || db
        const sessionSnapshot = await getDocs(collection(firestoreDb, 'attendanceSessions'))
        attendanceSessions = sessionSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AttendanceSession[]
      } catch (err) {
        console.warn('Could not load attendanceSessions for dashboard:', err)
      }
    }

    let allMembers: Member[]
    let basePolicy: SuspensionPolicySettings

    if (deps.getMembers) {
      allMembers = await deps.getMembers(true)
    } else {
      const { memberService } = await import('./memberService.ts')
      allMembers = await memberService.getMembers(true)
    }

    let publications: any[] = []
    if (deps.getPublications) {
      publications = await deps.getPublications()
    } else if (deps.getActivePublication) {
      const pub = await deps.getActivePublication({ regularOnly: true })
      if (pub) publications = [pub]
    } else {
      publications = await publicationService.getPublications(deps.db || db)
    }

    if (deps.getPolicySettings) {
      basePolicy = await deps.getPolicySettings()
    } else {
      const { settingsService } = await import('./settingsService.ts')
      basePolicy = await settingsService.getPolicySettings()
    }

    // Calculate dates and active operating cycle policy in Asia/Manila parish timezone
    const parishTodayStr = getParishTodayDate('Asia/Manila') // "YYYY-MM-DD"
    const [pYearStr, pMonthStr] = parishTodayStr.split('-')
    const currentYear = parseInt(pYearStr, 10)
    const currentMonthNum = parseInt(pMonthStr, 10)

    const resolvedContext = resolveEvaluationContext({
      publications,
      basePolicy,
      currentDate: parishTodayStr
    })

    const startDate = resolvedContext.startDate
    const endDate = resolvedContext.endDate
    const activePolicy = resolvedContext.policy
    const operatingCycleTitle = resolvedContext.periodLabel
    const operatingCycleMonths = resolvedContext.policy.evaluationMonths || 1
    const evaluationPeriodLabel = resolvedContext.publication
      ? `${resolvedContext.publication.name} (Regular Publication)`
      : resolvedContext.periodLabel
    const evaluationPeriodType = (resolvedContext.periodType === 'regular_publication' ? 'regular_publication' : 'calendar_month') as 'regular_publication' | 'calendar_month'

    let suspendedMembersCount = 0
    let userOrderSuspendedCount = 0
    let monthSchedules: Schedule[] = []

    const suspendedMemberIds = new Set<string>()
    const warningMemberIds = new Set<string>()

    // 1. Collect members whose profile status is explicitly / manually 'suspended'
    allMembers.forEach(m => {
      if (m.status === 'suspended') {
        suspendedMemberIds.add(m.id)
      }
    })

    // 2. Combine with dynamic attendance policy infractions for this cycle
    try {
      let reportData: any
      let memberRows: any[]

      if (deps.loadReportData) {
        reportData = await deps.loadReportData(startDate, endDate, allMembers)
      } else {
        const { reportService } = await import('./reportService.ts')
        reportData = await reportService.loadReportData(startDate, endDate, allMembers)
      }

      monthSchedules = reportData.schedules

      if (deps.generateMemberReport) {
        memberRows = deps.generateMemberReport(reportData, activePolicy)
      } else {
        const { reportService } = await import('./reportService.ts')
        memberRows = reportService.generateMemberReport(reportData, activePolicy)
      }
      memberRows.forEach(r => {
        if (r.warningStatus === 'suspended') {
          suspendedMemberIds.add(r.memberId)
        } else if (r.warningStatus === 'warning') {
          warningMemberIds.add(r.memberId)
        }
      })
    } catch (err) {
      console.warn('Could not calculate suspended and warning members count from reports:', err)
    }

    suspendedMembersCount = suspendedMemberIds.size
    const warningMembersCount = warningMemberIds.size
    let userOrderWarningCount = 0

    if (userOrder) {
      userOrderSuspendedCount = Array.from(suspendedMemberIds).filter(id => {
        const m = allMembers.find(mem => mem.id === id)
        const memberOrder = m?.order?.toLowerCase().trim()
        const targetOrder = userOrder.toLowerCase().trim()
        return memberOrder && (memberOrder.includes(targetOrder) || targetOrder.includes(memberOrder))
      }).length

      userOrderWarningCount = Array.from(warningMemberIds).filter(id => {
        const m = allMembers.find(mem => mem.id === id)
        const memberOrder = m?.order?.toLowerCase().trim()
        const targetOrder = userOrder.toLowerCase().trim()
        return memberOrder && (memberOrder.includes(targetOrder) || targetOrder.includes(memberOrder))
      }).length
    } else {
      userOrderSuspendedCount = suspendedMembersCount
      userOrderWarningCount = warningMembersCount
    }

    // 1. Calculate statistics
    const activeMembers = allMembers.filter(m => m.status === 'active').length
    const archivedMembers = allMembers.filter(m => m.status === 'archived').length

    let upcomingSchedules = 0
    let ongoingSchedules = 0
    let completedSchedules = 0

    monthSchedules.forEach((s) => {
      const status = getScheduleStatus(s)
      if (status === 'upcoming') upcomingSchedules++
      else if (status === 'ongoing') ongoingSchedules++
      else if (status === 'completed') completedSchedules++
    })

    const stats: DashboardStats = {
      activeMembers,
      archivedMembers,
      suspendedMembersCount,
      userOrderSuspendedCount,
      warningMembersCount,
      userOrderWarningCount,
      userOrder,
      upcomingSchedules,
      ongoingSchedules,
      completedSchedules,
      attendanceSessionsCount: attendanceSessions.length,
      operatingCycleTitle,
      operatingCycleMonths,
      evaluationPeriodLabel,
      evaluationPeriodType
    }

    // 2. Fetch today's duty roster independently for parishTodayStr (Asia/Manila)
    let todaySchedules: Schedule[] = []
    try {
      const directToday = deps.getSchedulesByDate
        ? await deps.getSchedulesByDate(parishTodayStr)
        : await scheduleService.getSchedulesByDate(parishTodayStr)
      // Merge with any today schedules from monthSchedules to ensure complete coverage without duplicates
      const mergedMap = new Map<string, Schedule>()
      monthSchedules.filter(s => s.date === parishTodayStr).forEach(s => mergedMap.set(s.id, s))
      directToday.forEach(s => mergedMap.set(s.id, s))
      todaySchedules = Array.from(mergedMap.values())
        .filter(s => s.status !== 'cancelled')
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    } catch (err) {
      console.warn('Could not load independent today schedules, falling back to monthSchedules:', err)
      todaySchedules = monthSchedules
        .filter(s => s.date === parishTodayStr && s.status !== 'cancelled')
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    }

    // 3. Formulate recent activities by combining members, schedules, and sessions
    const activities: ActivityLog[] = []

    // Map member activities (up to 5 latest)
    const sortedMembers = [...allMembers].sort((a, b) => {
      const dateA = toDate(a.updatedAt || a.createdAt).getTime()
      const dateB = toDate(b.updatedAt || b.createdAt).getTime()
      return dateB - dateA
    }).slice(0, 5)

    sortedMembers.forEach((m) => {
      const createdTime = toDate(m.createdAt).getTime()
      const updatedTime = toDate(m.updatedAt).getTime()
      const isNew = Math.abs(updatedTime - createdTime) < 5000
      activities.push({
        id: `member-${m.id}-${updatedTime}`,
        description: isNew 
          ? `Member added: ${m.firstName} ${m.lastName}`
          : `Member profile updated: ${m.firstName} ${m.lastName}`,
        timestamp: toDate(m.updatedAt || m.createdAt)
      })
    })

    // Fetch recent schedules (broad window not constrained to future publication)
    let recentScheduleSource = monthSchedules
    try {
      const recentWindowSchedules = deps.getSchedules
        ? await deps.getSchedules()
        : await scheduleService.getSchedules()
      if (recentWindowSchedules && recentWindowSchedules.length > 0) {
        recentScheduleSource = recentWindowSchedules
      }
    } catch {
      recentScheduleSource = monthSchedules
    }

    // Map schedule activities (up to 5 latest)
    const sortedSchedules = [...recentScheduleSource].sort((a, b) => {
      const dateA = toDate(a.updatedAt || a.createdAt).getTime()
      const dateB = toDate(b.updatedAt || b.createdAt).getTime()
      return dateB - dateA
    }).slice(0, 5)

    sortedSchedules.forEach((s) => {
      const createdTime = toDate(s.createdAt).getTime()
      const updatedTime = toDate(s.updatedAt).getTime()
      const isNew = Math.abs(updatedTime - createdTime) < 5000
      activities.push({
        id: `schedule-${s.id}-${updatedTime}`,
        description: isNew
          ? `Schedule created: "${s.title}" on ${s.date}`
          : `Schedule updated: "${s.title}" on ${s.date}`,
        timestamp: toDate(s.updatedAt || s.createdAt)
      })
    })

    // Map attendance session activities (up to 5 latest)
    const sortedSessions = [...attendanceSessions].sort((a, b) => {
      const dateA = toDate(a.updatedAt || a.createdAt).getTime()
      const dateB = toDate(b.updatedAt || b.createdAt).getTime()
      return dateB - dateA
    }).slice(0, 5)

    sortedSessions.forEach((session) => {
      const schedule = monthSchedules.find(s => s.id === session.scheduleId)
      const scheduleTitle = schedule ? schedule.title : 'Service'
      const dateStr = schedule ? schedule.date : ''
      const createdTime = toDate(session.createdAt).getTime()
      const updatedTime = toDate(session.updatedAt).getTime()
      const isNew = Math.abs(updatedTime - createdTime) < 5000

      let desc = `Attendance session updated for "${scheduleTitle}"`
      if (session.locked) {
        desc = `Attendance finalized & locked for "${scheduleTitle}" on ${dateStr}`
      } else if (isNew) {
        desc = `Attendance session initialized for "${scheduleTitle}" on ${dateStr}`
      } else {
        desc = `Attendance recorded for "${scheduleTitle}" on ${dateStr}`
      }

      activities.push({
        id: `session-${session.id}-${updatedTime}`,
        description: desc,
        timestamp: toDate(session.updatedAt || session.createdAt)
      })
    })

    // 4. Calculate Birthdays for the current month
    const currentMonth = currentMonthNum // 1-12
    const currentYearNum = currentYear
    const monthBirthdays = this.calculateBirthdaysForMonth(allMembers, currentMonth, currentYearNum, 'day')

    return {
      stats,
      todaySchedules,
      activities: activities.slice(0, 10), // show up to top 10 latest activities
      monthBirthdays,
      members: allMembers
    }
  },

  /**
   * Calculates birthday celebrants for any target month (1-12) and year in Asia/Manila parish timezone.
   */
  calculateBirthdaysForMonth(
    members: Member[],
    targetMonth: number,
    targetYear?: number,
    sortMode: 'day' | 'name' | 'order' = 'day'
  ): BirthdayCelebrant[] {
    const parishTodayStr = getParishTodayDate('Asia/Manila')
    const [pYearStr, pMonthStr, pDayStr] = parishTodayStr.split('-')
    const currentYear = parseInt(pYearStr, 10)
    const currentMonthNum = parseInt(pMonthStr, 10)
    const currentDay = parseInt(pDayStr, 10)
    const resolvedTargetYear = targetYear ?? currentYear
    const todayDateOnly = new Date(currentYear, currentMonthNum - 1, currentDay)

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const list: BirthdayCelebrant[] = []

    members
      .filter(m => m.status === 'active' && m.dateOfBirth)
      .forEach(m => {
        const rawDob = (m.dateOfBirth || '').trim()
        if (!rawDob) return

        let bYear: number | undefined
        let bMonth: number | undefined
        let bDay: number | undefined

        // Case 1: YYYY-MM-DD
        if (/^\d{4}-\d{1,2}-\d{1,2}/.test(rawDob)) {
          const parts = rawDob.split('T')[0].split('-')
          bYear = parseInt(parts[0], 10)
          bMonth = parseInt(parts[1], 10)
          bDay = parseInt(parts[2], 10)
        } 
        // Case 2: MM/DD/YYYY or M/D/YYYY
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawDob)) {
          const parts = rawDob.split('/')
          bMonth = parseInt(parts[0], 10)
          bDay = parseInt(parts[1], 10)
          bYear = parseInt(parts[2], 10)
        }
        // Case 3: Standard Date parse fallback
        else {
          const parsed = new Date(rawDob)
          if (!isNaN(parsed.getTime())) {
            bYear = parsed.getFullYear()
            bMonth = parsed.getMonth() + 1
            bDay = parsed.getDate()
          }
        }

        if (bMonth === targetMonth && bDay && !isNaN(bDay) && bDay >= 1 && bDay <= 31) {
          const isCurrentMonth = targetMonth === currentMonthNum && resolvedTargetYear === currentYear
          const isToday = isCurrentMonth && bDay === currentDay

          // Target birthday date in resolvedTargetYear
          const targetBirthdayDate = new Date(resolvedTargetYear, targetMonth - 1, bDay)
          const diffTime = targetBirthdayDate.getTime() - todayDateOnly.getTime()
          const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          const isUpcoming = daysRemaining > 0
          const turningAge = bYear && bYear > 1900 && bYear <= resolvedTargetYear ? resolvedTargetYear - bYear : undefined

          const suffix = m.suffix ? ` ${m.suffix}` : ''
          const fullName = `${m.firstName}${m.middleName ? ` ${m.middleName[0]}.` : ''} ${m.lastName}${suffix}`

          list.push({
            id: m.id,
            memberId: m.id,
            fullName,
            nickname: m.nickname,
            rank: m.rank,
            order: m.order,
            dateOfBirth: rawDob,
            birthMonth: bMonth,
            birthDay: bDay,
            formattedDate: `${monthNames[bMonth - 1]} ${bDay}`,
            isToday,
            isUpcoming,
            daysRemaining,
            turningAge
          })
        }
      })

    // Sort according to sortMode
    if (sortMode === 'name') {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName))
    } else if (sortMode === 'order') {
      list.sort((a, b) => (a.order || '').localeCompare(b.order || '') || a.birthDay - b.birthDay)
    } else {
      // Default: Day sort (Today first if current month, then ascending by day)
      list.sort((a, b) => {
        if (a.isToday && !b.isToday) return -1
        if (!a.isToday && b.isToday) return 1
        return a.birthDay - b.birthDay
      })
    }

    return list
  },

  async getMyEventAssignments(identifier: string, uid?: string, memberId?: string): Promise<any[]> {
    if (!identifier && !uid && !memberId) return []
    
    // First, query all active events so we can map IDs to titles
    const eventsQuery = query(collection(db, 'events'), where('isArchived', '==', false))
    const eventsSnap = await getDocs(eventsQuery)
    const eventTitles: Record<string, string> = {}
    eventsSnap.forEach(doc => {
      eventTitles[doc.id] = doc.data().title
    })

    const assignmentsMap = new Map<string, any>()

    // Query by memberUid if provided
      if (uid || memberId) {
      const qUid = query(
        collection(db, 'eventAssignments'),
          where('memberUid', 'in', [...new Set([uid, memberId].filter(Boolean))])
      )
      const snapUid = await getDocs(qUid)
      snapUid.forEach(doc => {
        const data = doc.data()
        if (eventTitles[data.eventId]) {
          assignmentsMap.set(doc.id, { id: doc.id, ...data, eventTitle: eventTitles[data.eventId] })
        }
      })
    }

    // Query by memberName / displayName if provided
    if (identifier) {
      const qName = query(
        collection(db, 'eventAssignments'),
        where('memberName', '==', identifier)
      )
      const snapName = await getDocs(qName)
      const matchingMemberIds = new Set(snapName.docs.filter(document => eventTitles[document.data().eventId]).map(document => document.data().memberUid))
      snapName.forEach(doc => {
        const data = doc.data()
        const matchesIdentity = data.memberUid === uid || data.memberUid === memberId || (!memberId && matchingMemberIds.size === 1)
        if (eventTitles[data.eventId] && matchesIdentity) {
          assignmentsMap.set(doc.id, { id: doc.id, ...data, eventTitle: eventTitles[data.eventId] })
        }
      })
    }

    return Array.from(assignmentsMap.values())
  },

  async getMyUnreadTasksCount(displayName: string): Promise<number> {
    if (!displayName) return 0
    try {
      const q = query(
        collection(db, 'eventTasks'),
        where('assignedMemberName', '==', displayName),
        where('unreadByAssignee', '==', true),
        where('isArchived', '==', false)
      )
      const snapshot = await getDocs(q)
      return snapshot.size
    } catch (err) {
      console.error(err)
      return 0
    }
  }
}
