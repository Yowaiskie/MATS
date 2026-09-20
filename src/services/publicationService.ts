import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocs, 
  query, 
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import { auditService } from '@/services/auditService'

const PUBLICATIONS_COLLECTION = 'schedulePublications'

export const publicationService = {
  /**
   * Retrieves all publications sorted chronologically by startDate.
   */
  async getPublications(): Promise<SchedulePublication[]> {
    const pubRef = collection(db, PUBLICATIONS_COLLECTION)
    const q = query(pubRef, orderBy('startDate', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SchedulePublication[]
  },

  /**
   * Retrieves a single publication by ID.
   */
  async getPublication(id: string): Promise<SchedulePublication | null> {
    const docRef = doc(db, PUBLICATIONS_COLLECTION, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as SchedulePublication
  },

  /**
   * Retrieves the currently active published publication.
   */
  async getActivePublication(): Promise<SchedulePublication | null> {
    const list = await this.getPublications()
    if (list.length === 0) return null

    // 1. Find published publications
    const published = list.filter(p => p.status === 'published')
    const today = new Date().toISOString().split('T')[0]

    if (published.length > 0) {
      // Prioritize the published publication spanning today's date
      const current = published.find(p => p.startDate <= today && today <= p.endDate)
      return current || published[0]
    }

    // 2. If no publication is explicitly marked 'published', check if any publication spans today
    const currentAny = list.find(p => p.startDate <= today && today <= p.endDate)
    return currentAny || list[0]
  },

  /**
   * Adds a new publication.
   */
  async addPublication(input: SchedulePublicationInput, performedBy = 'System'): Promise<string> {
    const pubRef = collection(db, PUBLICATIONS_COLLECTION)
    const docRef = await addDoc(pubRef, {
      name: input.name.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status || 'draft',
      description: input.description?.trim() || '',
      submissionDeadline: input.submissionDeadline || '',
      maxSundaysPerServer: input.maxSundaysPerServer ?? 4,
      maxWeekdaysPerServer: input.maxWeekdaysPerServer ?? 8,
      maxServersPerSundaySlot: input.maxServersPerSundaySlot ?? 5,
      maxServersPerWeekdaySlot: input.maxServersPerWeekdaySlot ?? 5,
      includeSundays: input.includeSundays ?? true,
      includeWeekdays: input.includeWeekdays ?? true,
      includeHolyHour: input.includeHolyHour ?? false,
      includeMeetings: input.includeMeetings ?? false,
      customExcludedKeywords: input.customExcludedKeywords || [],
      allowedRanks: input.allowedRanks || ['Chevaliers', 'Paladins'],
      warningAbsenceThreshold: input.warningAbsenceThreshold ?? 3,
      suspensionAbsenceThreshold: input.suspensionAbsenceThreshold ?? 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'SCHEDULE_CREATE',
      'schedule',
      `Created publication '${input.name}'`,
      performedBy,
      { publicationId: docRef.id, input }
    )

    return docRef.id
  },

  /**
   * Updates publication details.
   */
  async updatePublication(id: string, input: Partial<SchedulePublicationInput>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, PUBLICATIONS_COLLECTION, id)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }

    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.startDate !== undefined) updateData.startDate = input.startDate
    if (input.endDate !== undefined) updateData.endDate = input.endDate
    if (input.status !== undefined) updateData.status = input.status
    if (input.description !== undefined) updateData.description = input.description.trim()
    if (input.submissionDeadline !== undefined) updateData.submissionDeadline = input.submissionDeadline
    if (input.maxSundaysPerServer !== undefined) updateData.maxSundaysPerServer = input.maxSundaysPerServer
    if (input.maxWeekdaysPerServer !== undefined) updateData.maxWeekdaysPerServer = input.maxWeekdaysPerServer
    if (input.maxServersPerSundaySlot !== undefined) updateData.maxServersPerSundaySlot = input.maxServersPerSundaySlot
    if (input.maxServersPerWeekdaySlot !== undefined) updateData.maxServersPerWeekdaySlot = input.maxServersPerWeekdaySlot
    if (input.includeSundays !== undefined) updateData.includeSundays = input.includeSundays
    if (input.includeWeekdays !== undefined) updateData.includeWeekdays = input.includeWeekdays
    if (input.includeHolyHour !== undefined) updateData.includeHolyHour = input.includeHolyHour
    if (input.includeMeetings !== undefined) updateData.includeMeetings = input.includeMeetings
    if (input.customExcludedKeywords !== undefined) updateData.customExcludedKeywords = input.customExcludedKeywords
    if (input.allowedRanks !== undefined) updateData.allowedRanks = input.allowedRanks
    if (input.warningAbsenceThreshold !== undefined) updateData.warningAbsenceThreshold = input.warningAbsenceThreshold
    if (input.suspensionAbsenceThreshold !== undefined) updateData.suspensionAbsenceThreshold = input.suspensionAbsenceThreshold

    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'SCHEDULE_UPDATE',
      'schedule',
      `Updated publication details for ID: ${id} (${input.name || ''})`,
      performedBy,
      { publicationId: id, updates: input }
    )
  },

  /**
   * Deletes a publication.
   */
  async deletePublication(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, PUBLICATIONS_COLLECTION, id)
    await deleteDoc(docRef)

    await auditService.logAction(
      'SCHEDULE_DELETE',
      'schedule',
      `Deleted publication with ID: ${id}`,
      performedBy,
      { publicationId: id }
    )
  },

  /**
   * Marks a member as having submitted their schedule for this publication.
   */
  async markMemberSubmitted(publicationId: string, memberId: string): Promise<void> {
    const docRef = doc(db, PUBLICATIONS_COLLECTION, publicationId)
    await updateDoc(docRef, {
      submittedMembers: arrayUnion(memberId),
      updatedAt: serverTimestamp()
    })
  },

  /**
   * Marks multiple members as having submitted their schedules for this publication.
   */
  async markMembersSubmitted(publicationId: string, memberIds: string[]): Promise<void> {
    if (memberIds.length === 0) return
    const docRef = doc(db, PUBLICATIONS_COLLECTION, publicationId)
    await updateDoc(docRef, {
      // @ts-ignore - Firestore arrayUnion accepts multiple arguments via spread
      submittedMembers: arrayUnion(...memberIds),
      updatedAt: serverTimestamp()
    })
  },

  /**
   * Resets submission status for multiple members, allowing them to submit again.
   */
  async resetMembersSubmission(publicationId: string, memberIds: string[]): Promise<void> {
    if (memberIds.length === 0) return
    const docRef = doc(db, PUBLICATIONS_COLLECTION, publicationId)
    await updateDoc(docRef, {
      // @ts-ignore - Firestore arrayRemove accepts multiple arguments via spread
      submittedMembers: arrayRemove(...memberIds),
      updatedAt: serverTimestamp()
    })
  }
}
