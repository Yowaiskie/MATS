import type { Timestamp } from 'firebase/firestore'

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface RequestedSlotSummary {
  dayOfWeek?: number
  dayName?: string
  startTime: string
  title?: string
  location?: string
  datesCount?: number
  scheduleIds: string[]
  slotIndex?: number
}

export interface ScheduleSubmission {
  id: string // `${publicationId}_${memberId}`
  publicationId: string
  memberId: string
  memberName: string
  memberRank?: string
  status: SubmissionStatus
  requestedScheduleIds: string[]
  slotSummaries?: RequestedSlotSummary[]
  submittedAt: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  effectiveDate?: string
  createdAt: Timestamp | any
  updatedAt: Timestamp | any
}

export interface CreateSubmissionInput {
  publicationId: string
  memberId: string
  memberName: string
  memberRank?: string
  requestedScheduleIds: string[]
  slotSummaries?: RequestedSlotSummary[]
}
export type SubmissionErrorCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'MEMBER_INELIGIBLE'
  | 'PUBLICATION_CLOSED'
  | 'SLOT_FULL'
  | 'OVERLAPPING_SCHEDULE'
  | 'QUOTA_EXCEEDED'
  | 'TRANSACTION_FAILED'
  | 'CONFLICT_DETECTED'

export class SubmissionError extends Error {
  code: SubmissionErrorCode
  details?: Record<string, any>

  constructor(code: SubmissionErrorCode, message: string, details?: Record<string, any>) {
    super(message)
    this.name = 'SubmissionError'
    this.code = code
    this.details = details
  }
}

export interface AdminUserContext {
  uid: string
  email?: string | null
  role?: string
  permissions?: { canManageSchedules?: boolean; [key: string]: any }
}

export interface CycleConflictItem {
  type: 'CAPACITY_EXCEEDED' | 'RANK_INELIGIBLE' | 'MEMBER_SUSPENDED' | 'TIME_OVERLAP' | 'DUPLICATE_ASSIGNMENT'
  memberId: string
  memberName: string
  scheduleId?: string
  massTitle?: string
  date?: string
  time?: string
  message: string
}

export interface CycleFinalizationOptions {
  effectiveDate?: string // YYYY-MM-DD (defaults to parish current date in Asia/Manila)
  adminUser?: AdminUserContext
  firestoreInstance?: any
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
}

export interface CycleFinalizationResult {
  publicationId: string
  approvedSubmissionsCount: number
  updatedSchedulesCount: number
  preservedHistoricalSchedulesCount: number
  assignedMembersCount: number
  effectiveDate: string
  conflicts?: CycleConflictItem[]
}

export interface ApproveSubmissionOptions {
  effectiveDate?: string // YYYY-MM-DD (defaults to parish current date in Asia/Manila)
  adminUser?: AdminUserContext
  firestoreInstance?: any
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
}

export interface RejectSubmissionOptions {
  reason?: string
  adminUser?: AdminUserContext
  firestoreInstance?: any
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
}

export interface ApprovalResult {
  success: boolean
  submissionId: string
  memberId: string
  assignedScheduleIds: string[]
  skippedHistoricalScheduleIds: string[]
  effectiveDate: string
}

export interface RejectionResult {
  success: boolean
  submissionId: string
  memberId: string
  reason?: string
}
