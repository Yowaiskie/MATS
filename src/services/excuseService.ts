import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  query,
  where,
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
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
          currentCount = counterDoc.data().count || 0
        }

        const newCount = currentCount + 1
        const date = new Date()
        const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
        const paddedCount = newCount.toString().padStart(5, '0')
        const generatedTrackingNumber = `EX-${yearMonth}-${paddedCount}`

        // Update or create counter
        if (counterDoc.exists()) {
          transaction.update(counterRef, { count: newCount })
        } else {
          transaction.set(counterRef, { count: newCount })
        }

        const excuseRef = doc(collection(db, EXCUSES_COLLECTION))
        transaction.set(excuseRef, {
          ...data,
          trackingNumber: generatedTrackingNumber,
          status: 'pending' as ExcuseStatus,
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
      let q = query(collection(db, EXCUSES_COLLECTION), orderBy('submittedAt', 'desc'))

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status))
      }
      if (filters?.memberId) {
        q = query(q, where('memberId', '==', filters.memberId))
      }

      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExcuseRequest[]
    } catch (error) {
      console.error('Error fetching excuse requests:', error)
      throw new Error('Failed to fetch excuse requests.')
    }
  },

  /**
   * Fetch a single excuse request by its tracking number.
   */
  async getExcuseRequestByTrackingNumber(trackingNumber: string): Promise<ExcuseRequest | null> {
    try {
      const q = query(
        collection(db, EXCUSES_COLLECTION),
        where('trackingNumber', '==', trackingNumber)
      )
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) return null
      
      const docSnap = snapshot.docs[0]
      return { id: docSnap.id, ...docSnap.data() } as ExcuseRequest
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
      await updateDoc(ref, {
        status: 'approved' as ExcuseStatus,
        adminRemarks,
        reviewedAt: serverTimestamp(),
        reviewedByUid: adminUid,
        reviewedByName: adminName
      })

      await auditService.logAction(
        'EXCUSE_APPROVED',
        'excuse',
        `Approved excuse request ${trackingNumber}`,
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
