import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocs, 
  query, 
  where, 
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Schedule, ScheduleInput } from '@/types/schedule'
import { isTimeOverlapping } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'
import type { Member } from '@/types/member'

const SCHEDULES_COLLECTION = 'schedules'
const ATTENDANCE_COLLECTION = 'attendance'
const MEMBERS_COLLECTION = 'members'

export const scheduleService = {
  /**
   * Retrieves all schedules sorted chronologically by date and startTime.
   */
  async getSchedules(): Promise<Schedule[]> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const snapshot = await getDocs(schedulesRef)
    const schedules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Schedule[]
    
    schedules.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      const dateCompare = dateA.localeCompare(dateB)
      if (dateCompare !== 0) return dateCompare
      
      const timeA = a.startTime || ''
      const timeB = b.startTime || ''
      return timeA.localeCompare(timeB)
    })
    
    return schedules
  },

  /**
   * Adds a new service schedule.
   */
  async addSchedule(input: ScheduleInput): Promise<string> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const docRef = await addDoc(schedulesRef, {
      title: input.title.trim(),
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status || 'upcoming',
      assignedMembers: input.assignedMembers || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  },

  /**
   * Updates schedule details (title, date, start/end time, or cancellation status).
   */
  async updateSchedule(id: string, input: Partial<ScheduleInput>): Promise<void> {
    const docRef = doc(db, SCHEDULES_COLLECTION, id)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }

    if (input.title !== undefined) updateData.title = input.title.trim()
    if (input.date !== undefined) updateData.date = input.date
    if (input.startTime !== undefined) updateData.startTime = input.startTime
    if (input.endTime !== undefined) updateData.endTime = input.endTime
    if (input.status !== undefined) updateData.status = input.status

    await updateDoc(docRef, updateData)
  },

  /**
   * Deletes a schedule and all its associated attendance records.
   */
  async deleteSchedule(id: string): Promise<void> {
    // Cascade-delete any attendance records linked to this schedule
    const attendanceRef = collection(db, ATTENDANCE_COLLECTION)
    const q = query(attendanceRef, where('scheduleId', '==', id))
    const attendanceSnap = await getDocs(q)
    await Promise.all(attendanceSnap.docs.map(d => deleteDoc(d.ref)))

    // Delete the schedule itself
    const docRef = doc(db, SCHEDULES_COLLECTION, id)
    await deleteDoc(docRef)
  },

  /**
   * Bulk-deletes multiple schedules.
   * Schedules that have attendance records are skipped and returned as skippedIds.
   */
  async bulkDeleteSchedules(ids: string[]): Promise<{ deletedCount: number; skippedIds: string[] }> {
    let deletedCount = 0
    const skippedIds: string[] = []

    await Promise.all(
      ids.map(async (id) => {
        try {
          await scheduleService.deleteSchedule(id)
          deletedCount++
        } catch {
          skippedIds.push(id)
        }
      })
    )

    return { deletedCount, skippedIds }
  },

  /**
   * Assigns a list of members to a schedule.
   * Performs validation to prevent double-booking members to overlapping schedules on the same day.
   */
  async assignMembers(scheduleId: string, memberIds: string[]): Promise<void> {
    const scheduleRef = doc(db, SCHEDULES_COLLECTION, scheduleId)
    const scheduleSnap = await getDoc(scheduleRef)
    if (!scheduleSnap.exists()) {
      throw new Error('Schedule not found.')
    }

    const targetSchedule = scheduleSnap.data() as Schedule
    
    // Skip overlap validation if the target schedule is cancelled
    if (targetSchedule.status === 'cancelled') {
      await updateDoc(scheduleRef, {
        assignedMembers: memberIds,
        updatedAt: serverTimestamp()
      })
      return
    }

    // Load other active schedules on the same date
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const q = query(
      schedulesRef, 
      where('date', '==', targetSchedule.date)
    )
    
    const snapshot = await getDocs(q)
    const activeStatuses = ['upcoming', 'ongoing', 'completed']
    const otherSchedules = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as Schedule)
      .filter(s => s.id !== scheduleId && activeStatuses.includes(s.status)) // exclude target schedule and cancelled

    // Perform conflict check for each member being assigned
    for (const memberId of memberIds) {
      const conflictingSchedule = otherSchedules.find(other => 
        other.assignedMembers.includes(memberId) &&
        isTimeOverlapping(targetSchedule.startTime, targetSchedule.endTime, other.startTime, other.endTime)
      )

      if (conflictingSchedule) {
        // Retrieve member profile to formulate a helpful error message
        const memberRef = doc(db, MEMBERS_COLLECTION, memberId)
        const memberSnap = await getDoc(memberRef)
        const memberName = memberSnap.exists() 
          ? getFullName(memberSnap.data() as Member)
          : `Member (${memberId})`
        
        throw new Error(
          `Conflict detected: ${memberName} is already assigned to "${conflictingSchedule.title}" (${conflictingSchedule.startTime} - ${conflictingSchedule.endTime}) on this date.`
        )
      }
    }

    // Save assignments directly inside the schedule document
    await updateDoc(scheduleRef, {
      assignedMembers: memberIds,
      updatedAt: serverTimestamp()
    })
  }
}
