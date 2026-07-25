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
}

export interface PermissionPreset {
  id: string
  name: string
  description: string
  icon: 'clipboard' | 'users' | 'shield' | 'calendar' | 'chart' | 'settings'
  role: UserRole
  allowedModules: ModuleKey[]
  canTakeAttendance: boolean
  canFinalizeAttendance: boolean
  canViewSchedules: boolean
  canManageSchedules: boolean
  canViewReports: boolean
  canExportReports: boolean
  assignedOrder?: OrderGroup
}

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  role: UserRole
  assignedOrder?: OrderGroup
  permissions?: Partial<UserPermissions>
  createdAt?: string
  updatedAt?: string
}
