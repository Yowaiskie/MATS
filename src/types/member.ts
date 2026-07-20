export type MemberStatus = 'active' | 'inactive' | 'archived'

export const ORDER_GROUPS = [
  'Order of San Pedro',
  'Order of San Juan',
  'Order of San Tiago',
  'Order of San Andres'
] as const

export type OrderGroup = typeof ORDER_GROUPS[number]

export interface Member {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  nickname?: string
  homeAddress?: string
  dateOfBirth?: string
  rank: string
  status: MemberStatus
  phoneNumber?: string
  monthJoined?: string
  dateOfInvestiture?: string
  position?: string
  order?: string
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}

export interface MemberInput {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  nickname?: string
  homeAddress?: string
  dateOfBirth?: string
  rank: string
  status: MemberStatus
  phoneNumber?: string
  monthJoined?: string
  dateOfInvestiture?: string
  position?: string
  order?: string
}
