import type { ScheduleCategoryKey } from './attendanceCategory'

export type ScheduleStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled'

export interface Schedule {
  id: string
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
