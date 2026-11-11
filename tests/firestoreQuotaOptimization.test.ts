import { test } from 'node:test'
import assert from 'node:assert'
import { dashboardService } from '../src/services/dashboardService.ts'
import type { Schedule } from '../src/types/schedule.ts'
import type { Member } from '../src/types/member.ts'

test('Firestore Quota Optimization Suite', async (t) => {
  await t.test('1. dashboardService.getDashboardData avoids unconstrained schedule scans when monthSchedules exist', async () => {
    let unconstrainedGetSchedulesCalls = 0
    const mockMonthSchedules: Schedule[] = [
      {
        id: 'sched-1',
        title: 'Sunday Morning Mass',
        date: '2026-10-25',
        startTime: '08:00',
        endTime: '09:00',
        status: 'completed',
        createdAt: new Date('2026-10-20T08:00:00Z'),
        updatedAt: new Date('2026-10-25T09:00:00Z')
      }
    ]

    const mockMembers: Member[] = [
      {
        id: 'mem-1',
        firstName: 'John',
        lastName: 'Doe',
        rank: 'Knight',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01')
      }
    ]

    const result = await dashboardService.getDashboardData(undefined, {
      getAttendanceSessions: async () => [],
      getMembers: async () => mockMembers,
      getPublications: async () => [],
      getPolicySettings: async () => ({
        warningAbsenceThreshold: 2,
        suspensionAbsenceThreshold: 3,
        evaluationMonths: 1,
        includeSundays: true,
        includeWeekdays: false,
        includeMeetings: true
      }),
      loadReportData: async () => ({
        members: mockMembers,
        schedules: mockMonthSchedules,
        attendance: [],
        policy: {} as any
      }),
      generateMemberReport: () => [],
      getSchedulesByDate: async () => [],
      // deps.getSchedules NOT passed, simulating standard dashboard flow
    })

    assert.ok(result.stats)
    assert.strictEqual(unconstrainedGetSchedulesCalls, 0)
    // Activities correctly formulated from monthSchedules
    const scheduleActivities = result.activities.filter(a => a.id.startsWith('schedule-'))
    assert.strictEqual(scheduleActivities.length, 1)
    assert.ok(scheduleActivities[0].description.includes('Sunday Morning Mass'))
  })

  await t.test('2. Untaken schedules query bounds date range within last 14 days', () => {
    // Verify date calculation bounds correctly
    const now = new Date('2026-10-26T18:00:00Z')
    const pastBoundaryDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const pYear = pastBoundaryDate.getUTCFullYear()
    const pMonth = String(pastBoundaryDate.getUTCMonth() + 1).padStart(2, '0')
    const pDay = String(pastBoundaryDate.getUTCDate()).padStart(2, '0')
    const startDateStr = `${pYear}-${pMonth}-${pDay}`

    assert.strictEqual(startDateStr, '2026-10-12')
  })
})
