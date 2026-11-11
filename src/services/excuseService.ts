import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import { attendanceService } from '@/services/attendanceService'
import { notificationService } from '@/services/notificationService'
import type { ExcuseRequest, ExcuseStatus } from '@/types/excuse'

const EXCUSES_COLLECTION = 'excuseRequests'

/**
 * Strips all undefined properties from an object before writing to Firestore.
 */
function cleanPayload<T extends Record<string, any>>(data: T): Record<string, any> {
  const result: Record<string, any> = {}
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      result[key] = data[key]
    }
  })
  return result
}

export const excuseService = {
  /**
   * Submit a new excuse request. Generates a collision-free tracking number.
   */
  async submitExcuseRequest(
    data: Omit<ExcuseRequest, 'trackingNumber' | 'status' | 'submittedAt'>,
    performedBy: string = 'Public Portal'
  ): Promise<string> {
    try {
      const date = new Date()
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const randomSuffix = Math.floor(10000 + Math.random() * 90000)
      const generatedTrackingNumber = `EX-${yearMonth}-${randomSuffix}`

      const excuseRef = doc(collection(db, EXCUSES_COLLECTION))
      const rawPayload = {
        ...data,
        trackingNumber: generatedTrackingNumber,
        status: 'pending' as ExcuseStatus,
        submittedAt: serverTimestamp(),
        isArchived: false
      }

      await setDoc(excuseRef, cleanPayload(rawPayload))

      // Create the public status mapping document (accessible via get)
      const statusRef = doc(db, 'excuseStatus', generatedTrackingNumber)
      await setDoc(statusRef, {
        status: 'pending' as ExcuseStatus,
        reason: data.reason || '',
        rejectionReason: '',
        adminRemarks: '',
        submittedAt: serverTimestamp()
      })

      // Non-blocking audit log
      auditService.logAction(
        'EXCUSE_SUBMITTED',
        'excuse',
        `Submitted excuse request ${generatedTrackingNumber}`,
        performedBy,
        { trackingNumber: generatedTrackingNumber, memberId: data.memberId }
      ).catch(() => {})

      // Non-blocking real-time notification dispatch to officers and administrators
      notificationService.sendExcuseRequestNotification({
        excuseId: excuseRef.id,
        trackingNumber: generatedTrackingNumber,
        memberName: data.memberName || 'Altar Server',
        reason: data.reason || '',
        scheduleCount: data.schedules?.length || 0,
        memberId: data.memberId,
        performedBy
      }).catch((notifErr) => {
        console.warn('Failed to dispatch excuse notification:', notifErr)
      })

      return generatedTrackingNumber
    } catch (error: any) {
      console.error('Error submitting excuse request:', error)
      throw new Error(error.message || 'Failed to submit excuse request.')
    }
  },

  /**
   * Directly file an excuse request on behalf of a member by an Officer/Admin.
   * If directlyApprove is true, marks as approved and syncs attendance immediately.
   */
  async fileOfficerExcuseRequest(params: {
    memberId: string
    memberName: string
    memberOrder?: string
    memberRank?: string
    schedules: string[]
    reason: string
    officerNotes?: string
    directlyApprove: boolean
    officerUid: string
    officerName: string
  }): Promise<{ trackingNumber: string; approved: boolean }> {
    try {
      const date = new Date()
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const randomSuffix = Math.floor(10000 + Math.random() * 90000)
      const generatedTrackingNumber = `EX-${yearMonth}-${randomSuffix}`

      const excuseRef = doc(collection(db, EXCUSES_COLLECTION))
      const isApproved = params.directlyApprove === true
      const effectiveStatus: ExcuseStatus = isApproved ? 'approved' : 'pending'

      const excusePayload: Record<string, any> = {
        trackingNumber: generatedTrackingNumber,
        memberId: params.memberId,
        memberName: params.memberName,
        schedules: params.schedules || [],
        reason: params.reason,
        submittedByOfficer: true,
        submittedByUid: params.officerUid,
        submittedByName: params.officerName,
        status: effectiveStatus,
        submittedAt: serverTimestamp(),
        isArchived: false,
        ...(params.memberOrder ? { memberOrder: params.memberOrder } : {}),
        ...(params.memberRank ? { memberRank: params.memberRank } : {}),
        ...(params.officerNotes ? { officerNotes: params.officerNotes, additionalNotes: params.officerNotes } : {}),
        ...(isApproved ? {
          adminRemarks: params.officerNotes?.trim() || `Filed & approved by Officer (${params.officerName})`,
          reviewedAt: serverTimestamp(),
          reviewedByUid: params.officerUid,
          reviewedByName: params.officerName
        } : {})
      }

      await setDoc(excuseRef, cleanPayload(excusePayload))

      // Create the public tracking status doc
      const statusRef = doc(db, 'excuseStatus', generatedTrackingNumber)
      await setDoc(statusRef, {
        status: effectiveStatus,
        reason: params.reason || '',
        rejectionReason: '',
        adminRemarks: isApproved ? (params.officerNotes?.trim() || `Approved by ${params.officerName}`) : '',
        submittedAt: serverTimestamp()
      })

      if (isApproved) {
        // Automatically sync and mark attendance records for all approved schedules
        if (params.schedules && params.schedules.length > 0 && params.memberId) {
          await attendanceService.markExcuseForSchedules(
            params.schedules,
            params.memberId,
            params.reason,
            params.officerNotes || `Filed & approved by Officer (${params.officerName})`,
            params.officerName
          )
        }

        auditService.logAction(
          'EXCUSE_APPROVED',
          'excuse',
          `Officer ${params.officerName} filed & directly approved excuse ${generatedTrackingNumber} for ${params.memberName}`,
          params.officerName,
          { trackingNumber: generatedTrackingNumber, memberId: params.memberId, excuseId: excuseRef.id }
        ).catch(() => {})
      } else {
        auditService.logAction(
          'EXCUSE_SUBMITTED',
          'excuse',
          `Officer ${params.officerName} filed excuse ${generatedTrackingNumber} for ${params.memberName} (Pending Review)`,
          params.officerName,
          { trackingNumber: generatedTrackingNumber, memberId: params.memberId, excuseId: excuseRef.id }
        ).catch(() => {})

        notificationService.sendExcuseRequestNotification({
          excuseId: excuseRef.id,
          trackingNumber: generatedTrackingNumber,
          memberName: params.memberName,
          reason: params.reason,
          scheduleCount: params.schedules.length,
          memberId: params.memberId,
          performedBy: params.officerName
        }).catch((notifErr) => {
          console.warn('Failed to dispatch excuse notification:', notifErr)
        })
      }

      return {
        trackingNumber: generatedTrackingNumber,
        approved: isApproved
      }
    } catch (error: any) {
      console.error('Error filing officer excuse request:', error)
      throw new Error(error.message || 'Failed to file excuse request.')
    }
  },

  /**
   * Fetch all excuse requests with optional filters.
   */
  async getExcuseRequests(filters?: { status?: ExcuseStatus; memberId?: string; includeArchived?: boolean }): Promise<ExcuseRequest[]> {
    try {
      let q = query(collection(db, EXCUSES_COLLECTION))

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status))
      }
      if (filters?.memberId) {
        q = query(q, where('memberId', '==', filters.memberId))
      }

      const snapshot = await getDocs(q)
      let list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExcuseRequest[]

      // Filter by archive status if requested
      if (filters?.includeArchived === false) {
        list = list.filter(r => !r.isArchived)
      } else if (filters?.includeArchived === true) {
        list = list.filter(r => r.isArchived === true)
      }

      // Client-side in-memory sorting to prevent composite index errors
      return list.sort((a, b) => {
        const timeA = a.submittedAt?.toDate?.() ? a.submittedAt.toDate().getTime() : 0
        const timeB = b.submittedAt?.toDate?.() ? b.submittedAt.toDate().getTime() : 0
        return timeB - timeA
      })
    } catch (error) {
      console.error('Error fetching excuse requests:', error)
      throw new Error('Failed to fetch excuse requests.')
    }
  },

  /**
   * Fetch all excuse requests filed by a specific member.
   */
  async getExcuseRequestsByMemberId(memberId: string): Promise<ExcuseRequest[]> {
    return this.getExcuseRequests({ memberId, includeArchived: false })
  },

  /**
   * Fetch a single excuse request by its tracking number.
   */
  async getExcuseRequestByTrackingNumber(trackingNumber: string): Promise<ExcuseRequest | null> {
    try {
      const docRef = doc(db, 'excuseStatus', trackingNumber)
      const docSnap = await getDoc(docRef)
      
      if (!docSnap.exists()) return null
      
      return { id: docSnap.id, ...docSnap.data() } as any
    } catch (error) {
      console.error('Error fetching request by tracking number:', error)
      throw new Error('Failed to fetch excuse request.')
    }
  },

  /**
   * Approve an excuse request.
   */
  async approveExcuseRequest(
    id: string,
    trackingNumber: string,
    adminRemarks: string,
    adminUid: string,
    adminName: string
  ): Promise<void> {
    try {
      const ref = doc(db, EXCUSES_COLLECTION, id)
      const snap = await getDoc(ref)
      const excuseData = snap.exists() ? (snap.data() as ExcuseRequest) : null

      await updateDoc(ref, {
        status: 'approved' as ExcuseStatus,
        adminRemarks,
        reviewedAt: serverTimestamp(),
        reviewedByUid: adminUid,
        reviewedByName: adminName
      })

      // Also update the public tracking mapping status document
      const statusRef = doc(db, 'excuseStatus', trackingNumber)
      await updateDoc(statusRef, {
        status: 'approved' as ExcuseStatus,
        adminRemarks
      })

      // Automatically sync and mark attendance records for all approved schedules
      if (excuseData?.schedules && excuseData.schedules.length > 0 && excuseData.memberId) {
        await attendanceService.markExcuseForSchedules(
          excuseData.schedules,
          excuseData.memberId,
          excuseData.reason || '',
          adminRemarks,
          adminName
        )
      }

      await auditService.logAction(
        'EXCUSE_APPROVED',
        'excuse',
        `Approved excuse request ${trackingNumber} and marked attendance records as Excused`,
        adminName,
        { trackingNumber, excuseId: id }
      )
    } catch (error) {
      console.error('Error approving excuse request:', error)
      throw new Error('Failed to approve excuse request.')
    }
  },

  /**
   * Reject an excuse request.
   */
  async rejectExcuseRequest(
    id: string,
    trackingNumber: string,
    rejectionReason: string,
    adminUid: string,
    adminName: string
  ): Promise<void> {
    try {
      const ref = doc(db, EXCUSES_COLLECTION, id)
      const snap = await getDoc(ref)
      const existing = snap.exists() ? (snap.data() as ExcuseRequest) : null

      if (existing?.status === 'approved') {
        throw new Error('Approved excuse requests are locked and cannot be changed or rejected.')
      }

      await updateDoc(ref, {
        status: 'rejected' as ExcuseStatus,
        rejectionReason,
        reviewedAt: serverTimestamp(),
        reviewedByUid: adminUid,
        reviewedByName: adminName
      })

      // Also update the public tracking mapping status document
      const statusRef = doc(db, 'excuseStatus', trackingNumber)
      await updateDoc(statusRef, {
        status: 'rejected' as ExcuseStatus,
        rejectionReason
      })

      await auditService.logAction(
        'EXCUSE_REJECTED',
        'excuse',
        `Rejected excuse request ${trackingNumber}`,
        adminName,
        { trackingNumber, excuseId: id }
      )
    } catch (error) {
      console.error('Error rejecting excuse request:', error)
      throw new Error('Failed to reject excuse request.')
    }
  },

  /**
   * Authorized administrative status override for previously finalized excuse requests.
   */
  async overrideExcuseStatus(
    id: string,
    trackingNumber: string,
    targetStatus: ExcuseStatus,
    remarksOrReason: string,
    adminUid: string,
    adminName: string
  ): Promise<void> {
    try {
      const ref = doc(db, EXCUSES_COLLECTION, id)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        throw new Error('Excuse request not found.')
      }
      const existing = snap.data() as ExcuseRequest
      const prevStatus = existing.status

      const isApproved = targetStatus === 'approved'

      await updateDoc(ref, {
        status: targetStatus,
        adminRemarks: isApproved ? remarksOrReason : (existing.adminRemarks || remarksOrReason),
        rejectionReason: !isApproved ? remarksOrReason : '',
        reviewedAt: serverTimestamp(),
        reviewedByUid: adminUid,
        reviewedByName: adminName
      })

      // Update public tracking document
      const statusRef = doc(db, 'excuseStatus', trackingNumber)
      await updateDoc(statusRef, {
        status: targetStatus,
        adminRemarks: isApproved ? remarksOrReason : (existing.adminRemarks || remarksOrReason),
        rejectionReason: !isApproved ? remarksOrReason : ''
      }).catch(() => {})

      // If overriding to approved, mark attendance records
      if (isApproved && existing.schedules && existing.schedules.length > 0 && existing.memberId) {
        await attendanceService.markExcuseForSchedules(
          existing.schedules,
          existing.memberId,
          existing.reason || '',
          remarksOrReason,
          adminName
        )
      }

      await auditService.logAction(
        'EXCUSE_OVERRIDDEN' as any,
        'excuse',
        `Overrode excuse request ${trackingNumber} status from ${prevStatus} to ${targetStatus}`,
        adminName,
        { trackingNumber, excuseId: id, previousStatus: prevStatus, newStatus: targetStatus }
      )
    } catch (error: any) {
      console.error('Error overriding excuse request status:', error)
      throw new Error(error.message || 'Failed to override excuse status.')
    }
  },

  /**
   * Soft-delete / Archive an excuse request.
   */
  async archiveExcuseRequest(
    id: string,
    trackingNumber: string,
    performedByUid: string,
    performedByName = 'Officer'
  ): Promise<void> {
    try {
      const ref = doc(db, EXCUSES_COLLECTION, id)
      await updateDoc(ref, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedByUid: performedByUid,
        archivedByName: performedByName
      })

      await auditService.logAction(
        'EXCUSE_ARCHIVED' as any,
        'excuse',
        `Archived (soft-deleted) excuse request ${trackingNumber || id}`,
        performedByName,
        { trackingNumber, excuseId: id }
      )
    } catch (error) {
      console.error('Error archiving excuse request:', error)
      throw new Error('Failed to archive excuse request.')
    }
  },

  /**
   * Restore an archived excuse request back to active list.
   */
  async restoreExcuseRequest(
    id: string,
    trackingNumber: string,
    performedByName = 'Officer'
  ): Promise<void> {
    try {
      const ref = doc(db, EXCUSES_COLLECTION, id)
      await updateDoc(ref, {
        isArchived: false,
        archivedAt: null,
        archivedByUid: null,
        archivedByName: null
      })

      await auditService.logAction(
        'EXCUSE_RESTORED' as any,
        'excuse',
        `Restored archived excuse request ${trackingNumber || id}`,
        performedByName,
        { trackingNumber, excuseId: id }
      )
    } catch (error) {
      console.error('Error restoring excuse request:', error)
      throw new Error('Failed to restore excuse request.')
    }
  },

  /**
   * Permanently delete an excuse request document and its tracking status document (Hard Delete).
   */
  async deleteExcuseRequest(
    id: string,
    trackingNumber?: string,
    performedBy = 'Officer'
  ): Promise<void> {
    try {
      const ref = doc(db, EXCUSES_COLLECTION, id)
      await deleteDoc(ref)

      if (trackingNumber) {
        const statusRef = doc(db, 'excuseStatus', trackingNumber)
        await deleteDoc(statusRef).catch(() => {})
      }

      await auditService.logAction(
        'EXCUSE_DELETED',
        'excuse',
        `Permanently deleted excuse request ${trackingNumber || id}`,
        performedBy,
        { trackingNumber, excuseId: id }
      )
    } catch (error) {
      console.error('Error deleting excuse request:', error)
      throw new Error('Failed to delete excuse request.')
    }
  }
}
