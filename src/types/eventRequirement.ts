import type { Timestamp } from 'firebase/firestore'
import type { MemberRank } from '@/types/member'

export interface EventRequirementSettings {
  eventId: string
  selectedRanks: MemberRank[]
  updatedAt: Timestamp
  updatedByUid: string
}

export interface EventRequirement {
  id: string
  eventId: string
  title: string
  description: string
  targetRanks: MemberRank[] // Empty means all tracker ranks
  isArchived: boolean
  createdByUid: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EventRequirementCheck {
  id: string
  eventId: string
  requirementId: string
  memberId: string
  completed: boolean
  updatedByUid: string
  updatedAt: Timestamp
}

export type RequirementInput = Pick<EventRequirement, 'title' | 'description' | 'targetRanks'>
export type RequirementCellStatus = 'Done' | 'Pending' | 'N/A'
export interface RequirementMemberRow {
  memberId: string
  name: string
  rank: string
  cells: Record<string, RequirementCellStatus>
  completed: number
  required: number
  status: 'Complete' | 'Incomplete' | 'N/A'
}
