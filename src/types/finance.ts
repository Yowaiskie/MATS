export interface FinanceIncome {
  id: string
  amount: number
  source: string
  categoryId: string
  receivedFrom: string
  date: string // YYYY-MM-DD
  description: string
  referenceNumber: string
  periodId: string // YYYY-MM
  createdAt: any
  updatedAt: any
  createdByUid: string
  createdByName: string
  updatedByUid?: string
  updatedByName?: string

  // Tracing for event transfers
  sourceType?: 'event_transfer'
  sourceEventId?: string
  sourceTransferId?: string

  // Soft Delete Fields
  isArchived: boolean
  archivedAt?: any
  archivedByUid?: string
  archivedByName?: string
}

export interface DirectExpense {
  id: string
  amount: number
  categoryId: string
  spentByUid: string
  spentByName: string
  date: string // YYYY-MM-DD
  description: string
  referenceNumber: string
  periodId: string // YYYY-MM
  createdAt: any
  updatedAt: any
  createdByUid: string
  createdByName: string
  updatedByUid?: string
  updatedByName?: string

  // Soft Delete Fields
  isArchived: boolean
  archivedAt?: any
  archivedByUid?: string
  archivedByName?: string
}

export interface FinanceCategory {
  id: string
  name: string
  icon?: string
  color?: string
  createdAt: any
  createdByUid: string
  createdByName: string

  // Soft Delete Fields
  isArchived: boolean
  archivedAt?: any
  archivedByUid?: string
  archivedByName?: string
}

export interface FinanceFundRequest {
  id: string
  title: string
  purpose: string
  requestedAmount: number
  requestedByUid: string
  requestedByName: string
  dateNeeded: string // YYYY-MM-DD
  description: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'released' | 'liquidated' | 'closed'
  periodId: string // YYYY-MM
  referenceNumber: string
  createdAt: any
  updatedAt: any
  createdByUid: string
  createdByName: string

  // Approval / Rejection
  approvedByUid?: string
  approvedByName?: string
  approvedAt?: any
  approvalRemarks?: string
  rejectedByUid?: string
  rejectedByName?: string
  rejectedAt?: any
  rejectionReason?: string

  // Release
  releasedByUid?: string
  releasedByName?: string
  releasedToName?: string
  releasedAt?: any
  releasedDate?: string // YYYY-MM-DD
  releasedAmount?: number
  releaseRemarks?: string

  // Liquidation
  totalSpent?: number
  remainingAmount?: number
  returnedAmount?: number
  liquidationRemarks?: string
  liquidatedByUid?: string
  liquidatedByName?: string
  liquidatedAt?: any
  liquidationReviewedByUid?: string
  liquidationReviewedByName?: string
  liquidationReviewedAt?: any

  // Soft Delete Fields
  isArchived: boolean
  archivedAt?: any
  archivedByUid?: string
  archivedByName?: string
}

export interface FinancePeriod {
  id: string // "YYYY-MM"
  month: number // 1-12
  year: number
  status: 'open' | 'closed'
  closedByUid?: string
  closedByName?: string
  closedAt?: any
  openedByUid?: string
  openedByName?: string
  openedAt?: any
}

export interface LedgerEntry {
  id: string
  date: string
  type: 'income' | 'direct_expense' | 'fund_release' | 'fund_return'
  description: string
  referenceNumber?: string
  amountIn: number
  amountOut: number
  runningBalance: number
}

export interface MonthlySummary {
  openingBalance: number
  totalIncome: number
  totalExpenses: number
  currentBalance: number
  pendingRequestsCount: number
  pendingLiquidationsCount: number
  releasedThisMonth: number
  incomeThisMonth: number
  expensesThisMonth: number
}
