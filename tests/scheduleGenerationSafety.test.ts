import test from 'node:test'
import assert from 'node:assert/strict'
import { loadScheduleServices } from './helpers/loadScheduleServices.ts'
import type { ScheduleInput } from '../src/types/schedule.ts'

type Data = Record<string, unknown>
type Ref = { path: string; id: string }
type Constraint = { field?: string; operator?: string; value: unknown; kind: string }

// Isolated Firebase module boundary. No real Firebase initialization or network.
function harness() {
  const records = new Map<string, Data>()
  const versions = new Map<string, number>()
  const queries: Array<{ path: string; constraints: Constraint[] }> = []
  let retries = 0
  let serial = 0
  const faults = { auditWritesDenied: false }
  const db = { app: { name: 'memory-only' } }
  const seed = (key: string, data: Data) => {
    records.set(key, structuredClone(data))
    versions.set(key, (versions.get(key) || 0) + 1)
  }
  const snapshot = (key: string) => {
    const value = records.has(key) ? structuredClone(records.get(key)) : undefined
    return { id: key.split('/').at(-1)!, exists: () => value !== undefined, data: () => value }
  }
  const firestore = {
    collection: (_db: unknown, name: string) => ({ path: name }),
    doc: (source: { path?: string }, name?: string, id?: string): Ref => {
      const target = source.path ? `${source.path}/${name || `auto-${++serial}`}` : `${name}/${id}`
      return { path: target, id: target.split('/').at(-1)! }
    },
    where: (field: string, operator: string, value: unknown): Constraint => ({ field, operator, value, kind: 'where' }),
    documentId: () => '__name__',
    startAfter: (...value: unknown[]): Constraint => ({ value, kind: 'cursor' }),
    limit: (value: number): Constraint => ({ value, kind: 'limit' }),
    orderBy: (field: string): Constraint => ({ field, value: undefined, kind: 'order' }),
    query: (reference: { path: string }, ...constraints: Constraint[]) => ({ ...reference, constraints }),
    getDocsFromServer: async (request: { path: string; constraints: Constraint[] }) => {
      queries.push(request)
      let found = [...records.entries()].filter(([key]) => key.startsWith(`${request.path}/`))
      for (const constraint of request.constraints) {
        if (constraint.kind === 'where') found = found.filter(([, data]) => {
          const actual = constraint.field!.split('.').reduce<unknown>((value, field) => (value as Data | undefined)?.[field], data) as string
          const expected = constraint.value as string
          return actual !== undefined && (constraint.operator === '>=' ? actual >= expected : constraint.operator === '<=' ? actual <= expected : actual === expected)
        })
        if (constraint.kind === 'order') {
          found = found.filter(([, data]) => constraint.field === '__name__' || data[constraint.field!] !== undefined)
          const ordering = request.constraints.filter(item => item.kind === 'order')
          found.sort(([leftKey, left], [rightKey, right]) => {
            for (const order of ordering) {
              const a = String(order.field === '__name__' ? leftKey.split('/').at(-1) : left[order.field!])
              const b = String(order.field === '__name__' ? rightKey.split('/').at(-1) : right[order.field!])
              if (a !== b) return a < b ? -1 : 1
            }
            return 0
          })
        }
        if (constraint.kind === 'cursor') {
          const [date, id] = constraint.value as string[]
          found = found.filter(([key, data]) => String(data.date) > date || (data.date === date && key.split('/').at(-1)! > id))
        }
        if (constraint.kind === 'limit') found = found.slice(0, Number(constraint.value))
      }
      return { docs: found.map(([key]) => snapshot(key)), empty: found.length === 0 }
    },
    getDoc: async (reference: Ref) => snapshot(reference.path),
    serverTimestamp: () => ({ timestamp: 'server' }),
    runTransaction: async (_db: unknown, callback: (transaction: {
      get: (reference: Ref) => Promise<ReturnType<typeof snapshot>>
      set: (reference: Ref, data: Data) => void
      update: (reference: Ref, data: Data) => void
      delete: (reference: Ref) => void
    }) => Promise<unknown>) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const reads = new Map<string, number>()
        const writes: Array<{ ref: Ref; data?: Data; update?: boolean }> = []
        const transaction = {
          get: async (reference: Ref) => {
            assert.equal(writes.length, 0, 'All transaction reads must precede writes')
            reads.set(reference.path, versions.get(reference.path) || 0)
            return snapshot(reference.path)
          },
          set: (ref: Ref, data: Data) => {
            if (faults.auditWritesDenied && ref.path.startsWith('auditLogs/')) throw new Error('PERMISSION_DENIED: audit write')
            writes.push({ ref, data })
          },
          update: (ref: Ref, data: Data) => { writes.push({ ref, data, update: true }) },
          delete: (ref: Ref) => { writes.push({ ref }) }
        }
        const result = await callback(transaction)
        if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) {
          retries++
          continue
        }
        for (const write of writes) {
          if (!write.data) {
            records.delete(write.ref.path)
            versions.set(write.ref.path, (versions.get(write.ref.path) || 0) + 1)
          } else seed(write.ref.path, write.update ? { ...records.get(write.ref.path), ...write.data } : write.data)
        }
        return result
      }
      throw new Error('Too much transaction contention')
    }
  }
  const { integrity, publications, recurring } = loadScheduleServices({ ...firestore, getDocs: firestore.getDocsFromServer }, db)
  return { records, seed, queries, faults, db: db as unknown as import('firebase/firestore').Firestore, integrity, publications, recurring, retries: () => retries }
}

const publication = (overrides: Data = {}) => ({ name: 'Regular cycle', startDate: '2099-11-01', endDate: '2099-11-30', status: 'draft' as const, publicationType: 'regular' as const, ...overrides })
const occurrence: ScheduleInput = { publicationId: 'pub', title: 'Wednesday Mass', category: 'mass_weekday', date: '2099-11-04', startTime: '18:00', endTime: '19:00', location: 'Church', assignedMembers: ['server-original'] }
const template = { id: 'wed', name: 'Wednesday', title: 'Wednesday Mass', dayOfWeek: 'Wednesday', startTime: '18:00', endTime: '19:00', location: 'Church', assignedMembers: [], active: true, createdAt: null, updatedAt: null }

test('concurrent regular publication creates serialize and reject the overlap', async () => {
  const h = harness()
  const results = await Promise.allSettled([
    h.publications.addPublication(publication(), 'admin', h.db),
    h.publications.addPublication(publication({ name: 'Overlapping cycle' }), 'admin', h.db)
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.match(String(results.find(result => result.status === 'rejected')?.reason), /overlaps/)
  assert.ok(h.retries() > 0)
})

test('archived records do not reserve dates; Special and Regular publications may overlap', async () => {
  const h = harness()
  h.seed('schedulePublications/archived', publication({ status: 'archived' }))
  await h.publications.addPublication(publication(), 'admin', h.db)
  await h.publications.addPublication(publication({ publicationType: 'special_event' }), 'admin', h.db)
  const listed = await h.publications.getPublications(h.db)
  assert.equal(listed.length, 3)
  assert.ok(listed.every(item => item.id !== h.integrity.PUBLICATION_GUARD_ID))
})

test('date edits and archived reactivation cannot bypass overlap validation', async () => {
  const h = harness()
  h.seed('schedulePublications/active', publication())
  h.seed('schedulePublications/later', publication({ startDate: '2099-12-01', endDate: '2099-12-31' }))
  await assert.rejects(h.publications.updatePublication('later', { startDate: '2099-11-20' }, 'admin', h.db), /overlaps/)
  h.seed('schedulePublications/archived', publication({ status: 'archived' }))
  await assert.rejects(h.publications.updatePublication('archived', { status: 'published' }, 'admin', h.db), /overlaps/)
  await assert.rejects(h.publications.reopenPublication('archived', '2099-11-20T23:59:00Z', 'admin', undefined, { db: h.db }), /overlaps/)
  await assert.rejects(h.publications.updatePublicationStatus('archived', 'published', 'admin', { db: h.db }), /overlaps/)
  assert.equal(h.records.get('schedulePublications/archived')?.status, 'archived')
})

test('concurrent creation/retry creates one occurrence and never overwrites assignments/history', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  const results = await Promise.all(Array.from({ length: 4 }, () => h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence)))
  assert.equal(results.filter(result => result.created).length, 1)
  const id = results[0].id
  const saved = { ...h.records.get(`schedules/${id}`), assignedMembers: ['real-server'], isLocked: true, status: 'completed' }
  h.seed(`schedules/${id}`, saved)
  h.seed('attendance/record', { scheduleId: id, status: 'present' })
  h.seed('scheduleSubmissions/submission', { publicationId: 'pub', requestedScheduleIds: [id] })
  const before = JSON.stringify([...h.records])
  assert.equal((await h.integrity.scheduleIntegrityService.createOccurrence(h.db, { ...occurrence, assignedMembers: [] })).created, false)
  assert.equal(await h.integrity.scheduleIntegrityService.updateOccurrence(h.db, 'pub', id, { title: 'Changed' }), false)
  assert.equal(JSON.stringify([...h.records]), before)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('auditLogs/')).length, 1)
})

test('intentional Special Mass and different Mass contexts survive the same date/time/location', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.seed('schedulePublications/special', publication({ publicationType: 'special_event' }))
  for (const input of [occurrence, { ...occurrence, publicationId: 'special', category: 'special_event' as const }, { ...occurrence, category: 'holy_hour' as const }]) {
    assert.equal((await h.integrity.scheduleIntegrityService.createOccurrence(h.db, input)).created, true)
  }
  assert.equal([...h.records.keys()].filter(key => key.startsWith('schedules/')).length, 3)
})

test('actual generator preserves legacy assignments and reports unowned matches without adoption', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.seed('schedules/legacy', { ...occurrence, publicationId: undefined, id: 'legacy', isLocked: true })
  const before = JSON.stringify(h.records.get('schedules/legacy'))
  const result = await h.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'pub' })
  assert.equal(result.created, 0)
  assert.equal(result.validationErrors.length, 1)
  assert.equal(JSON.stringify(h.records.get('schedules/legacy')), before)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('schedules/')).length, 1)
})

test('actual generator is idempotent under concurrency and uses bounded schedule queries', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  const results = await Promise.all([1, 2].map(() => h.recurring.generateSchedules(occurrence.date, occurrence.date, [template, { ...template, id: 'second-template' }], { publicationId: 'pub' })))
  assert.equal(results.reduce((sum, report) => sum + report.created, 0), 1)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('schedules/')).length, 1)
  const scheduleQueries = h.queries.filter(request => request.path === 'schedules')
  assert.equal(scheduleQueries.length, 2)
  assert.ok(scheduleQueries.every(request => request.constraints.some(item => item.field === 'date' && item.operator === '>=') && request.constraints.some(item => item.field === 'date' && item.operator === '<=') && request.constraints.some(item => item.kind === 'limit')))
})

test('read-only report preserves all records and separates distinct contexts', async () => {
  const h = harness()
  h.seed('schedules/a', { ...occurrence, isLocked: true })
  h.seed('schedules/b', { ...occurrence, assignedMembers: [] })
  h.seed('schedules/c', { ...occurrence, category: 'special_event' })
  h.seed('schedules/d', { ...occurrence, category: 'holy_hour' })
  const before = JSON.stringify([...h.records])
  const report = await h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, occurrence.date, occurrence.date)
  assert.equal(report.groups.length, 1)
  assert.equal(report.groups[0].records.length, 2)
  assert.equal(report.groups[0].classification, 'same_publication')
  assert.equal(report.groups[0].records.find(record => record.id === 'a')?.assignedMemberCount, 1)
  assert.equal(JSON.stringify([...h.records]), before)
  assert.equal(h.queries.length, 1)
})

test('deletion rejects linked schedules, submissions, legacy range records and historical publications', async () => {
  for (const kind of ['schedules', 'scheduleSubmissions', 'attendanceSessions', 'attendance', 'excuseRequests', 'auditLogs', 'legacy', 'archived', 'published', 'historical']) {
    const h = harness()
    h.seed('schedulePublications/pub', publication(kind === 'archived' || kind === 'published' ? { status: kind } : kind === 'historical' ? { startDate: '2020-01-01', endDate: '2020-01-31' } : {}))
    if (!['archived', 'published', 'historical'].includes(kind)) h.seed(`${kind === 'legacy' ? 'schedules' : kind}/reference`, kind === 'legacy' ? { date: occurrence.date } : kind === 'auditLogs' ? { details: { publicationId: 'pub' } } : { publicationId: 'pub' })
    const before = JSON.stringify([...h.records])
    await assert.rejects(h.publications.deletePublication('pub', 'admin', h.db), /[Aa]rchive/)
    assert.equal(JSON.stringify([...h.records]), before)
  }
})

test('only an empty future draft can be deleted; archived/deleted parents cannot generate', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  await h.publications.deletePublication('pub', 'admin', h.db)
  assert.equal(h.records.has('schedulePublications/pub'), false)
  await assert.rejects(h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence), /no longer exists/)
  h.seed('schedulePublications/pub', publication({ status: 'archived' }))
  await assert.rejects(h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence), /archived/)
})

test('invalid/oversized report ranges fail closed; report pages stop at the review cap without writes', async () => {
  const h = harness()
  await assert.rejects(h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, 'invalid', occurrence.date), /valid/)
  await assert.rejects(h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, '2090-01-01', '2099-01-01'), /one year/)
  for (let index = 0; index < 1001; index++) h.seed(`schedules/${index}`, { ...occurrence })
  const before = JSON.stringify([...h.records])
  let report = await h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, occurrence.date, occurrence.date)
  assert.equal(report.scannedCount, 100)
  while (report.hasMore) report = await h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, occurrence.date, occurrence.date, report)
  assert.equal(report.scannedCount, 1000)
  assert.equal(report.truncated, true)
  assert.equal(h.queries.length, 10)
  assert.ok(h.queries.every(request => request.constraints.some(constraint => constraint.kind === 'limit' && constraint.value === 100)))
  assert.equal(JSON.stringify([...h.records]), before)
})

test('Firestore cursor pages retain cross-page duplicates without rereading earlier schedules', async () => {
  const h = harness()
  for (let index = 0; index < 105; index++) h.seed(`schedules/record-${String(index).padStart(3, '0')}`, {
    ...occurrence, location: index >= 99 && index <= 100 ? 'Cross-page pair' : `Location ${index}`
  })
  const first = await h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, occurrence.date, occurrence.date)
  assert.equal(first.scannedCount, 100)
  assert.equal(first.groups.length, 0)
  assert.equal(first.hasMore, true)
  const next = await h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, occurrence.date, occurrence.date, first)
  assert.equal(next.scannedCount, 105)
  assert.equal(next.groups.length, 1)
  assert.equal(next.groups[0].records.length, 2)
  assert.equal(new Set(next.records.map(record => record.id)).size, 105)
  assert.equal(next.hasMore, false)
  assert.equal(next.truncated, false)
  assert.equal(h.queries.length, 2)
  assert.ok(h.queries[1].constraints.some(constraint => constraint.kind === 'cursor'))
  await h.integrity.scheduleIntegrityService.getDuplicateReport(h.db, occurrence.date, occurrence.date, next)
  assert.equal(h.queries.length, 2)
})

test('legacy same-publication random IDs are skipped without replacing assignments or IDs', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.seed('schedules/random-original', { ...occurrence, isLocked: true, status: 'completed' })
  const before = JSON.stringify(h.records.get('schedules/random-original'))
  const report = await h.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'pub' })
  assert.equal(report.created, 0)
  assert.equal(report.duplicates, 1)
  assert.equal(JSON.stringify(h.records.get('schedules/random-original')), before)
})

test('Regular generation does not invalidate an intentional overlapping Special Mass', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.seed('schedulePublications/special', publication({ publicationType: 'special_event' }))
  h.seed('schedules/special-mass', { ...occurrence, publicationId: 'special', category: undefined })
  const before = JSON.stringify(h.records.get('schedules/special-mass'))
  const report = await h.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'pub' })
  assert.equal(report.created, 1)
  assert.equal(report.validationErrors.length, 0)
  assert.equal(JSON.stringify(h.records.get('schedules/special-mass')), before)
})

test('publication edits cannot orphan existing occurrences or change their context', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.seed('schedules/original', { ...occurrence })
  await assert.rejects(h.publications.updatePublication('pub', { startDate: '2099-11-05' }, 'admin', h.db), /existing schedules/)
  await assert.rejects(h.publications.updatePublication('pub', { publicationType: 'special_event' }, 'admin', h.db), /existing schedules/)
  await h.publications.updatePublication('pub', { endDate: '2099-12-31' }, 'admin', h.db)
  assert.equal(h.records.get('schedulePublications/pub')?.endDate, '2099-12-31')
  assert.equal(h.records.get('schedules/original')?.publicationId, 'pub')
})

test('future occurrence edits preserve attendance and reject cross-publication ownership', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.seed('schedulePublications/other', publication({ publicationType: 'special_event' }))
  h.seed('schedules/original', { ...occurrence })
  h.seed('attendanceSessions/session', { scheduleId: 'original', locked: true, hasRecords: true })
  const before = JSON.stringify([...h.records])
  assert.equal(await h.integrity.scheduleIntegrityService.updateOccurrence(h.db, 'pub', 'original', { location: 'Elsewhere' }), false)
  await assert.rejects(h.integrity.scheduleIntegrityService.updateOccurrence(h.db, 'other', 'original', { location: 'Elsewhere' }), /ownership/)
  assert.equal(JSON.stringify([...h.records]), before)
})

test('concurrent deletion and generation cannot leave an orphan generated occurrence', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  await Promise.allSettled([
    h.publications.deletePublication('pub', 'admin', h.db),
    h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence)
  ])
  const schedules = [...h.records.keys()].filter(key => key.startsWith('schedules/'))
  assert.ok(schedules.length === 0 || h.records.has('schedulePublications/pub'))
})

test('failed atomic creation can be retried without partial writes or duplicate audits', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  h.faults.auditWritesDenied = true
  const before = JSON.stringify([...h.records])
  await assert.rejects(h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence), /PERMISSION_DENIED/)
  assert.equal(JSON.stringify([...h.records]), before)
  h.faults.auditWritesDenied = false
  assert.equal((await h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence)).created, true)
  assert.equal((await h.integrity.scheduleIntegrityService.createOccurrence(h.db, occurrence)).created, false)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('auditLogs/')).length, 1)
})

test('regular template label differences do not duplicate one Mass; different locations remain separate', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  const report = await h.recurring.generateSchedules(occurrence.date, occurrence.date, [
    template,
    { ...template, id: 'alternate-label', title: 'Weekday Mass' },
    { ...template, id: 'different-venue', location: 'Chapel' }
  ], { publicationId: 'pub' })
  assert.equal(report.created, 2)
  assert.equal(report.duplicates, 1)
})

test('standalone generator defers to an owning regular publication', async () => {
  const h = harness()
  h.seed('schedulePublications/pub', publication())
  await assert.rejects(h.recurring.generateSchedules(occurrence.date, occurrence.date, [template]), /from that publication/)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('schedules/')).length, 0)
})

test('standalone generation is concurrent-safe and performs one bounded publication query per run', async () => {
  const h = harness()
  const results = await Promise.all([1, 2].map(() => h.recurring.generateSchedules(occurrence.date, occurrence.date, [template])))
  assert.equal(results.reduce((sum, report) => sum + report.created, 0), 1)
  assert.equal(h.queries.filter(request => request.path === 'schedulePublications').length, 2)
})

test('stale standalone context cannot create a copy after publication creation', async () => {
  const h = harness()
  const prepared = await h.integrity.scheduleIntegrityService.prepareGeneration(h.db, occurrence.date, occurrence.date)
  await h.publications.addPublication(publication(), 'admin', h.db)
  await assert.rejects(h.integrity.scheduleIntegrityService.createOccurrence(h.db, { ...occurrence, publicationId: undefined }, 'admin', prepared.publicationRevision), /Publications changed/)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('schedules/')).length, 0)
})

test('simultaneous standalone occurrence and publication creation resolve without duplicate Mass records', async () => {
  const h = harness()
  const prepared = await h.integrity.scheduleIntegrityService.prepareGeneration(h.db, occurrence.date, occurrence.date)
  const results = await Promise.allSettled([
    h.integrity.scheduleIntegrityService.createOccurrence(h.db, { ...occurrence, publicationId: undefined }, 'admin', prepared.publicationRevision),
    h.publications.addPublication(publication(), 'admin', h.db)
  ])
  const createdPublication = results[1]
  assert.equal(createdPublication.status, 'fulfilled')
  if (createdPublication.status !== 'fulfilled') return
  await h.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: createdPublication.value })
  assert.equal([...h.records.keys()].filter(key => key.startsWith('schedules/')).length, 1)
})
