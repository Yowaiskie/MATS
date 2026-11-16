import { test } from 'node:test'
import assert from 'node:assert'
import { DEFAULT_EXCUSE_POLICY_SETTINGS } from '../src/types/excuse.ts'
import type { ExcusePolicySettings } from '../src/types/excuse.ts'
import type { Schedule } from '../src/types/schedule.ts'

/**
 * Pure helper mirroring the public excuse eligibility filtering in PublicExcusePage.tsx
 */
function filterPublicEligibleSchedules(
  allSchedules: Schedule[],
  memberId: string,
  approvedScheduleIds: Set<string>,
  policy: ExcusePolicySettings,
  referenceToday = new Date('2026-11-16T00:00:00')
): Schedule[] {
  const ref = new Date(referenceToday)
  ref.setHours(0, 0, 0, 0)
  const todayStr = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`

  let cutoffStr = todayStr
  if (policy.allowPublicPastExcuses) {
    const cutoffDate = new Date(ref)
    cutoffDate.setDate(ref.getDate() - (policy.publicPastWindowDays || 7))
    cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`
  }

  return allSchedules.filter(s => {
    if (!s.date || s.status === 'cancelled') return false
    const isAssigned = s.assignedMembers?.includes(memberId)
    if (!isAssigned) return false
    const isNotApproved = !approvedScheduleIds.has(s.id)
    if (!isNotApproved) return false

    const isFuture = s.date >= todayStr
    const isEligiblePast = policy.allowPublicPastExcuses && s.date < todayStr && s.date >= cutoffStr
    return isFuture || isEligiblePast
  }).sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '')
    if (d !== 0) return d
    return (a.startTime || '').localeCompare(b.startTime || '')
  })
}

/**
 * Pure helper mirroring admin schedule categorization in FileMemberExcuseModal.tsx
 */
function categorizeAdminSchedules(
  schedules: Schedule[],
  memberId: string,
  showAllParishSchedules: boolean,
  referenceToday = new Date('2026-11-16T00:00:00')
) {
  const ref = new Date(referenceToday)
  ref.setHours(0, 0, 0, 0)
  const todayStr = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`

  const activeSchedules = schedules.filter(s => {
    if (s.status === 'cancelled') return false
    if (!s.date) return false
    if (!showAllParishSchedules) {
      return s.assignedMembers?.includes(memberId)
    }
    return true
  })

  const upcoming: Schedule[] = []
  const pastSchedules: Schedule[] = []

  activeSchedules.forEach(s => {
    if (s.date < todayStr) {
      pastSchedules.push(s)
    } else {
      upcoming.push(s)
    }
  })

  // Sort upcoming ascending
  upcoming.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  // Sort past descending (most recent first)
  pastSchedules.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return {
    upcoming,
    pastSchedules,
    upcomingTotal: upcoming.length,
    pastTotal: pastSchedules.length,
    total: upcoming.length + pastSchedules.length
  }
}

test('Excuse Policy & Past Schedule Allowance Suite', async (t) => {
  await t.test('1. Default Excuse Policy settings match expected defaults', () => {
    assert.strictEqual(DEFAULT_EXCUSE_POLICY_SETTINGS.allowPublicPastExcuses, true)
    assert.strictEqual(DEFAULT_EXCUSE_POLICY_SETTINGS.publicPastWindowDays, 7)
    assert.strictEqual(DEFAULT_EXCUSE_POLICY_SETTINGS.requireReason, true)
    assert.strictEqual(DEFAULT_EXCUSE_POLICY_SETTINGS.minimumReasonLength, 5)
  })

  await t.test('2. Public filtering includes past schedules within window and excludes outside window', () => {
    const referenceToday = new Date('2026-11-16T00:00:00') // Nov 16, 2026
    const memberId = 'mem-101'
    const approvedScheduleIds = new Set<string>(['sched-approved'])

    const testSchedules: Schedule[] = [
      {
        id: 'sched-future-1',
        title: 'Sunday Morning Mass',
        date: '2026-11-22',
        startTime: '08:00',
        endTime: '09:00',
        status: 'published',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-today',
        title: 'Daily Evening Mass',
        date: '2026-11-16',
        startTime: '18:00',
        endTime: '19:00',
        status: 'published',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-past-3days',
        title: 'Friday Holy Hour',
        date: '2026-11-13', // 3 days ago (within 7 days)
        startTime: '17:00',
        endTime: '18:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-past-exact-cutoff',
        title: 'Monday Mass',
        date: '2026-11-09', // exactly 7 days ago
        startTime: '06:00',
        endTime: '07:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-past-10days',
        title: 'Past Mass Beyond Window',
        date: '2026-11-06', // 10 days ago (outside 7 days)
        startTime: '06:00',
        endTime: '07:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-approved',
        title: 'Already Approved Past Duty',
        date: '2026-11-14',
        startTime: '06:00',
        endTime: '07:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-cancelled',
        title: 'Cancelled Mass',
        date: '2026-11-15',
        startTime: '06:00',
        endTime: '07:00',
        status: 'cancelled',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      }
    ]

    const policy: ExcusePolicySettings = {
      allowPublicPastExcuses: true,
      publicPastWindowDays: 7,
      requireReason: true,
      minimumReasonLength: 5
    }

    const eligible = filterPublicEligibleSchedules(
      testSchedules,
      memberId,
      approvedScheduleIds,
      policy,
      referenceToday
    )

    const eligibleIds = eligible.map(s => s.id)
    assert.ok(eligibleIds.includes('sched-future-1'), 'Future schedule must be eligible')
    assert.ok(eligibleIds.includes('sched-today'), 'Today schedule must be eligible')
    assert.ok(eligibleIds.includes('sched-past-3days'), '3-day past schedule must be eligible within 7-day window')
    assert.ok(eligibleIds.includes('sched-past-exact-cutoff'), 'Exact 7-day boundary schedule must be eligible')
    assert.ok(!eligibleIds.includes('sched-past-10days'), '10-day past schedule must be EXCLUDED beyond 7-day window')
    assert.ok(!eligibleIds.includes('sched-approved'), 'Already approved excuse must be EXCLUDED')
    assert.ok(!eligibleIds.includes('sched-cancelled'), 'Cancelled schedule must be EXCLUDED')
  })

  await t.test('3. When allowPublicPastExcuses is false, all past schedules are excluded from public portal', () => {
    const referenceToday = new Date('2026-11-16T00:00:00')
    const memberId = 'mem-101'

    const testSchedules: Schedule[] = [
      {
        id: 'sched-future',
        title: 'Future Mass',
        date: '2026-11-18',
        startTime: '08:00',
        status: 'published',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-today',
        title: 'Today Mass',
        date: '2026-11-16',
        startTime: '08:00',
        status: 'published',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-yesterday',
        title: 'Yesterday Mass',
        date: '2026-11-15',
        startTime: '08:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      }
    ]

    const disabledPolicy: ExcusePolicySettings = {
      allowPublicPastExcuses: false,
      publicPastWindowDays: 7,
      requireReason: true,
      minimumReasonLength: 5
    }

    const eligible = filterPublicEligibleSchedules(
      testSchedules,
      memberId,
      new Set(),
      disabledPolicy,
      referenceToday
    )

    const eligibleIds = eligible.map(s => s.id)
    assert.ok(eligibleIds.includes('sched-future'), 'Future duty must be included')
    assert.ok(eligibleIds.includes('sched-today'), 'Today duty must be included')
    assert.ok(!eligibleIds.includes('sched-yesterday'), 'Yesterday duty must be EXCLUDED when policy is disabled')
    assert.strictEqual(eligible.length, 2)
  })

  await t.test('4. Admin schedule categorization retains historical schedules without window cutoff', () => {
    const referenceToday = new Date('2026-11-16T00:00:00')
    const memberId = 'mem-admin-test'

    const testSchedules: Schedule[] = [
      {
        id: 'sched-admin-old',
        title: 'Old Duty (60 Days Ago)',
        date: '2026-09-17',
        startTime: '06:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-admin-recent-past',
        title: 'Recent Past Duty (2 Days Ago)',
        date: '2026-11-14',
        startTime: '07:00',
        status: 'completed',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'sched-admin-upcoming',
        title: 'Upcoming Sunday',
        date: '2026-11-22',
        startTime: '08:00',
        status: 'published',
        assignedMembers: [memberId],
        createdAt: '',
        updatedAt: ''
      }
    ]

    const result = categorizeAdminSchedules(testSchedules, memberId, false, referenceToday)

    assert.strictEqual(result.upcomingTotal, 1)
    assert.strictEqual(result.pastTotal, 2)
    assert.strictEqual(result.total, 3)

    // Verify past schedules are sorted descending (most recent past first)
    assert.strictEqual(result.pastSchedules[0].id, 'sched-admin-recent-past')
    assert.strictEqual(result.pastSchedules[1].id, 'sched-admin-old')
  })

  await t.test('5. Excuse reason validation rules are enforced accurately', () => {
    const policy: ExcusePolicySettings = {
      allowPublicPastExcuses: true,
      publicPastWindowDays: 14,
      requireReason: true,
      minimumReasonLength: 8
    }

    const validateReason = (reasonText: string, p: ExcusePolicySettings) => {
      const trimmed = reasonText.trim()
      if (p.requireReason && !trimmed) {
        return { valid: false, error: 'Reason required' }
      }
      if (p.requireReason && trimmed.length < p.minimumReasonLength) {
        return { valid: false, error: `Reason must be at least ${p.minimumReasonLength} characters` }
      }
      return { valid: true }
    }

    assert.strictEqual(validateReason('', policy).valid, false)
    assert.strictEqual(validateReason('   ', policy).valid, false)
    assert.strictEqual(validateReason('Sick', policy).valid, false, 'Length 4 is below minimum 8')
    assert.strictEqual(validateReason('High fever and flu', policy).valid, true, 'Length 18 exceeds minimum 8')

    // When optional
    const optionalPolicy: ExcusePolicySettings = { ...policy, requireReason: false }
    assert.strictEqual(validateReason('', optionalPolicy).valid, true)
    assert.strictEqual(validateReason('Sick', optionalPolicy).valid, true)
  })
})
