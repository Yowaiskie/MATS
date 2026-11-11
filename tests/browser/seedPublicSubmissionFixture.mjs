import fs from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, writeBatch } from 'firebase/firestore'

const environment = await initializeTestEnvironment({ projectId: 'demo-mats-public-submission', firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync('firestore.rules', 'utf8') } })
try {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'schedulePublications/public-cycle'), { name: 'Anonymous Public Submission Test', startDate: '2099-11-01', endDate: '2099-11-30', status: 'published', publicationType: 'regular', submissionDeadlineMs: Date.parse('2099-11-30T23:59:00Z'), includeWeekdays: true, includeSundays: true, maxWeekdaysPerServer: 1, maxServersPerWeekdaySlot: 1, enableRankQuotas: false, allowedRanks: ['Chevaliers'], submittedMembers: [] })
    for (const [id, firstName] of [['desktop', 'Desktop'], ['messenger', 'Messenger'], ['full', 'Existing']]) batch.set(doc(db, 'members', id), { firstName, lastName: 'Server', rank: 'Chevaliers', status: 'active', order: 'Order of San Pedro' })
    batch.set(doc(db, 'schedules/wednesday'), { publicationId: 'public-cycle', title: 'Wednesday Mass', date: '2099-11-04', startTime: '18:00', endTime: '19:00', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] })
    batch.set(doc(db, 'schedules/friday-full'), { publicationId: 'public-cycle', title: 'Friday Mass', date: '2099-11-06', startTime: '18:00', endTime: '19:00', category: 'mass_weekday', status: 'upcoming', assignedMembers: ['full'] })
    await batch.commit()
  })
  console.log('Seeded anonymous public submission fixtures in demo-mats-public-submission; schedules intentionally have no location.')
} finally {
  await environment.cleanup()
}
