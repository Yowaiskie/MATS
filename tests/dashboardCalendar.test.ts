import test from 'node:test'
import assert from 'node:assert/strict'
import type { Event, EventTask } from '../src/types/event.ts'
import type { Member } from '../src/types/member.ts'
import type { Schedule } from '../src/types/schedule.ts'
import {
  buildMonthGrid,
  expandEventToCalendarItems,
  groupCalendarItemsByDate,
  mapMassScheduleToCalendarItem,
  mapTaskToCalendarItem,
  resolveUserMemberIds
} from '../src/utils/dashboardCalendar.ts'

test('dashboardCalendar utilities', async (t) => {
  await t.test('expands single-day and multi-day events and respects workspace access vs shared read-only preview', () => {
    const multiDayEvent: Event = {
      id: 'evt-1',
      title: 'Pax Tecum 2026',
      description: 'Annual parish activity',
      location: 'Main Parish Hall',
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      startTime: '08:00',
      endTime: '17:00',
      stage: 'Preparation',
      priority: 'High',
      headUid: 'head-1',
      headName: 'Kyle',
      showOnDashboardCalendar: true,
      createdByUid: 'admin-1',
      createdByName: 'Admin',
      createdAt: null,
      updatedAt: null,
      isArchived: false
    }

    const teamItems = expandEventToCalendarItems(multiDayEvent, {
      canOpenWorkspace: true,
      isSharedByAdmin: true
    })
    assert.equal(teamItems.length, 3)
    assert.deepEqual(teamItems.map(i => i.date), ['2026-12-10', '2026-12-11', '2026-12-12'])
    assert.equal(teamItems[0].canOpenLink, true)
    assert.equal(teamItems[0].linkTo, '/events/evt-1')
    assert.equal(teamItems[0].timeRange, '8:00 AM - 5:00 PM')

    const readOnlyItems = expandEventToCalendarItems(multiDayEvent, {
      canOpenWorkspace: false,
      isSharedByAdmin: true
    })
    assert.equal(readOnlyItems.length, 3)
    assert.equal(readOnlyItems[0].canOpenLink, false)
    assert.equal(readOnlyItems[0].linkTo, undefined)
    assert.equal(readOnlyItems[0].isSharedByAdmin, true)
  })

  await t.test('maps assigned tasks using dueDate first, falling back to startDate, and skips cancelled or undated tasks', () => {
    const baseTask: EventTask = {
      id: 'task-1',
      eventId: 'evt-1',
      title: 'Prepare chairs',
      description: '',
      priority: 'Medium',
      status: 'In Progress',
      assignedMemberUid: 'u1',
      assignedMemberName: 'Juan',
      assignedRoleId: null,
      assignedRoleName: null,
      dependsOnTaskId: null,
      startDate: '2026-12-08',
      dueDate: '2026-12-09',
      estimatedHours: null,
      completedDate: null,
      progressPercent: 50,
      createdByUid: 'admin-1',
      createdByName: 'Admin',
      createdAt: null,
      updatedAt: null,
      isArchived: false
    }

    const mapped = mapTaskToCalendarItem(baseTask, 'Pax Tecum 2026')
    assert.ok(mapped)
    assert.equal(mapped.date, '2026-12-09')
    assert.equal(mapped.linkTo, '/events/evt-1?task=task-1')

    const fallbackMapped = mapTaskToCalendarItem({ ...baseTask, dueDate: null }, 'Pax Tecum 2026')
    assert.ok(fallbackMapped)
    assert.equal(fallbackMapped.date, '2026-12-08')

    assert.equal(mapTaskToCalendarItem({ ...baseTask, status: 'Cancelled' }), null)
    assert.equal(mapTaskToCalendarItem({ ...baseTask, dueDate: null, startDate: null }), null)
  })

  await t.test('maps Mass schedules and resolves user member IDs via memberId or unique name match', () => {
    const schedule: Schedule = {
      id: 'sched-1',
      title: 'Sunday 8:00 AM Mass',
      date: '2026-12-13',
      startTime: '08:00',
      endTime: '09:00',
      status: 'upcoming',
      assignedMembers: ['mem-42'],
      createdAt: null,
      updatedAt: null
    }

    const members = [
      { id: 'mem-42', firstName: 'Juan', lastName: 'Dela Cruz', status: 'active', rank: 'Senior' } as Member
    ]

    const resolvedIds = resolveUserMemberIds(
      { uid: 'uid-42', displayName: 'Juan Dela Cruz' },
      members
    )
    assert.equal(resolvedIds.has('mem-42'), true)

    const item = mapMassScheduleToCalendarItem(schedule, false)
    assert.ok(item)
    assert.equal(item.type, 'mass')
    assert.equal(item.canOpenLink, false)
    assert.equal(item.linkTo, undefined)
    assert.equal(item.timeRange, '8:00 AM - 9:00 AM')
  })

  await t.test('builds Sunday-to-Saturday month grid and groups/sorts items by date', () => {
    const cells = buildMonthGrid(2026, 12)
    assert.ok(cells.length === 35 || cells.length === 42)
    assert.equal(cells.filter(c => c.isCurrentMonth).length, 31)

    const grouped = groupCalendarItemsByDate([
      { id: 't1', type: 'task', date: '2026-12-10', title: 'Task B', canOpenLink: true },
      { id: 'e1', type: 'event', date: '2026-12-10', title: 'Event A', canOpenLink: true },
      { id: 'm1', type: 'mass', date: '2026-12-10', title: 'Mass C', canOpenLink: false }
    ])
    assert.deepEqual(grouped['2026-12-10'].map(i => i.type), ['event', 'mass', 'task'])
  })
})
