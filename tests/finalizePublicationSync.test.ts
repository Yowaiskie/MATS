import test from 'node:test'
import assert from 'node:assert/strict'
import { submissionService } from '../src/services/submissionService.ts'

function createMockDb(seed: Record<string, Record<string, any>>) {
  const store: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(seed))
  const updatedDocs: Array<{ col: string; id: string; data: any }> = []

  const db: any = {
    getDoc(col: string, id: string) {
      return store[col]?.[id] ?? null
    },
    queryDocs(col: string, field: string, value: any) {
      const bucket = store[col] || {}
      return Object.entries(bucket)
        .filter(([, v]) => v[field] === value)
        .map(([id, v]) => ({ id, ...v }))
    },
    doc(col: string, id: string) {
      return { col, id }
    },
    async runTransaction(fn: (tx: any) => Promise<any>) {
      const tx = {
        async get(ref: { col: string; id: string }) {
          const val = store[ref.col]?.[ref.id]
          return {
            id: ref.id,
            exists: () => Boolean(val),
            data: () => val
          }
        },
        update(ref: { col: string; id: string }, data: any) {
          if (!store[ref.col]) store[ref.col] = {}
          store[ref.col][ref.id] = { ...store[ref.col][ref.id], ...data }
          updatedDocs.push({ col: ref.col, id: ref.id, data })
        }
      }
      return fn(tx)
    }
  }

  return { db, store, updatedDocs }
}

test('finalizePublicationCycle syncs untagged schedules and reconciles approved-but-missing assignments with minimal writes', async () => {
  const { db, store, updatedDocs } = createMockDb({
    schedulePublications: {
      'pub-1': {
        name: 'December 2026 Cycle',
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        status: 'published',
        publicationType: 'regular',
        allowedRanks: ['Chevaliers', 'Paladins'],
        maxServersPerSundaySlot: 5,
        maxServersPerWeekdaySlot: 5,
        submittedMembers: ['mem-1']
      }
    },
    members: {
      'mem-1': { firstName: 'JUAN', lastName: 'DELA CRUZ', rank: 'Chevaliers', status: 'active' },
      'mem-2': { firstName: 'PEDRO', lastName: 'SANTOS', rank: 'Paladins', status: 'active' }
    },
    schedules: {
      // Tagged schedule already has mem-1 assigned (should NOT be rewritten unnecessarily)
      'sched-tagged': {
        publicationId: 'pub-1',
        title: 'Sunday 8:00 AM Mass',
        date: '2026-12-20',
        startTime: '08:00',
        endTime: '09:00',
        status: 'upcoming',
        assignedMembers: ['mem-1']
      },
      // Untagged/template-generated schedule WITHOUT publicationId (previously skipped!)
      'sched-untagged': {
        title: 'Sunday 10:00 AM Mass',
        date: '2026-12-20',
        startTime: '10:00',
        endTime: '11:00',
        status: 'upcoming',
        assignedMembers: []
      }
    },
    scheduleSubmissions: {
      // Already approved earlier, but missed sched-untagged because it lacked publicationId
      'sub-approved': {
        publicationId: 'pub-1',
        memberId: 'mem-1',
        memberName: 'DELA CRUZ, JUAN',
        status: 'approved',
        requestedScheduleIds: ['sched-tagged', 'sched-untagged'],
        submittedAt: '2026-11-24T01:00:00Z'
      },
      // New pending submission selecting sched-untagged
      'sub-pending': {
        publicationId: 'pub-1',
        memberId: 'mem-2',
        memberName: 'SANTOS, PEDRO',
        status: 'pending',
        requestedScheduleIds: ['sched-untagged'],
        submittedAt: '2026-11-24T02:00:00Z'
      }
    }
  })

  const result = await submissionService.finalizePublicationCycle('pub-1', {
    firestoreInstance: db,
    transactionRunner: db.runTransaction.bind(db),
    effectiveDate: '2026-12-01',
    adminUser: { uid: 'admin-1', email: 'admin@mats.test', role: 'admin' }
  })

  // Both mem-1 (reconciled from approved) and mem-2 (newly approved) are now on sched-untagged!
  assert.deepEqual(store.schedules['sched-untagged'].assignedMembers, ['mem-1', 'mem-2'])
  // sched-tagged was already up-to-date, so it was NOT written unnecessarily!
  const scheduleWrites = updatedDocs.filter(u => u.col === 'schedules')
  assert.equal(scheduleWrites.length, 1)
  assert.equal(scheduleWrites[0].id, 'sched-untagged')
  assert.equal(result.updatedSchedulesCount, 1)
  assert.equal(result.approvedSubmissionsCount, 1)
  assert.equal(store.scheduleSubmissions['sub-pending'].status, 'approved')
})
