import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, terminate, writeBatch, type Firestore } from 'firebase/firestore'
import { deleteApp, initializeApp } from 'firebase/app'
import { submissionService } from '../src/services/submissionService.ts'
import { groupSchedulesIntoPatterns } from '../src/utils/scheduleUtils.ts'
import type { Schedule } from '../src/types/schedule.ts'
import type { SchedulePublication } from '../src/types/publication.ts'
import type { Member } from '../src/types/member.ts'
import type { CreateSubmissionInput } from '../src/types/submission.ts'

test('Public submission optional fields: real anonymous Firestore Emulator flow', { skip: !process.env.FIRESTORE_EMULATOR_HOST, timeout: 60000 }, async t => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':')
  assert.ok(['127.0.0.1', 'localhost'].includes(host))
  const environment = await initializeTestEnvironment({ projectId: 'demo-mats-submission-undefined', firestore: { host, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') } })
  // Use the production modular SDK with an explicitly local, anonymous client.
  const app = initializeApp({ projectId: 'demo-mats-submission-undefined', apiKey: 'fake-emulator-key' }, 'public-submission-emulator')
  const db = getFirestore(app)
  connectFirestoreEmulator(db, host, Number(port))
  const publication = { id: 'public-cycle', name: 'Public cycle', startDate: '2099-11-01', endDate: '2099-11-30', status: 'published', publicationType: 'regular', submissionDeadlineMs: Date.parse('2099-11-30T23:59:00Z'), allowedRanks: ['Chevaliers'], submittedMembers: [] } as unknown as SchedulePublication
  const member = { id: 'server', firstName: 'Fixture', lastName: 'Server', rank: 'Chevaliers', status: 'active' } as Member
  const schedule = { id: 'wednesday', publicationId: publication.id, title: 'Wednesday Mass', date: '2099-11-04', startTime: '18:00', endTime: '19:00', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as unknown as Schedule
  const options = { firestoreInstance: db, publication, member, publicationSchedules: [schedule] }
  const baseInput: CreateSubmissionInput = { publicationId: publication.id, memberId: member.id, memberName: 'Fixture Server', requestedScheduleIds: [schedule.id] }
  const snapshot = async () => environment.withSecurityRulesDisabled(async context => {
    const privateDb = context.firestore() as unknown as Firestore
    return { schedule: (await getDoc(doc(privateDb, 'schedules/wednesday'))).data(), publication: (await getDoc(doc(privateDb, 'schedulePublications/public-cycle'))).data() }
  })
  const submitAs = (id: string, input: Partial<CreateSubmissionInput>) => submissionService.createPendingSubmission({ ...baseInput, ...input, memberId: id }, { ...options, member: { ...member, id } })
  try {
    await environment.clearFirestore()
    await environment.withSecurityRulesDisabled(async context => {
      const privateDb = context.firestore() as unknown as Firestore
      const batch = writeBatch(privateDb)
      batch.set(doc(privateDb, 'schedulePublications/public-cycle'), publication)
      batch.set(doc(privateDb, 'members/server'), member)
      batch.set(doc(privateDb, 'schedules/wednesday'), schedule)
      await batch.commit()
    })
    const before = await snapshot()

    await t.test('actual public-page pattern with absent location can be submitted anonymously', async () => {
      const patterns = groupSchedulesIntoPatterns([schedule], publication).weekdayPatterns
      assert.equal(patterns.length, 1)
      const slotSummaries = patterns.map(pattern => ({ dayOfWeek: pattern.dayOfWeek, dayName: pattern.dayName, startTime: pattern.startTime, title: pattern.title, location: pattern.location, datesCount: pattern.scheduleIds.length, scheduleIds: pattern.scheduleIds }))
      assert.equal(slotSummaries[0].location, undefined)
      const submission = await submitAs('missing-location', { slotSummaries })
      assert.equal(submission.status, 'pending')
      const saved = (await getDoc(doc(db, 'scheduleSubmissions/public-cycle_missing-location'))).data()!
      assert.equal('location' in saved.slotSummaries[0], false)
      assert.equal(saved.slotSummaries[0].title, schedule.title)
    })

    await t.test('all optional summary fields may be explicitly undefined, without required-field defaults', async () => {
      const submission = await submitAs('optional-fields', { memberRank: undefined, slotSummaries: [{ startTime: '18:00', scheduleIds: [schedule.id], dayOfWeek: undefined, dayName: undefined, title: undefined, location: undefined, datesCount: undefined }] })
      assert.deepEqual(submission.slotSummaries, [{ startTime: '18:00', scheduleIds: [schedule.id] }])
      assert.deepEqual((await getDoc(doc(db, 'scheduleSubmissions/public-cycle_optional-fields'))).data()?.slotSummaries, submission.slotSummaries)
    })

    await t.test('absent summaries are valid and defined falsy optional values are preserved', async () => {
      assert.deepEqual((await submitAs('no-summaries', {})).slotSummaries, [])
      const submission = await submitAs('zero-values', { slotSummaries: [{ startTime: '18:00', scheduleIds: [schedule.id], dayOfWeek: 0, datesCount: 0, location: '' }] })
      assert.equal(submission.slotSummaries?.[0].dayOfWeek, 0)
      assert.equal(submission.slotSummaries?.[0].datesCount, 0)
      assert.equal(submission.slotSummaries?.[0].location, '')
    })

    await t.test('required values remain rejected and no invalid submission is persisted', async () => {
      for (const input of [
        { memberName: '' },
        { memberName: undefined },
        { requestedScheduleIds: [] },
        { slotSummaries: [{ scheduleIds: [schedule.id] }] },
        { slotSummaries: [{ startTime: '18:00' }] }
      ]) {
        await assert.rejects(submitAs('invalid', input as unknown as Partial<CreateSubmissionInput>))
        assert.equal((await getDoc(doc(db, 'scheduleSubmissions/public-cycle_invalid'))).exists(), false)
      }
    })

    await t.test('deadlines, publication isolation, duplicate and public update protection remain enforced', async () => {
      await assert.rejects(submissionService.createPendingSubmission(baseInput, { ...options, publication: { ...publication, submissionDeadlineMs: 1 } }), /deadline|closed/i)
      await assert.rejects(submissionService.createPendingSubmission(baseInput, { ...options, publication: { ...publication, status: 'draft' } }), /closed/i)
      await assert.rejects(submitAs('foreign', { requestedScheduleIds: ['other-publication-schedule'] }), /does not belong/)
      await assert.rejects(submitAs('missing-location', {}), /already been received/)
      await assert.rejects(setDoc(doc(db, 'scheduleSubmissions/public-cycle_optional-fields'), { ...baseInput, memberId: 'optional-fields', status: 'approved' }), /permission|PERMISSION_DENIED/i)
      assert.deepEqual(await snapshot(), before)
    })
  } finally {
    await terminate(db)
    await deleteApp(app)
    await environment.cleanup()
  }
})
