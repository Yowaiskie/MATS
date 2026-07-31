import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/firebase/config'

export const counterService = {
  /**
   * Generates a unique, chronological reference number for Incomes, Expenses, and Fund Requests.
   * Format: TYPE-YYYYMM-XXXXX (e.g., INC-202607-00001)
   */
  async generateReferenceNumber(type: 'INC' | 'EXP' | 'FR', dateStr: string): Promise<string> {
    const yearMonth = dateStr.slice(0, 7).replace('-', '') // "202607"
    const counterId = `finance_${type.toLowerCase()}_${yearMonth}`
    const counterRef = doc(db, 'counters', counterId)

    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef)
      let nextSeq = 1
      if (counterDoc.exists()) {
        const data = counterDoc.data()
        nextSeq = (data.currentSeq || 0) + 1
      }
      transaction.set(counterRef, { currentSeq: nextSeq }, { merge: true })
      const paddedSeq = String(nextSeq).padStart(5, '0')
      return `${type}-${yearMonth}-${paddedSeq}`
    })
  }
}
