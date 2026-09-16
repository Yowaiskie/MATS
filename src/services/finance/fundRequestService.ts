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

          // Request Classification & Fund Source
          requestType: data.requestType || 'requisition',
          fundSource: data.fundSource || 'main_funds',

          // Requisition Details
          fromMinistry: data.fromMinistry || '',
          venue: data.venue || '',
          participants: data.participants || '',
          assembly: data.assembly || '',
          expectedExpenses: data.expectedExpenses || [],

          // Approval / Rejection
          approvedByUid: data.approvedByUid,
          approvedByName: data.approvedByName,
          approvedAt: data.approvedAt,
          approvalRemarks: data.approvalRemarks,
          rejectedByUid: data.rejectedByUid,
          rejectedByName: data.rejectedByName,
          rejectedAt: data.rejectedAt,
          rejectionReason: data.rejectionReason,

          // Parish Priest Approval Tracking
          parishApprovedByFr: data.parishApprovedByFr,
          parishFrApprovalDate: data.parishFrApprovalDate,
          parishFrRemarks: data.parishFrRemarks,

          // Cancellation
          cancelledByUid: data.cancelledByUid,
          cancelledByName: data.cancelledByName,
          cancelledAt: data.cancelledAt,
          cancellationReason: data.cancellationReason,

          // Voiding
          voidedByUid: data.voidedByUid,
          voidedByName: data.voidedByName,
          voidedAt: data.voidedAt,
          voidReason: data.voidReason,

          // Release / Disbursement
          releasedByUid: data.releasedByUid,
          releasedByName: data.releasedByName,
          releasedToName: data.releasedToName,
          releasedAt: data.releasedAt,
          releasedDate: data.releasedDate,
          releasedAmount: data.releasedAmount,
          releaseRemarks: data.releaseRemarks,

          // Parish Office Release Specifics
          parishOfficeDisbursed: data.parishOfficeDisbursed,
          parishOfficeDisbursedDate: data.parishOfficeDisbursedDate,
          parishOfficeDisbursedAmount: data.parishOfficeDisbursedAmount,
          parishOfficeDisbursedBy: data.parishOfficeDisbursedBy,
          parishOfficeReceivedBy: data.parishOfficeReceivedBy,
          parishOfficeRemarks: data.parishOfficeRemarks,

          // Liquidation
          totalSpent: data.totalSpent,
          remainingAmount: data.remainingAmount,
          returnedAmount: data.returnedAmount,
          reimbursedAmount: data.reimbursedAmount || 0,
          liquidationRemarks: data.liquidationRemarks,
          liquidationTo: data.liquidationTo,
          liquidationFrom: data.liquidationFrom,
          liquidationDate: data.liquidationDate,
          budgetSources: data.budgetSources || [],
          liquidationExpenses: data.liquidationExpenses || [],
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
      fundSource,
      fromMinistry,
      venue,
      participants,
      assembly,
      expectedExpenses,
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
        fundSource: fundSource || 'main_funds',
        fromMinistry: fromMinistry || 'The MINISTRY OF ALTAR SERVERS',
        venue: venue || 'N/A',
        participants: participants || 'N/A',
        assembly: assembly || 'N/A',
        expectedExpenses: expectedExpenses 
          ? expectedExpenses.map(item => ({ ...item, amount: Number(String(item.amount).replace(/,/g, '')) || 0 }))
          : [],
        targetEventId: targetEventId || null,
        targetEventName: targetEventName || null,
        isArchived: false,
        createdByUid,
        createdByName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      const sourceLabel = fundSource === 'parish' ? 'Parish' : 'Main Funds'

      await auditService.logAction(
        'REQUEST_SUBMIT',
        'attendance',
        `Created fund request '${title}' (₱${requestedAmount}) from ${sourceLabel} as ${status} (${referenceNumber})${targetEventName ? ` for event ${targetEventName}` : ''}`,
        createdByName,
        { requestId: docRef.id, referenceNumber, amount: requestedAmount, status, fundSource: fundSource || 'main_funds', targetEventId, targetEventName }
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
    approvedByName: string,
    parishData?: { parishApprovedByFr?: boolean; parishFrApprovalDate?: string; parishFrRemarks?: string },
    userRole?: string,
    allowAdminExemption: boolean = false
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'pending') throw new Error('Only pending requests can be approved.')

      // Check self-approval: requester cannot approve their own request unless user is an admin or coordinator
      const isAdminExempt = allowAdminExemption || userRole === 'admin' || userRole === 'coordinator'
      const isSelfApproval = Boolean(
        (approvedByUid && (data.requestedByUid === approvedByUid || data.createdByUid === approvedByUid)) ||
        (approvedByName && data.requestedByName && data.requestedByName.trim().toLowerCase() === approvedByName.trim().toLowerCase())
      )
      if (isSelfApproval && !isAdminExempt) {
        throw new Error('Self-approval is not allowed. A different authorized administrator must approve this fund request.')
      }

      await checkPeriodClosed(data.dateNeeded)

      const updatePayload: any = {
        status: 'approved',
        approvedByUid,
        approvedByName,
        approvedAt: serverTimestamp(),
        approvalRemarks: remarks || '',
        updatedAt: serverTimestamp()
      }

      if (data.fundSource === 'parish' || parishData) {
        updatePayload.parishApprovedByFr = parishData?.parishApprovedByFr ?? true
        updatePayload.parishFrApprovalDate = parishData?.parishFrApprovalDate || new Date().toISOString().slice(0, 10)
        if (parishData?.parishFrRemarks) {
          updatePayload.parishFrRemarks = parishData.parishFrRemarks
        }
      }

      await updateDoc(docRef, updatePayload)

      await auditService.logAction(
        'REQUEST_APPROVE',
        'attendance',
        `Approved fund request '${data.title}' (${data.referenceNumber})${data.fundSource === 'parish' ? ' (Approved by Parish Priest)' : ''}`,
        approvedByName,
        { requestId: id, referenceNumber: data.referenceNumber, remarks, parishData }
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
   * Cancels a fund request (allowed for draft, pending, or approved before release).
   */
  async cancelRequest(
    id: string,
    reason: string,
    cancelledByUid: string,
    cancelledByName: string
  ): Promise<void> {
    if (!reason.trim()) throw new Error('A cancellation reason is required.')

    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status === 'cancelled') throw new Error('Fund request is already cancelled.')
      if (data.status === 'voided') throw new Error('Fund request is already voided.')
      if (data.status === 'released' || data.status === 'liquidated' || data.status === 'closed') {
        throw new Error('Funds have already been released. Please use "Void" instead of "Cancel".')
      }

      await checkPeriodClosed(data.dateNeeded)

      await updateDoc(docRef, {
        status: 'cancelled',
        cancelledByUid,
        cancelledByName,
        cancelledAt: serverTimestamp(),
        cancellationReason: reason.trim(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_CANCEL',
        'attendance',
        `Cancelled fund request '${data.title}' (${data.referenceNumber})`,
        cancelledByName,
        { requestId: id, referenceNumber: data.referenceNumber, reason: reason.trim() }
      )
    } catch (err) {
      console.error('Failed to cancel fund request:', err)
      throw err
    }
  },

  /**
   * Voids an active or released fund request with an audit trail and reverses linked event income if any.
   */
  async voidRequest(
    id: string,
    reason: string,
    voidedByUid: string,
    voidedByName: string
  ): Promise<void> {
    if (!reason.trim()) throw new Error('A reason for voiding is required.')

    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status === 'voided') throw new Error('Fund request is already voided.')
      if (data.status === 'cancelled') throw new Error('Fund request is already cancelled.')
      if (data.status !== 'released' && data.status !== 'liquidated' && data.status !== 'closed') {
        throw new Error('Funds have not been released yet. Please use "Cancel" instead of "Void".')
      }

      await checkPeriodClosed(data.dateNeeded)
      if (data.releasedDate) {
        await checkPeriodClosed(data.releasedDate)
      }

      // If funds were released to an event, soft-archive the linked event income to keep ledgers synchronized
      if (data.linkedEventIncomeId) {
        try {
          const eventIncomeRef = doc(db, 'eventIncome', data.linkedEventIncomeId)
          const incomeSnap = await getDoc(eventIncomeRef)
          if (incomeSnap.exists()) {
            await updateDoc(eventIncomeRef, {
              isArchived: true,
              archivedAt: serverTimestamp(),
              archivedByUid: voidedByUid,
              archivedByName: voidedByName,
              updatedAt: serverTimestamp()
            })
          }
        } catch (incomeErr) {
          console.warn('Could not archive linked event income on void:', incomeErr)
        }
      }

      await updateDoc(docRef, {
        status: 'voided',
        voidedByUid,
        voidedByName,
        voidedAt: serverTimestamp(),
        voidReason: reason.trim(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'REQUEST_VOID',
        'attendance',
        `Voided fund request '${data.title}' (${data.referenceNumber})`,
        voidedByName,
        { requestId: id, referenceNumber: data.referenceNumber, reason: reason.trim(), linkedEventIncomeId: data.linkedEventIncomeId }
      )
    } catch (err) {
      console.error('Failed to void fund request:', err)
      throw err
    }
  },

  /**
   * Releases funds for an approved request.
   */
  async releaseFunds(
    id: string,
    releaseData: { 
      releasedToName: string
      releasedAmount: number
      releasedDate: string
      remarks: string
      parishOfficeDisbursedDate?: string
      parishOfficeDisbursedAmount?: number
      parishOfficeDisbursedBy?: string
      parishOfficeReceivedBy?: string
      parishOfficeRemarks?: string
    },
    releasedByUid: string,
    releasedByName: string
  ): Promise<void> {
    const { 
      releasedToName, 
      releasedAmount, 
      releasedDate, 
      remarks,
      parishOfficeDisbursedDate,
      parishOfficeDisbursedAmount,
      parishOfficeDisbursedBy,
      parishOfficeReceivedBy,
      parishOfficeRemarks
    } = releaseData

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
        const isParish = data.fundSource === 'parish'
        const sourceLabel = isParish ? 'Parish Funds' : 'Main Ministry Funds'
        const allocationType = isParish ? 'Parish Grant' : 'Ministry Grant'

        const eventIncomeRef = await addDoc(collection(db, 'eventIncome'), {
          eventId: data.targetEventId,
          amount: Number(releasedAmount),
          receivedFrom: sourceLabel,
          categoryId: '',
          date: releasedDate,
          paymentMethod: 'Cash',
          allocation: allocationType,
          description: `Budget released from ${sourceLabel} (${data.referenceNumber}) - ${data.title}`,
          isArchived: false,
          sourceType: isParish ? 'general' : 'main_fund_release',
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
          `Added event income of ₱${releasedAmount} to event ${data.targetEventId} from ${sourceLabel} Release (${data.referenceNumber})`,
          releasedByName,
          { eventId: data.targetEventId, incomeId: eventIncomeRef.id, referenceNumber: data.referenceNumber, fundSource: data.fundSource || 'main_funds' }
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

      // If Parish-sourced request, record specific Parish Office release audit details
      if (data.fundSource === 'parish') {
        updatePayload.parishOfficeDisbursed = true
        updatePayload.parishOfficeDisbursedDate = parishOfficeDisbursedDate || releasedDate
        updatePayload.parishOfficeDisbursedAmount = Number(parishOfficeDisbursedAmount || releasedAmount)
        updatePayload.parishOfficeDisbursedBy = parishOfficeDisbursedBy || 'Parish Office'
        updatePayload.parishOfficeReceivedBy = parishOfficeReceivedBy || releasedToName
        if (parishOfficeRemarks) {
          updatePayload.parishOfficeRemarks = parishOfficeRemarks
        }
      }

      if (linkedEventIncomeId) {
        updatePayload.linkedEventIncomeId = linkedEventIncomeId
      }

      await updateDoc(docRef, updatePayload)

      const fundSourceLabel = data.fundSource === 'parish' ? 'Parish' : 'Main Ministry Funds'

      await auditService.logAction(
        'FUNDS_RELEASE',
        'attendance',
        `Released ₱${releasedAmount} from ${fundSourceLabel} to ${releasedToName}${parishOfficeReceivedBy ? ` (Received by: ${parishOfficeReceivedBy})` : ''} for request '${data.title}' (${data.referenceNumber})${data.targetEventName ? ` (Auto-credited to event ${data.targetEventName})` : ''}`,
        releasedByName,
        { requestId: id, referenceNumber: data.referenceNumber, amount: releasedAmount, fundSource: data.fundSource || 'main_funds', linkedEventIncomeId, parishOfficeReceivedBy }
      )
    } catch (err) {
      console.error('Failed to release funds:', err)
      throw err
    }
  },

  /**
   * Creates an Outside / Independent Liquidation report directly in 'liquidated' status.
   * Has ZERO impact on Ministry and Parish treasury ledgers.
   */
  async createOutsideLiquidation(
    data: {
      title: string
      purpose: string
      liquidationDate: string
      liquidationTo?: string
      liquidationFrom?: string
      budgetSources: import('@/types/finance').LiquidationBudgetSource[]
      liquidationExpenses: import('@/types/finance').LiquidationExpenseItem[]
      totalSpent: number
      returnedAmount: number
      reimbursedAmount: number
      remarks?: string
    },
    createdByUid: string,
    createdByName: string
  ): Promise<string> {
    const {
      title,
      purpose,
      liquidationDate,
      liquidationTo = 'Rev. Fr. ILDEFONSO DE GUZMAN JR., Parish Priest',
      liquidationFrom = 'MINISTRY OF ALTAR SERVERS',
      budgetSources,
      liquidationExpenses,
      totalSpent,
      returnedAmount,
      reimbursedAmount,
      remarks = ''
    } = data

    await checkPeriodClosed(liquidationDate)

    const referenceNumber = await counterService.generateReferenceNumber('LIQ', liquidationDate)
    const periodId = liquidationDate.slice(0, 7)
    const totalBudget = budgetSources.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

    try {
      const colRef = collection(db, REQUEST_COLLECTION)
      const docRef = await addDoc(colRef, {
        title: title.trim(),
        purpose: purpose.trim(),
        requestedAmount: totalBudget,
        requestedByUid: createdByUid,
        requestedByName: createdByName,
        dateNeeded: liquidationDate,
        description: remarks.trim() || 'Outside / Independent Liquidation Report',
        status: 'liquidated',
        requestType: 'direct_liquidation',
        fundSource: 'outside',
        referenceNumber,
        periodId,
        fromMinistry: liquidationFrom,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid,
        createdByName,

        // Direct liquidation specifics
        liquidationTo: liquidationTo.trim(),
        liquidationFrom: liquidationFrom.trim(),
        liquidationDate,
        budgetSources,
        liquidationExpenses,
        totalSpent: Number(totalSpent),
        remainingAmount: 0,
        returnedAmount: Number(returnedAmount),
        reimbursedAmount: Number(reimbursedAmount),
        liquidationRemarks: remarks.trim(),
        liquidatedByUid: createdByUid,
        liquidatedByName: createdByName,
        liquidatedAt: serverTimestamp(),

        isArchived: false
      })

      await auditService.logAction(
        'LIQUIDATION_SUBMIT',
        'attendance',
        `Recorded Outside Liquidation '${title}' (${referenceNumber}) [Total Spent: ₱${totalSpent}]`,
        createdByName,
        { requestId: docRef.id, referenceNumber, totalSpent, fundSource: 'outside' }
      )

      return docRef.id
    } catch (err) {
      console.error('Failed to create outside liquidation:', err)
      throw err
    }
  },

  /**
   * Submits a liquidation report for released funds.
   */
  async submitLiquidation(
    id: string,
    liquidationData: { 
      totalSpent: number
      remainingAmount: number
      returnedAmount: number
      reimbursedAmount?: number
      remarks: string
      liquidationTo?: string
      liquidationFrom?: string
      liquidationDate?: string
      budgetSources?: import('@/types/finance').LiquidationBudgetSource[]
      liquidationExpenses?: import('@/types/finance').LiquidationExpenseItem[]
    },
    liquidatedByUid: string,
    liquidatedByName: string
  ): Promise<void> {
    const { 
      totalSpent, 
      remainingAmount, 
      returnedAmount, 
      reimbursedAmount = 0,
      remarks,
      liquidationTo = 'Rev. Fr. ILDEFONSO DE GUZMAN JR., Parish Priest',
      liquidationFrom = 'MINISTRY OF ALTAR SERVERS',
      liquidationDate = new Date().toISOString().slice(0, 10),
      budgetSources = [],
      liquidationExpenses = []
    } = liquidationData

    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'released' && data.status !== 'liquidated') {
        throw new Error('Liquidation can only be submitted or adjusted for released or liquidated requests.')
      }

      await checkPeriodClosed(data.dateNeeded)
      if (data.releasedDate) {
        await checkPeriodClosed(data.releasedDate)
      }

      await updateDoc(docRef, {
        status: 'liquidated',
        totalSpent: Number(totalSpent),
        remainingAmount: Number(remainingAmount),
        returnedAmount: Number(returnedAmount),
        reimbursedAmount: Number(reimbursedAmount),
        liquidationRemarks: remarks || '',
        liquidationTo,
        liquidationFrom,
        liquidationDate,
        budgetSources: budgetSources.map(b => ({ ...b, amount: Number(String(b.amount).replace(/,/g, '')) || 0 })),
        liquidationExpenses: liquidationExpenses.map(e => ({ ...e, amount: Number(String(e.amount).replace(/,/g, '')) || 0 })),
        liquidatedByUid,
        liquidatedByName,
        liquidatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'LIQUIDATION_SUBMIT',
        'finance',
        `Submitted liquidation for '${data.title}' (Spent: ₱${totalSpent.toLocaleString()}, Returned: ₱${returnedAmount.toLocaleString()}) (${data.referenceNumber})`,
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
    reviewedByName: string,
    remarks?: string
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
        liquidationReviewRemarks: remarks?.trim() || null,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'LIQUIDATION_APPROVE',
        'finance',
        `Approved liquidation and closed fund request '${data.title}' (${data.referenceNumber})${remarks ? `: ${remarks}` : ''}`,
        reviewedByName,
        { requestId: id, referenceNumber: data.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to review liquidation:', err)
      throw err
    }
  },

  /**
   * Requests revisions on a submitted liquidation and returns status to 'released'.
   */
  async requestLiquidationRevision(
    id: string,
    revisionReason: string,
    requestedByUid: string,
    requestedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'liquidated') throw new Error('Only liquidated requests can be returned for revision.')

      await updateDoc(docRef, {
        status: 'released',
        liquidationRevisionReason: revisionReason.trim(),
        liquidationRevisionRequestedByUid: requestedByUid,
        liquidationRevisionRequestedByName: requestedByName,
        liquidationRevisionRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'LIQUIDATION_REVISION_REQUEST',
        'finance',
        `Returned liquidation of '${data.title}' (${data.referenceNumber}) for revision: ${revisionReason.trim()}`,
        requestedByName,
        { requestId: id, referenceNumber: data.referenceNumber, revisionReason: revisionReason.trim() }
      )
    } catch (err) {
      console.error('Failed to request liquidation revision:', err)
      throw err
    }
  },

  /**
   * Reopens a closed fund request back to 'liquidated' status for re-review or audit corrections.
   */
  async reopenLiquidationReview(
    id: string,
    reopenReason: string,
    reopenedByUid: string,
    reopenedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REQUEST_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) throw new Error('Fund request does not exist.')

      const data = docSnap.data()
      if (data.status !== 'closed') throw new Error('Only closed fund requests can be reopened for review.')

      await checkPeriodClosed(data.dateNeeded)
      if (data.releasedDate) {
        await checkPeriodClosed(data.releasedDate)
      }

      await updateDoc(docRef, {
        status: 'liquidated',
        liquidationReopenedByUid: reopenedByUid,
        liquidationReopenedByName: reopenedByName,
        liquidationReopenedAt: serverTimestamp(),
        liquidationReopenReason: reopenReason.trim() || null,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'LIQUIDATION_REOPEN',
        'finance',
        `Reopened closed liquidation of '${data.title}' (${data.referenceNumber}) for re-review${reopenReason.trim() ? `: ${reopenReason.trim()}` : ''}`,
        reopenedByName,
        { requestId: id, referenceNumber: data.referenceNumber, reopenReason: reopenReason.trim() }
      )
    } catch (err) {
      console.error('Failed to reopen liquidation for review:', err)
      throw err
    }
  },

  /**
   * Updates an existing fund request details (draft, pending, approved, or rejected).
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
      if (['released', 'liquidated', 'closed', 'voided'].includes(currentData.status)) {
        throw new Error(`Cannot edit request in '${currentData.status}' status. Funds have already been released or finalized.`)
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

      if (updates.requestedAmount !== undefined) {
        payload.requestedAmount = Number(updates.requestedAmount) || 0
      }

      if (updates.expectedExpenses) {
        payload.expectedExpenses = updates.expectedExpenses.map(item => ({
          ...item,
          amount: Number(String(item.amount).replace(/,/g, '')) || 0
        }))
      }

      if (updates.dateNeeded) {
        payload.periodId = updates.dateNeeded.slice(0, 7)
      }

      await updateDoc(docRef, payload)

      const amountLabel = updates.requestedAmount !== undefined ? ` (₱${Number(updates.requestedAmount).toLocaleString()})` : ''
      await auditService.logAction(
        'REQUEST_UPDATE',
        'attendance',
        `Updated details for fund request '${updates.title || currentData.title}'${amountLabel} (${currentData.referenceNumber})`,
        updatedByName,
        { requestId: id, referenceNumber: currentData.referenceNumber, ...updates }
      )
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
