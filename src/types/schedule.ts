import type { ScheduleCategoryKey } from './attendanceCategory'

export type ScheduleStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled'

export interface Schedule {
  id: string
  publicationId?: string // Owning SchedulePublication ID for publication isolation
  templateId?: string // Source ScheduleTemplate ID when generated from template
  title: string
  category?: ScheduleCategoryKey
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  location?: string // Optional street, venue, or chapel (e.g. Street Mass / Block Rosary)
  liturgicalColor?: string // e.g. 'green' | 'white' | 'purple' | 'red' | 'rose' | 'blue' | 'gold'
  status: ScheduleStatus
  isLocked?: boolean
  assignedMembers: string[] // Array of member document IDs
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}

export interface ScheduleInput {
  publicationId?: string
  templateId?: string
  title: string
  category?: ScheduleCategoryKey
  date: string
  startTime: string
  endTime: string
  location?: string
  liturgicalColor?: string
  status?: ScheduleStatus
  isLocked?: boolean
  assignedMembers?: string[]
}

export interface ScheduleTemplate {
  id: string
  name: string
  title: string
  dayOfWeek: string // 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  startTime: string
  endTime: string
  location?: string
  liturgicalColor?: string
  assignedMembers: string[]
  active: boolean
  createdAt: any
  updatedAt: any
}

export interface ScheduleTemplateInput {
  name: string
  title: string
  dayOfWeek: string
  startTime: string
  endTime: string
  location?: string
  liturgicalColor?: string
  assignedMembers: string[]
  active: boolean
}

export interface ScheduleSelectionItem {
  scheduleId: string
  isSelected: boolean
}

export interface AdminEffectiveDatedScheduleEditOptions {
  effectiveDate: string // YYYY-MM-DD in Asia/Manila timezone
  adminUser?: {
    uid: string
    email?: string
    role?: string
    permissions?: { canManageSchedules?: boolean; [key: string]: any }
  }
  markAsSubmitted?: boolean
  firestoreInstance?: any
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
}

export interface AdminEffectiveDatedScheduleEditResult {
  success: boolean
  memberId: string
  publicationId: string
  effectiveDate: string
  previousAssignedScheduleIds: string[]
  updatedAssignedScheduleIds: string[]
  affectedFutureScheduleIds: string[]
  preservedHistoricalScheduleIds: string[]
  preservedHistoricalSchedulesCount: number
  updatedFutureSchedulesCount: number
  addedCount: number
  removedCount: number
}

export interface AdminMassSlotAssignmentOptions {
  effectiveDate?: string // YYYY-MM-DD in Asia/Manila, defaults to parish today
  adminUser?: {
    uid: string
    email?: string
    role?: string
    permissions?: { canManageSchedules?: boolean; [key: string]: any }
  }
  markAsSubmitted?: boolean
  firestoreInstance?: any
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
}

export interface AdminMassSlotAssignmentResult {
  success: boolean
  publicationId: string
  patternId?: string
  assignedMemberIds: string[]
  previousAssignedMemberIds: string[]
  updatedFutureSchedulesCount: number
  preservedHistoricalSchedulesCount: number
  affectedFutureScheduleIds: string[]
  preservedHistoricalScheduleIds: string[]
}
