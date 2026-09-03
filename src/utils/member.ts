import type { Member, MemberInput } from '@/types/member'
import { getMemberOrders } from '@/types/member'

/**
 * Formats a member's name as "LastName, FirstName MiddleName Suffix" (with optional Nickname in parentheses).
 * @param member Member profile object
 * @param includeNickname Whether to include nickname in parentheses (defaults to true)
 */
export const getFullName = (
  member: Member | MemberInput | { firstName: string; lastName: string; middleName?: string; suffix?: string; nickname?: string },
  includeNickname: boolean = true
): string => {
  const { firstName, lastName, middleName, suffix, nickname } = member
  
  const mid = middleName?.trim() ? ` ${middleName.trim()}` : ''
  const suf = suffix?.trim() ? ` ${suffix.trim()}` : ''
  const nick = (includeNickname && nickname?.trim()) ? ` (${nickname.trim()})` : ''
  
  return `${lastName.trim()}, ${firstName.trim()}${mid}${suf}${nick}`
}

/**
 * Normalizes name strings for comparison.
 */
export const normalizeName = (name: string): string => {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Checks if two members have the same combination of firstName and lastName.
 */
export const isDuplicateName = (
  firstA: string,
  lastA: string,
  firstB: string,
  lastB: string
): boolean => {
  return (
    normalizeName(firstA) === normalizeName(firstB) &&
    normalizeName(lastA) === normalizeName(lastB)
  )
}

/**
 * Determines whether a member holds an officer role, order, position, or rank.
 */
export const isOfficerMember = (
  member?: Member | MemberInput | { order?: string; position?: string; rank?: string } | null
): boolean => {
  if (!member) return false

  const orderStr = (member.order || '').toLowerCase()
  const positionStr = (member.position || '').toLowerCase()
  const rankStr = (member.rank || '').toLowerCase()

  // 1. Check order groups (e.g. 'Officers' or 'Order of San Pedro, Officers')
  const orders = getMemberOrders(member.order)
  if (orders.some(o => o.toLowerCase().includes('officer'))) return true
  if (orderStr.includes('officer')) return true

  // 2. Check position (e.g. 'President', 'Treasurer', 'Vice President', etc., excluding generic 'member')
  if (positionStr.trim().length > 0 && !positionStr.includes('member')) {
    return true
  }

  // 3. Check rank
  if (rankStr.includes('officer')) return true

  return false
}

