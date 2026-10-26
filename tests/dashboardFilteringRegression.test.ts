import { test } from 'node:test'
import assert from 'node:assert'
import { publicationService } from '../src/services/publicationService.ts'
import { dashboardService } from '../src/services/dashboardService.ts'
import type { SchedulePublication } from '../src/types/publication.ts'
import type { Schedule } from '../src/types/schedule.ts'
import type { Member } from '../src/types/member.ts'

test('Dashboard & Publication Selection Regression Test Suite', async (t) => {
  // Mock dataset mimicking the observed production situation:
  // Today: 2026-10-26 (Asia/Manila)
  // 1. Sept-Oct 2026 regular: archived
  // 2. Oct Rosary Month: published, special_event
  // 3. Nov-Dec 2026 regular: published, future (2026-11-01 to 2026-12-31)
  const mockPublications: SchedulePublication[] = [
    {
      id: 'pub-nov-dec',
      name: 'TESTING LANG BOSS',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      status: 'published',
      publicationType: 'regular',
      warningAbsenceThreshold: 3,
      suspensionAbsenceThreshold: 5,
    },
    {
      id: 'pub-rosary-oct',
      name: 'Special Mass for Rosary Month',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'published',
      publicationType: 'special_event',
      warningAbsenceThreshold: 2,
      suspensionAbsenceThreshold: 3,
    },
    {
      id: 'pub-sept-oct',
      name: 'September - October 2026',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      status: 'archived',
      publicationType: 'regular',
      warningAbsenceThreshold: 3,
      suspensionAbsenceThreshold: 5,
    }
  ]

  await t.test('1. Future Regular publication does not hijack current Dashboard', async () => {
    const origGetPubs = publicationService.getPublications
    publicationService.getPublications = async () => mockPublications

    try {
      const active = await publicationService.getActivePublication({
        regularOnly: true,
        currentDate: '2026-10-26'
      })
      // Should NOT return pub-nov-dec ('TESTING LANG BOSS')
      assert.strictEqual(active, null, 'Expected active regular publication to be null when current is archived and future is not yet active')
    } finally {
      publicationService.getPublications = origGetPubs
    }
  })

  await t.test('2. Archived Regular publication does not automatically become active', async () => {
    const origGetPubs = publicationService.getPublications
    publicationService.getPublications = async () => mockPublications

    try {
      const active = await publicationService.getActivePublication({
        regularOnly: true,
        currentDate: '2026-10-26'
      })
      assert.strictEqual(active, null, 'Archived publication must not be returned as active published publication')
    } finally {
      publicationService.getPublications = origGetPubs
    }
  })

  await t.test('3. Special Event publication does not replace Regular evaluation context when regularOnly is requested', async () => {
    const origGetPubs = publicationService.getPublications
    publicationService.getPublications = async () => mockPublications

    try {
      const activeRegular = await publicationService.getActivePublication({
        regularOnly: true,
        currentDate: '2026-10-26'
      })
      assert.strictEqual(activeRegular, null, 'Special event must be excluded when regularOnly: true is passed')

      const activeAny = await publicationService.getActivePublication({
        regularOnly: false,
        currentDate: '2026-10-26'
      })
      assert.ok(activeAny, 'When regularOnly is false, active special event spanning today is returned')
      assert.strictEqual(activeAny?.id, 'pub-rosary-oct')
    } finally {
      publicationService.getPublications = origGetPubs
    }
  })

  await t.test('4. Calendar-month fallback works correctly when no regular publication is active', async () => {
    const dashboardData = await dashboardService.getDashboardData(undefined, {
      getAttendanceSessions: async () => [],
      getMembers: async () => [{ id: 'm1', firstName: 'Juan', lastName: 'Dela Cruz', status: 'active', rank: 'Knight' } as Member],
      getActivePublication: async () => null, // No regular publication spanning today
      getPolicySettings: async () => ({
        warningAbsenceThreshold: 2,
        suspensionAbsenceThreshold: 3,
        evaluationMonths: 1,
        includeSundays: true,
        includeWeekdays: false,
        includeMeetings: false,
      } as any),
      loadReportData: async (start, end) => {
        assert.ok(start.endsWith('-01'), 'Start date should be first day of month')
        assert.ok(end.endsWith('-31') || end.endsWith('-30') || end.endsWith('-28'), 'End date should be last day of month')
        return { members: [], schedules: [], attendance: [], policy: {} as any }
      },
      generateMemberReport: () => [],
      getSchedulesByDate: async () => [],
      getSchedules: async () => []
    })

    assert.ok(dashboardData.stats.evaluationPeriodLabel?.includes('Calendar Month'), 'Evaluation period should indicate Calendar Month')
    assert.ok(!dashboardData.stats.operatingCycleTitle?.includes('TESTING LANG BOSS'), 'Operating cycle must NOT show future publication title')
    assert.strictEqual(dashboardData.stats.evaluationPeriodType, 'calendar_month')
  })

  await t.test('5. Today\'s Duty Roster includes valid schedules occurring today independently of publication bounds', async () => {
    const expectedTodaySched: Schedule = {
      id: 'today-sched-1',
      title: 'Morning Weekday Mass',
      date: '2026-10-26',
      startTime: '06:00',
      endTime: '07:00',
      status: 'upcoming',
      assignedMembers: []
    } as any

    const dashboardData = await dashboardService.getDashboardData(undefined, {
      getAttendanceSessions: async () => [],
      getMembers: async () => [],
      getActivePublication: async () => null,
      getPolicySettings: async () => ({
        warningAbsenceThreshold: 2,
        suspensionAbsenceThreshold: 3,
        evaluationMonths: 1,
        includeSundays: true,
        includeWeekdays: false,
        includeMeetings: false,
      } as any),
      loadReportData: async () => ({
        members: [],
        schedules: [], // publication range empty
        attendance: [],
        policy: {} as any
      }),
      generateMemberReport: () => [],
      getSchedulesByDate: async () => [expectedTodaySched],
      getSchedules: async () => [expectedTodaySched]
    })

    assert.strictEqual(dashboardData.todaySchedules.length, 1, 'Today schedules must contain today\'s mass')
    assert.strictEqual(dashboardData.todaySchedules[0].id, 'today-sched-1')
    assert.strictEqual(dashboardData.todaySchedules[0].title, 'Morning Weekday Mass')
  })

  await t.test('6. Future schedules do not hide current duties', async () => {
    const futureSched: Schedule = {
      id: 'future-sched-1',
      title: 'Future Sunday Mass',
      date: '2026-11-08',
      startTime: '08:00',
      endTime: '09:00',
      status: 'upcoming',
      assignedMembers: []
    } as any

    const todaySched: Schedule = {
      id: 'today-sched-1',
      title: 'Active Today Mass',
      date: '2026-10-26',
      startTime: '07:00',
      endTime: '08:00',
      status: 'upcoming',
      assignedMembers: []
    } as any

    const dashboardData = await dashboardService.getDashboardData(undefined, {
      getAttendanceSessions: async () => [],
      getMembers: async () => [],
      getActivePublication: async () => null,
      getPolicySettings: async () => ({
        warningAbsenceThreshold: 2,
        suspensionAbsenceThreshold: 3,
        evaluationMonths: 1,
        includeSundays: true,
        includeWeekdays: false,
        includeMeetings: false,
      } as any),
      loadReportData: async () => ({
        members: [],
        schedules: [futureSched],
        attendance: [],
        policy: {} as any
      }),
      generateMemberReport: () => [],
      getSchedulesByDate: async () => [todaySched],
      getSchedules: async () => [todaySched, futureSched]
    })

    assert.strictEqual(dashboardData.todaySchedules.length, 1)
    assert.strictEqual(dashboardData.todaySchedules[0].id, 'today-sched-1')
  })

  await t.test('7. Warning and suspension metrics use the correct evaluation period', async () => {
    const members: Member[] = [
      { id: 'm1', firstName: 'Juan', lastName: 'Dela Cruz', status: 'active', order: 'San Pedro' } as Member,
      { id: 'm2', firstName: 'Pedro', lastName: 'Santos', status: 'suspended', order: 'San Pedro' } as Member
    ]

    let capturedStartDate: string | undefined
    let capturedEndDate: string | undefined

    const dashboardData = await dashboardService.getDashboardData('San Pedro', {
      getAttendanceSessions: async () => [],
      getMembers: async () => members,
      getActivePublication: async () => null,
      getPolicySettings: async () => ({
        warningAbsenceThreshold: 2,
        suspensionAbsenceThreshold: 3,
        evaluationMonths: 1,
        includeSundays: true,
        includeWeekdays: false,
        includeMeetings: false,
      } as any),
      loadReportData: async (start, end) => {
        capturedStartDate = start
        capturedEndDate = end
        return { members, schedules: [], attendance: [], policy: {} as any }
      },
      generateMemberReport: () => [
        { memberId: 'm1', warningStatus: 'warning' } as any
      ],
      getSchedulesByDate: async () => [],
      getSchedules: async () => []
    })

    assert.ok(capturedStartDate?.startsWith('2026-10-'), 'Evaluation start date should be in October 2026')
    assert.ok(capturedEndDate?.startsWith('2026-10-'), 'Evaluation end date should be in October 2026')
    assert.strictEqual(dashboardData.stats.warningMembersCount, 1)
    assert.strictEqual(dashboardData.stats.userOrderWarningCount, 1)
    assert.strictEqual(dashboardData.stats.suspendedMembersCount, 1)
    assert.strictEqual(dashboardData.stats.userOrderSuspendedCount, 1)
  })

  await t.test('8. Birthdays use the Asia/Manila calendar month', () => {
    const testMembers: Member[] = [
      { id: 'm1', firstName: 'Oct', lastName: 'Celebrant', status: 'active', dateOfBirth: '2000-10-15', rank: 'Knight' } as any,
      { id: 'm2', firstName: 'Nov', lastName: 'Celebrant', status: 'active', dateOfBirth: '2000-11-20', rank: 'Knight' } as any,
    ]

    const octBirthdays = dashboardService.calculateBirthdaysForMonth(testMembers, 10, 2026)
    assert.strictEqual(octBirthdays.length, 1)
    assert.strictEqual(octBirthdays[0].fullName, 'Oct Celebrant')

    const novBirthdays = dashboardService.calculateBirthdaysForMonth(testMembers, 11, 2026)
    assert.strictEqual(novBirthdays.length, 1)
    assert.strictEqual(novBirthdays[0].fullName, 'Nov Celebrant')
  })

  await t.test('9. Recent activities are not restricted to future publication dates', async () => {
    const octoberSchedule: Schedule = {
      id: 'oct-sched-1',
      title: 'October Holy Hour',
      date: '2026-10-20',
      startTime: '18:00',
      endTime: '19:00',
      status: 'completed',
      createdAt: new Date('2026-10-20T10:00:00Z'),
      updatedAt: new Date('2026-10-20T10:00:00Z'),
      assignedMembers: []
    } as any

    const dashboardData = await dashboardService.getDashboardData(undefined, {
      getAttendanceSessions: async () => [],
      getMembers: async () => [],
      getActivePublication: async () => null,
      getPolicySettings: async () => ({
        warningAbsenceThreshold: 2,
        suspensionAbsenceThreshold: 3,
        evaluationMonths: 1,
        includeSundays: true,
        includeWeekdays: false,
        includeMeetings: false,
      } as any),
      loadReportData: async () => ({
        members: [],
        schedules: [], // future month empty
        attendance: [],
        policy: {} as any
      }),
      generateMemberReport: () => [],
      getSchedulesByDate: async () => [],
      getSchedules: async () => [octoberSchedule]
    })

    const scheduleActivities = dashboardData.activities.filter(a => a.id.startsWith('schedule-'))
    assert.strictEqual(scheduleActivities.length, 1, 'Schedule activity from October should appear in recent activities')
    assert.ok(scheduleActivities[0].description.includes('October Holy Hour'))
  })

  await t.test('10. Other callers of getActivePublication preserve intended behavior when allowFuture is requested', async () => {
    const origGetPubs = publicationService.getPublications
    publicationService.getPublications = async () => mockPublications

    try {
      const futureAllowed = await publicationService.getActivePublication({
        regularOnly: true,
        allowFuture: true,
        currentDate: '2026-10-26'
      })
      assert.ok(futureAllowed, 'When allowFuture is true, future publication is returned as fallback')
      assert.strictEqual(futureAllowed?.id, 'pub-nov-dec')
    } finally {
      publicationService.getPublications = origGetPubs
    }
  })

  await t.test('11. Date boundaries work correctly around midnight in Asia/Manila', async () => {
    const origGetPubs = publicationService.getPublications
    publicationService.getPublications = async () => [
      {
        id: 'pub-spanning',
        name: 'Spanning Publication',
        startDate: '2026-10-26',
        endDate: '2026-10-27',
        status: 'published',
        publicationType: 'regular'
      } as any
    ]

    try {
      // Exactly on startDate
      const atStart = await publicationService.getActivePublication({
        regularOnly: true,
        currentDate: '2026-10-26'
      })
      assert.strictEqual(atStart?.id, 'pub-spanning')

      // Exactly on endDate
      const atEnd = await publicationService.getActivePublication({
        regularOnly: true,
        currentDate: '2026-10-27'
      })
      assert.strictEqual(atEnd?.id, 'pub-spanning')

      // Day after endDate
      const dayAfter = await publicationService.getActivePublication({
        regularOnly: true,
        currentDate: '2026-10-28'
      })
      assert.strictEqual(dayAfter, null)
    } finally {
      publicationService.getPublications = origGetPubs
    }
  })
})
