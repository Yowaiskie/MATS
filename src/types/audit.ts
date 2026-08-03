export type AuditCategory = 'member' | 'schedule' | 'attendance' | 'settings' | 'system' | 'excuse' | 'finance'

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
  | 'CATEGORY_CREATE'
  | 'CATEGORY_ARCHIVE'
  | 'INCOME_ADD'
  | 'INCOME_UPDATE'
  | 'INCOME_ARCHIVE'
  | 'EXPENSE_RECORD'
  | 'EXPENSE_UPDATE'
  | 'EXPENSE_ARCHIVE'
  | 'REQUEST_SUBMIT'
  | 'REQUEST_APPROVE'
  | 'REQUEST_REJECT'
  | 'FUNDS_RELEASE'
  | 'LIQUIDATION_SUBMIT'
  | 'LIQUIDATION_APPROVE'
  | 'REQUEST_ARCHIVE'
  | 'PERIOD_CLOSE'
  | 'PERIOD_REOPEN'

export interface AuditLog {
  id: string
  action: AuditAction
  category: AuditCategory
  description: string
  performedBy: string // user email
  timestamp: any // Firestore Timestamp
  details?: any
}
