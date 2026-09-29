import { Timestamp } from 'firebase/firestore'

export type PublicationStatus = 'draft' | 'published' | 'archived'
export type PublicationType = 'regular' | 'special_event'

export interface RankSlotLimit {
  Chevaliers?: number
  Paladins?: number
  Squires?: number
  [rank: string]: number | undefined
}

export interface SchedulePublication {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  status: PublicationStatus
  publicationType?: PublicationType
  description?: string
  submissionDeadline?: string // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  maxSundaysPerServer?: number
  maxWeekdaysPerServer?: number
  maxSpecialPerServer?: number
  maxServersPerSundaySlot?: number
  maxServersPerWeekdaySlot?: number
  maxServersPerSpecialSlot?: number
  enableRankQuotas?: boolean
  rankSlotQuotas?: RankSlotLimit
  sundayRankQuotas?: RankSlotLimit
  weekdayRankQuotas?: RankSlotLimit
  specialRankQuotas?: RankSlotLimit
  includeSundays?: boolean
  includeWeekdays?: boolean
  includeHolyHour?: boolean
  includeMeetings?: boolean
  includeSpecialEvents?: boolean
  includedDaysOfWeek?: string[] // e.g. ['Thursday'] or ['Monday', 'Tuesday', ...]
  enableStreetLocation?: boolean // Optional Street / Location toggle (e.g. Street Mass / Block Rosary)
  liturgicalColor?: string // 'green' | 'white' | 'purple' | 'red' | 'rose' | 'blue' | 'gold'
  customExcludedKeywords?: string[]
  allowedRanks?: string[]
  submittedMembers?: string[]
  warningAbsenceThreshold?: number
  suspensionAbsenceThreshold?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SchedulePublicationInput {
  name: string
  startDate: string
  endDate: string
  status?: PublicationStatus
  publicationType?: PublicationType
  description?: string
  submissionDeadline?: string
  maxSundaysPerServer?: number
  maxWeekdaysPerServer?: number
  maxSpecialPerServer?: number
  maxServersPerSundaySlot?: number
  maxServersPerWeekdaySlot?: number
  maxServersPerSpecialSlot?: number
  enableRankQuotas?: boolean
  rankSlotQuotas?: RankSlotLimit
  sundayRankQuotas?: RankSlotLimit
  weekdayRankQuotas?: RankSlotLimit
  specialRankQuotas?: RankSlotLimit
  includeSundays?: boolean
  includeWeekdays?: boolean
  includeHolyHour?: boolean
  includeMeetings?: boolean
  includeSpecialEvents?: boolean
  includedDaysOfWeek?: string[]
  enableStreetLocation?: boolean
  liturgicalColor?: string
  customExcludedKeywords?: string[]
  allowedRanks?: string[]
  warningAbsenceThreshold?: number
  suspensionAbsenceThreshold?: number
}


