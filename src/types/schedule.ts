import type { ScheduleCategoryKey } from './attendanceCategory'

export type ScheduleStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled'

export interface Schedule {
  id: string
  title: string
  category?: ScheduleCategoryKey
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  status: ScheduleStatus
  isLocked?: boolean
  assignedMembers: string[] // Array of member document IDs
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}

export interface ScheduleInput {
  title: string
  category?: ScheduleCategoryKey
  date: string
  startTime: string
  endTime: string
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
  assignedMembers: string[]
  active: boolean
}
