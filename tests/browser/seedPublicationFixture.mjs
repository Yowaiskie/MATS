import fs from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, writeBatch } from 'firebase/firestore'

const projectId = 'demo-mats-publication-browser'
const environment = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules: fs.readFileSync('firestore.rules', 'utf8') } })
try {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    const batch = writeBatch(db)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const end = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()
    const publication = { name: 'Browser Regular Cycle', startDate: `${today.slice(0, 7)}-01`, endDate: `${today.slice(0, 7)}-${end}`, status: 'draft', publicationType: 'regular', includeSundays: true, includeWeekdays: true, allowedRanks: ['Chevaliers'] }
    batch.set(doc(db, 'users/verification-coordinator'), { role: 'coordinator', permissions: { canManageSchedules: true } })
    batch.set(doc(db, 'schedulePublications/browser-regular'), publication)
    batch.set(doc(db, 'schedulePublications/browser-special'), { ...publication, name: 'Browser Special Mass', publicationType: 'special_event' })
    batch.set(doc(db, 'schedulePublications/browser-future'), { ...publication, name: 'Browser Future Cycle', startDate: '2099-11-01', endDate: '2099-11-30' })
    batch.set(doc(db, 'members/existing-server'), { firstName: 'Fixture', lastName: 'Server', status: 'active', rank: 'Chevaliers' })
    batch.set(doc(db, 'scheduleTemplates/wednesday'), { name: 'Wednesday', title: 'Wednesday Mass', dayOfWeek: 'Wednesday', startTime: '18:00', endTime: '19:00', active: true, assignedMembers: [] })
    for (let index = 0; index < 105; index++) {
      const id = `browser-row-${String(index).padStart(3, '0')}`
      batch.set(doc(db, 'schedules', id), {
        publicationId: index === 104 ? 'browser-special' : 'browser-regular',
        title: 'Wednesday Mass', category: index === 104 ? 'special_event' : 'mass_weekday', date: today, startTime: '18:00', endTime: '19:00',
        location: index === 99 || index === 100 ? 'Cross-page pair' : index >= 103 ? 'Intentional overlap' : `Location ${index}`,
        assignedMembers: index === 0 ? ['existing-server'] : [], isLocked: index === 0, status: index === 0 ? 'completed' : 'upcoming'
      })
    }
    batch.set(doc(db, 'attendanceSessions/browser-history'), { scheduleId: 'browser-row-000', locked: true, hasRecords: true })
    batch.set(doc(db, 'attendance/browser-history'), { scheduleId: 'browser-row-000', status: 'present', memberId: 'existing-server' })
    batch.set(doc(db, 'scheduleSubmissions/browser-history'), { publicationId: 'browser-regular', requestedScheduleIds: ['browser-row-000'], status: 'approved', memberId: 'existing-server' })
    await batch.commit()
  })
  console.log('Seeded isolated browser fixture: demo-mats-publication-browser, 105 report schedules.')
} finally {
  await environment.cleanup()
}
