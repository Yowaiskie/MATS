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
  updateDoc
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { AttendanceSession, AttendanceRecord, AttendanceInput } from '@/types/attendance'
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
    performedBy = 'System'
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

    // 3. Mark update timestamp on parent session
    await updateDoc(sessionRef, {
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'ATTENDANCE_SAVE',
      'attendance',
      `Saved ${inputs.length} attendance records for schedule ID: ${scheduleId}`,
      performedBy,
      { sessionId, scheduleId, date, recordCount: inputs.length }
    )
  },

  /**
   * Locks or unlocks an attendance session.
   */
  async setSessionLockState(
    sessionId: string,
    locked: boolean,
    adminEmail: string | null
  ): Promise<void> {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId)
    await updateDoc(sessionRef, {
      locked,
      finalizedAt: locked ? serverTimestamp() : null,
      finalizedBy: locked ? adminEmail : null,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      locked ? 'ATTENDANCE_LOCK' : 'ATTENDANCE_UNLOCK',
      'attendance',
      `${locked ? 'Finalized and locked' : 'Unlocked'} attendance session (ID: ${sessionId})`,
      adminEmail || 'System',
      { sessionId }
    )
  },

  /**
   * Fetches all attendance sessions.
   */
  async getAllSessions(): Promise<AttendanceSession[]> {
    const sessionsRef = collection(db, SESSIONS_COLLECTION)
    const snapshot = await getDocs(sessionsRef)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceSession[]
  }
}
