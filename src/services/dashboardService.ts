import { 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Schedule } from '@/types/schedule'
import type { AttendanceSession } from '@/types/attendance'
import { memberService } from './memberService'
import { getScheduleStatus, calculateMonthsBetween } from '@/utils/scheduleUtils'
import { publicationService } from './publicationService'
import { settingsService, type SuspensionPolicySettings } from './settingsService'
import { reportService } from './reportService'

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

export const dashboardService = {
  /**
   * Retrieves all dashboard statistics and recent activities efficiently.
   */
  async getDashboardData(userOrder?: string): Promise<{
    stats: DashboardStats
    todaySchedules: Schedule[]
    activities: ActivityLog[]
    monthBirthdays: BirthdayCelebrant[]
  }> {
    let attendanceSessions: AttendanceSession[] = []
    try {
      const sessionSnapshot = await getDocs(collection(db, 'attendanceSessions'))
      attendanceSessions = sessionSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceSession[]
    } catch (err) {
      console.warn('Could not load attendanceSessions for dashboard:', err)
    }

    const [allMembers, activePub, basePolicy] = await Promise.all([
      memberService.getMembers(true),
      publicationService.getActivePublication(),
      settingsService.getPolicySettings()
    ])

    // Calculate dates and active operating cycle policy
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const lastDayOfMonth = new Date(currentYear, currentMonthNum, 0).getDate()

    let startDate: string
    let endDate: string
    let activePolicy: SuspensionPolicySettings
    let operatingCycleTitle: string
    let operatingCycleMonths: number = 1

    if (activePub) {
      startDate = activePub.startDate
      endDate = activePub.endDate
      operatingCycleTitle = activePub.name
      operatingCycleMonths = calculateMonthsBetween(startDate, endDate)

      const defaultWarning = operatingCycleMonths === 2 ? 3 : operatingCycleMonths >= 3 ? 4 : 2
      const defaultSuspension = operatingCycleMonths === 2 ? 5 : operatingCycleMonths >= 3 ? 7 : 3

      activePolicy = {
        ...basePolicy,
        warningAbsenceThreshold: activePub.warningAbsenceThreshold ?? defaultWarning,
        suspensionAbsenceThreshold: activePub.suspensionAbsenceThreshold ?? defaultSuspension,
        evaluationMonths: operatingCycleMonths,
        includeSundays: activePub.includeSundays !== undefined ? activePub.includeSundays : basePolicy.includeSundays,
        includeWeekdays: activePub.includeWeekdays !== undefined ? activePub.includeWeekdays : basePolicy.includeWeekdays,
        includeMeetings: activePub.includeMeetings !== undefined ? activePub.includeMeetings : basePolicy.includeMeetings,
      }
    } else {
      startDate = `${currentMonthStr}-01`
      endDate = `${currentMonthStr}-${String(lastDayOfMonth).padStart(2, '0')}`
      operatingCycleTitle = 'This Month'
      operatingCycleMonths = basePolicy.evaluationMonths || 1
      activePolicy = basePolicy
    }

    let suspendedMembersCount = 0
    let userOrderSuspendedCount = 0
    let monthSchedules: Schedule[] = []

    const suspendedMemberIds = new Set<string>()
    const warningMemberIds = new Set<string>()

    // 1. Collect members whose profile status is explicitly / manually 'suspended' (as is)
    allMembers.forEach(m => {
      if (m.status === 'suspended') {
        const sStart = m.suspensionStartDate || ''
        const sEnd = m.suspensionEndDate || ''

        // Check if suspension period overlaps with current operating cycle
        const isSuspensionActiveThisPeriod = !sStart || (
          sStart <= endDate && (!sEnd || sEnd >= startDate)
        )

        if (isSuspensionActiveThisPeriod) {
          suspendedMemberIds.add(m.id)
        }
      }
    })

    // 2. Combine with dynamic attendance policy infractions for this cycle
    try {
      const reportData = await reportService.loadReportData(startDate, endDate, allMembers)
      monthSchedules = reportData.schedules
      const memberRows = reportService.generateMemberReport(reportData, activePolicy)
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
        return m?.order && m.order.toLowerCase().includes(userOrder.toLowerCase())
      }).length

      userOrderWarningCount = Array.from(warningMemberIds).filter(id => {
        const m = allMembers.find(mem => mem.id === id)
        return m?.order && m.order.toLowerCase().includes(userOrder.toLowerCase())
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
      operatingCycleMonths
    }

    // 2. Filter today's schedules
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    const todaySchedules = monthSchedules
      .filter(s => s.date === todayStr)
      // Sorted by startTime chronologically
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

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

    // Map schedule activities (up to 5 latest)
    const sortedSchedules = [...monthSchedules].sort((a, b) => {
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
    const currentDay = today.getDate()
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const monthBirthdays: BirthdayCelebrant[] = []

    allMembers
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

        if (bMonth === currentMonth && bDay && !isNaN(bDay) && bDay >= 1 && bDay <= 31) {
          const isToday = bDay === currentDay
          const daysRemaining = bDay - currentDay
          const isUpcoming = daysRemaining > 0
          const turningAge = bYear && bYear > 1900 && bYear <= currentYear ? currentYear - bYear : undefined

          const suffix = m.suffix ? ` ${m.suffix}` : ''
          const fullName = `${m.firstName}${m.middleName ? ` ${m.middleName[0]}.` : ''} ${m.lastName}${suffix}`

          monthBirthdays.push({
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

    // Sort birthdays: Today first, then upcoming (ascending by day), then passed (ascending by day)
    monthBirthdays.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1
      if (!a.isToday && b.isToday) return 1
      if (a.isUpcoming && !b.isUpcoming) return -1
      if (!a.isUpcoming && b.isUpcoming) return 1
      return a.birthDay - b.birthDay
    })

    return {
      stats,
      todaySchedules,
      activities: activities.slice(0, 10), // show up to top 10 latest activities
      monthBirthdays
    }
  },

  async getMyEventAssignments(identifier: string, uid?: string): Promise<any[]> {
    if (!identifier && !uid) return []
    
    // First, query all active events so we can map IDs to titles
    const eventsQuery = query(collection(db, 'events'), where('isArchived', '==', false))
    const eventsSnap = await getDocs(eventsQuery)
    const eventTitles: Record<string, string> = {}
    eventsSnap.forEach(doc => {
      eventTitles[doc.id] = doc.data().title
    })

    const assignmentsMap = new Map<string, any>()

    // Query by memberUid if provided
    if (uid) {
      const qUid = query(
        collection(db, 'eventAssignments'),
        where('memberUid', '==', uid)
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
      snapName.forEach(doc => {
        const data = doc.data()
        if (eventTitles[data.eventId]) {
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
