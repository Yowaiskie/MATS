import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc,
  serverTimestamp, 
  query, 
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { FinancePeriod } from '@/types/finance'
import { auditService } from '@/services/auditService'

const PERIOD_COLLECTION = 'financePeriods'

export const financePeriodService = {
  /**
   * Fetches all registered financial period documents, sorted chronologically.
   */
  async getPeriods(): Promise<FinancePeriod[]> {
    try {
      const colRef = collection(db, PERIOD_COLLECTION)
      const q = query(colRef, orderBy('id', 'desc'))
      const querySnapshot = await getDocs(q)
      const periods: FinancePeriod[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        periods.push({
          id: docSnap.id,
          month: data.month,
          year: data.year,
          status: data.status || 'open',
          closedByUid: data.closedByUid,
          closedByName: data.closedByName,
          closedAt: data.closedAt,
          openedByUid: data.openedByUid,
          openedByName: data.openedByName,
          openedAt: data.openedAt
        })
      })

      return periods
    } catch (err) {
      console.error('Failed to load financial periods:', err)
      throw err
    }
  },

  /**
   * Checks if a specific period (YYYY-MM) is closed.
   */
  async isPeriodClosed(periodId: string): Promise<boolean> {
    try {
      const docRef = doc(db, PERIOD_COLLECTION, periodId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return docSnap.data().status === 'closed'
      }
      return false
    } catch (err) {
      console.error('Failed to check period status:', err)
      return false
    }
  },

  /**
   * Closes a financial period, locking edits for all transactions in that month.
   */
  async closePeriod(
    periodId: string,
    closedByUid: string,
    closedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, PERIOD_COLLECTION, periodId)
      const [yearStr, monthStr] = periodId.split('-')
      
      await setDoc(docRef, {
        month: Number(monthStr),
        year: Number(yearStr),
        status: 'closed',
        closedByUid,
        closedByName,
        closedAt: serverTimestamp()
      }, { merge: true })

      await auditService.logAction(
        'PERIOD_CLOSE',
        'system',
        `Closed financial period '${periodId}' (locked for edits) by ${closedByName}`,
        closedByName,
        { periodId }
      )
    } catch (err) {
      console.error('Failed to close financial period:', err)
      throw err
    }
  },

  /**
   * Reopens a closed financial period. Only authorized roles (Coordinator) should trigger this.
   */
  async reopenPeriod(
    periodId: string,
    openedByUid: string,
    openedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, PERIOD_COLLECTION, periodId)
      const [yearStr, monthStr] = periodId.split('-')

      await setDoc(docRef, {
        month: Number(monthStr),
        year: Number(yearStr),
        status: 'open',
        openedByUid,
        openedByName,
        openedAt: serverTimestamp()
      }, { merge: true })

      await auditService.logAction(
        'PERIOD_REOPEN',
        'system',
        `Reopened financial period '${periodId}' by ${openedByName}`,
        openedByName,
        { periodId }
      )
    } catch (err) {
      console.error('Failed to reopen financial period:', err)
      throw err
    }
  }
}
