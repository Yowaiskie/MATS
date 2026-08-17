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
import { getScheduleStatus } from '@/utils/scheduleUtils'

import { reportService } from './reportService'

export interface DashboardStats {
  activeMembers: number
  archivedMembers: number
  suspendedMembersCount: number
  userOrderSuspendedCount: number
  userOrder?: string
  upcomingSchedules: number
  ongoingSchedules: number
  completedSchedules: number
  attendanceSessionsCount: number
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

    const allMembers = await memberService.getMembers(true)

    // Calculate dates for current month
    const today = new Date()
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const startDate = `${currentMonthStr}-01`
    const endDate = `${currentMonthStr}-31`
    let suspendedMembersCount = 0
    let userOrderSuspendedCount = 0
    let monthSchedules: Schedule[] = []

    try {
      const reportData = await reportService.loadReportData(startDate, endDate, allMembers)
      monthSchedules = reportData.schedules
      const memberRows = reportService.generateMemberReport(reportData)
      const allSuspended = memberRows.filter(r => r.warningStatus === 'suspended')
      suspendedMembersCount = allSuspended.length

      if (userOrder) {
        userOrderSuspendedCount = allSuspended.filter(r => {
          const m = allMembers.find(mem => mem.id === r.memberId)
          return m?.order && m.order.toLowerCase().includes(userOrder.toLowerCase())
        }).length
      } else {
        userOrderSuspendedCount = suspendedMembersCount
      }
    } catch (err) {
      console.warn('Could not calculate suspended members count:', err)
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
      userOrder,
      upcomingSchedules,
      ongoingSchedules,
      completedSchedules,
      attendanceSessionsCount: attendanceSessions.length
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

    // Sort combined activities by timestamp descending
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return {
      stats,
      todaySchedules,
      activities: activities.slice(0, 10) // show up to top 10 latest activities
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
