import type { OrderGroup } from '@/types/member'

export type UserRole = 'admin' | 'user' | 'order_leader'

export type ModuleKey = 
  | 'dashboard'
  | 'schedules' 
  | 'attendance' 
  | 'reports' 
  | 'members' 
  | 'users' 
  | 'settings' 
  | 'audit'
  | 'changePassword'
  | 'excuses'
  | 'finance'

export interface UserPermissions {
  allowedModules: ModuleKey[]
  
  // Attendance actions
  canTakeAttendance: boolean
  canFinalizeAttendance: boolean

  // Schedule actions
  canViewSchedules: boolean
  canManageSchedules: boolean

  // Reports actions & Scope
  canViewReports: boolean
  canExportReports: boolean
  assignedOrder?: OrderGroup
  presetName?: string

  // Finance actions
  canViewFinanceDashboard?: boolean
  canAddIncome?: boolean
  canEditIncome?: boolean
  canDeleteIncome?: boolean
  canCreateFundRequest?: boolean
  canApproveFundRequest?: boolean
  canRejectFundRequest?: boolean
  canReleaseFunds?: boolean
  canSubmitLiquidation?: boolean
  canReviewLiquidation?: boolean
  canViewFinanceReports?: boolean
  canExportFinanceReports?: boolean
  canManageFinanceCategories?: boolean
  canCloseFinancePeriod?: boolean
  canReopenFinancePeriod?: boolean
}

export interface PermissionPreset {
  id: string
  name: string
  description: string
  icon: 'clipboard' | 'users' | 'shield' | 'calendar' | 'chart' | 'settings' | 'bank'
  role: UserRole
  allowedModules: ModuleKey[]
  canTakeAttendance: boolean
  canFinalizeAttendance: boolean
  canViewSchedules: boolean
  canManageSchedules: boolean
  canViewReports: boolean
  canExportReports: boolean
  assignedOrder?: OrderGroup

  // Finance actions
  canViewFinanceDashboard?: boolean
  canAddIncome?: boolean
  canEditIncome?: boolean
  canDeleteIncome?: boolean
  canCreateFundRequest?: boolean
  canApproveFundRequest?: boolean
  canRejectFundRequest?: boolean
  canReleaseFunds?: boolean
  canSubmitLiquidation?: boolean
  canReviewLiquidation?: boolean
  canViewFinanceReports?: boolean
  canExportFinanceReports?: boolean
  canManageFinanceCategories?: boolean
  canCloseFinancePeriod?: boolean
  canReopenFinancePeriod?: boolean
}

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  role: UserRole
  assignedOrder?: OrderGroup
  presetName?: string
  permissions?: Partial<UserPermissions>
  createdAt?: string
  updatedAt?: string
}
