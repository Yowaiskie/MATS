import type { SchedulePublication } from '../types/publication.ts'
import type { SuspensionPolicySettings } from '../services/settingsService.ts'
import { getParishTodayDate, calculateMonthsBetween } from './scheduleUtils.ts'

export interface ResolvedEvaluationContext {
  startDate: string
  endDate: string
  policy: SuspensionPolicySettings
  periodLabel: string
  periodType: 'regular_publication' | 'calendar_month' | 'custom'
  publication?: SchedulePublication
  isArchivedCycle?: boolean
}

export interface EvaluationResolverOptions {
  publications: SchedulePublication[]
  basePolicy: SuspensionPolicySettings
  currentDate?: string // Defaults to getParishTodayDate('Asia/Manila')
  targetPublicationId?: string // Set when manually chosen in Reports
  customDateRange?: { startDate: string; endDate: string } // Set on manual date entry
}

/**
 * Resolves policy thresholds from publication overrides or cycle length heuristics.
 */
export function resolveCyclePolicy(
  basePolicy: SuspensionPolicySettings,
  publication?: SchedulePublication
): SuspensionPolicySettings {
  if (!publication) return basePolicy

  const pubMonths = calculateMonthsBetween(publication.startDate, publication.endDate)
  const defaultWarning = pubMonths === 2 ? 3 : pubMonths >= 3 ? 4 : 2
  const defaultSuspension = pubMonths === 2 ? 5 : pubMonths >= 3 ? 7 : 3

  return {
    ...basePolicy,
    warningAbsenceThreshold: publication.warningAbsenceThreshold ?? defaultWarning,
    suspensionAbsenceThreshold: publication.suspensionAbsenceThreshold ?? defaultSuspension,
    evaluationMonths: pubMonths,
    includeSundays: publication.includeSundays !== undefined ? publication.includeSundays : basePolicy.includeSundays,
    includeWeekdays: publication.includeWeekdays !== undefined ? publication.includeWeekdays : basePolicy.includeWeekdays,
    includeMeetings: publication.includeMeetings !== undefined ? publication.includeMeetings : basePolicy.includeMeetings,
  }
}

/**
 * Resolves the unified evaluation period and policy for Dashboard and Reports.
 */
export function resolveEvaluationContext(options: EvaluationResolverOptions): ResolvedEvaluationContext {
  const {
    publications,
    basePolicy,
    currentDate = getParishTodayDate('Asia/Manila'),
    targetPublicationId,
    customDateRange
  } = options

  // 1. Manual target publication selected (Reports dropdown)
  if (targetPublicationId && targetPublicationId !== 'custom') {
    const pub = publications.find(p => p.id === targetPublicationId)
    if (pub) {
      return {
        startDate: pub.startDate,
        endDate: pub.endDate,
        policy: resolveCyclePolicy(basePolicy, pub),
        periodLabel: pub.name,
        periodType: 'regular_publication',
        publication: pub,
        isArchivedCycle: pub.status === 'archived'
      }
    }
  }

  // 2. Custom date range explicitly provided (Reports custom range)
  if (customDateRange?.startDate && customDateRange?.endDate) {
    return {
      startDate: customDateRange.startDate,
      endDate: customDateRange.endDate,
      policy: basePolicy,
      periodLabel: `${customDateRange.startDate} to ${customDateRange.endDate}`,
      periodType: 'custom'
    }
  }

  // 3. Auto-resolve current operating period for currentDate (Asia/Manila):
  const regularPubs = publications.filter(p => p.publicationType !== 'special_event')

  // 3a. Find regular publication spanning today with status === 'published'
  const currentPublished = regularPubs.find(
    p => p.status === 'published' && p.startDate <= currentDate && currentDate <= p.endDate
  )
  if (currentPublished) {
    return {
      startDate: currentPublished.startDate,
      endDate: currentPublished.endDate,
      policy: resolveCyclePolicy(basePolicy, currentPublished),
      periodLabel: currentPublished.name,
      periodType: 'regular_publication',
      publication: currentPublished,
      isArchivedCycle: false
    }
  }

  // 3b. Find regular publication spanning today regardless of lifecycle status (e.g. archived or closed)
  // This ensures an in-progress cycle (like Sept-Oct on Oct 26) is respected even if archived for next cycle prep.
  const currentSpanning = regularPubs.find(
    p => p.startDate <= currentDate && currentDate <= p.endDate
  )
  if (currentSpanning) {
    return {
      startDate: currentSpanning.startDate,
      endDate: currentSpanning.endDate,
      policy: resolveCyclePolicy(basePolicy, currentSpanning),
      periodLabel: currentSpanning.name,
      periodType: 'regular_publication',
      publication: currentSpanning,
      isArchivedCycle: currentSpanning.status === 'archived'
    }
  }

  // 3c. Fallback: Current calendar month in parish timezone
  const [yearStr, monthStr] = currentDate.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const lastDay = new Date(year, month, 0).getDate()
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const monthName = monthNames[month - 1]

  const fallbackStart = `${yearStr}-${monthStr}-01`
  const fallbackEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

  return {
    startDate: fallbackStart,
    endDate: fallbackEnd,
    policy: basePolicy,
    periodLabel: `${monthName} ${year} (Calendar Month)`,
    periodType: 'calendar_month'
  }
}
