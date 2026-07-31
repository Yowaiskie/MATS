import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp, 
  query, 
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { DirectExpense } from '@/types/finance'
import { counterService } from './counterService'
import { auditService } from '@/services/auditService'

const EXPENSE_COLLECTION = 'financeExpenses'

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

export const expenseService = {
  /**
   * Fetches direct expenses, optionally filtering by date range and archived status.
   */
  async getExpenses(startDate?: string, endDate?: string, includeArchived = false): Promise<DirectExpense[]> {
    try {
      const colRef = collection(db, EXPENSE_COLLECTION)
      const q = query(colRef, orderBy('date', 'desc'))

      const querySnapshot = await getDocs(q)
      let expenses: DirectExpense[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        const recordDate = data.date || ''

        if (startDate && recordDate < startDate) return
        if (endDate && recordDate > endDate) return

        expenses.push({
          id: docSnap.id,
          amount: data.amount,
          categoryId: data.categoryId,
          spentByUid: data.spentByUid,
          spentByName: data.spentByName,
          date: recordDate,
          description: data.description || '',
          referenceNumber: data.referenceNumber || '',
          periodId: data.periodId || recordDate.slice(0, 7),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdByUid: data.createdByUid,
          createdByName: data.createdByName,
          updatedByUid: data.updatedByUid,
          updatedByName: data.updatedByName,
          isArchived: !!data.isArchived,
          archivedAt: data.archivedAt,
          archivedByUid: data.archivedByUid,
          archivedByName: data.archivedByName
        })
      })

      if (!includeArchived) {
        expenses = expenses.filter(exp => !exp.isArchived)
      }

      return expenses
    } catch (err) {
      console.error('Failed to load expense records:', err)
      throw err
    }
  },

  /**
   * Records a new direct expense.
   */
  async addExpense(
    expenseData: Omit<DirectExpense, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'isArchived' | 'periodId'>,
    createdByUid: string,
    createdByName: string
  ): Promise<string> {
    const { date, amount, categoryId, spentByUid, spentByName, description } = expenseData

    await checkPeriodClosed(date)

    const referenceNumber = await counterService.generateReferenceNumber('EXP', date)
    const periodId = date.slice(0, 7)

    try {
      const colRef = collection(db, EXPENSE_COLLECTION)
      const docRef = await addDoc(colRef, {
        amount: Number(amount),
        categoryId,
        spentByUid,
        spentByName,
        date,
        description: description || '',
        referenceNumber,
        periodId,
        isArchived: false,
        createdByUid,
        createdByName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'EXPENSE_RECORD',
        'attendance',
        `Recorded direct expense of $${amount} spent by ${spentByName} (${referenceNumber})`,
        createdByName,
        { expenseId: docRef.id, referenceNumber, amount }
      )

      return docRef.id
    } catch (err) {
      console.error('Failed to save expense record:', err)
      throw err
    }
  },

  /**
   * Updates an existing expense record.
   */
  async updateExpense(
    id: string,
    updates: Partial<Omit<DirectExpense, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName'>>,
    updatedByUid: string,
    updatedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, EXPENSE_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        throw new Error('Expense record does not exist.')
      }

      const currentData = docSnap.data()
      await checkPeriodClosed(currentData.date)
      if (updates.date && updates.date !== currentData.date) {
        await checkPeriodClosed(updates.date)
      }

      const payload: any = {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedByUid,
        updatedByName
      }

      if (updates.date) {
        payload.periodId = updates.date.slice(0, 7)
      }

      await updateDoc(docRef, payload)

      await auditService.logAction(
        'EXPENSE_UPDATE',
        'attendance',
        `Updated direct expense details for reference '${currentData.referenceNumber}'`,
        updatedByName,
        { expenseId: id, referenceNumber: currentData.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to update expense record:', err)
      throw err
    }
  },

  /**
   * Archives (soft-deletes) an expense record.
   */
  async archiveExpense(
    id: string,
    archivedByUid: string,
    archivedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, EXPENSE_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        throw new Error('Expense record does not exist.')
      }

      const currentData = docSnap.data()
      await checkPeriodClosed(currentData.date)

      await updateDoc(docRef, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedByUid,
        archivedByName,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'EXPENSE_ARCHIVE',
        'attendance',
        `Archived direct expense '${currentData.referenceNumber}' ($${currentData.amount})`,
        archivedByName,
        { expenseId: id, referenceNumber: currentData.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to archive expense record:', err)
      throw err
    }
  }
}
