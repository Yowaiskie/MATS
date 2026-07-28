export type MemberStatus = 'active' | 'inactive' | 'archived'

export const ORDER_GROUPS = [
  'Order of San Pedro',
  'Order of San Juan',
  'Order of San Tiago',
  'Order of San Andres',
  'Officers',
  'Squires'
] as const

export type OrderGroup = typeof ORDER_GROUPS[number]

export const MEMBER_RANKS = [
  'Chevaliers',
  'Paladins',
  'Squires'
] as const

export type MemberRank = typeof MEMBER_RANKS[number]

export interface OrderColorTheme {
  bg: string
  border: string
  text: string
  badge: string
  activeTab: string
}

export const ORDER_COLORS: Record<string, OrderColorTheme> = {
  'Order of San Pedro': {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-50 border-red-200 text-red-700',
    activeTab: 'bg-red-600 border-red-600 text-white shadow-xs'
  },
  'Order of San Juan': {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-50 border-blue-200 text-blue-700',
    activeTab: 'bg-blue-600 border-blue-600 text-white shadow-xs'
  },
  'Order of San Tiago': {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    activeTab: 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
  },
  'Order of San Andres': {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-50 border-amber-200 text-amber-700',
    activeTab: 'bg-amber-500 border-amber-500 text-white shadow-xs'
  },
  'Officers': {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-50 border-purple-200 text-purple-700',
    activeTab: 'bg-purple-600 border-purple-600 text-white shadow-xs'
  },
  'Squires': {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    badge: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    activeTab: 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
  }
}

export const getOrderBadgeStyle = (order?: string): string => {
  if (!order) return 'bg-gray-50 border-gray-200 text-gray-700'
  const normalized = order.trim()
  if (ORDER_COLORS[normalized]) {
    return ORDER_COLORS[normalized].badge
  }
  // Case-insensitive / partial fallbacks
  if (normalized.toLowerCase().includes('pedro')) return ORDER_COLORS['Order of San Pedro'].badge
  if (normalized.toLowerCase().includes('juan')) return ORDER_COLORS['Order of San Juan'].badge
  if (normalized.toLowerCase().includes('tiago')) return ORDER_COLORS['Order of San Tiago'].badge
  if (normalized.toLowerCase().includes('andres')) return ORDER_COLORS['Order of San Andres'].badge
  if (normalized.toLowerCase().includes('officer')) return ORDER_COLORS['Officers'].badge

  return 'bg-gray-50 border-gray-200 text-gray-700'
}

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
