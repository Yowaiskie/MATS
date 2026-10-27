import type { Schedule, ScheduleInput } from '../types/schedule.ts'
import type { SchedulePublication } from '../types/publication.ts'
import { isHolyHourSchedule, isMeetingSchedule, isSpecialEventOrService, isSundayOrAnticipatedMass } from './scheduleUtils.ts'

type Occurrence = Pick<ScheduleInput, 'publicationId' | 'title' | 'category' | 'date' | 'startTime' | 'location'>
const normalize = (value = '') => value.trim().toLowerCase().replace(/\s+/g, ' ')

export class GenerationContextChangedError extends Error {}

export function validateScheduleRange(startDate: string, endDate: string): void {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error('Select a valid start and end date.')
  }
  if ((Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 366) {
    throw new Error('Select a range of at most one year. Narrow the dates to review more records.')
  }
}

// Missing legacy categories are resolved only for comparing the same titled context.
export function getOccurrenceContext(schedule: Occurrence): string {
  const category = schedule.category || (isHolyHourSchedule(schedule.title) ? 'holy_hour'
    : isMeetingSchedule(schedule.title) ? 'meeting'
    : isSpecialEventOrService(schedule) ? 'special_event'
    : isSundayOrAnticipatedMass(schedule.title, schedule.date, schedule.startTime) ? 'mass_sunday' : 'mass_weekday')
  // Regular template labels can differ for the same Mass. Category + owner keep
  // Regular/Special contexts separate; a label change must not create a new Mass.
  const label = category === 'mass_sunday' || category === 'mass_weekday' ? 'regular_mass' : normalize(schedule.title)
  return JSON.stringify([schedule.date, schedule.startTime, normalize(schedule.location), category, label])
}

export function getOccurrenceKey(schedule: Occurrence): string {
  return JSON.stringify([schedule.publicationId || null, getOccurrenceContext(schedule)])
}

export function findRegularPublicationConflict(
  candidate: Pick<SchedulePublication, 'id' | 'startDate' | 'endDate' | 'status' | 'publicationType'>,
  publications: SchedulePublication[]
): SchedulePublication | undefined {
  if (candidate.publicationType === 'special_event' || candidate.status === 'archived') return undefined
  return publications.find(publication => publication.id !== candidate.id &&
    publication.publicationType !== 'special_event' && publication.status !== 'archived' &&
    publication.startDate <= candidate.endDate && publication.endDate >= candidate.startDate)
}

export interface DuplicateScheduleGroup {
  context: string
  classification: 'same_publication' | 'ownership_review'
  records: Array<Pick<Schedule, 'id' | 'publicationId' | 'title' | 'category' | 'date' | 'startTime' | 'endTime' | 'location' | 'status' | 'isLocked'> & {
    assignedMemberCount: number
  }>
}

export function buildDuplicateScheduleReport(schedules: Schedule[]): DuplicateScheduleGroup[] {
  const grouped = new Map<string, Schedule[]>()
  for (const schedule of schedules) {
    const context = getOccurrenceContext(schedule)
    const records = grouped.get(context) || []
    records.push(schedule)
    grouped.set(context, records)
  }
  return [...grouped.entries()].filter(([, records]) => records.length > 1).map(([context, records]) => ({
    context,
    classification: new Set(records.map(record => record.publicationId || null)).size === 1 && records[0].publicationId
      ? 'same_publication' : 'ownership_review',
    records: records.map(record => ({
      id: record.id,
      ...(record.publicationId ? { publicationId: record.publicationId } : {}),
      title: record.title,
      category: record.category,
      date: record.date,
      startTime: record.startTime,
      endTime: record.endTime,
      location: record.location,
      status: record.status,
      isLocked: record.isLocked,
      assignedMemberCount: record.assignedMembers?.length || 0
    }))
  }))
}
