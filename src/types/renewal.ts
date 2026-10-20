import type { Member, MemberRank } from '@/types/member'

export type RenewalMembershipStatus =
  | 'active'        // Fully renewed and active for this cycle
  | 'probationary' // Under evaluation or conditional renewal
  | 'honorary'     // Honorary / emeritus member for this cycle
  | 'alumni'       // Transitioned to alumni during this cycle
  | 'inactive'     // Did not complete renewal / inactive for this cycle

export const RENEWAL_STATUSES: RenewalMembershipStatus[] = [
  'active',
  'probationary',
  'honorary',
  'alumni',
  'inactive'
]

export interface RenewalStatusOption {
  value: RenewalMembershipStatus
  label: string
  description: string
}

export const RENEWAL_STATUS_OPTIONS: RenewalStatusOption[] = [
  { value: 'active', label: 'Active', description: 'Regular participating member for this cycle' },
  { value: 'probationary', label: 'Probationary', description: 'Under evaluation or conditional renewal' },
  { value: 'honorary', label: 'Honorary', description: 'Honorary or emeritus member for this cycle' },
  { value: 'alumni', label: 'Alumni', description: 'Transitioned to alumni during this cycle' },
  { value: 'inactive', label: 'Inactive', description: 'Did not complete renewal / inactive for this cycle' }
]

export interface RenewalCycle {
  id: string                      // Unique document ID (e.g. cycle_2026_2027 or auto ID)
  name: string                    // Display name: e.g. "Annual Renewal Cycle 2026–2027"
  year: string                    // Academic / Ministry year, e.g. "2026–2027"
  startDate: string               // YYYY-MM-DD
  endDate: string                 // YYYY-MM-DD
  isCurrent: boolean              // Exactly ONE cycle can be current at a given time
  isArchived: boolean             // If true, cycle is locked from edits
  description?: string
  memberCount: number             // Cached count of memberships in this cycle
  createdBy: string               // User email / UID
  createdAt: any                  // Firestore Timestamp
  updatedAt: any                  // Firestore Timestamp
  archivedAt?: any                // Firestore Timestamp
  archivedBy?: string
}

export interface RenewalCycleInput {
  name: string
  year: string
  startDate: string
  endDate: string
  description?: string
  isCurrent?: boolean
}

export interface RenewalMembership {
  id: string                      // Deterministic ID: `${cycleId}_${memberId}`
  cycleId: string                 // Ref to renewalCycles.id
  memberId: string                // Ref to permanent members.id
  cycleRank: MemberRank | string  // 'Chevaliers' | 'Paladins' | 'Squires' (cycle-specific classification)
  cycleOrder?: string             // Cycle-specific order assignment (defaults to member.order)
  membershipStatus: RenewalMembershipStatus // Cycle-specific status
  renewalDate: string             // YYYY-MM-DD date when enrolled/renewed
  notes?: string                  // Remarks or special notes for this cycle
  addedBy: string                 // User email / UID
  createdAt: any                  // Firestore Timestamp
  updatedAt: any                  // Firestore Timestamp
}

export interface RenewalMembershipInput {
  cycleRank: MemberRank | string
  membershipStatus: RenewalMembershipStatus
  cycleOrder?: string
  renewalDate?: string
  notes?: string
}

export const normalizeCycleRank = (rank?: string): MemberRank => {
  if (rank === 'Chevaliers') return 'Chevaliers'
  if (rank === 'Squires') return 'Squires'
  return 'Paladins'
}

export interface RenewalMembershipWithMember extends RenewalMembership {
  member: Member                  // Joined permanent member profile
}

export const getRenewalStatusBadgeStyle = (status: RenewalMembershipStatus): string => {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'probationary':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'honorary':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'alumni':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'inactive':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}
