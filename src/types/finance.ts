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

  // Tracing for event expenses
  sourceType?: 'event_expense'
  sourceEventId?: string
  sourceEventExpenseId?: string
  sourceEventName?: string

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

export interface FundRequisitionItem {
  id: string
  intendedUse: string
  unitPrice: string
  quantity: string
  amount: number | string
}

export interface LiquidationBudgetSource {
  id: string
  description: string
  amount: number | string
}

export interface LiquidationExpenseItem {
  id: string
  orNumber: string
  description: string
  amount: number | string
}

export type FundRequestSource = 'main_funds' | 'parish' | 'outside'

export interface FinanceFundRequest {
  id: string
  title: string
  purpose: string
  requestedAmount: number
  requestedByUid: string
  requestedByName: string
  dateNeeded: string // YYYY-MM-DD
  description: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'released' | 'liquidated' | 'closed' | 'cancelled' | 'voided'
  periodId: string // YYYY-MM
  referenceNumber: string
  createdAt: any
  updatedAt: any
  createdByUid: string
  createdByName: string

  // Request Classification: 'requisition' (Default multi-step) | 'direct_liquidation' (Outside/Standalone)
  requestType?: 'requisition' | 'direct_liquidation'

  // Fund Source / Channel: 'main_funds' (Main Ministry Funds) | 'parish' (Parish Funds) | 'outside' (Outside/Independent Funds)
  fundSource?: FundRequestSource

  // Requisition Details
  fromMinistry?: string
  venue?: string
  participants?: string
  assembly?: string
  expectedExpenses?: FundRequisitionItem[]

  // Approval / Rejection
  approvedByUid?: string
  approvedByName?: string
  approvedAt?: any
  approvalRemarks?: string
  rejectedByUid?: string
  rejectedByName?: string
  rejectedAt?: any
  rejectionReason?: string

  // Parish Priest Approval Tracking (for Parish Fund requests)
  parishApprovedByFr?: boolean
  parishFrApprovalDate?: string
  parishFrRemarks?: string

  // Cancellation
  cancelledByUid?: string
  cancelledByName?: string
  cancelledAt?: any
  cancellationReason?: string

  // Voiding
  voidedByUid?: string
  voidedByName?: string
  voidedAt?: any
  voidReason?: string

  // Release / Disbursement
  releasedByUid?: string
  releasedByName?: string
  releasedToName?: string
  releasedAt?: any
  releasedDate?: string // YYYY-MM-DD
  releasedAmount?: number
  releaseRemarks?: string

  // Parish Office Release Specifics (When funds are disbursed by Parish Office)
  parishOfficeDisbursed?: boolean
  parishOfficeDisbursedDate?: string
  parishOfficeDisbursedAmount?: number
  parishOfficeDisbursedBy?: string // e.g. Parish Secretary / Office Staff
  parishOfficeReceivedBy?: string // Name of the Ministry Officer / Representative who received the cash from the office
  parishOfficeRemarks?: string

  // Liquidation
  totalSpent?: number
  remainingAmount?: number
  returnedAmount?: number
  reimbursedAmount?: number
  liquidationRemarks?: string
  liquidationTo?: string
  liquidationFrom?: string
  liquidationDate?: string
  budgetSources?: LiquidationBudgetSource[]
  liquidationExpenses?: LiquidationExpenseItem[]
  liquidatedByUid?: string
  liquidatedByName?: string
  liquidatedAt?: any
  liquidationReviewedByUid?: string
  liquidationReviewedByName?: string
  liquidationReviewedAt?: any
  liquidationReviewRemarks?: string
  liquidationRevisionReason?: string
  liquidationRevisionRequestedByUid?: string
  liquidationRevisionRequestedByName?: string
  liquidationRevisionRequestedAt?: any
  liquidationReopenedByUid?: string
  liquidationReopenedByName?: string
  liquidationReopenedAt?: any
  liquidationReopenReason?: string

  // Target Event Link (when requested for a specific event)
  targetEventId?: string
  targetEventName?: string
  linkedEventIncomeId?: string

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
