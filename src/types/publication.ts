import { Timestamp } from 'firebase/firestore'

export type PublicationStatus = 'draft' | 'published' | 'archived'

export interface SchedulePublication {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  status: PublicationStatus
  description?: string
  maxSundaysPerServer?: number
  maxWeekdaysPerServer?: number
  maxServersPerSundaySlot?: number
  maxServersPerWeekdaySlot?: number
  submittedMembers?: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SchedulePublicationInput {
  name: string
  startDate: string
  endDate: string
  status?: PublicationStatus
  description?: string
  maxSundaysPerServer?: number
  maxWeekdaysPerServer?: number
  maxServersPerSundaySlot?: number
  maxServersPerWeekdaySlot?: number
}
