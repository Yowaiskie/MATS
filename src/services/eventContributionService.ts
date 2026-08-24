import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  getDoc,
  deleteDoc,
  deleteField,
  runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { EventContribution, EventContributionPurpose, ContributionLinkAllocation, ContributionPaymentMethod } from '@/types/eventContribution'
import { getContributionLinkSummary } from '@/types/eventContribution'
import type { EventIncome } from '@/types/eventFinance'
import { auditService } from './auditService'

const PURPOSES_COL = 'eventContributionPurposes'
const CONTRIBUTIONS_COL = 'eventContributions'
const FINANCE_INCOME_COL = 'eventIncome'

export interface LinkToFinanceOptions {
  destination?: 'current_event' | 'main_funds' | 'other_event'
  targetEventId?: string
  targetEventName?: string
  currentEventName?: string
  linkAmount?: number
}

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (Array.isArray(val)) {
        result[key] = val.map(item => (typeof item === 'object' && item !== null && !(item instanceof Date)) ? sanitizeForFirestore(item) : item)
      } else if (typeof val === 'object' && val !== null && !(val instanceof Date) && typeof (val as any).toDate !== 'function') {
        result[key] = sanitizeForFirestore(val)
      } else {
        result[key] = val
      }
    }
  }
  return result
}

export const eventContributionService = {
  // Purpose Methods
  async getPurposesByEventId(eventId: string): Promise<EventContributionPurpose[]> {
    if (!eventId) throw new Error('Event ID is required.')
    const q = query(
      collection(db, PURPOSES_COL),
      where('eventId', '==', eventId)
    )
    const snap = await getDocs(q)
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventContributionPurpose))
    return data.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0)
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0)
      return timeB - timeA
    })
  },

  async createPurpose(
    purpose: Omit<EventContributionPurpose, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'createdByUid' | 'createdByName'>,
    performedByUid: string,
    performedByName: string
  ): Promise<string> {
    if (!purpose.eventId) throw new Error('Event ID is required.')
    if (!purpose.name || !purpose.name.trim()) throw new Error('Purpose name is required.')

    const payload = {
      ...purpose,
      name: purpose.name.trim(),
      description: purpose.description ? purpose.description.trim() : '',
      isArchived: false,
      createdByUid: performedByUid,
      createdByName: performedByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    const docRef = await addDoc(collection(db, PURPOSES_COL), payload)
    await auditService.logAction(
      'CONTRIBUTION_PURPOSE_CREATE',
      'events',
      `Created contribution purpose '${purpose.name}' for event ${purpose.eventId}`,
      performedByName,
      { eventId: purpose.eventId, purposeId: docRef.id }
    )
    return docRef.id
  },

  async updatePurpose(
    id: string,
    updates: { name?: string; description?: string },
    eventId: string,
    performedByName: string
  ): Promise<void> {
    if (!id) throw new Error('Purpose ID is required.')
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp()
    }
    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new Error('Purpose name is required.')
      payload.name = updates.name.trim()
    }
    if (updates.description !== undefined) {
      payload.description = updates.description.trim()
    }

    const docRef = doc(db, PURPOSES_COL, id)
    await updateDoc(docRef, payload)

    await auditService.logAction(
      'CONTRIBUTION_PURPOSE_UPDATE',
      'events',
      `Updated contribution purpose ${id} for event ${eventId}`,
      performedByName,
      { eventId, purposeId: id }
    )
  },

  async archivePurpose(id: string, eventId: string, performedByName: string): Promise<void> {
    if (!id) throw new Error('Purpose ID is required.')
    const docRef = doc(db, PURPOSES_COL, id)
    await updateDoc(docRef, {
      isArchived: true,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'CONTRIBUTION_PURPOSE_ARCHIVE',
      'events',
      `Archived contribution purpose ${id} for event ${eventId}`,
      performedByName,
      { eventId, purposeId: id }
    )
  },

  // Contribution Methods
  async getContributionsByEventId(eventId: string): Promise<EventContribution[]> {
    if (!eventId) throw new Error('Event ID is required.')
    const q = query(
      collection(db, CONTRIBUTIONS_COL),
      where('eventId', '==', eventId)
    )
    const snap = await getDocs(q)
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventContribution))
    return data.sort((a, b) => {
      const timeA = a.contributedAt?.toDate ? a.contributedAt.toDate().getTime() : (a.contributedAt ? new Date(a.contributedAt as any).getTime() : 0)
      const timeB = b.contributedAt?.toDate ? b.contributedAt.toDate().getTime() : (b.contributedAt ? new Date(b.contributedAt as any).getTime() : 0)
      return timeB - timeA
    })
  },

  async addContribution(
    contribution: Omit<EventContribution, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName' | 'status' | 'linkedFinanceIncomeId'>,
    performedByUid: string,
    performedByName: string
  ): Promise<string> {
    if (!contribution.eventId) throw new Error('Event ID is required.')
    if (!contribution.contributorName || !contribution.contributorName.trim()) {
      throw new Error('Contributor name is required.')
    }
    if (!contribution.purposeId) throw new Error('Contribution purpose is required.')
    if (typeof contribution.amount !== 'number' || contribution.amount <= 0) {
      throw new Error('Valid contribution amount is required.')
    }

    const payload = {
      ...contribution,
      contributorName: contribution.contributorName.trim(),
      notes: contribution.notes ? contribution.notes.trim() : '',
      referenceNumber: contribution.referenceNumber ? contribution.referenceNumber.trim() : '',
      collectedByName: contribution.collectedByName ? contribution.collectedByName.trim() : '',
      status: 'recorded',
      isArchived: false,
      createdByUid: performedByUid,
      createdByName: performedByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    const docRef = await addDoc(collection(db, CONTRIBUTIONS_COL), payload)
    await auditService.logAction(
      'EVENT_CONTRIBUTION_ADD',
      'events',
      `Recorded contribution of ₱${contribution.amount} from '${contribution.contributorName}' for purpose '${contribution.purposeName}'`,
      performedByName,
      { eventId: contribution.eventId, contributionId: docRef.id, amount: contribution.amount }
    )
    return docRef.id
  },

  async updateContribution(
    id: string,
    updates: {
      contributorUid?: string | null
      contributorName: string
      purposeId: string
      purposeName: string
      amount: number
      paymentMethod: ContributionPaymentMethod
      referenceNumber?: string
      collectedByName?: string
      notes?: string
      contributedAt: any
    },
    _performedByUid: string,
    performedByName: string
  ): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) throw new Error('Contribution record not found.')

    const existingData = docSnap.data() as EventContribution
    if (existingData.status === 'voided') {
      throw new Error('Cannot edit a voided contribution.')
    }

    if (!updates.contributorName || !updates.contributorName.trim()) {
      throw new Error('Contributor name is required.')
    }
    if (!updates.purposeId) {
      throw new Error('Contribution purpose is required.')
    }
    if (typeof updates.amount !== 'number' || updates.amount <= 0) {
      throw new Error('Valid contribution amount is required.')
    }

    const summary = getContributionLinkSummary(existingData)
    if (summary.totalLinked > 0 && updates.amount < summary.totalLinked) {
      throw new Error(
        `Cannot reduce amount below already linked total of ₱${summary.totalLinked.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Please unlink finance portions first.`
      )
    }

    const payload = sanitizeForFirestore({
      contributorUid: updates.contributorUid || null,
      contributorName: updates.contributorName.trim(),
      purposeId: updates.purposeId,
      purposeName: updates.purposeName,
      amount: updates.amount,
      paymentMethod: updates.paymentMethod,
      referenceNumber: (updates.paymentMethod === 'gcash' || updates.paymentMethod === 'bank_transfer') ? (updates.referenceNumber?.trim() || '') : '',
      collectedByName: updates.collectedByName ? updates.collectedByName.trim() : '',
      notes: updates.notes ? updates.notes.trim() : '',
      contributedAt: updates.contributedAt,
      updatedAt: serverTimestamp()
    })

    await updateDoc(docRef, payload)

    await auditService.logAction(
      'EVENT_CONTRIBUTION_UPDATE',
      'events',
      `Updated contribution record ${id} of ₱${updates.amount} from '${updates.contributorName}' for purpose '${updates.purposeName}'`,
      performedByName,
      { eventId: existingData.eventId, contributionId: id, amount: updates.amount }
    )
  },

  async voidContribution(
    id: string,
    eventId: string,
    performedByName: string,
    reason?: string
  ): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) throw new Error('Contribution not found.')

    const data = docSnap.data() as EventContribution
    if (data.status === 'voided') throw new Error('Contribution is already voided.')
    if (data.linkedFinanceIncomeId) throw new Error('Cannot void a linked contribution. Please contact a finance admin to unlink it first.')

    const voidReason = reason ? ` | VOID REASON: ${reason}` : ''
    await updateDoc(docRef, {
      status: 'voided',
      notes: data.notes ? `${data.notes}${voidReason}` : voidReason.replace(' | ', ''),
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_VOID',
      'events',
      `Voided contribution ${id} of ₱${data.amount}${reason ? '. Reason: ' + reason : ''}`,
      performedByName,
      { eventId, contributionId: id, reason }
    )
  },

  async archiveContribution(id: string, eventId: string, performedByName: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const snap = await getDoc(docRef)
    if (!snap.exists()) throw new Error('Contribution not found.')
    const data = snap.data() as EventContribution
    if (data.linkedFinanceIncomeId) {
      throw new Error('Cannot archive a contribution linked to Finance.')
    }

    await updateDoc(docRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedByName: performedByName,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_ARCHIVE',
      'events',
      `Archived contribution record ${id}`,
      performedByName,
      { eventId, contributionId: id }
    )
  },

  async restoreContribution(id: string, eventId: string, performedByName: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    await updateDoc(docRef, {
      isArchived: false,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_RESTORE',
      'events',
      `Restored contribution record ${id}`,
      performedByName,
      { eventId, contributionId: id }
    )
  },

  async unlinkFromFinance(id: string, performedByName: string, allocationId?: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const contribRef = doc(db, CONTRIBUTIONS_COL, id)
    const snap = await getDoc(contribRef)
    if (!snap.exists()) throw new Error('Contribution record not found.')
    const data = snap.data() as EventContribution

    const summary = getContributionLinkSummary(data)
    if (summary.status === 'unlinked') {
      return // Not linked
    }

    const allocationsToDelete = allocationId
      ? summary.allocations.filter(a => a.id === allocationId)
      : summary.allocations

    for (const alloc of allocationsToDelete) {
      if (alloc.financeIncomeId) {
        if (alloc.destination === 'main_funds') {
          try {
            await deleteDoc(doc(db, 'financeIncome', alloc.financeIncomeId))
          } catch (err) {
            console.warn('Main finance income entry was already deleted or not found:', err)
          }
        } else {
          try {
            await deleteDoc(doc(db, FINANCE_INCOME_COL, alloc.financeIncomeId))
          } catch (err) {
            console.warn('Event finance income entry was already deleted or not found:', err)
          }
        }
      }
    }

    const remainingAllocations = allocationId
      ? summary.allocations.filter(a => a.id !== allocationId)
      : []

    if (remainingAllocations.length === 0) {
      await updateDoc(contribRef, {
        linkedAllocations: deleteField(),
        linkedFinanceIncomeId: deleteField(),
        linkedDestination: deleteField(),
        linkedTargetEventId: deleteField(),
        linkedTargetEventName: deleteField(),
        linkedAt: deleteField(),
        linkedByUid: deleteField(),
        linkedByName: deleteField(),
        updatedAt: serverTimestamp()
      })
    } else {
      const primaryAlloc = remainingAllocations[0]
      await updateDoc(contribRef, {
        linkedAllocations: remainingAllocations,
        linkedFinanceIncomeId: primaryAlloc.financeIncomeId,
        linkedDestination: primaryAlloc.destination,
        linkedTargetEventId: primaryAlloc.targetEventId || deleteField(),
        linkedTargetEventName: primaryAlloc.targetEventName || deleteField(),
        linkedAt: primaryAlloc.linkedAt || serverTimestamp(),
        linkedByUid: primaryAlloc.linkedByUid,
        linkedByName: primaryAlloc.linkedByName,
        updatedAt: serverTimestamp()
      })
    }

    await auditService.logAction(
      'EVENT_CONTRIBUTION_LINK_FINANCE',
      'events',
      `Unlinked ${allocationsToDelete.length} finance allocation(s) from contribution ${id} of ₱${data.amount}`,
      performedByName,
      { eventId: data.eventId, contributionId: id, allocationId }
    )
  },

  async deleteContribution(id: string, eventId: string, performedByName: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const snap = await getDoc(docRef)
    if (!snap.exists()) throw new Error('Contribution not found.')
    const data = snap.data() as EventContribution

    const summary = getContributionLinkSummary(data)
    for (const alloc of summary.allocations) {
      if (alloc.financeIncomeId) {
        if (alloc.destination === 'main_funds') {
          try {
            await deleteDoc(doc(db, 'financeIncome', alloc.financeIncomeId))
          } catch (err) {
            console.warn('Main finance income entry not found or already deleted:', err)
          }
        } else {
          try {
            await deleteDoc(doc(db, FINANCE_INCOME_COL, alloc.financeIncomeId))
          } catch (err) {
            console.warn('Event finance income entry not found or already deleted:', err)
          }
        }
      }
    }

    await deleteDoc(docRef)
    await auditService.logAction(
      'EVENT_CONTRIBUTION_DELETE',
      'events',
      `Permanently deleted contribution record ${id} of ₱${data.amount}`,
      performedByName,
      { eventId, contributionId: id }
    )
  },

  async linkToFinance(
    id: string,
    categoryId: string,
    dateStr: string,
    performedByUid: string,
    performedByName: string,
    options?: LinkToFinanceOptions
  ): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    if (!categoryId) throw new Error('Finance category is required.')
    if (!dateStr) throw new Error('Finance date is required.')

    const destination = options?.destination || 'current_event'
    const targetEventId = destination === 'other_event' ? options?.targetEventId : undefined
    const targetEventName = destination === 'other_event' ? options?.targetEventName : undefined
    const currentEventName = options?.currentEventName || 'Event'

    if (destination === 'other_event' && !targetEventId) {
      throw new Error('Target event is required when linking to another event.')
    }

    const contribRef = doc(db, CONTRIBUTIONS_COL, id)

    let finalLinkedAmount = 0
    let finalRemainingAmount = 0

    await runTransaction(db, async (transaction) => {
      // ==========================================
      // 1. ALL READS FIRST
      // ==========================================
      const contribSnap = await transaction.get(contribRef)
      if (!contribSnap.exists()) throw new Error('Contribution record not found.')
      const contribData = contribSnap.data() as EventContribution

      if (contribData.status === 'voided') throw new Error('Cannot link a voided contribution.')

      const summary = getContributionLinkSummary(contribData)
      if (summary.remainingToLink <= 0) {
        throw new Error('Contribution is already fully linked to Finance.')
      }

      const requestedLinkAmount = options?.linkAmount !== undefined && options?.linkAmount !== null
        ? Number(options.linkAmount)
        : summary.remainingToLink

      if (isNaN(requestedLinkAmount) || requestedLinkAmount <= 0) {
        throw new Error('Valid linking amount is required.')
      }
      if (requestedLinkAmount > summary.remainingToLink) {
        throw new Error(`Linking amount (₱${requestedLinkAmount.toLocaleString()}) cannot exceed remaining unlinked amount (₱${summary.remainingToLink.toLocaleString()}).`)
      }

      finalLinkedAmount = requestedLinkAmount
      finalRemainingAmount = summary.remainingToLink - requestedLinkAmount

      // Read financial period
      const periodId = dateStr.slice(0, 7)
      const periodRef = doc(db, 'financePeriods', periodId)
      const periodDoc = await transaction.get(periodRef)
      if (periodDoc.exists() && periodDoc.data().status === 'closed') {
        throw new Error(`The financial period ${periodId} is closed.`)
      }

      let nextSeq = 1
      let counterRef: any = null
      let effectiveEventId: string = contribData.eventId
      let resolvedCategoryName = ''

      if (destination === 'main_funds') {
        const catRef = doc(db, 'financeCategories', categoryId)
        const catSnap = await transaction.get(catRef)
        const catData = catSnap.data() as any
        if (!catSnap.exists() || catData?.isArchived) {
          throw new Error('Selected Main Finance category is invalid or archived.')
        }
        resolvedCategoryName = catData?.name || ''

        const yearMonth = dateStr.slice(0, 7).replace('-', '')
        const counterId = `finance_inc_${yearMonth}`
        counterRef = doc(db, 'counters', counterId)
        const counterDoc = await transaction.get(counterRef)
        const counterData = counterDoc.data() as any
        if (counterDoc.exists() && counterData?.currentSeq) {
          nextSeq = Number(counterData.currentSeq) + 1
        }
      } else {
        effectiveEventId = destination === 'other_event' ? targetEventId! : contribData.eventId
        const categoryRef = doc(db, 'eventFinanceCategories', categoryId)
        const categorySnap = await transaction.get(categoryRef)
        if (!categorySnap.exists()) throw new Error('Event Finance Category not found.')
        const categoryData = categorySnap.data() as any
        if (categoryData.eventId !== effectiveEventId) {
          throw new Error('Finance Category does not belong to the selected event.')
        }
        if (categoryData.isArchived) throw new Error('Selected category is archived.')
        resolvedCategoryName = categoryData?.name || ''
      }

      // ==========================================
      // 2. ALL WRITES AFTER ALL READS
      // ==========================================
      const paymentMethodMap: Record<string, 'Cash' | 'GCash' | 'Cheque' | 'Bank Transfer'> = {
        cash: 'Cash',
        gcash: 'GCash',
        bank_transfer: 'Bank Transfer',
        other: 'Cash'
      }

      const newAllocId = 'alloc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

      if (destination === 'main_funds') {
        const yearMonth = dateStr.slice(0, 7).replace('-', '')
        transaction.set(counterRef, { currentSeq: nextSeq }, { merge: true })
        const paddedSeq = String(nextSeq).padStart(5, '0')
        const referenceNumber = `INC-${yearMonth}-${paddedSeq}`

        const mainIncomeRef = doc(collection(db, 'financeIncome'))
        transaction.set(mainIncomeRef, {
          amount: requestedLinkAmount,
          source: `Event Contribution: ${currentEventName}`,
          categoryId,
          receivedFrom: contribData.contributorName,
          date: dateStr,
          description: `Contribution (${contribData.purposeName}) from event "${currentEventName}". Ref: ${contribData.referenceNumber || 'N/A'}.${contribData.collectedByName ? ' Collector: ' + contribData.collectedByName + '.' : ''}${contribData.notes ? ' Notes: ' + contribData.notes : ''}`,
          referenceNumber,
          periodId,
          isArchived: false,
          createdByUid: performedByUid,
          createdByName: performedByName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        const newAllocation: ContributionLinkAllocation = {
          id: newAllocId,
          amount: requestedLinkAmount,
          destination: 'main_funds',
          financeIncomeId: mainIncomeRef.id,
          categoryId: categoryId || '',
          categoryName: resolvedCategoryName || '',
          date: dateStr || '',
          linkedAt: new Date().toISOString(),
          linkedByUid: performedByUid || '',
          linkedByName: performedByName || ''
        }

        const existingAllocations = summary.allocations
        const updatedAllocations = [...existingAllocations, newAllocation]

        transaction.update(contribRef, sanitizeForFirestore({
          linkedAllocations: updatedAllocations.map(a => sanitizeForFirestore(a)),
          linkedFinanceIncomeId: mainIncomeRef.id,
          linkedDestination: updatedAllocations.length === 1 ? 'main_funds' : 'current_event',
          updatedAt: serverTimestamp()
        }))
      } else {
        const incomeRef = doc(collection(db, FINANCE_INCOME_COL))
        const descPrefix = destination === 'other_event' 
          ? `Linked contribution from event "${currentEventName || 'Event'}": ${contribData.purposeName}`
          : `Linked contribution: ${contribData.purposeName}`

        const incomePayload: Omit<EventIncome, 'id'> = {
          eventId: effectiveEventId,
          amount: requestedLinkAmount,
          receivedFrom: contribData.contributorName,
          categoryId: categoryId,
          date: dateStr,
          paymentMethod: paymentMethodMap[contribData.paymentMethod] || 'Cash',
          description: `${descPrefix}. Ref: ${contribData.referenceNumber || 'N/A'}.${contribData.collectedByName ? ' Collector: ' + contribData.collectedByName + '.' : ''}${contribData.notes ? ' Notes: ' + contribData.notes : ''}`,
          createdByUid: performedByUid,
          createdByName: performedByName,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
          isArchived: false
        }

        transaction.set(incomeRef, sanitizeForFirestore(incomePayload))

        const newAllocation: ContributionLinkAllocation = {
          id: newAllocId,
          amount: requestedLinkAmount,
          destination,
          financeIncomeId: incomeRef.id,
          categoryId: categoryId || '',
          categoryName: resolvedCategoryName || '',
          date: dateStr || '',
          linkedAt: new Date().toISOString(),
          linkedByUid: performedByUid || '',
          linkedByName: performedByName || ''
        }
        if (destination === 'other_event' && targetEventId) {
          newAllocation.targetEventId = targetEventId
          if (targetEventName) newAllocation.targetEventName = targetEventName
        }

        const existingAllocations = summary.allocations
        const updatedAllocations = [...existingAllocations, newAllocation]

        const updatePayload: Record<string, any> = {
          linkedAllocations: updatedAllocations.map(a => sanitizeForFirestore(a)),
          linkedFinanceIncomeId: incomeRef.id,
          linkedDestination: destination,
          updatedAt: serverTimestamp()
        }
        if (destination === 'other_event' && targetEventId) {
          updatePayload.linkedTargetEventId = targetEventId
          if (targetEventName) updatePayload.linkedTargetEventName = targetEventName
        } else {
          updatePayload.linkedTargetEventId = contribData.eventId || ''
          if (currentEventName) updatePayload.linkedTargetEventName = currentEventName
        }

        transaction.update(contribRef, sanitizeForFirestore(updatePayload))
      }
    })

    const destLabel = destination === 'main_funds' 
      ? 'Main Church Funds' 
      : destination === 'other_event' 
        ? `Target Event "${targetEventName || targetEventId}"` 
        : 'Event Finance'

    await auditService.logAction(
      'EVENT_CONTRIBUTION_LINK_FINANCE',
      'events',
      `Linked ₱${finalLinkedAmount.toLocaleString()} of contribution ${id} to ${destLabel}${finalRemainingAmount > 0 ? ` (Remaining unlinked balance: ₱${finalRemainingAmount.toLocaleString()})` : ''}`,
      performedByName,
      { eventId: id, destination, targetEventId, linkedAmount: finalLinkedAmount, remainingAmount: finalRemainingAmount }
    )
  },

  async bulkLinkToFinance(
    ids: string[],
    categoryId: string,
    dateStr: string,
    performedByUid: string,
    performedByName: string,
    options?: LinkToFinanceOptions
  ): Promise<number> {
    if (!ids || ids.length === 0) throw new Error('No contributions selected for bulk link.')
    if (!categoryId) throw new Error('Finance category is required.')
    if (!dateStr) throw new Error('Finance date is required.')

    const destination = options?.destination || 'current_event'
    const targetEventId = destination === 'other_event' ? options?.targetEventId : undefined
    const targetEventName = destination === 'other_event' ? options?.targetEventName : undefined
    const currentEventName = options?.currentEventName || 'Event'

    if (destination === 'other_event' && !targetEventId) {
      throw new Error('Target event is required when linking to another event.')
    }

    let linkedCount = 0

    await runTransaction(db, async (transaction) => {
      // ==========================================
      // 1. ALL READS FIRST
      // ==========================================
      const periodId = dateStr.slice(0, 7)
      const periodRef = doc(db, 'financePeriods', periodId)
      const periodDoc = await transaction.get(periodRef)
      if (periodDoc.exists() && periodDoc.data().status === 'closed') {
        throw new Error(`The financial period ${periodId} is closed.`)
      }

      // Read all contribution records FIRST
      const validContribs: { docRef: any; data: EventContribution; linkAmount: number; summary: any }[] = []
      for (const id of ids) {
        const contribRef = doc(db, CONTRIBUTIONS_COL, id)
        const contribSnap = await transaction.get(contribRef)
        if (contribSnap.exists()) {
          const contribData = contribSnap.data() as EventContribution
          if (contribData.status !== 'voided') {
            const summary = getContributionLinkSummary(contribData)
            if (summary.remainingToLink > 0) {
              validContribs.push({
                docRef: contribRef,
                data: contribData,
                linkAmount: summary.remainingToLink,
                summary
              })
            }
          }
        }
      }

      linkedCount = validContribs.length
      if (validContribs.length === 0) {
        return
      }

      let currentSeq = 0
      let counterRef: any = null
      let effectiveEventId: string | null = null
      let resolvedCategoryName = ''

      if (destination === 'main_funds') {
        const catRef = doc(db, 'financeCategories', categoryId)
        const catSnap = await transaction.get(catRef)
        const catData = catSnap.data() as any
        if (!catSnap.exists() || catData?.isArchived) {
          throw new Error('Selected Main Finance category is invalid or archived.')
        }
        resolvedCategoryName = catData?.name || ''

        const yearMonth = dateStr.slice(0, 7).replace('-', '')
        const counterId = `finance_inc_${yearMonth}`
        counterRef = doc(db, 'counters', counterId)
        const counterDoc = await transaction.get(counterRef)
        const counterData = counterDoc.data() as any
        currentSeq = (counterDoc.exists() && counterData?.currentSeq) ? Number(counterData.currentSeq) : 0
      } else {
        effectiveEventId = destination === 'other_event' ? targetEventId! : null
        const categoryRef = doc(db, 'eventFinanceCategories', categoryId)
        const categorySnap = await transaction.get(categoryRef)
        if (!categorySnap.exists()) throw new Error('Finance Category not found.')
        const categoryData = categorySnap.data() as any
        if (categoryData.isArchived) throw new Error('Selected category is archived.')
        resolvedCategoryName = categoryData?.name || ''
      }

      // ==========================================
      // 2. ALL WRITES AFTER ALL READS
      // ==========================================
      const paymentMethodMap: Record<string, 'Cash' | 'GCash' | 'Cheque' | 'Bank Transfer'> = {
        cash: 'Cash',
        gcash: 'GCash',
        bank_transfer: 'Bank Transfer',
        other: 'Cash'
      }

      if (destination === 'main_funds') {
        const yearMonth = dateStr.slice(0, 7).replace('-', '')
        for (const item of validContribs) {
          currentSeq += 1
          const paddedSeq = String(currentSeq).padStart(5, '0')
          const referenceNumber = `INC-${yearMonth}-${paddedSeq}`

          const mainIncomeRef = doc(collection(db, 'financeIncome'))
          transaction.set(mainIncomeRef, {
            amount: item.linkAmount,
            source: `Event Contribution: ${currentEventName}`,
            categoryId,
            receivedFrom: item.data.contributorName,
            date: dateStr,
            description: `Bulk linked contribution (${item.data.purposeName}) from event "${currentEventName}". Ref: ${item.data.referenceNumber || 'N/A'}.`,
            referenceNumber,
            periodId,
            isArchived: false,
            createdByUid: performedByUid,
            createdByName: performedByName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })

          const newAllocId = 'alloc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
          const newAllocation: ContributionLinkAllocation = {
            id: newAllocId,
            amount: item.linkAmount,
            destination: 'main_funds',
            financeIncomeId: mainIncomeRef.id,
            categoryId,
            categoryName: resolvedCategoryName,
            date: dateStr,
            linkedAt: new Date().toISOString(),
            linkedByUid: performedByUid,
            linkedByName: performedByName
          }

          const existingAllocations = item.summary.allocations
          const updatedAllocations = [...existingAllocations, newAllocation]

          transaction.update(item.docRef, {
            linkedAllocations: updatedAllocations,
            linkedFinanceIncomeId: mainIncomeRef.id,
            linkedDestination: 'main_funds',
            updatedAt: serverTimestamp()
          })
        }

        transaction.set(counterRef, { currentSeq }, { merge: true })
      } else {
        for (const item of validContribs) {
          const targetEvent = effectiveEventId || item.data.eventId
          const incomeRef = doc(collection(db, FINANCE_INCOME_COL))
          const descPrefix = destination === 'other_event' 
            ? `Bulk linked contribution from event "${currentEventName}": ${item.data.purposeName}`
            : `Bulk linked contribution: ${item.data.purposeName}`

          const incomePayload: Omit<EventIncome, 'id'> = {
            eventId: targetEvent,
            amount: item.linkAmount,
            receivedFrom: item.data.contributorName,
            categoryId: categoryId,
            date: dateStr,
            paymentMethod: paymentMethodMap[item.data.paymentMethod] || 'Cash',
            description: `${descPrefix}. Ref: ${item.data.referenceNumber || 'N/A'}.`,
            createdByUid: performedByUid,
            createdByName: performedByName,
            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
            isArchived: false
          }

          transaction.set(incomeRef, sanitizeForFirestore(incomePayload))

          const newAllocId = 'alloc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
          const newAllocation: ContributionLinkAllocation = {
            id: newAllocId,
            amount: item.linkAmount,
            destination,
            financeIncomeId: incomeRef.id,
            categoryId: categoryId || '',
            categoryName: resolvedCategoryName || '',
            date: dateStr || '',
            linkedAt: new Date().toISOString(),
            linkedByUid: performedByUid || '',
            linkedByName: performedByName || ''
          }
          if (destination === 'other_event' && targetEventId) {
            newAllocation.targetEventId = targetEventId
            if (targetEventName) newAllocation.targetEventName = targetEventName
          }

          const existingAllocations = item.summary.allocations
          const updatedAllocations = [...existingAllocations, newAllocation]

          const updatePayload: Record<string, any> = {
            linkedAllocations: updatedAllocations.map(a => sanitizeForFirestore(a)),
            linkedFinanceIncomeId: incomeRef.id,
            linkedDestination: destination,
            updatedAt: serverTimestamp()
          }
          if (destination === 'other_event' && targetEventId) {
            updatePayload.linkedTargetEventId = targetEventId
            if (targetEventName) updatePayload.linkedTargetEventName = targetEventName
          } else {
            updatePayload.linkedTargetEventId = item.data.eventId || ''
            if (currentEventName) updatePayload.linkedTargetEventName = currentEventName
          }

          transaction.update(item.docRef, sanitizeForFirestore(updatePayload))
        }
      }
    })

    const destLabel = destination === 'main_funds' 
      ? 'Main Church Funds' 
      : destination === 'other_event' 
        ? `Target Event "${targetEventName || targetEventId}"` 
        : 'Event Finance'

    await auditService.logAction(
      'EVENT_CONTRIBUTION_LINK_FINANCE',
      'events',
      `Bulk linked ${linkedCount} contributions to ${destLabel}`,
      performedByName,
      { bulkCount: linkedCount, categoryId, destination, targetEventId }
    )

    return linkedCount
  }
}
