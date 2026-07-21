import type { Member, MemberInput } from '@/types/member'

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
