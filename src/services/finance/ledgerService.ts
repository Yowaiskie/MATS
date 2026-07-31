import { incomeService } from './incomeService'
import { expenseService } from './expenseService'
import { fundRequestService } from './fundRequestService'
import { financeEngine } from '@/utils/financeEngine'
import type { LedgerEntry } from '@/types/finance'

export const ledgerService = {
  /**
   * Fetches all transactions chronologically to build the chronological ledger log.
   */
  async getLedgerEntries(
    startDate?: string,
    endDate?: string,
    includeArchived = false
  ): Promise<LedgerEntry[]> {
    try {
      const [incomes, expenses, requests] = await Promise.all([
        incomeService.getIncomes(undefined, undefined, includeArchived),
        expenseService.getExpenses(undefined, undefined, includeArchived),
        fundRequestService.getFundRequests(undefined, undefined, includeArchived)
      ])

      const allEntries = financeEngine.computeLedgerEntries(incomes, expenses, requests)

      // Filter by date range if provided
      return allEntries.filter((entry) => {
        if (startDate && entry.date < startDate) return false
        if (endDate && entry.date > endDate) return false
        return true
      })
    } catch (err) {
      console.error('Failed to construct finance ledger entries:', err)
      throw err
    }
  }
}
