import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  writeBatch,
  serverTimestamp,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { AttendanceSession, AttendanceRecord, AttendanceInput, AttendanceStatus } from '@/types/attendance'
import { auditService } from '@/services/auditService'

const SESSIONS_COLLECTION = 'attendanceSessions'
const ATTENDANCE_COLLECTION = 'attendance'

export const attendanceService = {
  /**
   * Fetches or automatically initializes an attendance session for a given schedule.
   */
  async getOrCreateSession(scheduleId: string): Promise<AttendanceSession> {
    const sessionsRef = collection(db, SESSIONS_COLLECTION)
    const q = query(sessionsRef, where('scheduleId', '==', scheduleId))
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      const docData = snapshot.docs[0]
      return {
        id: docData.id,
        ...docData.data()
      } as AttendanceSession
    }

    // Auto-create new session
    const docRef = await addDoc(sessionsRef, {
      scheduleId,
      locked: false,
      hasRecords: false,
      finalizedAt: null,
      finalizedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    const newDoc = await getDoc(docRef)
    return {
      id: newDoc.id,
      ...newDoc.data()
    } as AttendanceSession
  },

  /**
   * Retrieves all attendance records for a specific session.
   */
  async getAttendanceForSession(sessionId: string): Promise<AttendanceRecord[]> {
    const attendanceRef = collection(db, ATTENDANCE_COLLECTION)
    const q = query(attendanceRef, where('sessionId', '==', sessionId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceRecord[]
  },

  /**
   * Saves attendance records inside a chunked sequential batch write.
   */
  async saveAttendanceRecords(
    sessionId: string,
    scheduleId: string,
    date: string,
    inputs: AttendanceInput[],
    performedBy = 'System',
    scheduleTitle?: string
  ): Promise<void> {
    // 1. Verify if session is locked
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId)
    const sessionSnap = await getDoc(sessionRef)
    if (!sessionSnap.exists()) {
      throw new Error('Attendance session not found.')
    }
    if ((sessionSnap.data() as AttendanceSession).locked) {
      throw new Error('This attendance session is locked and cannot be modified.')
    }

    if (inputs.length === 0) return

    const BATCH_SIZE_LIMIT = 500
    const attendanceRef = collection(db, ATTENDANCE_COLLECTION)

    // 2. Commit batch operations sequentially
    for (let i = 0; i < inputs.length; i += BATCH_SIZE_LIMIT) {
      const chunk = inputs.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)

      chunk.forEach((input) => {
        if (input.id) {
          // Update existing document
          const docRef = doc(db, ATTENDANCE_COLLECTION, input.id)
          batch.update(docRef, {
            status: input.status,
            remarks: input.remarks?.trim() || '',
            isOtherServer: input.isOtherServer ?? false,
            updatedAt: serverTimestamp()
          })
        } else {
          // Add new document
          const newDocRef = doc(attendanceRef)
          batch.set(newDocRef, {
            sessionId,
            scheduleId,
            memberId: input.memberId,
            status: input.status,
            remarks: input.remarks?.trim() || '',
            attendanceDate: date,
            isOtherServer: input.isOtherServer ?? false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }
      })

      await batch.commit()
    }

    // 3. Mark update timestamp & last updated user on parent session
    await updateDoc(sessionRef, {
      hasRecords: true,
      lastUpdatedBy: performedBy,
      lastUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    const titleStr = scheduleTitle ? `'${scheduleTitle}'` : `schedule (${date})`

    await auditService.logAction(
      'ATTENDANCE_SAVE',
      'attendance',
      `Saved ${inputs.length} attendance records for ${titleStr}`,
      performedBy,
      { sessionId, scheduleId, scheduleTitle, date, recordCount: inputs.length }
    )
  },

  /**
   * Locks or unlocks an attendance session.
   */
  async setSessionLockState(
    sessionId: string,
    locked: boolean,
    adminEmail: string | null,
    scheduleTitle?: string
  ): Promise<void> {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId)
    await updateDoc(sessionRef, {
      locked,
      finalizedAt: locked ? serverTimestamp() : null,
      finalizedBy: locked ? adminEmail : null,
      updatedAt: serverTimestamp()
    })

    const titleStr = scheduleTitle ? ` for '${scheduleTitle}'` : ''

    await auditService.logAction(
      locked ? 'ATTENDANCE_LOCK' : 'ATTENDANCE_UNLOCK',
      'attendance',
      `${locked ? 'Finalized and locked' : 'Unlocked'} attendance session${titleStr}`,
      adminEmail || 'System',
      { sessionId, scheduleTitle, lockState: locked ? 'Finalized & Locked' : 'Unlocked' }
    )
  },

  /**
   * Fetches all attendance sessions directly from Firestore sessions collection.
   */
  async getAllSessions(): Promise<AttendanceSession[]> {
    const sessionsRef = collection(db, SESSIONS_COLLECTION)
    const snapshot = await getDocs(sessionsRef)

    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        hasRecords: data.hasRecords ?? false,
        lastUpdatedBy: data.lastUpdatedBy || null,
        lastUpdatedAt: data.lastUpdatedAt || data.updatedAt || null
      }
    }) as AttendanceSession[]
  },

  /**
   * Deletes a single attendance record document.
   */
  async deleteAttendanceRecord(recordId: string): Promise<void> {
    const docRef = doc(db, ATTENDANCE_COLLECTION, recordId)
    await deleteDoc(docRef)
  },

  /**
   * Automatically marks a member as excused for an array of schedules following an approved excuse request.
   */
  async markExcuseForSchedules(
    scheduleIds: string[],
    memberId: string,
    reason: string,
    adminRemarks?: string,
    performedBy = 'Officer'
  ): Promise<void> {
    for (const scheduleId of scheduleIds) {
      try {
        // 1. Get schedule details (date)
        const schedDoc = await getDoc(doc(db, 'schedules', scheduleId))
        const schedData = schedDoc.exists() ? schedDoc.data() : null
        const date = schedData?.date || new Date().toISOString().split('T')[0]

        // 2. Get or create attendance session
        const session = await this.getOrCreateSession(scheduleId)

        // 3. Find if attendance record already exists for this member in this session
        const attendanceRef = collection(db, ATTENDANCE_COLLECTION)
        const q = query(
          attendanceRef,
          where('sessionId', '==', session.id),
          where('memberId', '==', memberId)
        )
        const snap = await getDocs(q)

        const remarksText = `Excused: ${reason}${adminRemarks ? ` | Remarks: ${adminRemarks}` : ''}`

        if (!snap.empty) {
          // Update existing record to excused
          const existingDoc = snap.docs[0]
          await updateDoc(doc(db, ATTENDANCE_COLLECTION, existingDoc.id), {
            status: 'excused' as AttendanceStatus,
            remarks: remarksText,
            updatedAt: serverTimestamp()
          })
        } else {
          // Create new attendance record marked as excused
          await addDoc(attendanceRef, {
            sessionId: session.id,
            scheduleId,
            memberId,
            status: 'excused' as AttendanceStatus,
            remarks: remarksText,
            attendanceDate: date,
            isOtherServer: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }

        // Mark session hasRecords
        await updateDoc(doc(db, SESSIONS_COLLECTION, session.id), {
          hasRecords: true,
          lastUpdatedBy: performedBy,
          lastUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      } catch (err) {
        console.error(`Failed to automatically mark schedule ${scheduleId} as excused for member ${memberId}:`, err)
      }
    }
  }
}
