import { incomeService } from './incomeService'
import { expenseService } from './expenseService'
import { fundRequestService } from './fundRequestService'
import { categoryService } from './categoryService'
import { financeEngine } from '@/utils/financeEngine'
import type { FinanceIncome, DirectExpense, FinanceFundRequest, LedgerEntry } from '@/types/finance'

export interface CategoryBreakdown {
  categoryId: string
  categoryName: string
  color?: string
  total: number
}

export interface FinanceReportData {
  startDate: string
  endDate: string
  openingBalance: number
  closingBalance: number
  totalIncome: number
  totalExpenses: number
  incomeList: FinanceIncome[]
  directExpenseList: DirectExpense[]
  fundRequestList: FinanceFundRequest[]
  ledgerEntries: LedgerEntry[]
  incomeByCategory: CategoryBreakdown[]
  expenseByCategory: CategoryBreakdown[]
  categoriesMap: Record<string, { name: string; color?: string }>
}

export const reportService = {
  /**
   * Generates aggregated financial reports for a given date range.
   */
  async generateFinanceReport(startDate: string, endDate: string): Promise<FinanceReportData> {
    try {
      const [incomes, expenses, requests, categories] = await Promise.all([
        incomeService.getIncomes(startDate, endDate, false),
        expenseService.getExpenses(startDate, endDate, false),
        fundRequestService.getFundRequests(startDate, endDate, false),
        categoryService.getCategories(true) // include archived to resolve past records
      ])

      // Resolve category names mapping
      const categoriesMap: Record<string, { name: string; color?: string }> = {}
      categories.forEach((cat) => {
        categoriesMap[cat.id] = { name: cat.name, color: cat.color }
      })

      // Fetch all historical transactions (overall) to compute opening balances accurately
      const [allIncomes, allExpenses, allRequests] = await Promise.all([
        incomeService.getIncomes(undefined, undefined, false),
        expenseService.getExpenses(undefined, undefined, false),
        fundRequestService.getFundRequests(undefined, undefined, false)
      ])

      const allLedger = financeEngine.computeLedgerEntries(allIncomes, allExpenses, allRequests)
      const openingBalance = financeEngine.computeOpeningBalance(allLedger, startDate)

      // Ledger for the filtered date range
      const ledgerEntries = allLedger.filter(
        (entry) => entry.date >= startDate && entry.date <= endDate
      )

      // Calculate totals inside this range
      let totalIncome = 0
      let totalExpenses = 0

      ledgerEntries.forEach((entry) => {
        totalIncome += entry.amountIn
        totalExpenses += entry.amountOut
      })

      const closingBalance = openingBalance + totalIncome - totalExpenses

      // Category Inflows & Outflows breakdowns
      const incomeCategoryTotals: Record<string, number> = {}
      const expenseCategoryTotals: Record<string, number> = {}

      incomes.forEach((inc) => {
        const catId = inc.categoryId || 'unknown'
        incomeCategoryTotals[catId] = (incomeCategoryTotals[catId] || 0) + inc.amount
      })

      // Direct expenses are cash outflows
      expenses.forEach((exp) => {
        const catId = exp.categoryId || 'unknown'
        expenseCategoryTotals[catId] = (expenseCategoryTotals[catId] || 0) + exp.amount
      })

      // Finalized request disbursements count towards category outflows
      requests.forEach((req) => {
        // Only count requests with a released status
        if (
          req.status === 'released' ||
          req.status === 'liquidated' ||
          req.status === 'closed'
        ) {
          // Find the category of the request
          // Note: Fund requests might have categories. We map it or treat as general if not set.
          // Since the prompt schema for Fund Requests has purpose, if category isn't set directly,
          // we can assume a general category or a dedicated request category if added to document.
          // Let's check: in our types/finance.ts, does FinanceFundRequest have categoryId?
          // Wait, types/finance.ts doesn't enforce categoryId for fund requests because requests are purposeful cash outflows.
          // However, we can group request disbursements under a general "Fund Releases" or map it if needed.
          // Let's look: direct expenses are grouped by categoryId. For requests, let's treat request releases
          // as a special category "Fund Requests" if they don't have categoryId.
          const catId = 'fund_requests'
          const amt = req.releasedAmount || req.requestedAmount
          expenseCategoryTotals[catId] = (expenseCategoryTotals[catId] || 0) + amt
        }

        // Subtract returned liquidations
        if (
          (req.status === 'liquidated' || req.status === 'closed') &&
          req.returnedAmount &&
          req.returnedAmount > 0
        ) {
          const catId = 'fund_requests'
          expenseCategoryTotals[catId] = (expenseCategoryTotals[catId] || 0) - req.returnedAmount
        }
      })

      const incomeByCategory: CategoryBreakdown[] = Object.keys(incomeCategoryTotals).map((catId) => ({
        categoryId: catId,
        categoryName: categoriesMap[catId]?.name || (catId === 'unknown' ? 'Uncategorized' : catId),
        color: categoriesMap[catId]?.color,
        total: incomeCategoryTotals[catId]
      }))

      const expenseByCategory: CategoryBreakdown[] = Object.keys(expenseCategoryTotals).map((catId) => ({
        categoryId: catId,
        categoryName: categoriesMap[catId]?.name || 
          (catId === 'fund_requests' ? 'Fund Requests' : catId === 'unknown' ? 'Uncategorized' : catId),
        color: categoriesMap[catId]?.color,
        total: expenseCategoryTotals[catId]
      }))

      return {
        startDate,
        endDate,
        openingBalance,
        closingBalance,
        totalIncome,
        totalExpenses,
        incomeList: incomes,
        directExpenseList: expenses,
        fundRequestList: requests,
        ledgerEntries,
        incomeByCategory,
        expenseByCategory,
        categoriesMap
      }
    } catch (err) {
      console.error('Failed to generate finance report:', err)
      throw err
    }
  }
}
