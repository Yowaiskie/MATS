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
import type { FinanceIncome } from '@/types/finance'
import { counterService } from './counterService'
import { auditService } from '@/services/auditService'

const INCOME_COLLECTION = 'financeIncome'

/**
 * Checks if the financial period for a given date is closed.
 */
async function checkPeriodClosed(dateStr: string) {
  const periodId = dateStr.slice(0, 7) // "YYYY-MM"
  const docRef = doc(db, 'financePeriods', periodId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists() && docSnap.data().status === 'closed') {
    throw new Error(`The financial period ${periodId} is closed. Modifications are disabled.`)
  }
}

export const incomeService = {
  /**
   * Fetches income records, optionally filtering by date range and archived status.
   */
  async getIncomes(startDate?: string, endDate?: string, includeArchived = false): Promise<FinanceIncome[]> {
    try {
      const colRef = collection(db, INCOME_COLLECTION)
      const q = query(colRef, orderBy('date', 'desc'))

      const querySnapshot = await getDocs(q)
      let incomes: FinanceIncome[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        const recordDate = data.date || ''
        
        // Dynamic date filtering
        if (startDate && recordDate < startDate) return
        if (endDate && recordDate > endDate) return

        incomes.push({
          id: docSnap.id,
          amount: data.amount,
          source: data.source,
          categoryId: data.categoryId,
          receivedFrom: data.receivedFrom,
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
        incomes = incomes.filter(inc => !inc.isArchived)
      }

      return incomes
    } catch (err) {
      console.error('Failed to load income records:', err)
      throw err
    }
  },

  /**
   * Creates a new income record. Generates reference number automatically.
   */
  async addIncome(
    incomeData: Omit<FinanceIncome, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'isArchived' | 'periodId'>,
    createdByUid: string,
    createdByName: string
  ): Promise<string> {
    const { date, amount, source, categoryId, receivedFrom, description } = incomeData
    
    // Check if period is closed
    await checkPeriodClosed(date)

    // Generate unique sequential reference number
    const referenceNumber = await counterService.generateReferenceNumber('INC', date)
    const periodId = date.slice(0, 7)

    try {
      const colRef = collection(db, INCOME_COLLECTION)
      const docRef = await addDoc(colRef, {
        amount: Number(amount),
        source,
        categoryId,
        receivedFrom,
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
        'INCOME_ADD',
        'attendance', // using existing category group since 'finance' isn't standard, or 'system'
        `Added income transaction of $${amount} from '${receivedFrom}' (${referenceNumber})`,
        createdByName,
        { incomeId: docRef.id, referenceNumber, amount }
      )

      return docRef.id
    } catch (err) {
      console.error('Failed to save income record:', err)
      throw err
    }
  },

  /**
   * Updates an existing income record.
   */
  async updateIncome(
    id: string,
    updates: Partial<Omit<FinanceIncome, 'id' | 'referenceNumber' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'createdByName'>>,
    updatedByUid: string,
    updatedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, INCOME_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        throw new Error('Income record does not exist.')
      }
      
      const currentData = docSnap.data()
      // Check current date and new date for period locks
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
        'INCOME_UPDATE',
        'attendance',
        `Updated income transaction details for reference '${currentData.referenceNumber}'`,
        updatedByName,
        { incomeId: id, referenceNumber: currentData.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to update income record:', err)
      throw err
    }
  },

  /**
   * Archives (soft-deletes) an income record.
   */
  async archiveIncome(
    id: string,
    archivedByUid: string,
    archivedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, INCOME_COLLECTION, id)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        throw new Error('Income record does not exist.')
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
        'INCOME_ARCHIVE',
        'attendance',
        `Archived income transaction '${currentData.referenceNumber}' ($${currentData.amount})`,
        archivedByName,
        { incomeId: id, referenceNumber: currentData.referenceNumber }
      )
    } catch (err) {
      console.error('Failed to archive income record:', err)
      throw err
    }
  }
}
