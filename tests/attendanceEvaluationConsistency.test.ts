import { test } from 'node:test'
import assert from 'node:assert'
import { resolveEvaluationContext } from '../src/utils/evaluationContext.ts'
import { reportService } from '../src/services/reportService.ts'
import { dashboardService } from '../src/services/dashboardService.ts'
import type { SchedulePublication } from '../src/types/publication.ts'
import type { Schedule } from '../src/types/schedule.ts'
import type { Member } from '../src/types/member.ts'
import type { AttendanceRecord } from '../src/types/attendance.ts'
import type { SuspensionPolicySettings } from '../src/services/settingsService.ts'

test('Attendance Evaluation Consistency & Alignment Suite', async (t) => {
  const basePolicy: SuspensionPolicySettings = {
    warningAbsenceThreshold: 2,
    suspensionAbsenceThreshold: 3,
    evaluationMonths: 1,
    includeSundays: true,
    includeWeekdays: false,
    includeMeetings: true
  }

  const publications: SchedulePublication[] = [
    {
      id: 'pub-sept-oct',
      name: 'September - October 2026',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      status: 'archived',
      publicationType: 'regular',
      warningAbsenceThreshold: 3,
      suspensionAbsenceThreshold: 5
    },
    {
      id: 'pub-rosary-oct',
      name: 'Special Mass for Rosary Month',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'published',
      publicationType: 'special_event',
      warningAbsenceThreshold: 2,
      suspensionAbsenceThreshold: 3
    },
    {
      id: 'pub-nov-dec',
      name: 'TESTING LANG BOSS',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      status: 'published',
      publicationType: 'regular',
      warningAbsenceThreshold: 3,
      suspensionAbsenceThreshold: 5
    }
  ]

  await t.test('1. resolveEvaluationContext: auto-selects spanning Regular publication even if archived', () => {
    const resolved = resolveEvaluationContext({
      publications,
      basePolicy,
      currentDate: '2026-10-26'
    })

    assert.strictEqual(resolved.periodType, 'regular_publication')
    assert.strictEqual(resolved.publication?.id, 'pub-sept-oct')
    assert.strictEqual(resolved.startDate, '2026-09-01')
    assert.strictEqual(resolved.endDate, '2026-10-31')
    assert.strictEqual(resolved.policy.warningAbsenceThreshold, 3)
    assert.strictEqual(resolved.policy.suspensionAbsenceThreshold, 5)
    assert.strictEqual(resolved.isArchivedCycle, true)
  })

  await t.test('2. resolveEvaluationContext: strictly ignores future publications for currentDate', () => {
    const onlyFuture: SchedulePublication[] = [
      {
        id: 'pub-future',
        name: 'Future Publication 2027',
        startDate: '2027-01-01',
        endDate: '2027-02-28',
        status: 'published',
        publicationType: 'regular'
      }
    ]

    const resolved = resolveEvaluationContext({
      publications: onlyFuture,
      basePolicy,
      currentDate: '2026-10-26'
    })

    assert.strictEqual(resolved.periodType, 'calendar_month')
    assert.strictEqual(resolved.startDate, '2026-10-01')
    assert.strictEqual(resolved.endDate, '2026-10-31')
    assert.ok(resolved.periodLabel.includes('October 2026 (Calendar Month)'))
  })

  await t.test('3. resolveEvaluationContext: manual publication override in Reports selects specified publication', () => {
    const resolved = resolveEvaluationContext({
      publications,
      basePolicy,
      currentDate: '2026-10-26',
      targetPublicationId: 'pub-rosary-oct'
    })

    assert.strictEqual(resolved.publication?.id, 'pub-rosary-oct')
    assert.strictEqual(resolved.startDate, '2026-10-01')
    assert.strictEqual(resolved.endDate, '2026-10-31')
    assert.strictEqual(resolved.policy.warningAbsenceThreshold, 2)
    assert.strictEqual(resolved.policy.suspensionAbsenceThreshold, 3)
  })

  await t.test('4. resolveEvaluationContext: manual custom date range uses custom boundaries and base policy', () => {
    const resolved = resolveEvaluationContext({
      publications,
      basePolicy,
      currentDate: '2026-10-26',
      customDateRange: { startDate: '2026-08-01', endDate: '2026-08-31' }
    })

    assert.strictEqual(resolved.periodType, 'custom')
    assert.strictEqual(resolved.startDate, '2026-08-01')
    assert.strictEqual(resolved.endDate, '2026-08-31')
    assert.strictEqual(resolved.policy.suspensionAbsenceThreshold, 3)
  })

  await t.test('5. Inactive vs Suspended precedence: delinquent server with 0 attendance is NOT masked as inactive', () => {
    const members: Member[] = [
      { id: 'mem-delinquent-zero', firstName: 'Persus', lastName: 'Baruela', status: 'active', rank: 'Knight' } as any,
      { id: 'mem-inactive-under-limit', firstName: 'Quiet', lastName: 'Member', status: 'active', rank: 'Page' } as any,
      { id: 'mem-active-good', firstName: 'Active', lastName: 'Server', status: 'active', rank: 'Knight' } as any,
      { id: 'mem-profile-suspended', firstName: 'Official', lastName: 'Suspended', status: 'suspended', rank: 'Knight' } as any
    ]

    const schedules: Schedule[] = [
      { id: 's-sun-1', title: 'Sunday Mass', date: '2026-09-06', startTime: '08:00' } as any,
      { id: 's-sun-2', title: 'Sunday Mass', date: '2026-09-13', startTime: '08:00' } as any,
      { id: 's-sun-3', title: 'Sunday Mass', date: '2026-09-20', startTime: '08:00' } as any,
      { id: 's-sun-4', title: 'Sunday Mass', date: '2026-09-27', startTime: '08:00' } as any,
      { id: 's-sun-5', title: 'Sunday Mass', date: '2026-10-04', startTime: '08:00' } as any,
      { id: 's-sun-6', title: 'Sunday Mass', date: '2026-10-11', startTime: '08:00' } as any,
    ]

    const attendance: AttendanceRecord[] = [
      // mem-delinquent-zero: 6 Sunday absences, 0 presents (threshold is 5)
      { id: 'a1', memberId: 'mem-delinquent-zero', scheduleId: 's-sun-1', status: 'absent', attendanceDate: '2026-09-06' } as any,
      { id: 'a2', memberId: 'mem-delinquent-zero', scheduleId: 's-sun-2', status: 'absent', attendanceDate: '2026-09-13' } as any,
      { id: 'a3', memberId: 'mem-delinquent-zero', scheduleId: 's-sun-3', status: 'absent', attendanceDate: '2026-09-20' } as any,
      { id: 'a4', memberId: 'mem-delinquent-zero', scheduleId: 's-sun-4', status: 'absent', attendanceDate: '2026-09-27' } as any,
      { id: 'a5', memberId: 'mem-delinquent-zero', scheduleId: 's-sun-5', status: 'absent', attendanceDate: '2026-10-04' } as any,
      { id: 'a6', memberId: 'mem-delinquent-zero', scheduleId: 's-sun-6', status: 'absent', attendanceDate: '2026-10-11' } as any,

      // mem-inactive-under-limit: 2 absences, 0 presents (under threshold 5)
      { id: 'a7', memberId: 'mem-inactive-under-limit', scheduleId: 's-sun-1', status: 'absent', attendanceDate: '2026-09-06' } as any,
      { id: 'a8', memberId: 'mem-inactive-under-limit', scheduleId: 's-sun-2', status: 'absent', attendanceDate: '2026-09-13' } as any,

      // mem-active-good: 5 presents, 0 absences
      { id: 'a9', memberId: 'mem-active-good', scheduleId: 's-sun-1', status: 'present', attendanceDate: '2026-09-06' } as any,
      { id: 'a10', memberId: 'mem-active-good', scheduleId: 's-sun-2', status: 'present', attendanceDate: '2026-09-13' } as any,
      { id: 'a11', memberId: 'mem-active-good', scheduleId: 's-sun-3', status: 'present', attendanceDate: '2026-09-20' } as any,
      { id: 'a12', memberId: 'mem-active-good', scheduleId: 's-sun-4', status: 'present', attendanceDate: '2026-09-27' } as any,
      { id: 'a13', memberId: 'mem-active-good', scheduleId: 's-sun-5', status: 'present', attendanceDate: '2026-10-04' } as any,
    ]

    const cyclePolicy: SuspensionPolicySettings = {
      ...basePolicy,
      warningAbsenceThreshold: 3,
      suspensionAbsenceThreshold: 5,
      evaluationMonths: 2
    }

    const rows = reportService.generateMemberReport({
      members,
      schedules,
      attendance,
      policy: cyclePolicy
    }, cyclePolicy)

    const delinquent = rows.find(r => r.memberId === 'mem-delinquent-zero')
    assert.strictEqual(delinquent?.warningStatus, 'suspended', 'Delinquent server with 6 absences must be suspended')
    assert.strictEqual(delinquent?.isZeroAttendance, true, 'Zero attendance flag should be true')
    assert.strictEqual(delinquent?.suspensionSource, 'attendance')

    const inactive = rows.find(r => r.memberId === 'mem-inactive-under-limit')
    assert.strictEqual(inactive?.warningStatus, 'inactive', 'Server under limit with 0 presents should be inactive')

    const active = rows.find(r => r.memberId === 'mem-active-good')
    assert.strictEqual(active?.warningStatus, 'active', 'Regular server in good standing should be active')

    const profileSuspended = rows.find(r => r.memberId === 'mem-profile-suspended')
    assert.strictEqual(profileSuspended?.warningStatus, 'suspended', 'Officially suspended profile must remain suspended')
    assert.strictEqual(profileSuspended?.suspensionSource, 'profile')
  })

  await t.test('6. Parity: Dashboard and Member Reports produce identical suspended count and IDs for Sept-Oct cycle', async () => {
    // A mock test representing the exact 16 suspended members identified in production
    const testMembers: Member[] = Array.from({ length: 50 }, (_, i) => ({
      id: `m-${i + 1}`,
      firstName: `Server${i + 1}`,
      lastName: `Test`,
      status: 'active',
      rank: 'Knight',
      order: i < 15 ? 'Order of San Pedro' : 'Order of San Tiago'
    } as any))

    // First 16 members have 6 absences in Sept-Oct (threshold is 5)
    const testSchedules: Schedule[] = [
      { id: 'sched-1', title: 'Sunday Mass', date: '2026-09-06', startTime: '08:00' } as any,
      { id: 'sched-2', title: 'Sunday Mass', date: '2026-09-13', startTime: '08:00' } as any,
      { id: 'sched-3', title: 'Sunday Mass', date: '2026-09-20', startTime: '08:00' } as any,
      { id: 'sched-4', title: 'Sunday Mass', date: '2026-09-27', startTime: '08:00' } as any,
      { id: 'sched-5', title: 'Sunday Mass', date: '2026-10-04', startTime: '08:00' } as any,
      { id: 'sched-6', title: 'Sunday Mass', date: '2026-10-11', startTime: '08:00' } as any,
    ]

    const testAttendance: AttendanceRecord[] = []
    // Assign 6 absences to the first 16 members
    for (let i = 0; i < 16; i++) {
      testSchedules.forEach((s, sIdx) => {
        testAttendance.push({
          id: `att-${i}-${sIdx}`,
          memberId: `m-${i + 1}`,
          scheduleId: s.id,
          status: 'absent',
          attendanceDate: s.date
        } as any)
      })
    }

    // Assign present marks to remaining members
    for (let i = 16; i < 50; i++) {
      testSchedules.forEach((s, sIdx) => {
        testAttendance.push({
          id: `att-${i}-${sIdx}`,
          memberId: `m-${i + 1}`,
          scheduleId: s.id,
          status: 'present',
          attendanceDate: s.date
        } as any)
      })
    }

    // 1. Evaluate via Dashboard
    const dashboardData = await dashboardService.getDashboardData(undefined, {
      getAttendanceSessions: async () => [],
      getMembers: async () => testMembers,
      getPublications: async () => publications,
      getPolicySettings: async () => basePolicy,
      loadReportData: async () => ({
        members: testMembers,
        schedules: testSchedules,
        attendance: testAttendance,
        policy: basePolicy
      }),
      generateMemberReport: (data, policy) => reportService.generateMemberReport(data, policy),
      getSchedulesByDate: async () => [],
      getSchedules: async () => []
    })

    // 2. Evaluate via Member Reports
    const resolvedContext = resolveEvaluationContext({
      publications,
      basePolicy,
      currentDate: '2026-10-26'
    })
    const reportRows = reportService.generateMemberReport({
      members: testMembers,
      schedules: testSchedules,
      attendance: testAttendance,
      policy: resolvedContext.policy
    }, resolvedContext.policy)

    const reportSuspendedRows = reportRows.filter(r => r.warningStatus === 'suspended')
    const reportSuspendedIds = reportSuspendedRows.map(r => r.memberId).sort()

    // Assert parity
    assert.strictEqual(dashboardData.stats.suspendedMembersCount, 16, 'Dashboard suspended count must be 16')
    assert.strictEqual(reportSuspendedRows.length, 16, 'Reports suspended count must be 16')
    assert.strictEqual(dashboardData.stats.suspendedMembersCount, reportSuspendedRows.length, 'Dashboard and Reports counts must match exactly')

    const expectedIds = Array.from({ length: 16 }, (_, i) => `m-${i + 1}`).sort()
    assert.deepStrictEqual(reportSuspendedIds, expectedIds, 'Expected member IDs must match exactly')
  })
})
