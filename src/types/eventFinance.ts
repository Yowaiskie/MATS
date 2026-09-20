import type { Timestamp } from 'firebase/firestore'

export type PaymentMethod = 'Cash' | 'GCash' | 'Cheque' | 'Bank Transfer'

export interface EventFinanceCategory {
  id: string
  eventId: string
  name: string
  type: 'income' | 'expense'
  createdByUid: string
  createdByName: string
  createdAt: Timestamp
  isArchived: boolean
}

export interface EventIncome {
  id: string
  eventId: string
  amount: number
  receivedFrom: string
  categoryId: string
  date: string // YYYY-MM-DD
  paymentMethod: PaymentMethod
  allocation?: string
  heldBy?: string
  description: string
  createdByUid: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastEditedBy?: string
  lastEditedAt?: string
  isArchived?: boolean
  archivedBy?: string
  archivedAt?: string
  encashmentStatus?: 'pending' | 'encashed'
  sourceType?: 'main_fund_release' | 'event_transfer' | 'contribution' | 'general'
  sourceFundRequestId?: string
  sourceFundRequestRef?: string
}

export interface EventExpenseReceipt {
  id: string
  orNumber: string
  label?: string
  amount?: number
}

export interface EventExpense {
  id: string
  eventId: string
  amount: number
  spentOn: string
  categoryId: string
  spentByUid: string
  spentByName: string
  date: string // YYYY-MM-DD
  paymentMethod: PaymentMethod
  allocation?: string
  description: string
  createdByUid: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastEditedBy?: string
  lastEditedAt?: string
  isArchived?: boolean
  archivedBy?: string
  archivedAt?: string
  encashmentStatus?: 'pending' | 'encashed'
  fundSource?: 'event' | 'main_funds'
  orNumber?: string
  receipts?: EventExpenseReceipt[]
  mainFinanceExpenseId?: string
  mainFinanceCategoryId?: string
}

export interface EventFundTransfer {
  id: string
  eventId: string
  eventName: string
  amount: number
  mainFundCategoryId: string
  date: string // YYYY-MM-DD
  remarks: string
  createdByUid: string
  createdByName: string
  createdAt: Timestamp
  status: 'completed' | 'reversed'
}
