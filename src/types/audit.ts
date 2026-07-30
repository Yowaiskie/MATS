export type AuditCategory = 'member' | 'schedule' | 'attendance' | 'settings' | 'system' | 'excuse'

export type AuditAction =
  | 'MEMBER_CREATE'
  | 'MEMBER_UPDATE'
  | 'MEMBER_DELETE'
  | 'MEMBER_ARCHIVE'
  | 'MEMBER_IMPORT'
  | 'SCHEDULE_CREATE'
  | 'SCHEDULE_UPDATE'
  | 'SCHEDULE_DELETE'
  | 'SCHEDULE_ASSIGN'
  | 'ATTENDANCE_SAVE'
  | 'ATTENDANCE_LOCK'
  | 'ATTENDANCE_UNLOCK'
  | 'SETTINGS_UPDATE'
  | 'USER_PASSWORD_CHANGE'
  | 'USER_LOGIN'
  | 'EXCUSE_SUBMITTED'
  | 'EXCUSE_APPROVED'
  | 'EXCUSE_REJECTED'
  | 'EXCUSE_CANCELLED'

export interface AuditLog {
  id: string
  action: AuditAction
  category: AuditCategory
  description: string
  performedBy: string // user email
  timestamp: any // Firestore Timestamp
  details?: any
}
