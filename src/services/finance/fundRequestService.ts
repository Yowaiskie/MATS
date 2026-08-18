import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  getDoc,
  serverTimestamp, 
  query, 
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { FinanceFundRequest } from '@/types/finance'
import { counterService } from './counterService'
import { auditService } from '@/services/auditService'

const REQUEST_COLLECTION = 'financeFundRequests'

/**
 * Checks if the financial period for a given date is closed.
 */
async function checkPeriodClosed(dateStr: string) {
  const periodId = dateStr.slice(0, 7)
  const docRef = doc(db, 'financePeriods', periodId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists() && docSnap.data().status === 'closed') {
    throw new Error(`The financial period ${periodId} is closed. Modifications are disabled.`)
  }
}

export const fundRequestService = {
  /**
   * Fetches fund requests, optionally filtering by date range and archived status.
   */
  async getFundRequests(startDate?: string, endDate?: string, includeArchived = false): Promise<FinanceFundRequest[]> {
    try {
      const colRef = collection(db, REQUEST_COLLECTION)
      const q = query(colRef, orderBy('dateNeeded', 'desc'))

      const querySnapshot = await getDocs(q)
      let requests: FinanceFundRequest[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        const dateNeeded = data.dateNeeded || ''

        if (startDate && dateNeeded < startDate) return
        if (endDate && dateNeeded > endDate) return

        requests.push({
          id: docSnap.id,
          title: data.title || '',
          purpose: data.purpose || '',
          requestedAmount: data.requestedAmount || 0,
          requestedByUid: data.requestedByUid || '',
          requestedByName: data.requestedByName || '',
          dateNeeded,
          description: data.description || '',
          status: data.status || 'draft',
          periodId: data.periodId || dateNeeded.slice(0, 7),
          referenceNumber: data.referenceNumber || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdByUid: data.createdByUid || '',
          createdByName: data.createdByName || '',

          // Approval / Rejection
          approvedByUid: data.approvedByUid,
          approvedByName: data.approvedByName,
          approvedAt: data.approvedAt,
          approvalRemarks: data.approvalRemarks,
          rejectedByUid: data.rejectedByUid,
          rejectedByName: data.rejectedByName,
          rejectedAt: data.rejectedAt,
          rejectionReason: data.rejectionReason,

          // Release
          releasedByUid: data.releasedByUid,
          releasedByName: data.releasedByName,
          releasedToName: data.releasedToName,
          releasedAt: data.releasedAt,
          releasedDate: data.releasedDate,
          releasedAmount: data.releasedAmount,
          releaseRemarks: data.releaseRemarks,

          // Liquidation
          totalSpent: data.totalSpent,
          remainingAmount: data.remainingAmount,
          returnedAmount: data.returnedAmount,
          liquidationRemarks: data.liquidationRemarks,
          liquidatedByUid: data.liquidatedByUid,
          liquidatedByName: data.liquidatedByName,
          liquidatedAt: data.liquidatedAt,
          liquidationReviewedByUid: data.liquidationReviewedByUid,
          liquidationReviewedByName: data.liquidationReviewedByName,
          liquidationReviewedAt: data.liquidationReviewedAt,

          // Event link
          targetEventId: data.targetEventId,
          targetEventName: data.targetEventName,
          linkedEventIncomeId: data.linkedEventIncomeId,

          isArchived: !!data.isArchived,
          archivedAt: data.archivedAt,
          archivedByUid: data.archivedByUid,
          archivedByName: data.archivedByName
        })
      })

      if (!includeArchived) {
        requests = requests.filter(r => !r.isArchived)
      }

      return requests
    } catch (err) {
      console.error('Failed to load fund requests:', err)
      throw err
    }
  },

  /**
   * Creates a new fund request (starts in 'draft' or 'pending').
   */
  async createFundRequest(
    requestData: Omit<FinanceFundRequest, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'isArchived' | 'periodId' | 'status'>,
    createdByUid: string,
    createdByName: string,
    submitImmediately = false
  ): Promise<string> {
    const { 
      title, 
      purpose, 
      requestedAmount, 
      requestedByUid, 
      requestedByName, 
      dateNeeded, 
      description,
      targetEventId,
      targetEventName
    } = requestData

    await checkPeriodClosed(dateNeeded)

    const referenceNumber = await counterService.generateReferenceNumber('FR', dateNeeded)
    const periodId = dateNeeded.slice(0, 7)
    const status = submitImmediately ? 'pending' : 'draft'

    try {
      const colRef = collection(db, REQUEST_COLLECTION)
      const docRef = await addDoc(colRef, {
        title,
        purpose,
        requestedAmount: Number(requestedAmount),
        requestedByUid,
        requestedByName,
        dateNeeded,
        description: description || '',
        status,
        referenceNumber,
        periodId,
        targetEventId: targetEventId || null,
        targetEventName: targetEventName || null,
        isArchived: false,
        createdByUid,
        createdByName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_SUBMIT',
        'attendance',
        `Created fund request '${title}' ($${requestedAmount}) as ${status} (${referenceNumber})${targetEventName ? ` for event ${targetEventName}` : ''}`,
        createdByName,
        { requestId: docRef.id, referenceNumber, amount: requestedAmount, status, targetEventId, targetEventName }
      )

      return docRef.id
    } catch (err) {
      console.error('Failed to save fund request:', err)
      throw err
    }
  },

  /**
   * Submits a draft request for approval.
   */
  async submitRequest(id: string, userUid: string, userName: string): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'draft') throw new Error('Only draft requests can be submitted.')
      await checkPeriodClosed(data.dateNeeded)

      await updateDoc(docRef, {
        status: 'pending',
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_SUBMIT',
        'attendance',
        `Submitted fund request '${data.title}' for approval (${data.referenceNumber})`,
        userName,
        { requestId: id, referenceNumber: data.referenceNumber, userUid }
      )
    } catch (err) {
      console.error('Failed to submit fund request:', err)
      throw err
    }
  },

  /**
   * Approves a pending fund request.
   */
  async approveRequest(
    id: string,
    remarks: string,
    approvedByUid: string,
    approvedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'pending') throw new Error('Only pending requests can be approved.')
      await checkPeriodClosed(data.dateNeeded)

      await updateDoc(docRef, {
        status: 'approved',
        approvedByUid,
        approvedByName,
        approvedAt: serverTimestamp(),
        approvalRemarks: remarks || '',
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_APPROVE',
        'attendance',
        `Approved fund request '${data.title}' (${data.referenceNumber})`,
        approvedByName,
        { requestId: id, referenceNumber: data.referenceNumber, remarks }
      )
    } catch (err) {
      console.error('Failed to approve fund request:', err)
      throw err
    }
  },

  /**
   * Rejects a pending fund request.
   */
  async rejectRequest(
    id: string,
    reason: string,
    rejectedByUid: string,
    rejectedByName: string
  ): Promise<void> {
    if (!reason.trim()) throw new Error('A rejection reason is required.')

    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'pending') throw new Error('Only pending requests can be rejected.')
      await checkPeriodClosed(data.dateNeeded)

      await updateDoc(docRef, {
        status: 'rejected',
        rejectedByUid,
        rejectedByName,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_REJECT',
        'attendance',
        `Rejected fund request '${data.title}' (${data.referenceNumber})`,
        rejectedByName,
        { requestId: id, referenceNumber: data.referenceNumber, reason }
      )
    } catch (err) {
      console.error('Failed to reject fund request:', err)
      throw err
    }
  },

  /**
   * Releases funds for an approved request.
   */
  async releaseFunds(
    id: string,
    releaseData: { releasedToName: string; releasedAmount: number; releasedDate: string; remarks: string },
    releasedByUid: string,
    releasedByName: string
  ): Promise<void> {
    const { releasedToName, releasedAmount, releasedDate, remarks } = releaseData

    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'approved') throw new Error('Only approved requests can be released.')
      
      await checkPeriodClosed(data.dateNeeded)
      await checkPeriodClosed(releasedDate)

      let linkedEventIncomeId: string | null = null

      // If this request is allocated for an Event, automatically create an Event Income record!
      if (data.targetEventId) {
        const eventIncomeRef = await addDoc(collection(db, 'eventIncome'), {
          eventId: data.targetEventId,
          amount: Number(releasedAmount),
          receivedFrom: 'Main Ministry Funds',
          categoryId: '',
          date: releasedDate,
          paymentMethod: 'Cash',
          allocation: 'Ministry Grant',
          description: `Budget released from Main Ministry Funds (${data.referenceNumber}) - ${data.title}`,
          isArchived: false,
          sourceType: 'main_fund_release',
          sourceFundRequestId: id,
          sourceFundRequestRef: data.referenceNumber,
          createdByUid: releasedByUid,
          createdByName: releasedByName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        linkedEventIncomeId = eventIncomeRef.id

        await auditService.logAction(
          'EVENT_INCOME_ADD',
          'events',
          `Added event income of ₱${releasedAmount} to event ${data.targetEventId} from Main Ministry Fund Release (${data.referenceNumber})`,
          releasedByName,
          { eventId: data.targetEventId, incomeId: eventIncomeRef.id, referenceNumber: data.referenceNumber }
        )
      }

      const updatePayload: any = {
        status: 'released',
        releasedByUid,
        releasedByName,
        releasedToName,
        releasedAt: serverTimestamp(),
        releasedDate,
        releasedAmount: Number(releasedAmount),
        releaseRemarks: remarks || '',
        updatedAt: serverTimestamp()
      }

      if (linkedEventIncomeId) {
        updatePayload.linkedEventIncomeId = linkedEventIncomeId
      }

      await updateDoc(docRef, updatePayload)

      await auditService.logAction(
        'FUNDS_RELEASE',
        'attendance',
        `Released ₱${releasedAmount} to ${releasedToName} for request '${data.title}' (${data.referenceNumber})${data.targetEventName ? ` (Auto-credited to event ${data.targetEventName})` : ''}`,
        releasedByName,
        { requestId: id, referenceNumber: data.referenceNumber, amount: releasedAmount, linkedEventIncomeId }
      )
    } catch (err) {
      console.error('Failed to release funds:', err)
      throw err
    }
  },

  /**
   * Submits a liquidation report for released funds.
   */
  async submitLiquidation(
    id: string,
    liquidationData: { totalSpent: number; remainingAmount: number; returnedAmount: number; remarks: string },
    liquidatedByUid: string,
    liquidatedByName: string
  ): Promise<void> {
    const { totalSpent, remainingAmount, returnedAmount, remarks } = liquidationData

    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'released') throw new Error('Liquidation can only be submitted for released requests.')

      await checkPeriodClosed(data.dateNeeded)
      if (data.releasedDate) {
        await checkPeriodClosed(data.releasedDate)
      }

      await updateDoc(docRef, {
        status: 'liquidated',
        totalSpent: Number(totalSpent),
        remainingAmount: Number(remainingAmount),
        returnedAmount: Number(returnedAmount),
        liquidationRemarks: remarks || '',
        liquidatedByUid,
        liquidatedByName,
        liquidatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'LIQUIDATION_SUBMIT',
        'attendance',
        `Submitted liquidation for '${data.title}' (Spent: $${totalSpent}, Returned: $${returnedAmount}) (${data.referenceNumber})`,
        liquidatedByName,
        { requestId: id, referenceNumber: data.referenceNumber, totalSpent, returnedAmount }
      )
    } catch (err) {
      console.error('Failed to submit liquidation:', err)
      throw err
    }
  },

  /**
   * Reviews and closes a submitted liquidation.
   */
  async reviewLiquidation(
    id: string,
    reviewedByUid: string,
    reviewedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'liquidated') throw new Error('Only liquidated requests can be reviewed and closed.')

      await checkPeriodClosed(data.dateNeeded)
      if (data.releasedDate) {
        await checkPeriodClosed(data.releasedDate)
      }

      await updateDoc(docRef, {
        status: 'closed',
        liquidationReviewedByUid: reviewedByUid,
        liquidationReviewedByName: reviewedByName,
        liquidationReviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'LIQUIDATION_APPROVE',
        'attendance',
        `Approved liquidation and closed fund request '${data.title}' (${data.referenceNumber})`,
        reviewedByName,
        { requestId: id, referenceNumber: data.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to review liquidation:', err)
      throw err
    }
  },

  /**
   * Updates an existing request (only if status is 'draft' or 'pending').
   */
  async updateRequest(
    id: string,
    updates: Partial<Omit<FinanceFundRequest, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName'>>,
    updatedByUid: string,
    updatedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const currentData = docSnap.data()
      if (currentData.status !== 'draft' && currentData.status !== 'pending') {
        throw new Error('Only draft or pending requests can be modified.')
      }

      await checkPeriodClosed(currentData.dateNeeded)
      if (updates.dateNeeded && updates.dateNeeded !== currentData.dateNeeded) {
        await checkPeriodClosed(updates.dateNeeded)
      }

      const payload: any = {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedByUid,
        updatedByName
      }

      if (updates.dateNeeded) {
        payload.periodId = updates.dateNeeded.slice(0, 7)
      }

      await updateDoc(docRef, payload)
    } catch (err) {
      console.error('Failed to update fund request:', err)
      throw err
    }
  },

  /**
   * Archives (soft-deletes) a request.
   */
  async archiveRequest(
    id: string,
    archivedByUid: string,
    archivedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const currentData = docSnap.data()
      await checkPeriodClosed(currentData.dateNeeded)

      await updateDoc(docRef, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedByUid,
        archivedByName,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_ARCHIVE',
        'attendance',
        `Archived fund request '${currentData.referenceNumber}'`,
        archivedByName,
        { requestId: id, referenceNumber: currentData.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to archive fund request:', err)
      throw err
    }
  },

  /**
   * Restores an archived request.
   */
  async restoreRequest(
    id: string,
    _restoredByUid: string,
    restoredByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const currentData = docSnap.data()
      await checkPeriodClosed(currentData.dateNeeded)

      await updateDoc(docRef, {
        isArchived: false,
        archivedAt: null,
        archivedByUid: null,
        archivedByName: null,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_RESTORE',
        'attendance',
        `Restored fund request '${currentData.referenceNumber}'`,
        restoredByName,
        { requestId: id, referenceNumber: currentData.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to restore fund request:', err)
      throw err
    }
  },

  /**
   * Permanently deletes a fund request.
   */
  async deleteRequest(
    id: string,
    _deletedByUid: string,
    deletedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const currentData = docSnap.data()
      await checkPeriodClosed(currentData.dateNeeded)

      await deleteDoc(docRef)

      await auditService.logAction(
        'REQUEST_DELETE',
        'attendance',
        `Permanently deleted fund request '${currentData.referenceNumber}' ($${currentData.requestedAmount})`,
        deletedByName,
        { requestId: id, referenceNumber: currentData.referenceNumber, amount: currentData.requestedAmount }
      )
    } catch (err) {
      console.error('Failed to permanently delete fund request:', err)
      throw err
    }
  },

  /**
   * Bulk permanently deletes fund requests.
   */
  async bulkDeleteRequests(
    ids: string[],
    deletedByUid: string,
    deletedByName: string
  ): Promise<void> {
    for (const id of ids) {
      await this.deleteRequest(id, deletedByUid, deletedByName)
    }
  },

  /**
   * Bulk archives fund requests.
   */
  async bulkArchiveRequests(
    ids: string[],
    archivedByUid: string,
    archivedByName: string
  ): Promise<void> {
    for (const id of ids) {
      await this.archiveRequest(id, archivedByUid, archivedByName)
    }
  },

  /**
   * Bulk restores fund requests.
   */
  async bulkRestoreRequests(
    ids: string[],
    restoredByUid: string,
    restoredByName: string
  ): Promise<void> {
    for (const id of ids) {
      await this.restoreRequest(id, restoredByUid, restoredByName)
    }
  }
}
