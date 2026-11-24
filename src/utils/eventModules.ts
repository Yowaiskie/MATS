import {
  ALL_EVENT_OPTIONAL_MODULES,
  type Event,
  type EventOptionalModule
} from '../types/event.ts'

export interface EventOptionalModuleMeta {
  key: EventOptionalModule
  label: string
  description: string
}

export const EVENT_OPTIONAL_MODULE_CONFIG: EventOptionalModuleMeta[] = [
  {
    key: 'timeline',
    label: 'Timeline',
    description: 'Visual schedule view of event tasks and milestones'
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'Track event income, expenses, budgets, and fund transfers'
  },
  {
    key: 'forms',
    label: 'Forms',
    description: 'Registration forms, appointment slots, and public submissions'
  },
  {
    key: 'requirements',
    label: 'Requirements',
    description: 'Member compliance checklists and rank-based requirement tracking'
  },
  {
    key: 'contributions',
    label: 'Contributions',
    description: 'Track pledges, member contributions, and finance linking'
  }
]

const VALID_MODULE_SET = new Set<string>(ALL_EVENT_OPTIONAL_MODULES)

/**
 * Resolves the enabled optional modules for an event.
 * - Legacy events with `enabledModules === undefined` keep all 5 optional modules enabled.
 * - New events with an explicit array (including `[]`) honor only valid unique entries.
 */
export function getResolvedEventModules(
  event?: Pick<Event, 'enabledModules'> | null
): EventOptionalModule[] {
  if (!event || event.enabledModules === undefined) {
    return [...ALL_EVENT_OPTIONAL_MODULES]
  }
  const seen = new Set<EventOptionalModule>()
  const resolved: EventOptionalModule[] = []
  for (const mod of event.enabledModules) {
    if (VALID_MODULE_SET.has(mod) && !seen.has(mod)) {
      seen.add(mod)
      resolved.push(mod)
    }
  }
  return resolved
}

export function isEventModuleEnabled(
  event: Pick<Event, 'enabledModules'> | null | undefined,
  moduleKey: EventOptionalModule
): boolean {
  return getResolvedEventModules(event).includes(moduleKey)
}

export function getNewlyDisabledModules(
  previous: EventOptionalModule[],
  next: EventOptionalModule[]
): EventOptionalModule[] {
  const nextSet = new Set(next)
  return previous.filter(mod => !nextSet.has(mod))
}

export function getEventModuleLabel(moduleKey: EventOptionalModule): string {
  return EVENT_OPTIONAL_MODULE_CONFIG.find(m => m.key === moduleKey)?.label || moduleKey
}
