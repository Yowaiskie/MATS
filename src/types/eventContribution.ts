import type { Timestamp } from 'firebase/firestore'

export type ContributionPaymentMethod = 'cash' | 'gcash' | 'bank_transfer' | 'other'
export type ContributionLinkDestination = 'current_event' | 'main_funds' | 'other_event'

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

  contributorUid?: string | null // Optional if contributor is not a registered member
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
  linkedDestination?: ContributionLinkDestination
  linkedFinanceIncomeId?: string
  linkedTargetEventId?: string
  linkedTargetEventName?: string
  linkedAt?: Timestamp
  linkedByUid?: string
  linkedByName?: string

  // Multi-Allocation Tracking (clean single-row partial linking)
  linkedAllocations?: ContributionLinkAllocation[]
}

export interface ContributionLinkAllocation {
  id: string
  amount: number
  destination: ContributionLinkDestination
  targetEventId?: string
  targetEventName?: string
  financeIncomeId: string
  categoryId: string
  categoryName?: string
  date: string
  linkedAt: any
  linkedByUid: string
  linkedByName: string
}

export interface ContributionLinkSummary {
  totalLinked: number
  remainingToLink: number
  status: 'unlinked' | 'partial' | 'full'
  allocations: ContributionLinkAllocation[]
}

export function getContributionLinkSummary(c: EventContribution): ContributionLinkSummary {
  const amount = Number(c.amount) || 0
  if (c.linkedAllocations && Array.isArray(c.linkedAllocations) && c.linkedAllocations.length > 0) {
    const totalLinked = c.linkedAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const remaining = Math.max(0, amount - totalLinked)
    return {
      totalLinked,
      remainingToLink: remaining,
      status: totalLinked >= amount ? 'full' : totalLinked > 0 ? 'partial' : 'unlinked',
      allocations: c.linkedAllocations
    }
  }

  if (c.linkedFinanceIncomeId) {
    const legacyAlloc: ContributionLinkAllocation = {
      id: 'legacy-primary',
      amount: amount,
      destination: c.linkedDestination || 'current_event',
      targetEventId: c.linkedTargetEventId,
      targetEventName: c.linkedTargetEventName,
      financeIncomeId: c.linkedFinanceIncomeId,
      categoryId: '',
      date: '',
      linkedAt: c.linkedAt,
      linkedByUid: c.linkedByUid || '',
      linkedByName: c.linkedByName || ''
    }
    return {
      totalLinked: amount,
      remainingToLink: 0,
      status: 'full',
      allocations: [legacyAlloc]
    }
  }

  return {
    totalLinked: 0,
    remainingToLink: amount,
    status: 'unlinked',
    allocations: []
  }
}
