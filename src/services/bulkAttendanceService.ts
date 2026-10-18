import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { AttendanceRecord, AttendanceSession, AttendanceStatus } from '@/types/attendance'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { UserProfile } from '@/types/auth'
import { scheduleService } from '@/services/scheduleService'
import { attendanceService } from '@/services/attendanceService'
import { memberService } from '@/services/memberService'
import { getFullName } from '@/utils/member'

const VALID_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'observer', 'formation', 'alumni']

export interface BulkAttendanceItem {
  scheduleId: string
  sessionId?: string
  title: string
  date: string
  time: string
  order?: string
  totalServers: number
  recordedCount: number
  statusCounts: {
    present: number
    late: number
    absent: number
    excused: number
    observer: number
    formation: number
    alumni: number
  }
  unmarkedMemberIds: string[]
  unmarkedMemberNames: string[]
  isFinalized: boolean
  finalizedBy?: string | null
  finalizedAt?: string | null
  eligible: boolean
  reason: string
  result?: 'finalized' | 'skipped' | 'failed'
}

function getTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCurrentTimeStr(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

function canFinalize(profile: UserProfile): boolean {
  return ['admin', 'coordinator'].includes(profile.role) || profile.permissions?.canFinalizeAttendance === true
}

export const bulkAttendanceService = {
  /**
   * Evaluates past schedules and their attendance sessions.
   * Supports optional date filtering and status inspection.
   */
  async previewSessions(options?: {
    startDate?: string
    endDate?: string
    scheduleIds?: string[]
    onProgress?: (processed: number, total: number) => void
  }): Promise<BulkAttendanceItem[]> {
    const todayStr = getTodayStr()
    const currentTimeStr = getCurrentTimeStr()

    // 1. Fetch schedules, sessions, and members in parallel
    // If date bounds are provided, use getSchedulesByDateRange to limit read quota
    const past30DaysStr = (() => {
      const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()

    // Determine query date window to avoid scanning entire history
    const effectiveStartDate = options?.startDate || (options?.scheduleIds && options.scheduleIds.length > 0 ? undefined : past30DaysStr)
    const effectiveEndDate = options?.endDate || todayStr

    const [allSchedules, allSessions, allMembers] = await Promise.all([
      effectiveStartDate
        ? scheduleService.getSchedulesByDateRange(effectiveStartDate, effectiveEndDate)
        : scheduleService.getSchedules(),
      attendanceService.getAllSessions(),
      memberService.getMembers(true)
    ])

    const memberMap = new Map<string, Member>()
    allMembers.forEach(m => memberMap.set(m.id, m))

    const sessionByScheduleId = new Map<string, AttendanceSession>()
    allSessions.forEach(s => {
      if (s.scheduleId) {
        sessionByScheduleId.set(s.scheduleId, s)
      }
    })

    // 2. Filter target schedules (must be past/completed schedules and not cancelled)
    const candidateSchedules = allSchedules.filter(s => {
      if (s.status === 'cancelled') return false
      if (options?.scheduleIds && options.scheduleIds.length > 0) {
        return options.scheduleIds.includes(s.id)
      }

      // Check date bounds
      if (options?.startDate && s.date < options.startDate) return false
      if (options?.endDate && s.date > options.endDate) return false

      // Must be in the past
      if (s.date < todayStr) return true
      if (s.date === todayStr) {
        const scheduleEndTime = s.endTime || s.startTime || '23:59'
        return currentTimeStr >= scheduleEndTime
      }
      return false
    })

    // Sort: newest past dates first
    candidateSchedules.sort((a, b) => b.date.localeCompare(a.date))

    const total = candidateSchedules.length
    let processed = 0

    // 3. OPTIMIZED BATCH QUERY: Identify sessions that actually need attendance records checked
    // We SKIP querying attendance for:
    //  - schedules with no session created yet
    //  - schedules with 0 assigned members (direct eligible)
    //  - sessions that are already locked/finalized
    const sessionIdsToQuery: string[] = []
    for (const schedule of candidateSchedules) {
      const assignedCount = (schedule.assignedMembers || []).length
      const session = sessionByScheduleId.get(schedule.id)
      if (session && !session.locked && assignedCount > 0) {
        sessionIdsToQuery.push(session.id)
      }
    }

    // Fetch attendance records in chunks of 30 session IDs using `where('sessionId', 'in', chunk)`
    // This replaces 100+ separate getDocs queries with just 1-3 batch queries!
    const recordsBySessionId = new Map<string, AttendanceRecord[]>()
    const CHUNK_SIZE = 30
    for (let i = 0; i < sessionIdsToQuery.length; i += CHUNK_SIZE) {
      const chunk = sessionIdsToQuery.slice(i, i + CHUNK_SIZE)
      const q = query(collection(db, 'attendance'), where('sessionId', 'in', chunk))
      const snap = await getDocs(q)
      snap.docs.forEach(d => {
        const rec = { id: d.id, ...d.data() } as AttendanceRecord
        const list = recordsBySessionId.get(rec.sessionId) || []
        list.push(rec)
        recordsBySessionId.set(rec.sessionId, list)
      })
    }

    const results: BulkAttendanceItem[] = []

    // 4. Assemble preview items in-memory without further Firestore queries
    for (const schedule of candidateSchedules) {
      const assignedIds = schedule.assignedMembers || []
      const session = sessionByScheduleId.get(schedule.id)

      const statusCounts = {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        observer: 0,
        formation: 0,
        alumni: 0
      }

      if (!session) {
        // No session created yet
        const unmarkedNames = assignedIds
          .map(id => {
            const m = memberMap.get(id)
            return m ? getFullName(m) : `Server (${id.slice(0, 5)})`
          })

        const hasZeroServers = assignedIds.length === 0
        results.push({
          scheduleId: schedule.id,
          title: schedule.title,
          date: schedule.date,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          order: schedule.title.includes('(') ? schedule.title.split('(')[1]?.replace(')', '') : 'All Orders',
          totalServers: assignedIds.length,
          recordedCount: 0,
          statusCounts,
          unmarkedMemberIds: assignedIds,
          unmarkedMemberNames: unmarkedNames,
          isFinalized: false,
          eligible: hasZeroServers,
          reason: hasZeroServers
            ? 'Ready to finalize (no servers assigned).'
            : 'Untaken: Attendance session has not been saved yet.'
        })
      } else if (session.locked) {
        // Already locked - no need to parse individual attendance records
        let formattedFinalizedAt: string | null = null
        if (session.finalizedAt) {
          const ts = session.finalizedAt as any
          if (typeof ts.toDate === 'function') {
            formattedFinalizedAt = ts.toDate().toLocaleDateString()
          } else if (ts.seconds) {
            formattedFinalizedAt = new Date(ts.seconds * 1000).toLocaleDateString()
          }
        }

        results.push({
          scheduleId: schedule.id,
          sessionId: session.id,
          title: schedule.title,
          date: schedule.date,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          order: schedule.title.includes('(') ? schedule.title.split('(')[1]?.replace(')', '') : 'All Orders',
          totalServers: assignedIds.length,
          recordedCount: assignedIds.length,
          statusCounts,
          unmarkedMemberIds: [],
          unmarkedMemberNames: [],
          isFinalized: true,
          finalizedBy: session.finalizedBy,
          finalizedAt: formattedFinalizedAt,
          eligible: false,
          reason: 'Already finalized and locked.'
        })
      } else {
        // Active unlocked session - use the in-memory batched records
        const records = recordsBySessionId.get(session.id) || []
        const recordedMemberIds = new Set<string>()

        records.forEach(r => {
          if (r.status && VALID_STATUSES.includes(r.status)) {
            recordedMemberIds.add(r.memberId)
            if (statusCounts[r.status] !== undefined) {
              statusCounts[r.status]++
            }
          }
        })

        // Combine assigned members + other servers who were added to the session
        const allExpectedIds = new Set([
          ...assignedIds,
          ...records.filter(r => r.isOtherServer).map(r => r.memberId)
        ])

        const totalExpectedCount = allExpectedIds.size
        const unmarkedIds = Array.from(allExpectedIds).filter(id => !recordedMemberIds.has(id))
        const unmarkedNames = unmarkedIds.map(id => {
          const m = memberMap.get(id)
          return m ? getFullName(m) : `Server (${id.slice(0, 5)})`
        })

        const isEligible = unmarkedIds.length === 0

        let reason = ''
        if (unmarkedIds.length > 0) {
          reason = `${unmarkedIds.length} server(s) unmarked (${unmarkedNames.slice(0, 3).join(', ')}${unmarkedNames.length > 3 ? '...' : ''}).`
        } else if (totalExpectedCount === 0) {
          reason = 'Ready to finalize (no servers assigned).'
        } else {
          reason = 'Ready to finalize.'
        }

        results.push({
          scheduleId: schedule.id,
          sessionId: session.id,
          title: schedule.title,
          date: schedule.date,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          order: schedule.title.includes('(') ? schedule.title.split('(')[1]?.replace(')', '') : 'All Orders',
          totalServers: totalExpectedCount,
          recordedCount: recordedMemberIds.size,
          statusCounts,
          unmarkedMemberIds: unmarkedIds,
          unmarkedMemberNames: unmarkedNames,
          isFinalized: false,
          finalizedBy: session.finalizedBy,
          finalizedAt: null,
          eligible: isEligible,
          reason
        })
      }

      processed++
      if (options?.onProgress) {
        options.onProgress(processed, total)
      }
    }

    return results
  },

  /**
   * Backward-compatible helper for existing calls
   */
  async previewUnfinalized(): Promise<BulkAttendanceItem[]> {
    return this.previewSessions()
  },

  /**
   * Backward-compatible helper for specific schedule IDs
   */
  async preview(scheduleIds: string[]): Promise<BulkAttendanceItem[]> {
    return this.previewSessions({ scheduleIds })
  },

  /**
   * Quick Resolver: Automatically marks remaining unmarked servers for a schedule as 'absent'
   * so the session immediately becomes eligible for finalization.
   */
  async autoMarkUnmarkedAsAbsent(scheduleId: string, performedBy = 'Admin'): Promise<void> {
    const session = await attendanceService.getOrCreateSession(scheduleId)
    const scheduleSnap = await getDoc(doc(db, 'schedules', scheduleId))
    if (!scheduleSnap.exists()) throw new Error('Schedule record not found.')
    const schedule = scheduleSnap.data() as Schedule

    const records = await attendanceService.getAttendanceForSession(session.id)
    const existingRecordedMemberIds = new Set(
      records.filter(r => r.status && VALID_STATUSES.includes(r.status)).map(r => r.memberId)
    )

    const assignedIds = schedule.assignedMembers || []
    const unmarkedAssignedIds = assignedIds.filter(id => !existingRecordedMemberIds.has(id))

    if (unmarkedAssignedIds.length === 0) return

    const batch = writeBatch(db)

    unmarkedAssignedIds.forEach(memberId => {
      const existingDoc = records.find(r => r.memberId === memberId)
      if (existingDoc) {
        batch.update(doc(db, 'attendance', existingDoc.id), {
          status: 'absent',
          remarks: 'Auto-marked absent during bulk review',
          updatedAt: serverTimestamp()
        })
      } else {
        const newRef = doc(collection(db, 'attendance'))
        batch.set(newRef, {
          sessionId: session.id,
          scheduleId,
          memberId,
          status: 'absent',
          remarks: 'Auto-marked absent during bulk review',
          attendanceDate: schedule.date,
          isOtherServer: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }
    })

    batch.update(doc(db, 'attendanceSessions', session.id), {
      hasRecords: true,
      lastUpdatedBy: performedBy,
      lastUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    await batch.commit()

    await auditService.logAction(
      'ATTENDANCE_SAVE',
      'attendance',
      `Auto-marked ${unmarkedAssignedIds.length} unmarked servers as absent for '${schedule.title}'`,
      performedBy,
      { scheduleId, sessionId: session.id, autoMarkedCount: unmarkedAssignedIds.length }
    )
  },

  /**
   * Finalizes and locks an attendance session and its parent schedule.
   */
  async finalize(scheduleId: string, performedBy?: string): Promise<BulkAttendanceItem> {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Sign in to finalize attendance.')
    const actor = performedBy || auth.currentUser?.email || uid

    const userSnap = await getDoc(doc(db, 'users', uid))
    if (!userSnap.exists() || !canFinalize(userSnap.data() as UserProfile)) {
      throw new Error('You do not have permission to finalize attendance.')
    }

    const [scheduleSnap, sessionDoc] = await Promise.all([
      getDoc(doc(db, 'schedules', scheduleId)),
      attendanceService.getOrCreateSession(scheduleId)
    ])

    if (!scheduleSnap.exists()) throw new Error('Schedule no longer exists.')
    const schedule = scheduleSnap.data() as Schedule

    if (sessionDoc.locked) {
      return {
        scheduleId,
        title: schedule.title,
        date: schedule.date,
        time: `${schedule.startTime} - ${schedule.endTime}`,
        totalServers: (schedule.assignedMembers || []).length,
        recordedCount: (schedule.assignedMembers || []).length,
        statusCounts: { present: 0, late: 0, absent: 0, excused: 0, observer: 0, formation: 0, alumni: 0 },
        unmarkedMemberIds: [],
        unmarkedMemberNames: [],
        isFinalized: true,
        eligible: false,
        reason: 'Already finalized and locked.',
        result: 'finalized'
      }
    }

    // Lock the attendance session
    const sessionRef = doc(db, 'attendanceSessions', sessionDoc.id)
    await updateDoc(sessionRef, {
      locked: true,
      finalizedAt: serverTimestamp(),
      finalizedBy: actor,
      updatedAt: serverTimestamp()
    })

    // Sync lock status to schedule document
    const scheduleRef = doc(db, 'schedules', scheduleId)
    await updateDoc(scheduleRef, {
      isLocked: true,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'ATTENDANCE_LOCK',
      'attendance',
      `Bulk finalized and locked attendance for '${schedule.title}'`,
      actor,
      { sessionId: sessionDoc.id, scheduleId, scheduleTitle: schedule.title, lockState: 'Finalized & Locked', bulk: true }
    )

    return {
      scheduleId,
      sessionId: sessionDoc.id,
      title: schedule.title,
      date: schedule.date,
      time: `${schedule.startTime} - ${schedule.endTime}`,
      totalServers: (schedule.assignedMembers || []).length,
      recordedCount: (schedule.assignedMembers || []).length,
      statusCounts: { present: 0, late: 0, absent: 0, excused: 0, observer: 0, formation: 0, alumni: 0 },
      unmarkedMemberIds: [],
      unmarkedMemberNames: [],
      isFinalized: true,
      eligible: false,
      reason: 'Finalized and locked.',
      result: 'finalized'
    }
  }
}
