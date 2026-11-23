import type {
  AppointmentSlotAnswer,
  EventFormQuestion,
  SlotCounterType
} from '@/types/eventForm'

export interface SelectedSlotTarget {
  docId: string
  mapKey: string
  formId: string
  questionId: string
  slotType: SlotCounterType
  slotKey: string
  maxCapacity: number
  label: string
}

export class SlotFullError extends Error {
  readonly questionId: string
  readonly slotKey: string
  readonly slotType: SlotCounterType
  readonly maxCapacity: number
  readonly label: string

  constructor(target: Pick<SelectedSlotTarget, 'questionId' | 'slotKey' | 'slotType' | 'maxCapacity' | 'label'>, message?: string) {
    super(
      message ||
        (target.slotType === 'appointment'
          ? `The appointment slot "${target.label}" is already full (${target.maxCapacity} max capacity reached). Please select another slot.`
          : `The option "${target.label}" is already full (${target.maxCapacity} max slots reached). Please select another option.`)
    )
    this.name = 'SlotFullError'
    this.questionId = target.questionId
    this.slotKey = target.slotKey
    this.slotType = target.slotType
    this.maxCapacity = target.maxCapacity
    this.label = target.label
  }
}

export function buildAppointmentSlotKey(date: string, slotId: string): string {
  return `${date.trim()}::${slotId.trim()}`
}

export function buildSlotCountMapKey(
  questionId: string,
  slotType: SlotCounterType,
  slotKey: string
): string {
  return `${questionId}::${slotType}::${slotKey}`
}

/**
 * Deterministic 32-bit FNV-1a hash encoded in base36 for Firestore-safe document IDs.
 */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function sanitizeSegment(raw: string, maxLen: number = 48): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen)
  return cleaned || 'slot'
}

/**
 * Builds a deterministic, Firestore-safe document ID for eventFormSlotCounts.
 * Includes a short hash of the raw key so distinct option labels never collide after sanitization.
 */
export function buildSlotCountDocId(
  formId: string,
  questionId: string,
  slotType: SlotCounterType,
  slotKey: string
): string {
  const safeForm = sanitizeSegment(formId, 40)
  const safeQ = sanitizeSegment(questionId, 40)
  const safeKey = sanitizeSegment(slotKey, 48)
  const hash = fnv1aHash(`${formId}|${questionId}|${slotType}|${slotKey}`)
  return `${safeForm}__${safeQ}__${slotType}__${safeKey}__${hash}`
}

/**
 * Extracts all capacity-limited appointment slots and option limits selected in a form response.
 */
export function extractLimitedSelections(
  formId: string,
  questions: EventFormQuestion[],
  answers: Record<string, any>
): SelectedSlotTarget[] {
  const targets: SelectedSlotTarget[] = []
  const seenDocIds = new Set<string>()

  for (const q of questions) {
    if (!q.id) continue
    const val = answers?.[q.id]
    if (val === undefined || val === null || val === '') continue

    // 1. Appointment slots with maxCapacity > 0
    if (q.type === 'appointment_slots' && q.appointmentConfig && q.appointmentConfig.length > 0) {
      if (typeof val === 'object' && !Array.isArray(val)) {
        const appt = val as AppointmentSlotAnswer
        if (appt.date && appt.slotId) {
          const dateCfg = q.appointmentConfig.find(d => d.date === appt.date)
          const slotCfg = dateCfg?.slots.find(s => s.id === appt.slotId)
          if (slotCfg && slotCfg.maxCapacity && slotCfg.maxCapacity > 0) {
            const slotKey = buildAppointmentSlotKey(appt.date, appt.slotId)
            const docId = buildSlotCountDocId(formId, q.id, 'appointment', slotKey)
            if (!seenDocIds.has(docId)) {
              seenDocIds.add(docId)
              const timeLabel = appt.timeRange || `${slotCfg.startTime} - ${slotCfg.endTime}`
              const dateLabel = appt.dateLabel || dateCfg?.label || appt.date
              targets.push({
                docId,
                mapKey: buildSlotCountMapKey(q.id, 'appointment', slotKey),
                formId,
                questionId: q.id,
                slotType: 'appointment',
                slotKey,
                maxCapacity: slotCfg.maxCapacity,
                label: `${timeLabel} (${dateLabel})`
              })
            }
          }
        }
      }
      continue
    }

    // 2. Option limits on multiple_choice, dropdown, checkbox
    if (q.optionLimits && Object.keys(q.optionLimits).length > 0) {
      const selectedOpts = Array.isArray(val) ? val : [val]
      for (const selOpt of selectedOpts) {
        if (typeof selOpt !== 'string' || !selOpt) continue
        const maxLimit = q.optionLimits[selOpt]
        if (maxLimit && maxLimit > 0) {
          const docId = buildSlotCountDocId(formId, q.id, 'option', selOpt)
          if (!seenDocIds.has(docId)) {
            seenDocIds.add(docId)
            targets.push({
              docId,
              mapKey: buildSlotCountMapKey(q.id, 'option', selOpt),
              formId,
              questionId: q.id,
              slotType: 'option',
              slotKey: selOpt,
              maxCapacity: maxLimit,
              label: selOpt
            })
          }
        }
      }
    }
  }

  return targets
}

/**
 * Computes which slot counters need to be incremented and decremented when editing an existing response.
 */
export function computeSlotDeltas(
  oldTargets: SelectedSlotTarget[],
  newTargets: SelectedSlotTarget[]
): {
  toIncrement: SelectedSlotTarget[]
  toDecrement: SelectedSlotTarget[]
} {
  const oldIds = new Set(oldTargets.map(t => t.docId))
  const newIds = new Set(newTargets.map(t => t.docId))

  const toIncrement = newTargets.filter(t => !oldIds.has(t.docId))
  const toDecrement = oldTargets.filter(t => !newIds.has(t.docId))

  return { toIncrement, toDecrement }
}
