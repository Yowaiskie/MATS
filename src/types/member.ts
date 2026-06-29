export type MemberStatus = 'active' | 'inactive' | 'archived'

export interface Member {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  nickname?: string
  rank: string
  status: MemberStatus
  phoneNumber?: string
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}

export interface MemberInput {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  nickname?: string
  rank: string
  status: MemberStatus
  phoneNumber?: string
}
