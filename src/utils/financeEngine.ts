import type { FinanceIncome, DirectExpense, FinanceFundRequest, LedgerEntry, MonthlySummary } from '@/types/finance'

export const financeEngine = {
  /**
   * Combines income, direct expenses, and fund requests into sorted ledger entries.
   */
  computeLedgerEntries(
    incomes: FinanceIncome[],
    expenses: DirectExpense[],
    fundRequests: FinanceFundRequest[]
  ): LedgerEntry[] {
    const entries: Omit<LedgerEntry, 'runningBalance'>[] = []

    // 1. Process Income
    incomes.forEach((inc) => {
      if (inc.isArchived) return
      entries.push({
        id: inc.id,
        date: inc.date,
        type: 'income',
        description: `Income: ${inc.source} - ${inc.description}`,
        referenceNumber: inc.referenceNumber,
        amountIn: inc.amount,
        amountOut: 0
      })
    })

    // 2. Process Direct Expenses
    expenses.forEach((exp) => {
      if (exp.isArchived) return
      entries.push({
        id: exp.id,
        date: exp.date,
        type: 'direct_expense',
        description: `Expense: ${exp.description}`,
        referenceNumber: exp.referenceNumber,
        amountIn: 0,
        amountOut: exp.amount
      })
    })

    // 3. Process Fund Requests
    fundRequests.forEach((req) => {
      if (req.isArchived) return

      const status = (req.status || '').toLowerCase()

      // Outflow occurs when funds are released
      if (
        status === 'released' ||
        status === 'liquidated' ||
        status === 'closed'
      ) {
        const relDate = req.releasedDate || req.dateNeeded
        const relAmount = (req.releasedAmount !== undefined && req.releasedAmount !== null) 
          ? req.releasedAmount 
          : req.requestedAmount

        if (relDate && relAmount > 0) {
          entries.push({
            id: `${req.id}_release`,
            date: relDate,
            type: 'fund_release',
            description: `Fund Release: ${req.title} (Released to: ${req.releasedToName || req.requestedByName})`,
            referenceNumber: req.referenceNumber,
            amountIn: 0,
            amountOut: relAmount
          })
        }
      }

      // Inflow occurs when excess funds are returned during liquidation
      if (status === 'liquidated' || status === 'closed') {
        const relDate = req.releasedDate || req.dateNeeded
        if (req.returnedAmount && req.returnedAmount > 0 && relDate) {
          // Use liquidation date if available, fallback to release date
          let liquidDate = relDate
          if (req.liquidatedAt) {
            try {
              if (req.liquidatedAt.seconds) {
                liquidDate = new Date(req.liquidatedAt.seconds * 1000).toISOString().slice(0, 10)
              } else {
                liquidDate = new Date(req.liquidatedAt).toISOString().slice(0, 10)
              }
            } catch (e) {
              console.error('Error parsing liquidatedAt timestamp:', e)
            }
          }

          entries.push({
            id: `${req.id}_return`,
            date: liquidDate,
            type: 'fund_return',
            description: `Fund Return: Excess from ${req.title} liquidation`,
            referenceNumber: req.referenceNumber,
            amountIn: req.returnedAmount,
            amountOut: 0
          })
        }
      }
    })

    // Sort chronologically by date
    // If dates are identical, sort by ID to ensure a deterministic order
    entries.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      return a.id.localeCompare(b.id)
    })

    // 4. Compute Running Balances
    let currentBalance = 0
    const finalEntries: LedgerEntry[] = []

    entries.forEach((entry) => {
      currentBalance = currentBalance + entry.amountIn - entry.amountOut
      finalEntries.push({
        ...entry,
        runningBalance: currentBalance
      })
    })

    return finalEntries
  },

  /**
   * Computes the opening balance for a given date range.
   */
  computeOpeningBalance(ledgerEntries: LedgerEntry[], startDateStr: string): number {
    let balance = 0
    for (const entry of ledgerEntries) {
      if (entry.date < startDateStr) {
        balance = balance + entry.amountIn - entry.amountOut
      } else {
        break
      }
    }
    return balance
  },

  /**
   * Computes the current balance from all ledger entries.
   */
  computeCurrentBalance(ledgerEntries: LedgerEntry[]): number {
    if (ledgerEntries.length === 0) return 0
    return ledgerEntries[ledgerEntries.length - 1].runningBalance
  },

  /**
   * Computes detailed monthly totals, pending requests, and current month metrics.
   */
  computeMonthlySummary(
    ledgerEntries: LedgerEntry[],
    rawRequests: FinanceFundRequest[],
    monthStr: string // Format: "YYYY-MM"
  ): MonthlySummary {
    let openingBalance = 0
    let totalIncome = 0
    let totalExpenses = 0
    let currentBalance = 0

    let incomeThisMonth = 0
    let expensesThisMonth = 0
    let releasedThisMonth = 0

    // Compute opening balance (prior to this month) and overall running totals
    ledgerEntries.forEach((entry) => {
      const entryMonth = entry.date.slice(0, 7)
      
      if (entryMonth < monthStr) {
        openingBalance = openingBalance + entry.amountIn - entry.amountOut
      }

      if (entryMonth === monthStr) {
        if (entry.amountIn > 0) {
          if (entry.type === 'income') {
            incomeThisMonth += entry.amountIn
          }
        }
        if (entry.amountOut > 0) {
          if (entry.type === 'direct_expense') {
            expensesThisMonth += entry.amountOut
          } else if (entry.type === 'fund_release') {
            releasedThisMonth += entry.amountOut
          }
        }
      }

      // Add to dynamic general metrics
      if (entry.type === 'income') {
        totalIncome += entry.amountIn
      } else if (entry.type === 'direct_expense') {
        totalExpenses += entry.amountOut
      } else if (entry.type === 'fund_release') {
        totalExpenses += entry.amountOut
      } else if (entry.type === 'fund_return') {
        // Returned excess subtracts from our absolute expenses
        totalExpenses -= entry.amountIn
      }
    })

    currentBalance = totalIncome - totalExpenses

    // Extract pending and released counts from raw fund requests (excluding archived)
    const activeRequests = rawRequests.filter(r => !r.isArchived)
    const pendingRequestsCount = activeRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length
    const pendingLiquidationsCount = activeRequests.filter(r => (r.status || '').toLowerCase() === 'released').length

    return {
      openingBalance,
      totalIncome,
      totalExpenses,
      currentBalance,
      pendingRequestsCount,
      pendingLiquidationsCount,
      releasedThisMonth,
      incomeThisMonth,
      expensesThisMonth
    }
  }
}
