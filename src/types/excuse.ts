export type ExcuseStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export interface ExcuseRequest {
  id?: string
  trackingNumber: string
  memberId: string
  memberName?: string
  memberOrder?: string
  memberRank?: string
  schedules: string[]
  reason: string
  additionalNotes?: string
  status: ExcuseStatus
  adminRemarks?: string
  rejectionReason?: string
  submittedAt: any // Firestore Timestamp
  submittedFrom?: string
  submittedIp?: string
  reviewedAt?: any // Firestore Timestamp
  reviewedByUid?: string
  reviewedByName?: string
  isArchived?: boolean
  archivedAt?: any // Firestore Timestamp
  archivedByUid?: string
  archivedByName?: string
  submittedByOfficer?: boolean
  submittedByUid?: string
  submittedByName?: string
  officerNotes?: string
}

export interface ExcuseConfig {
  allowedSubmissionWindow: number // days
  minimumReasonLength: number
  requireReason: boolean
}

export interface ExcusePolicySettings {
  allowPublicPastExcuses: boolean
  publicPastWindowDays: number
  requireReason: boolean
  minimumReasonLength: number
  updatedAt?: any
  updatedBy?: string
}

export const DEFAULT_EXCUSE_POLICY_SETTINGS: ExcusePolicySettings = {
  allowPublicPastExcuses: true,
  publicPastWindowDays: 7,
  requireReason: true,
  minimumReasonLength: 5
}
