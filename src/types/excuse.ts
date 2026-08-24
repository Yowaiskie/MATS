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
}

export interface ExcuseConfig {
  allowedSubmissionWindow: number // days
  minimumReasonLength: number
  requireReason: boolean
}
