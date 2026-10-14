import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where, type DocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { AttendanceRecord, AttendanceSession, AttendanceStatus } from '@/types/attendance'
import type { Schedule } from '@/types/schedule'
import type { UserProfile } from '@/types/auth'
import { scheduleService } from '@/services/scheduleService'
import { attendanceService } from '@/services/attendanceService'

const VALID_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'observer', 'formation', 'alumni']
export interface BulkAttendanceItem {
  scheduleId: string
  title: string
  date: string
  eligible: boolean
  reason: string
  result?: 'finalized' | 'skipped' | 'failed'
}

function validate(schedule: Schedule, session: AttendanceSession | null, records: AttendanceRecord[], now = new Date()): string | null {
  if (schedule.status === 'cancelled') return 'Schedule is cancelled.'
  const end = Date.parse(`${schedule.date}T${schedule.endTime}:00+08:00`)
  if (!Number.isFinite(end) || end >= now.getTime()) return 'Schedule has not ended.'
  if (!session) return 'No saved attendance session.'
  if (session.locked) return 'Already finalized and locked.'
  if (!records.length) return 'No saved attendance records.'
  const expected = new Set([...(schedule.assignedMembers || []), ...records.filter(r => r.isOtherServer).map(r => r.memberId)])
  if (!expected.size) return 'No assigned or Other Servers.'
  for (const memberId of expected) {
    const matches = records.filter(r => r.memberId === memberId)
    if (matches.length !== 1 || !VALID_STATUSES.includes(matches[0].status)) return 'Missing, duplicate, or invalid attendance status.'
  }
  if (records.some(r => r.sessionId !== session.id || r.scheduleId !== schedule.id || !expected.has(r.memberId) || !VALID_STATUSES.includes(r.status))) return 'Attendance records do not match the current roster.'
  return null
}

async function load(scheduleId: string) {
  const [scheduleSnap, sessions] = await Promise.all([
    getDoc(doc(db, 'schedules', scheduleId)), getDocs(query(collection(db, 'attendanceSessions'), where('scheduleId', '==', scheduleId)))
  ])
  const schedule = scheduleSnap.exists() ? { ...scheduleSnap.data(), id: scheduleId } as Schedule : null
  const sessionSnap = sessions.docs[0] as DocumentSnapshot | undefined
  const session = sessionSnap?.exists() ? { ...sessionSnap.data(), id: sessionSnap.id } as AttendanceSession : null
  const recordSnaps = session ? (await getDocs(query(collection(db, 'attendance'), where('sessionId', '==', session.id)))).docs : []
  const records = recordSnaps.map(r => ({ ...r.data(), id: r.id }) as AttendanceRecord)
  let reason = !schedule ? 'Schedule no longer exists.' : sessions.size > 1 ? 'Multiple attendance sessions require review.' : validate(schedule, session, records)
  if (!reason) {
    const memberIds = [...new Set(records.map(record => record.memberId))]
    const members = await Promise.all(memberIds.map(id => getDoc(doc(db, 'members', id))))
    if (members.some(member => !member.exists())) reason = 'A member record is missing. Review attendance first.'
  }
  return { schedule, session, sessionSnap, recordSnaps, reason }
}

function canFinalize(profile: UserProfile): boolean {
  return ['admin', 'coordinator'].includes(profile.role) || profile.permissions?.canFinalizeAttendance === true
}

export const bulkAttendanceService = {
  async previewUnfinalized(): Promise<BulkAttendanceItem[]> {
    const [schedules, sessions] = await Promise.all([
      scheduleService.getSchedules(), attendanceService.getAllSessions()
    ])
    const now = Date.now()
    const pendingIds = schedules.filter(schedule => {
      const end = Date.parse(`${schedule.date}T${schedule.endTime}:00+08:00`)
      return schedule.status !== 'cancelled' && Number.isFinite(end) && end < now
        && !sessions.some(session => session.scheduleId === schedule.id && session.locked)
    }).map(schedule => schedule.id)
    const items = await bulkAttendanceService.preview(pendingIds)
    return items.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.date.localeCompare(b.date))
  },

  async preview(scheduleIds: string[]): Promise<BulkAttendanceItem[]> {
    const results: BulkAttendanceItem[] = []
    for (const scheduleId of new Set(scheduleIds)) {
      try {
        const data = await load(scheduleId)
        results.push({ scheduleId, title: data.schedule?.title || 'Missing schedule', date: data.schedule?.date || '', eligible: !data.reason, reason: data.reason || 'Ready to finalize.' })
      } catch (error) {
        results.push({ scheduleId, title: 'Schedule', date: '', eligible: false, reason: error instanceof Error ? error.message : 'Could not check attendance.' })
      }
    }
    return results
  },

  async finalize(scheduleId: string): Promise<BulkAttendanceItem> {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Sign in to finalize attendance.')
    const actor = auth.currentUser?.email || uid
    const data = await load(scheduleId)
    const base = { scheduleId, title: data.schedule?.title || 'Schedule', date: data.schedule?.date || '', eligible: false }
    if (data.reason || !data.schedule || !data.session || !data.sessionSnap) return { ...base, result: 'skipped', reason: data.reason || 'Attendance unavailable.' }
    const sessionRef = doc(db, 'attendanceSessions', data.session.id)
    const reason = await runTransaction(db, async transaction => {
      const [profileSnap, scheduleSnap, sessionSnap, ...recordSnaps] = await Promise.all([
        transaction.get(doc(db, 'users', uid)), transaction.get(doc(db, 'schedules', scheduleId)), transaction.get(sessionRef),
        ...data.recordSnaps.map(record => transaction.get(record.ref))
      ])
      if (auth.currentUser?.uid !== uid || !profileSnap.exists() || !canFinalize(profileSnap.data() as UserProfile)) throw new Error('You do not have permission to finalize attendance.')
      if (!scheduleSnap.exists() || !sessionSnap.exists()) return 'Schedule or attendance session was removed.'
      if (JSON.stringify(sessionSnap.data().updatedAt) !== JSON.stringify(data.sessionSnap!.data()?.updatedAt)) return 'Attendance changed during preview. Check and retry.'
      const schedule = { ...scheduleSnap.data(), id: scheduleId } as Schedule
      const session = { ...sessionSnap.data(), id: sessionSnap.id } as AttendanceSession
      const records = recordSnaps.filter(snap => snap.exists()).map(snap => ({ ...snap.data(), id: snap.id }) as AttendanceRecord)
      const invalid = validate(schedule, session, records)
      if (invalid) return invalid
      const memberIds = [...new Set(records.map(record => record.memberId))]
      const members = await Promise.all(memberIds.map(id => transaction.get(doc(db, 'members', id))))
      if (members.some(member => !member.exists())) return 'A member record is missing. Review attendance first.'
      transaction.update(sessionRef, { locked: true, finalizedAt: serverTimestamp(), finalizedBy: actor, updatedAt: serverTimestamp() })
      return null
    })
    if (reason) return { ...base, result: 'skipped', reason }
    await auditService.logAction('ATTENDANCE_LOCK', 'attendance', `Bulk finalized and locked attendance for '${base.title}'`, actor, { sessionId: data.session.id, scheduleId, scheduleTitle: base.title, lockState: 'Finalized & Locked', bulk: true })
    return { ...base, result: 'finalized', reason: 'Finalized and locked.' }
  }
}
