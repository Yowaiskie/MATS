import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import * as firestore from 'firebase/firestore'
import { loadScheduleServices } from './helpers/loadScheduleServices.ts'

const PROJECT_ID = 'demo-mats-publication-verify'
const publication = { name: 'Verification regular cycle', startDate: '2099-11-01', endDate: '2099-11-30', status: 'draft' as const, publicationType: 'regular' as const }
const occurrence = { publicationId: 'regular', title: 'Wednesday Mass', category: 'mass_weekday' as const, date: '2099-11-04', startTime: '18:00', endTime: '19:00', location: 'Church', assignedMembers: ['existing-server'] }
const template = { id: 'wednesday', name: 'Wednesday', title: occurrence.title, dayOfWeek: 'Wednesday', startTime: '18:00', endTime: '19:00', location: 'Church', assignedMembers: [], active: true, createdAt: null, updatedAt: null }

test('Publication prevention: real Firestore Emulator integration', { skip: !process.env.FIRESTORE_EMULATOR_HOST, timeout: 180000 }, async t => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':')
  assert.ok(['127.0.0.1', 'localhost'].includes(host), 'Only a local emulator may be used')
  assert.ok(PROJECT_ID.startsWith('demo-'))
  const environment = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { host, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') } })
  const adminDb = environment.authenticatedContext('verification-coordinator').firestore() as unknown as firestore.Firestore
  const queryReads: number[] = []
  const services = loadScheduleServices({ ...firestore, getDocsFromServer: async (request: Parameters<typeof firestore.getDocsFromServer>[0]) => {
    const snapshot = await firestore.getDocsFromServer(request)
    queryReads.push(snapshot.size)
    return snapshot
  } }, adminDb)
  const seed = async (records: Record<string, Record<string, unknown>>) => environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore() as unknown as firestore.Firestore
    const batch = firestore.writeBatch(db)
    for (const [reference, data] of Object.entries(records)) batch.set(firestore.doc(db, reference), data)
    await batch.commit()
  })
  const reset = async () => {
    await environment.clearFirestore()
    await seed({ 'users/verification-coordinator': { role: 'coordinator', permissions: { canManageSchedules: true } } })
    queryReads.length = 0
  }

  try {
    await t.test('simultaneous actual generator calls and retries create exactly one occurrence and audit', async () => {
      await reset()
      await seed({ 'schedulePublications/regular': publication })
      const concurrent = await Promise.allSettled(Array.from({ length: 4 }, () => services.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'regular' })))
      assert.ok(concurrent.some(result => result.status === 'fulfilled'))
      for (const result of concurrent) {
        if (result.status === 'fulfilled') assert.deepEqual(result.value.validationErrors, [])
        else assert.match(String(result.reason), /aborted|contention/i)
      }
      let schedules = await firestore.getDocs(firestore.collection(adminDb, 'schedules'))
      assert.equal(schedules.size, 1)
      const id = schedules.docs[0].id
      await seed({ [`schedules/${id}`]: { ...schedules.docs[0].data(), assignedMembers: ['existing-server'], isLocked: true }, 'attendance/present': { scheduleId: id, memberId: 'existing-server', status: 'present' }, 'scheduleSubmissions/original': { publicationId: 'regular', memberId: 'existing-server', requestedScheduleIds: [id], status: 'approved' } })
      const before = (await firestore.getDoc(firestore.doc(adminDb, 'schedules', id))).data()
      for (let attempt = 0; attempt < 3; attempt++) {
        const retry = await services.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'regular' })
        assert.equal(retry.created, 0)
        assert.equal(retry.duplicates, 1)
      }
      schedules = await firestore.getDocs(firestore.collection(adminDb, 'schedules'))
      assert.equal(schedules.size, 1)
      assert.deepEqual(schedules.docs[0].data(), before)
      assert.equal((await firestore.getDocs(firestore.query(firestore.collection(adminDb, 'auditLogs'), firestore.where('details.scheduleId', '==', id)))).size, 1)
      assert.equal((await firestore.getDoc(firestore.doc(adminDb, 'attendance/present'))).data()?.status, 'present')
      assert.deepEqual((await firestore.getDoc(firestore.doc(adminDb, 'scheduleSubmissions/original'))).data()?.requestedScheduleIds, [id])
    })

    await t.test('concurrent regular creates reject overlap; archived and Special contexts remain valid', async () => {
      await reset()
      await seed({ 'schedulePublications/historical': { ...publication, status: 'archived' } })
      const results = await Promise.allSettled(Array.from({ length: 3 }, () => services.publications.addPublication(publication, 'verification', adminDb)))
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
      const specialId = await services.publications.addPublication({ ...publication, publicationType: 'special_event', name: 'Special Mass' }, 'verification', adminDb)
      const regularId = (results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<string>).value
      await services.integrity.scheduleIntegrityService.createOccurrence(adminDb, { ...occurrence, publicationId: regularId })
      await services.integrity.scheduleIntegrityService.createOccurrence(adminDb, { ...occurrence, publicationId: specialId, category: 'special_event' })
      assert.equal((await firestore.getDocs(firestore.collection(adminDb, 'schedules'))).size, 2)
      await assert.rejects(services.publications.reopenPublication('historical', '2099-11-20T23:59:00Z', 'verification', undefined, { db: adminDb }), /overlaps/)
    })

    await t.test('legacy IDs, attendance history and publication isolation survive generation and edits', async () => {
      await reset()
      await seed({ 'schedulePublications/regular': publication, 'schedulePublications/special': { ...publication, publicationType: 'special_event' }, 'schedules/original-random-id': { ...occurrence, isLocked: true, status: 'completed' }, 'schedules/past': { ...occurrence, date: '2020-01-01' }, 'attendanceSessions/finalized': { scheduleId: 'original-random-id', locked: true }, 'attendance/original': { scheduleId: 'original-random-id', status: 'present' } })
      const report = await services.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'regular' })
      assert.equal(report.created, 0)
      assert.equal(await services.integrity.scheduleIntegrityService.updateOccurrence(adminDb, 'regular', 'original-random-id', { title: 'Changed' }), false)
      assert.equal(await services.integrity.scheduleIntegrityService.updateOccurrence(adminDb, 'regular', 'past', { title: 'Changed' }), false)
      await assert.rejects(services.integrity.scheduleIntegrityService.updateOccurrence(adminDb, 'special', 'original-random-id', { title: 'Changed' }), /ownership/)
      await assert.rejects(services.publications.deletePublication('regular', 'verification', adminDb), /[Aa]rchive/)
      assert.deepEqual((await firestore.getDoc(firestore.doc(adminDb, 'schedules/original-random-id'))).data()?.assignedMembers, ['existing-server'])
      assert.equal((await firestore.getDoc(firestore.doc(adminDb, 'schedules/past'))).data()?.title, occurrence.title)
      assert.equal((await firestore.getDoc(firestore.doc(adminDb, 'attendanceSessions/finalized'))).data()?.locked, true)
    })

    await t.test('real cursor pages read 100 then 5 records and find a duplicate split across pages', async () => {
      await reset()
      const records: Record<string, Record<string, unknown>> = {}
      for (let index = 0; index < 105; index++) records[`schedules/row-${String(index).padStart(3, '0')}`] = { ...occurrence, location: index === 99 || index === 100 ? 'Cross-page pair' : `Location ${index}` }
      await seed(records)
      const first = await services.integrity.scheduleIntegrityService.getDuplicateReport(adminDb, occurrence.date, occurrence.date)
      assert.equal(first.scannedCount, 100)
      assert.equal(first.groups.length, 0)
      const next = await services.integrity.scheduleIntegrityService.getDuplicateReport(adminDb, occurrence.date, occurrence.date, first)
      assert.equal(next.scannedCount, 105)
      assert.equal(next.groups.length, 1)
      assert.equal(next.groups[0].records.length, 2)
      assert.equal(next.hasMore, false)
      assert.deepEqual(queryReads, [100, 5])
      assert.equal(new Set(next.records.map(record => record.id)).size, 105)
      await services.integrity.scheduleIntegrityService.getDuplicateReport(adminDb, occurrence.date, occurrence.date, next)
      assert.deepEqual(queryReads, [100, 5])
      assert.equal((await firestore.getDocs(firestore.collection(adminDb, 'auditLogs'))).size, 0)
    })

    await t.test('unchanged rules reject unauthorized schedule and publication writes', async () => {
      await reset()
      await seed({ 'schedulePublications/regular': publication })
      const publicDb = environment.unauthenticatedContext().firestore() as unknown as firestore.Firestore
      await assert.rejects(services.integrity.scheduleIntegrityService.createOccurrence(publicDb, occurrence), /permission|PERMISSION_DENIED/i)
      await assert.rejects(services.publications.addPublication({ ...publication, startDate: '2099-12-01', endDate: '2099-12-31' }, 'untrusted', publicDb), /permission|PERMISSION_DENIED/i)
      assert.equal((await firestore.getDocs(firestore.collection(adminDb, 'schedules'))).size, 0)
    })

    await t.test('legacy Special ownership remains independent even with no schedule category', async () => {
      await reset()
      const legacySpecial = Object.fromEntries(Object.entries(occurrence).filter(([field]) => field !== 'category'))
      await seed({ 'schedulePublications/regular': publication, 'schedulePublications/special': { ...publication, publicationType: 'special_event' }, 'schedules/legacy-special': { ...legacySpecial, publicationId: 'special', assignedMembers: ['special-server'] } })
      const before = (await firestore.getDoc(firestore.doc(adminDb, 'schedules/legacy-special'))).data()
      const report = await services.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: 'regular' })
      assert.equal(report.created, 1)
      assert.deepEqual(report.validationErrors, [])
      assert.equal((await firestore.getDocs(firestore.collection(adminDb, 'schedules'))).size, 2)
      assert.deepEqual((await firestore.getDoc(firestore.doc(adminDb, 'schedules/legacy-special'))).data(), before)
    })

    await t.test('a simultaneous standalone occurrence and regular publication cannot duplicate one Mass', async () => {
      await reset()
      const prepared = await services.integrity.scheduleIntegrityService.prepareGeneration(adminDb, occurrence.date, occurrence.date)
      const results = await Promise.allSettled([
        services.integrity.scheduleIntegrityService.createOccurrence(adminDb, { ...occurrence, publicationId: undefined }, 'verification', prepared.publicationRevision),
        services.publications.addPublication(publication, 'verification', adminDb)
      ])
      const createdPublication = results[1]
      assert.equal(createdPublication.status, 'fulfilled')
      if (createdPublication.status !== 'fulfilled') return
      await services.recurring.generateSchedules(occurrence.date, occurrence.date, [template], { publicationId: createdPublication.value })
      assert.equal((await firestore.getDocs(firestore.collection(adminDb, 'schedules'))).size, 1)
    })
  } finally {
    await environment.cleanup()
  }
})
