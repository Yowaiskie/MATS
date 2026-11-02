import {
  collection, doc, documentId, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where,
  type DocumentData, type DocumentReference, type Firestore, type Transaction
} from 'firebase/firestore'
import type { Schedule, ScheduleInput } from '../types/schedule.ts'
import type { SchedulePublication } from '../types/publication.ts'
import { buildDuplicateScheduleReport, findRegularPublicationConflict, GenerationContextChangedError, getOccurrenceKey, validateScheduleRange } from '../utils/scheduleIntegrity.ts'
import { getParishTodayDate, isHistoricalScheduleOccurrence } from '../utils/scheduleUtils.ts'

export const PUBLICATION_GUARD_ID = 'coordination_regular_publication_revision'
const MAX_RANGE_RECORDS = 1000
export const DUPLICATE_REPORT_PAGE_SIZE = 100
type PublicationCandidate = Pick<SchedulePublication, 'id' | 'name' | 'startDate' | 'endDate' | 'status' | 'publicationType'>

export interface DuplicateScheduleReport {
  startDate: string
  endDate: string
  scannedCount: number
  groups: ReturnType<typeof buildDuplicateScheduleReport>
  records: Schedule[]
  nextCursor?: { date: string; id: string }
  hasMore: boolean
  truncated: boolean
}

// Existing lifecycle tests use the repository's in-memory Firestore adapter.
interface Snapshot {
  id: string
  exists(): boolean
  data(): DocumentData | undefined
}
interface MemoryDb {
  doc(path: string, id: string): DocumentReference
  collection(path: string): { docs: Snapshot[] }
  runTransaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T>
}
function memoryDb(db: Firestore): MemoryDb | undefined {
  return !db.app && 'collection' in db ? db as unknown as MemoryDb : undefined
}
export function integrityDoc(db: Firestore, path: string, id: string): DocumentReference {
  return memoryDb(db)?.doc(path, id) || doc(db, path, id)
}

function integrityTransaction<T>(db: Firestore, callback: (transaction: Transaction) => Promise<T>): Promise<T> {
  return memoryDb(db)?.runTransaction(callback) || runTransaction(db, callback)
}

export async function readIntegrityRange(db: Firestore, path: string, startDate: string, endDate: string): Promise<Array<DocumentData & { id: string }>> {
  validateScheduleRange(startDate, endDate)
  const memory = memoryDb(db)
  let docs
  if (memory) {
    docs = memory.collection(path).docs.filter(snapshot => {
      const data = snapshot.data()!
      return path === 'schedules'
        ? data.date >= startDate && data.date <= endDate
        : data.endDate >= startDate && data.startDate <= endDate
    })
  } else {
    try {
      docs = (await getDocsFromServer(query(collection(db, path),
        ...(path === 'schedules'
          ? [where('date', '>=', startDate), where('date', '<=', endDate)]
          : [where('endDate', '>=', startDate), where('startDate', '<=', endDate)]),
        limit(MAX_RANGE_RECORDS + 1)))).docs
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string }
      if (path === 'schedulePublications' && (errorObj?.code === 'failed-precondition' || String(errorObj?.message || '').toLowerCase().includes('index'))) {
        const singleQueryDocs = (await getDocsFromServer(query(
          collection(db, path),
          where('endDate', '>=', startDate),
          limit(MAX_RANGE_RECORDS + 1)
        ))).docs
        docs = singleQueryDocs.filter(snapshot => {
          const data = snapshot.data() as { startDate?: string } | undefined
          return Boolean(data && data.startDate && data.startDate <= endDate)
        })
      } else {
        throw err
      }
    }
  }
  if (docs.length > MAX_RANGE_RECORDS) throw new Error('Too many records in this range. Narrow the dates before continuing.')
  return docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }))
}

/**
 * All cooperating publication mutations touch this revision. Read it BEFORE the
 * server range query, so another mutation forces a transaction retry and requery.
 * No dates are stored on this metadata document: orderBy('startDate') excludes it.
 */
export async function guardPublicationMutation(
  db: Firestore, transaction: Transaction, candidate: PublicationCandidate, checkOverlap = true
): Promise<SchedulePublication[]> {
  if (candidate.id === PUBLICATION_GUARD_ID) throw new Error('Invalid publication ID.')
  validateScheduleRange(candidate.startDate, candidate.endDate)
  const guardRef = integrityDoc(db, 'schedulePublications', PUBLICATION_GUARD_ID)
  const guard = await transaction.get(guardRef)
  let publications: SchedulePublication[] = []
  if (checkOverlap && candidate.publicationType !== 'special_event' && candidate.status !== 'archived') {
    publications = await readIntegrityRange(db, 'schedulePublications', candidate.startDate, candidate.endDate) as SchedulePublication[]
    const conflict = findRegularPublicationConflict(candidate, publications)
    if (conflict) throw new Error(`Regular publication overlaps "${conflict.name}" (${conflict.startDate} to ${conflict.endDate}). Edit or archive that publication first. Special publications may overlap.`)
  }
  transaction.set(guardRef, { revision: Number(guard.data()?.revision || 0) + 1 })
  return publications
}

export function needsPublicationOverlapCheck(current: SchedulePublication, next: SchedulePublication): boolean {
  return current.startDate !== next.startDate || current.endDate !== next.endDate ||
    current.publicationType !== next.publicationType || (current.status === 'archived' && next.status !== 'archived')
}

export async function guardPublicationRangeEdit(db: Firestore, current: SchedulePublication, next: SchedulePublication): Promise<void> {
  const changingContext = current.publicationType !== next.publicationType
  if (!changingContext && next.startDate <= current.startDate && next.endDate >= current.endDate) return
  const schedules = await readIntegrityRange(db, 'schedules', current.startDate, current.endDate) as Schedule[]
  if (schedules.some(schedule => (!schedule.publicationId || schedule.publicationId === current.id) &&
    (changingContext || schedule.date < next.startDate || schedule.date > next.endDate))) {
    throw new Error('This change would exclude or change the context of existing schedules. Keep their publication range/type and archive when appropriate; no records were changed.')
  }
}

async function generatedScheduleId(input: ScheduleInput): Promise<string> {
  const bytes = new TextEncoder().encode(getOccurrenceKey(input))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return `generated_${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export const scheduleIntegrityService = {
  async updateOccurrence(db: Firestore, publicationId: string, id: string, input: Partial<ScheduleInput>, performedBy = 'System'): Promise<boolean> {
    const auditRef = integrityDoc(db, 'auditLogs', globalThis.crypto.randomUUID())
    return integrityTransaction(db, async transaction => {
      const parentRef = integrityDoc(db, 'schedulePublications', publicationId)
      const scheduleRef = integrityDoc(db, 'schedules', id)
      const parent = await transaction.get(parentRef)
      const snapshot = await transaction.get(scheduleRef)
      if (!parent.exists() || !snapshot.exists()) throw new Error('Publication or schedule no longer exists. Reload before saving.')
      const current = { ...snapshot.data(), id } as Schedule
      if (current.publicationId !== publicationId) throw new Error('Schedule ownership requires review. No record was reassigned.')
      if (parent.data()?.status === 'archived') throw new Error('Archived publication schedules cannot be changed.')
      if (current.isLocked || current.status === 'completed' || isHistoricalScheduleOccurrence(current)) return false
      const nextDate = input.date || current.date
      if (nextDate < parent.data()!.startDate || nextDate > parent.data()!.endDate) throw new Error('Schedule is outside its publication date range.')
      const fields = ['title', 'date', 'startTime', 'endTime', 'location', 'liturgicalColor', 'category'] as const
      const updates = Object.fromEntries(fields.filter(field => input[field] !== undefined && (input[field] || '') !== (current[field] || '')).map(field => [field, input[field]]))
      if (Object.keys(updates).length === 0) return false
      // Explicitly edited future occurrences with attendance are retained too.
      // Query only this schedule; never load all attendance sessions.
      const memory = memoryDb(db)
      const hasSession = memory ? memory.collection('attendanceSessions').docs.some(record => record.data()?.scheduleId === id)
        : !(await getDocsFromServer(query(collection(db, 'attendanceSessions'), where('scheduleId', '==', id), limit(1)))).empty
      if (hasSession) return false
      transaction.update(scheduleRef, { ...updates, updatedAt: serverTimestamp() })
      transaction.update(parentRef, { scheduleRevision: Number(parent.data()?.scheduleRevision || 0) + 1 })
      transaction.set(auditRef, {
        action: 'SCHEDULE_UPDATE', category: 'schedule', performedBy, timestamp: serverTimestamp(),
        description: `Updated publication schedule ${id}`, details: { scheduleId: id, publicationId, updates }
      })
      return true
    })
  },

  async prepareGeneration(db: Firestore, startDate: string, endDate: string, publicationId?: string) {
    validateScheduleRange(startDate, endDate)
    let overlappingPublications: SchedulePublication[]
    let publicationRevision: number | undefined
    if (publicationId) {
      overlappingPublications = await integrityTransaction(db, async transaction => {
        const snapshot = await transaction.get(integrityDoc(db, 'schedulePublications', publicationId))
        if (!snapshot.exists()) throw new Error('Publication no longer exists.')
        const publication = { ...snapshot.data(), id: publicationId } as SchedulePublication
        if (publication.status === 'archived') throw new Error('Cannot generate schedules for an archived publication.')
        if (startDate < publication.startDate || endDate > publication.endDate) throw new Error('Generation range must stay inside the publication.')
        return guardPublicationMutation(db, transaction, publication)
      })
    } else {
      const prepared = await integrityTransaction(db, async transaction => {
        const guard = await transaction.get(integrityDoc(db, 'schedulePublications', PUBLICATION_GUARD_ID))
        const publications = await readIntegrityRange(db, 'schedulePublications', startDate, endDate) as SchedulePublication[]
        if (publications.some(publication => publication.status !== 'archived' && publication.publicationType !== 'special_event')) {
          throw new Error('A regular publication covers this range. Generate missing schedules from that publication instead of the standalone generator.')
        }
        return { publications, revision: Number(guard.data()?.revision || 0) }
      })
      overlappingPublications = prepared.publications
      publicationRevision = prepared.revision
    }
    const otherSpecialOwners = new Set(overlappingPublications.filter(publication => publication.publicationType === 'special_event' && publication.id !== publicationId).map(publication => publication.id))
    const schedules = await readIntegrityRange(db, 'schedules', startDate, endDate) as Schedule[]
    // A Special publication is an explicit separate context even when its legacy
    // schedules have no category. Do not reinterpret or rewrite those records.
    return { schedules: schedules.filter(schedule => !schedule.publicationId || !otherSpecialOwners.has(schedule.publicationId)), publicationRevision }
  },

  async getDuplicateReport(db: Firestore, startDate: string, endDate: string, previous?: DuplicateScheduleReport): Promise<DuplicateScheduleReport> {
    validateScheduleRange(startDate, endDate)
    if (previous && (previous.startDate !== startDate || previous.endDate !== endDate)) throw new Error('Dates changed. Run a new preview before loading more schedules.')
    if (previous && (!previous.hasMore || previous.records.length >= MAX_RANGE_RECORDS)) return previous
    const cursor = previous?.nextCursor
    const pageSize = Math.min(DUPLICATE_REPORT_PAGE_SIZE, MAX_RANGE_RECORDS - (previous?.records.length || 0))
    const snapshot = await getDocsFromServer(query(collection(db, 'schedules'),
      where('date', '>=', startDate), where('date', '<=', endDate),
      orderBy('date'), orderBy(documentId()),
      ...(cursor ? [startAfter(cursor.date, cursor.id)] : []), limit(pageSize)))
    const page = snapshot.docs.map(record => ({ ...record.data(), id: record.id })) as Schedule[]
    // Accumulate across pages: a matching pair may straddle a Firestore cursor.
    const records = [...(previous?.records || []), ...page]
    const last = page.at(-1)
    const fullPage = page.length === pageSize
    return {
      startDate, endDate, scannedCount: records.length, records,
      groups: buildDuplicateScheduleReport(records),
      nextCursor: last ? { date: last.date, id: last.id } : cursor,
      hasMore: fullPage && records.length < MAX_RANGE_RECORDS,
      truncated: fullPage && records.length >= MAX_RANGE_RECORDS
    }
  },

  // Stable IDs + create-only transactions protect retries/concurrent generators.
  // Legacy random-ID matches must be checked from the bounded range before calling.
  async createOccurrence(db: Firestore, input: ScheduleInput, performedBy = 'System', publicationRevision?: number): Promise<{ id: string; created: boolean }> {
    validateScheduleRange(input.date, input.date)
    const id = await generatedScheduleId(input)
    const ref = integrityDoc(db, 'schedules', id)
    const auditRef = integrityDoc(db, 'auditLogs', globalThis.crypto.randomUUID())
    return integrityTransaction(db, async transaction => {
      const guardRef = !input.publicationId ? integrityDoc(db, 'schedulePublications', PUBLICATION_GUARD_ID) : null
      const guard = guardRef ? await transaction.get(guardRef) : null
      if (guardRef && (publicationRevision === undefined || Number(guard?.data()?.revision || 0) !== publicationRevision)) {
        throw new GenerationContextChangedError('Publications changed during generation. Reload and generate from the owning publication when applicable.')
      }
      const parentRef = input.publicationId ? integrityDoc(db, 'schedulePublications', input.publicationId) : null
      const parent = parentRef ? await transaction.get(parentRef) : null
      if (parentRef && !parent?.exists()) throw new Error('Publication no longer exists. Reload before generating schedules.')
      if (parent && parent.exists()) {
        const publication = parent.data() as SchedulePublication
        if (publication.status === 'archived') throw new Error('Cannot generate schedules for an archived publication.')
        if (input.date < publication.startDate || input.date > publication.endDate) throw new Error('Schedule is outside its publication date range.')
      }
      const existing = await transaction.get(ref)
      if (existing.exists()) return { id, created: false }
      // Serialize standalone creation against publication creation without a
      // repeated publication query for every generated date.
      if (guardRef) transaction.set(guardRef, { revision: publicationRevision })
      // Parent revision serializes creation against safe deletion and range edits.
      if (parentRef) transaction.update(parentRef, { scheduleRevision: Number(parent?.data()?.scheduleRevision || 0) + 1 })
      const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
      transaction.set(ref, { ...data, title: input.title.trim(), status: input.status || 'upcoming', assignedMembers: input.assignedMembers || [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      transaction.set(auditRef, {
        action: 'SCHEDULE_CREATE', category: 'schedule', performedBy,
        description: `Created schedule '${input.title}' on ${input.date} (${input.startTime})`,
        timestamp: serverTimestamp(), details: { scheduleId: id, input: data }
      })
      return { id, created: true }
    })
  },

  async assertDeletable(db: Firestore, publication: SchedulePublication): Promise<void> {
    const today = getParishTodayDate('Asia/Manila')
    if (publication.status !== 'draft' || publication.startDate <= today || publication.submittedMembers?.length) {
      throw new Error('Only an empty future draft can be deleted. Archive this publication to preserve its history.')
    }
    for (const path of ['schedules', 'scheduleSubmissions', 'attendanceSessions', 'attendance', 'excuseRequests', 'auditLogs']) {
      const memory = memoryDb(db)
      const field = path === 'auditLogs' ? 'details.publicationId' : 'publicationId'
      const found = memory ? memory.collection(path).docs.some(snapshot => {
        const data = snapshot.data()
        return (path === 'auditLogs' ? data?.details?.publicationId : data?.publicationId) === publication.id
      }) : !(await getDocsFromServer(query(collection(db, path), where(field, '==', publication.id), limit(1)))).empty
      if (found) throw new Error(`Publication has linked ${path}. Archive it instead; no records were removed.`)
    }
    // Untagged historical schedules may still be included by the legacy fallback.
    // Conservatively retain drafts covering any existing schedule, using limit(1).
    const memory = memoryDb(db)
    const legacy = memory ? memory.collection('schedules').docs.some(snapshot => {
      const data = snapshot.data()!
      return data.date >= publication.startDate && data.date <= publication.endDate
    }) : !(await getDocsFromServer(query(collection(db, 'schedules'), where('date', '>=', publication.startDate), where('date', '<=', publication.endDate), limit(1)))).empty
    if (legacy) throw new Error('Schedules exist in this draft range and may have historical references. Archive it instead.')
  }
}
