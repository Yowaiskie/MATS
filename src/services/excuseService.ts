import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import { attendanceService } from '@/services/attendanceService'
import type { ExcuseRequest, ExcuseStatus } from '@/types/excuse'

const EXCUSES_COLLECTION = 'excuseRequests'
const COUNTERS_COLLECTION = 'counters'
const COUNTER_DOC = 'excuses'

export const excuseService = {
  /**
   * Submit a new excuse request. Generates a sequential tracking number.
   */
  async submitExcuseRequest(
    data: Omit<ExcuseRequest, 'trackingNumber' | 'status' | 'submittedAt'>,
    performedBy: string = 'Public Portal'
  ): Promise<string> {
    try {
      const trackingNumber = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, COUNTERS_COLLECTION, COUNTER_DOC)
        const counterDoc = await transaction.get(counterRef)

        let currentCount = 0
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().currentSeq || 0
        }

        const newCount = currentCount + 1
        const date = new Date()
        const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
        const paddedCount = newCount.toString().padStart(5, '0')
        const generatedTrackingNumber = `EX-${yearMonth}-${paddedCount}`

        // Update or create counter using standard currentSeq
        if (counterDoc.exists()) {
          transaction.update(counterRef, { currentSeq: newCount })
        } else {
          transaction.set(counterRef, { currentSeq: newCount })
        }

        const excuseRef = doc(collection(db, EXCUSES_COLLECTION))
        transaction.set(excuseRef, {
          ...data,
          trackingNumber: generatedTrackingNumber,
          status: 'pending' as ExcuseStatus,
          submittedAt: serverTimestamp()
        })

        // Create the public status mapping document (accessible via get)
        const statusRef = doc(db, 'excuseStatus', generatedTrackingNumber)
        transaction.set(statusRef, {
          status: 'pending' as ExcuseStatus,
          reason: data.reason,
          rejectionReason: '',
          adminRemarks: '',
          submittedAt: serverTimestamp()
        })

        return generatedTrackingNumber
      })

      await auditService.logAction(
        'EXCUSE_SUBMITTED',
        'excuse',
        `Submitted excuse request ${trackingNumber}`,
        performedBy,
        { trackingNumber, memberId: data.memberId }
      )

      return trackingNumber
    } catch (error) {
      console.error('Error submitting excuse request:', error)
      throw new Error('Failed to submit excuse request.')
    }
  },

  /**
   * Fetch all excuse requests with optional filters.
   */
  async getExcuseRequests(filters?: { status?: ExcuseStatus; memberId?: string }): Promise<ExcuseRequest[]> {
    try {
      let q = query(collection(db, EXCUSES_COLLECTION))

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status))
      }
      if (filters?.memberId) {
        q = query(q, where('memberId', '==', filters.memberId))
      }

      const snapshot = await getDocs(q)
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExcuseRequest[]

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
    return this.getExcuseRequests({ memberId })
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
  }
}
