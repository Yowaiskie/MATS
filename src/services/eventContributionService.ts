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
  runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { EventContribution, EventContributionPurpose } from '@/types/eventContribution'
import type { EventIncome } from '@/types/eventFinance'
import { auditService } from './auditService'

const PURPOSES_COL = 'eventContributionPurposes'
const CONTRIBUTIONS_COL = 'eventContributions'
const FINANCE_INCOME_COL = 'eventIncome'

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
    purpose: Omit<EventContributionPurpose, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName' | 'isArchived'>,
    uid: string,
    name: string
  ): Promise<string> {
    if (!purpose.eventId) throw new Error('Event ID is required.')
    if (!purpose.name.trim()) throw new Error('Purpose name is required.')
    
    const payload = {
      ...purpose,
      name: purpose.name.trim(),
      description: purpose.description?.trim() || '',
      isArchived: false,
      createdByUid: uid,
      createdByName: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    const docRef = await addDoc(collection(db, PURPOSES_COL), payload)
    await auditService.logAction(
      'CONTRIBUTION_PURPOSE_CREATE',
      'events',
      `Created contribution purpose: ${purpose.name} for event ${purpose.eventId}`,
      name,
      { eventId: purpose.eventId, purposeId: docRef.id, purposeName: purpose.name }
    )
    return docRef.id
  },

  async updatePurpose(id: string, updates: Partial<EventContributionPurpose>, eventId: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('Purpose ID is required.')
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp()
    }
    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new Error('Purpose name cannot be empty.')
      payload.name = updates.name.trim()
    }
    if (updates.description !== undefined) {
      payload.description = updates.description.trim()
    }

    await updateDoc(doc(db, PURPOSES_COL, id), payload)
    await auditService.logAction(
      'CONTRIBUTION_PURPOSE_UPDATE',
      'events',
      `Updated contribution purpose ${id}`,
      performedBy,
      { eventId, purposeId: id }
    )
  },

  async archivePurpose(id: string, eventId: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('Purpose ID is required.')
    await updateDoc(doc(db, PURPOSES_COL, id), {
      isArchived: true,
      updatedAt: serverTimestamp()
    })
    await auditService.logAction(
      'CONTRIBUTION_PURPOSE_ARCHIVE',
      'events',
      `Archived contribution purpose ${id}`,
      performedBy,
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
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0)
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0)
      return timeB - timeA
    })
  },

  async addContribution(
    contribution: Omit<EventContribution, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName' | 'status' | 'linkedFinanceIncomeId'>,
    uid: string,
    name: string
  ): Promise<string> {
    if (!contribution.eventId) throw new Error('Event ID is required.')
    if (contribution.amount <= 0) throw new Error('Contribution amount must be greater than zero.')
    if (!contribution.contributorName.trim()) throw new Error('Contributor name is required.')
    if (!contribution.purposeId) throw new Error('Purpose ID is required.')

    // Validate purpose is not archived
    const purposeRef = doc(db, PURPOSES_COL, contribution.purposeId)
    const purposeSnap = await getDoc(purposeRef)
    if (!purposeSnap.exists()) throw new Error('Purpose not found.')
    const purposeData = purposeSnap.data() as EventContributionPurpose
    if (purposeData.isArchived) throw new Error('Cannot add contribution to an archived purpose.')

    const payload = {
      ...contribution,
      contributorName: contribution.contributorName.trim(),
      notes: contribution.notes?.trim() || '',
      referenceNumber: contribution.referenceNumber?.trim() || '',
      status: 'recorded',
      createdByUid: uid,
      createdByName: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    const docRef = await addDoc(collection(db, CONTRIBUTIONS_COL), payload)
    await auditService.logAction(
      'EVENT_CONTRIBUTION_ADD',
      'events',
      `Recorded contribution of ₱${contribution.amount} from ${contribution.contributorName} for ${contribution.purposeName}`,
      name,
      { eventId: contribution.eventId, contributionId: docRef.id, amount: contribution.amount }
    )
    return docRef.id
  },

  async voidContribution(id: string, eventId: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) throw new Error('Contribution record not found.')
    const data = docSnap.data() as EventContribution
    if (data.status === 'voided') throw new Error('Contribution is already voided.')
    if (data.linkedFinanceIncomeId) throw new Error('Cannot void a linked contribution. Please contact a finance admin to unlink it first.')

    await updateDoc(docRef, {
      status: 'voided',
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_VOID',
      'events',
      `Voided contribution of ₱${data.amount} from ${data.contributorName}`,
      performedBy,
      { eventId, contributionId: id, amount: data.amount }
    )
  },

  async deleteContribution(id: string, eventId: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) throw new Error('Contribution record not found.')
    const data = docSnap.data() as EventContribution
    if (data.linkedFinanceIncomeId) {
      throw new Error('Cannot delete a contribution that is linked to Event Finance. Unlink it from finance first.')
    }

    await deleteDoc(docRef)

    await auditService.logAction(
      'EVENT_CONTRIBUTION_DELETE',
      'events',
      `Deleted contribution record of ₱${data.amount} from ${data.contributorName}`,
      performedBy,
      { eventId, contributionId: id, amount: data.amount }
    )
  },

  async archiveContribution(id: string, eventId: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) throw new Error('Contribution record not found.')
    const data = docSnap.data() as EventContribution
    if (data.linkedFinanceIncomeId) {
      throw new Error('Cannot archive a linked contribution. Unlink it from finance first.')
    }

    await updateDoc(docRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedByName: performedBy,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_ARCHIVE',
      'events',
      `Archived contribution record of ₱${data.amount} from ${data.contributorName}`,
      performedBy,
      { eventId, contributionId: id, amount: data.amount }
    )
  },

  async restoreContribution(id: string, eventId: string, performedBy: string): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    const docRef = doc(db, CONTRIBUTIONS_COL, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) throw new Error('Contribution record not found.')
    const data = docSnap.data() as EventContribution

    await updateDoc(docRef, {
      isArchived: false,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_RESTORE',
      'events',
      `Restored archived contribution record of ₱${data.amount} from ${data.contributorName}`,
      performedBy,
      { eventId, contributionId: id, amount: data.amount }
    )
  },

  async linkToFinance(
    id: string,
    categoryId: string,
    dateStr: string,
    performedByUid: string,
    performedByName: string
  ): Promise<void> {
    if (!id) throw new Error('Contribution ID is required.')
    if (!categoryId) throw new Error('Finance category is required.')
    if (!dateStr) throw new Error('Finance date is required.')

    const contribRef = doc(db, CONTRIBUTIONS_COL, id)
    const categoryRef = doc(db, 'eventFinanceCategories', categoryId)

    await runTransaction(db, async (transaction) => {
      const contribSnap = await transaction.get(contribRef)
      if (!contribSnap.exists()) throw new Error('Contribution record not found.')
      const contribData = contribSnap.data() as EventContribution

      if (contribData.status === 'voided') throw new Error('Cannot link a voided contribution.')
      if (contribData.linkedFinanceIncomeId) throw new Error('Contribution is already linked to Event Finance.')

      const categorySnap = await transaction.get(categoryRef)
      if (!categorySnap.exists()) throw new Error('Finance Category not found.')
      const categoryData = categorySnap.data() as any
      if (categoryData.eventId !== contribData.eventId) throw new Error('Finance Category does not belong to this event.')
      if (categoryData.isArchived) throw new Error('Selected category is archived.')

      // Check if period is closed (standard MATS rule checking)
      const periodId = dateStr.slice(0, 7)
      const periodRef = doc(db, 'financePeriods', periodId)
      const periodDoc = await transaction.get(periodRef)
      if (periodDoc.exists() && periodDoc.data().status === 'closed') {
        throw new Error(`The financial period ${periodId} is closed.`)
      }

      // Generate a new reference for the event income
      const incomeRef = doc(collection(db, FINANCE_INCOME_COL))

      const paymentMethodMap: Record<string, 'Cash' | 'GCash' | 'Cheque' | 'Bank Transfer'> = {
        cash: 'Cash',
        gcash: 'GCash',
        bank_transfer: 'Bank Transfer',
        other: 'Cash'
      }

      const incomePayload: Omit<EventIncome, 'id'> = {
        eventId: contribData.eventId,
        amount: contribData.amount,
        receivedFrom: contribData.contributorName,
        categoryId: categoryId,
        date: dateStr,
        paymentMethod: paymentMethodMap[contribData.paymentMethod] || 'Cash',
        description: `Linked contribution: ${contribData.purposeName}. Ref: ${contribData.referenceNumber || 'N/A'}. Notes: ${contribData.notes || 'N/A'}`,
        createdByUid: performedByUid,
        createdByName: performedByName,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        isArchived: false
      }

      transaction.set(incomeRef, incomePayload)
      transaction.update(contribRef, {
        linkedFinanceIncomeId: incomeRef.id,
        linkedAt: serverTimestamp(),
        linkedByUid: performedByUid,
        linkedByName: performedByName,
        updatedAt: serverTimestamp()
      })
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_LINK_FINANCE',
      'events',
      `Linked contribution ${id} to Event Finance`,
      performedByName,
      { eventId: id }
    )
  },

  async bulkLinkToFinance(
    ids: string[],
    categoryId: string,
    dateStr: string,
    performedByUid: string,
    performedByName: string
  ): Promise<number> {
    if (!ids || ids.length === 0) throw new Error('No contributions selected for bulk link.')
    if (!categoryId) throw new Error('Finance category is required.')
    if (!dateStr) throw new Error('Finance date is required.')

    const categoryRef = doc(db, 'eventFinanceCategories', categoryId)

    await runTransaction(db, async (transaction) => {
      const categorySnap = await transaction.get(categoryRef)
      if (!categorySnap.exists()) throw new Error('Finance Category not found.')
      const categoryData = categorySnap.data() as any
      if (categoryData.isArchived) throw new Error('Selected category is archived.')

      const periodId = dateStr.slice(0, 7)
      const periodRef = doc(db, 'financePeriods', periodId)
      const periodDoc = await transaction.get(periodRef)
      if (periodDoc.exists() && periodDoc.data().status === 'closed') {
        throw new Error(`The financial period ${periodId} is closed.`)
      }

      const paymentMethodMap: Record<string, 'Cash' | 'GCash' | 'Cheque' | 'Bank Transfer'> = {
        cash: 'Cash',
        gcash: 'GCash',
        bank_transfer: 'Bank Transfer',
        other: 'Cash'
      }

      for (const id of ids) {
        const contribRef = doc(db, CONTRIBUTIONS_COL, id)
        const contribSnap = await transaction.get(contribRef)
        if (!contribSnap.exists()) continue
        const contribData = contribSnap.data() as EventContribution

        if (contribData.status === 'voided' || contribData.linkedFinanceIncomeId) {
          continue // Skip voided or already linked records
        }

        const incomeRef = doc(collection(db, FINANCE_INCOME_COL))
        const incomePayload: Omit<EventIncome, 'id'> = {
          eventId: contribData.eventId,
          amount: contribData.amount,
          receivedFrom: contribData.contributorName,
          categoryId: categoryId,
          date: dateStr,
          paymentMethod: paymentMethodMap[contribData.paymentMethod] || 'Cash',
          description: `Bulk linked contribution: ${contribData.purposeName}. Ref: ${contribData.referenceNumber || 'N/A'}.`,
          createdByUid: performedByUid,
          createdByName: performedByName,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
          isArchived: false
        }

        transaction.set(incomeRef, incomePayload)
        transaction.update(contribRef, {
          linkedFinanceIncomeId: incomeRef.id,
          linkedAt: serverTimestamp(),
          linkedByUid: performedByUid,
          linkedByName: performedByName,
          updatedAt: serverTimestamp()
        })
      }
    })

    await auditService.logAction(
      'EVENT_CONTRIBUTION_LINK_FINANCE',
      'events',
      `Bulk linked ${ids.length} contributions to Event Finance category ${categoryId}`,
      performedByName,
      { bulkCount: ids.length, categoryId }
    )

    return ids.length
  }
}
