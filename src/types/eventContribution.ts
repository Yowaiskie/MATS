import type { Timestamp } from 'firebase/firestore'

export type ContributionPaymentMethod = 'cash' | 'gcash' | 'bank_transfer' | 'other'

export interface EventContributionPurpose {
  id: string
  eventId: string
  name: string
  description?: string
  createdByUid: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
  isArchived: boolean
}

export interface EventContribution {
  id: string
  eventId: string

  contributorUid?: string // Optional if contributor is not a registered member
  contributorName: string // Full name of the contributor

  purposeId: string
  purposeName: string

  amount: number
  paymentMethod: ContributionPaymentMethod
  referenceNumber?: string // Conditional/optional reference number

  notes?: string

  // Custodian / Collector Tracking (Care of / Hawak ni)
  collectedByName?: string // Name of person holding/receiving the funds (c/o)
  collectedByUid?: string  // Optional UID if collector is a MATS member

  // Status & Accountability
  status: 'recorded' | 'voided'
  isArchived?: boolean
  archivedAt?: Timestamp
  archivedByName?: string

  // Timestamps
  contributedAt: Timestamp // When the money was actually received
  createdAt: Timestamp     // When recorded in MATS
  updatedAt: Timestamp     // Last updated time

  // Creator Audit
  createdByUid: string
  createdByName: string

  // Finance Link Metadata
  linkedFinanceIncomeId?: string
  linkedAt?: Timestamp
  linkedByUid?: string
  linkedByName?: string
}
