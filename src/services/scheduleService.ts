import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocs, 
  query, 
  documentId,
  where, 
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Schedule, ScheduleInput } from '@/types/schedule'
import { isTimeOverlapping } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'
import type { Member } from '@/types/member'
import { auditService } from '@/services/auditService'
import { publicationService } from '@/services/publicationService'

const SCHEDULES_COLLECTION = 'schedules'
const ATTENDANCE_COLLECTION = 'attendance'
const MEMBERS_COLLECTION = 'members'

const sortSchedulesChronologically = (schedules: Schedule[]): Schedule[] => {
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
}

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

    return sortSchedulesChronologically(schedules)
  },

  /**
   * Retrieves a single schedule by ID.
   */
  async getScheduleById(id: string): Promise<Schedule | null> {
    const docRef = doc(db, SCHEDULES_COLLECTION, id)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as Schedule
  },

  /**
   * Retrieves all schedules on a specific date.
   */
  async getSchedulesByDate(date: string): Promise<Schedule[]> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const q = query(schedulesRef, where('date', '==', date))
    const snapshot = await getDocs(q)
    const schedules = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Schedule[]

    return sortSchedulesChronologically(schedules)
  },

  /**
   * Retrieves schedules within a date range, sorted chronologically.
   */
  async getSchedulesByDateRange(startDate: string, endDate: string): Promise<Schedule[]> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const q = query(
      schedulesRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    )
    const snapshot = await getDocs(q)
    const schedules = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Schedule[]

    return sortSchedulesChronologically(schedules)
  },

  /**
   * Retrieves schedules by explicit IDs.
   */
  async getSchedulesByIds(ids: string[]): Promise<Schedule[]> {
    if (ids.length === 0) return []
    const uniqueIds = Array.from(new Set(ids))
    const CHUNK_SIZE = 30
    const chunks: string[][] = []
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE))
    }

    const snapshots = await Promise.all(
      chunks.map(chunk =>
        getDocs(
          query(
            collection(db, SCHEDULES_COLLECTION),
            where(documentId(), 'in', chunk)
          )
        )
      )
    )

    const schedules: Schedule[] = snapshots.flatMap(snap =>
      snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }) as Schedule)
    )

    return sortSchedulesChronologically(schedules)
  },

  /**
   * Adds a new service schedule.
   */
  async addSchedule(input: ScheduleInput, performedBy = 'System'): Promise<string> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const newScheduleDoc: any = {
      title: input.title.trim(),
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status || 'upcoming',
      assignedMembers: input.assignedMembers || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    if (input.category) newScheduleDoc.category = input.category

    const docRef = await addDoc(schedulesRef, newScheduleDoc)

    await auditService.logAction(
      'SCHEDULE_CREATE',
      'schedule',
      `Created schedule '${input.title}' on ${input.date} (${input.startTime})`,
      performedBy,
      { scheduleId: docRef.id, input }
    )

    return docRef.id
  },

  /**
   * Updates schedule details (title, date, start/end time, or cancellation status).
   */
  async updateSchedule(id: string, input: Partial<ScheduleInput>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, SCHEDULES_COLLECTION, id)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }

    if (input.title !== undefined) updateData.title = input.title.trim()
    if (input.category !== undefined) updateData.category = input.category
    if (input.date !== undefined) updateData.date = input.date
    if (input.startTime !== undefined) updateData.startTime = input.startTime
    if (input.endTime !== undefined) updateData.endTime = input.endTime
    if (input.status !== undefined) updateData.status = input.status

    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'SCHEDULE_UPDATE',
      'schedule',
      `Updated schedule details for ID: ${id} (${input.title || ''})`,
      performedBy,
      { scheduleId: id, updates: input }
    )
  },

  /**
   * Toggles the locked status of a schedule.
   */
  async toggleLockSchedule(id: string, isLocked: boolean, performedBy = 'System'): Promise<void> {
    const scheduleRef = doc(db, SCHEDULES_COLLECTION, id)
    await updateDoc(scheduleRef, {
      isLocked,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'SCHEDULE_UPDATE',
      'schedule',
      `${isLocked ? 'Finalized & Locked' : 'Unlocked'} schedule with ID: ${id}`,
      performedBy,
      { scheduleId: id, isLocked }
    )
  },

  /**
   * Deletes a schedule and all its associated attendance records.
   */
  async deleteSchedule(id: string, performedBy = 'System'): Promise<void> {
    // Cascade-delete any attendance records linked to this schedule
    const attendanceRef = collection(db, ATTENDANCE_COLLECTION)
    const q = query(attendanceRef, where('scheduleId', '==', id))
    const attendanceSnap = await getDocs(q)
    await Promise.all(attendanceSnap.docs.map(d => deleteDoc(d.ref)))

    // Delete the schedule itself
    const docRef = doc(db, SCHEDULES_COLLECTION, id)
    await deleteDoc(docRef)

    await auditService.logAction(
      'SCHEDULE_DELETE',
      'schedule',
      `Deleted schedule with ID: ${id}`,
      performedBy,
      { scheduleId: id }
    )
  },

  /**
   * Bulk-deletes multiple schedules.
   * Schedules that have attendance records are skipped and returned as skippedIds.
   */
  async bulkDeleteSchedules(ids: string[], performedBy = 'System'): Promise<{ deletedCount: number; skippedIds: string[] }> {
    let deletedCount = 0
    const skippedIds: string[] = []

    await Promise.all(
      ids.map(async (id) => {
        try {
          await scheduleService.deleteSchedule(id, performedBy)
          deletedCount++
        } catch {
          skippedIds.push(id)
        }
      })
    )

    return { deletedCount, skippedIds }
  },

  /**
   * Bulk locks/unlocks schedules within a date range.
   */
  async bulkLockSchedules(startDate: string, endDate: string, isLocked: boolean, performedBy = 'System'): Promise<number> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const q = query(
      schedulesRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    )
    const snapshot = await getDocs(q)
    let updatedCount = 0

    await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const scheduleRef = doc(db, SCHEDULES_COLLECTION, docSnap.id)
        await updateDoc(scheduleRef, {
          isLocked,
          updatedAt: serverTimestamp()
        })
        updatedCount++
      })
    )

    if (updatedCount > 0) {
      await auditService.logAction(
        'SCHEDULE_UPDATE',
        'schedule',
        `Bulk ${isLocked ? 'locked' : 'unlocked'} ${updatedCount} schedules between ${startDate} and ${endDate}`,
        performedBy
      )
    }

    return updatedCount
  },

  /**
   * Removes specific members from all schedules within a date range.
   * Useful for resetting submissions.
   */
  async removeMembersFromSchedules(startDate: string, endDate: string, memberIds: string[], performedBy = 'System'): Promise<void> {
    const schedulesRef = collection(db, SCHEDULES_COLLECTION)
    const q = query(
      schedulesRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    )
    const snapshot = await getDocs(q)

    await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const schedule = docSnap.data() as Schedule
        if (!schedule.assignedMembers) return

        const updatedMembers = schedule.assignedMembers.filter(id => !memberIds.includes(id))
        
        // Only update if something changed
        if (updatedMembers.length !== schedule.assignedMembers.length) {
          const scheduleRef = doc(db, SCHEDULES_COLLECTION, docSnap.id)
          await updateDoc(scheduleRef, {
            assignedMembers: updatedMembers,
            updatedAt: serverTimestamp()
          })
        }
      })
    )

    await auditService.logAction(
      'SCHEDULE_UPDATE',
      'schedule',
      `Bulk removed ${memberIds.length} members from schedules between ${startDate} and ${endDate}`,
      performedBy
    )
  },

  /**
   * Assigns a list of members to a schedule.
   * Performs validation to prevent double-booking members to overlapping schedules on the same day.
   */
  async assignMembers(scheduleId: string, memberIds: string[], performedBy = 'System'): Promise<void> {
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
      await auditService.logAction(
        'SCHEDULE_ASSIGN',
        'schedule',
        `Assigned ${memberIds.length} members to cancelled schedule '${targetSchedule.title}'`,
        performedBy,
        { scheduleId, memberIds }
      )
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

    // Perform conflict check only for newly added members
    const currentAssigned = targetSchedule.assignedMembers || []
    const newlyAddedMemberIds = memberIds.filter(id => !currentAssigned.includes(id))

    for (const memberId of newlyAddedMemberIds) {
      const conflictingSchedule = otherSchedules.find(other => 
        (other.assignedMembers || []).includes(memberId) &&
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

    await auditService.logAction(
      'SCHEDULE_ASSIGN',
      'schedule',
      `Assigned ${memberIds.length} altar servers to schedule '${targetSchedule.title}'`,
      performedBy,
      { scheduleId, memberIds }
    )
  },

  /**
   * Public Self-Service: Allows an altar server to sign up or update their selections for active/upcoming schedules.
   */
  async submitPublicScheduleSelections(
    memberId: string,
    selections: { scheduleId: string; isSelected: boolean }[],
    performedBy = 'Self-Service'
  ): Promise<void> {
    const targetScheduleIds = selections.map(s => s.scheduleId)
    const targetSchedules = await this.getSchedulesByIds(targetScheduleIds)
    const scheduleMap = new Map(targetSchedules.map(s => [s.id, s]))

    for (const item of selections) {
      const target = scheduleMap.get(item.scheduleId)
      if (!target) continue
      if (target.isLocked || target.status === 'cancelled') continue

      let currentMembers = [...(target.assignedMembers || [])]
      const alreadyAssigned = currentMembers.includes(memberId)

      if (item.isSelected && !alreadyAssigned) {
        currentMembers.push(memberId)
      } else if (!item.isSelected && alreadyAssigned) {
        currentMembers = currentMembers.filter(id => id !== memberId)
      } else {
        continue // No change
      }

      const scheduleRef = doc(db, SCHEDULES_COLLECTION, item.scheduleId)
      await updateDoc(scheduleRef, {
        assignedMembers: currentMembers,
        updatedAt: serverTimestamp()
      })
    }

    await auditService.logAction(
      'SCHEDULE_ASSIGN',
      'schedule',
      `Public self-service updated schedule selections for member ID '${memberId}'`,
      performedBy,
      { memberId, selectionsCount: selections.length }
    )
  },

  /**
   * Admin Member Publication Schedule Override:
   * Directly sets or updates an altar server's assigned schedules within a publication,
   * without needing the public link or resetting their entire submission.
   */
  async adminUpdateMemberPublicationSchedules(
    publicationId: string,
    memberId: string,
    selections: { scheduleId: string; isSelected: boolean }[],
    markAsSubmitted: boolean,
    performedBy = 'Admin'
  ): Promise<void> {
    const targetScheduleIds = selections.map(s => s.scheduleId)
    const targetSchedules = await this.getSchedulesByIds(targetScheduleIds)
    const scheduleMap = new Map(targetSchedules.map(s => [s.id, s]))

    for (const item of selections) {
      const target = scheduleMap.get(item.scheduleId)
      if (!target) continue

      let currentMembers = [...(target.assignedMembers || [])]
      const alreadyAssigned = currentMembers.includes(memberId)

      if (item.isSelected && !alreadyAssigned) {
        currentMembers.push(memberId)
      } else if (!item.isSelected && alreadyAssigned) {
        currentMembers = currentMembers.filter(id => id !== memberId)
      } else {
        continue // No change
      }

      const scheduleRef = doc(db, SCHEDULES_COLLECTION, item.scheduleId)
      await updateDoc(scheduleRef, {
        assignedMembers: currentMembers,
        updatedAt: serverTimestamp()
      })
    }

    if (markAsSubmitted) {
      await publicationService.markMemberSubmitted(publicationId, memberId)
    } else {
      await publicationService.resetMembersSubmission(publicationId, [memberId])
    }

    await auditService.logAction(
      'SCHEDULE_ASSIGN',
      'schedule',
      `Admin updated publication schedule selections for member ID '${memberId}'`,
      performedBy,
      { publicationId, memberId, selectionsCount: selections.length, markAsSubmitted }
    )
  }
}
