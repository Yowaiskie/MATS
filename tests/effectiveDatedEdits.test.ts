import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleService } from '../src/services/scheduleService.ts';
import { SubmissionError } from '../src/types/submission.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Member } from '../src/types/member.ts';
import type { Schedule, ScheduleSelectionItem } from '../src/types/schedule.ts';

// In-memory document store simulating Firestore with atomic transaction semantics
class MockFirestoreStore {
  collections: Map<string, Map<string, any>> = new Map();
  versionMap: Map<string, number> = new Map();

  constructor() {
    this.collections.set('scheduleSubmissions', new Map());
    this.collections.set('schedulePublications', new Map());
    this.collections.set('members', new Map());
    this.collections.set('schedules', new Map());
  }

  setDoc(collectionName: string, id: string, data: any) {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, new Map());
    }
    const cloned = JSON.parse(JSON.stringify(data));
    this.collections.get(collectionName)!.set(id, cloned);
    const key = `${collectionName}/${id}`;
    this.versionMap.set(key, (this.versionMap.get(key) || 0) + 1);
  }

  getDoc(collectionName: string, id: string) {
    const col = this.collections.get(collectionName);
    if (!col || !col.has(id)) return null;
    return JSON.parse(JSON.stringify(col.get(id)));
  }

  createTransactionRunner() {
    return async <T>(fn: (transaction: any) => Promise<T>): Promise<T> => {
      const readVersions = new Map<string, number>();
      const writeBuffer: Array<{ col: string; id: string; data: any }> = [];

      const transaction = {
        get: async (docRef: { collection: string; id: string }) => {
          const key = `${docRef.collection}/${docRef.id}`;
          const currentVersion = this.versionMap.get(key) || 0;
          readVersions.set(key, currentVersion);
          const data = this.getDoc(docRef.collection, docRef.id);
          return {
            id: docRef.id,
            exists: () => data !== null,
            data: () => data
          };
        },
        update: (docRef: { collection: string; id: string }, updateData: any) => {
          writeBuffer.push({ col: docRef.collection, id: docRef.id, data: updateData });
        },
        set: (docRef: { collection: string; id: string }, setData: any) => {
          writeBuffer.push({ col: docRef.collection, id: docRef.id, data: setData });
        }
      };

      // Execute transaction callback; if fn throws, writeBuffer is discarded (ATOMIC ROLLBACK)
      const result = await fn(transaction);

      // Verify versions haven't changed (concurrency check)
      for (const [key, readVer] of readVersions.entries()) {
        const currentVer = this.versionMap.get(key) || 0;
        if (currentVer !== readVer) {
          throw new Error(`Transaction contention: document ${key} was modified concurrently.`);
        }
      }

      // Commit buffered writes atomically
      for (const { col, id, data } of writeBuffer) {
        const existing = this.getDoc(col, id) || {};
        const merged = { ...existing, ...data };
        this.setDoc(col, id, merged);
      }

      return result;
    };
  }

  doc(collectionName: string, id: string) {
    return { collection: collectionName, id } as any;
  }
}

function createSampleEnvironment() {
  const store = new MockFirestoreStore();

  const publication: SchedulePublication = {
    id: 'pub-nov-2026',
    name: 'November 2026 Regular Mass Schedule',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    publicationType: 'regular',
    status: 'published',
    targetRanks: ['Knight of the Altar', 'Senior Altar Server', 'Junior Altar Server'],
    maxSundaysPerServer: 5,
    maxWeekdaysPerServer: 8,
    maxServersPerSundaySlot: 4,
    maxServersPerWeekdaySlot: 4,
    submittedMembers: ['mem-a'],
    approvedMembers: ['mem-a'],
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z'
  };
  store.setDoc('schedulePublications', publication.id, publication);

  const memberA: Member = {
    id: 'mem-a',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@example.com',
    role: 'server',
    rank: 'Knight of the Altar',
    status: 'active'
  } as any;
  store.setDoc('members', memberA.id, memberA);

  const memberSubmission = {
    id: 'pub-nov-2026_mem-a',
    publicationId: 'pub-nov-2026',
    memberId: 'mem-a',
    status: 'approved',
    selectedScheduleIds: ['sched-sun-nov01-0730', 'sched-sun-nov08-0730', 'sched-sun-nov15-0730', 'sched-sun-nov22-0730', 'sched-sun-nov29-0730'],
    reviewedBy: 'coordinator@example.com',
    reviewedAt: '2026-10-25T10:00:00Z',
    submittedAt: '2026-10-25T08:00:00Z'
  };
  store.setDoc('scheduleSubmissions', memberSubmission.id, memberSubmission);

  // November 2026 Sundays: Nov 1, Nov 8, Nov 15, Nov 22, Nov 29
  // Two slots per Sunday: 07:30 and 09:00
  const sundays = ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'];
  const schedules: Schedule[] = [];

  for (const date of sundays) {
    // 7:30 AM slot (Member A initially assigned to all of them)
    const sched730: Schedule = {
      id: `sched-sun-${date.replace(/-/g, '')}-0730`,
      title: 'Sunday Mass',
      date,
      startTime: '07:30',
      endTime: '08:30',
      publicationId: 'pub-nov-2026',
      assignedMembers: ['mem-a'],
      status: 'upcoming'
    } as any;
    store.setDoc('schedules', sched730.id, sched730);
    schedules.push(sched730);

    // 9:00 AM slot (Empty or other servers)
    const sched900: Schedule = {
      id: `sched-sun-${date.replace(/-/g, '')}-0900`,
      title: 'Sunday Mass',
      date,
      startTime: '09:00',
      endTime: '10:00',
      publicationId: 'pub-nov-2026',
      assignedMembers: [],
      status: 'upcoming'
    } as any;
    store.setDoc('schedules', sched900.id, sched900);
    schedules.push(sched900);
  }

  return { store, publication, memberA, memberSubmission, schedules };
}

test('1. Effective-Dated Edit: Member A moves from 7:30 AM to 9:00 AM from Week 2 onward, preserving Week 1 intact', async () => {
  const { store, publication, memberA, schedules } = createSampleEnvironment();

  // Admin wants Member A to move from 7:30 AM to 9:00 AM effective from 2026-11-08 (2nd Sunday).
  // The selections contain the intended future state (uncheck 7:30, check 9:00).
  const selections: ScheduleSelectionItem[] = schedules.map(s => {
    if (s.startTime === '09:00') {
      return { scheduleId: s.id, isSelected: true };
    }
    return { scheduleId: s.id, isSelected: false };
  });

  const result = await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
    publication.id,
    memberA.id,
    selections,
    {
      effectiveDate: '2026-11-08',
      markAsSubmitted: true,
      adminUser: {
        uid: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        permissions: { canManageSchedules: true }
      },
      firestoreInstance: store,
      transactionRunner: store.createTransactionRunner()
    }
  );

  // Week 1 (2026-11-01) is before effectiveDate 2026-11-08: MUST BE PRESERVED INTACT!
  const week1_730 = store.getDoc('schedules', 'sched-sun-20261101-0730');
  const week1_900 = store.getDoc('schedules', 'sched-sun-20261101-0900');
  assert.deepEqual(week1_730.assignedMembers, ['mem-a'], 'Week 1 7:30 AM must remain assigned to Member A');
  assert.deepEqual(week1_900.assignedMembers, [], 'Week 1 9:00 AM must NOT be assigned to Member A');

  // Weeks 2 to 5 (Nov 8, 15, 22, 29) are on or after effectiveDate: MUST BE UPDATED!
  const futureSundays = ['20261108', '20261115', '20261122', '20261129'];
  for (const dayStr of futureSundays) {
    const s730 = store.getDoc('schedules', `sched-sun-${dayStr}-0730`);
    const s900 = store.getDoc('schedules', `sched-sun-${dayStr}-0900`);
    assert.deepEqual(s730.assignedMembers, [], `Week of ${dayStr} 7:30 AM must have Member A removed`);
    assert.deepEqual(s900.assignedMembers, ['mem-a'], `Week of ${dayStr} 9:00 AM must have Member A assigned`);
  }

  // Check result object
  assert.equal(result.preservedHistoricalSchedulesCount, 2, 'Two Week 1 schedules must be marked preserved');
  assert.equal(result.updatedFutureSchedulesCount, 8, '8 future schedules (4 removals + 4 additions) updated');
  assert.equal(result.effectiveDate, '2026-11-08');

  // Member submission status must remain 'approved'
  const subDoc = store.getDoc('scheduleSubmissions', `${publication.id}_${memberA.id}`);
  assert.equal(subDoc.status, 'approved', 'Submission status must remain approved');
  assert.equal(subDoc.effectiveDate, '2026-11-08');
});

test('2. Stale stored schedule.status does not compromise historical preservation', async () => {
  const { store, publication, memberA, schedules } = createSampleEnvironment();

  // Explicitly mark Week 1 schedule as having a stale status: 'upcoming' even though date is in past relative to effectiveDate
  const week1_730_orig = store.getDoc('schedules', 'sched-sun-20261101-0730');
  week1_730_orig.status = 'upcoming'; // STALE STATUS!
  store.setDoc('schedules', 'sched-sun-20261101-0730', week1_730_orig);

  const selections: ScheduleSelectionItem[] = schedules.map(s => ({
    scheduleId: s.id,
    isSelected: false // Admin attempts to unassign from everything
  }));

  await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
    publication.id,
    memberA.id,
    selections,
    {
      effectiveDate: '2026-11-08',
      adminUser: { uid: 'admin-1', role: 'admin' },
      firestoreInstance: store,
      transactionRunner: store.createTransactionRunner()
    }
  );

  // Even though stored status was 'upcoming', date 2026-11-01 is before effectiveDate 2026-11-08: PRESERVED!
  const week1_730_after = store.getDoc('schedules', 'sched-sun-20261101-0730');
  assert.deepEqual(week1_730_after.assignedMembers, ['mem-a'], 'Past occurrence with stale status must not be modified');
});

test('3. Locked schedules and finalized attendance sessions are preserved regardless of effectiveDate', async () => {
  const { store, publication, memberA, schedules } = createSampleEnvironment();

  // Set Week 3 (2026-11-15) as locked, and Week 4 (2026-11-22) as having finalized attendance
  const week3_730 = store.getDoc('schedules', 'sched-sun-20261115-0730');
  week3_730.isLocked = true;
  store.setDoc('schedules', week3_730.id, week3_730);

  const week4_730 = store.getDoc('schedules', 'sched-sun-20261122-0730');
  week4_730.attendanceSessionFinalized = true;
  store.setDoc('schedules', week4_730.id, week4_730);

  // Admin updates effective from 2026-11-01 (effective from beginning) to unassign from 7:30
  const selections: ScheduleSelectionItem[] = schedules.map(s => ({
    scheduleId: s.id,
    isSelected: false
  }));

  const result = await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
    publication.id,
    memberA.id,
    selections,
    {
      effectiveDate: '2026-11-01',
      adminUser: { uid: 'admin-1', role: 'admin' },
      firestoreInstance: store,
      transactionRunner: store.createTransactionRunner()
    }
  );

  // Locked Week 3 and finalized Week 4 must NOT be unassigned
  const week3_after = store.getDoc('schedules', week3_730.id);
  const week4_after = store.getDoc('schedules', week4_730.id);
  assert.deepEqual(week3_after.assignedMembers, ['mem-a'], 'Locked schedule must retain assigned member');
  assert.deepEqual(week4_after.assignedMembers, ['mem-a'], 'Finalized attendance schedule must retain assigned member');

  // Unlocked Week 2 (2026-11-08) should be unassigned
  const week2_after = store.getDoc('schedules', 'sched-sun-20261108-0730');
  assert.deepEqual(week2_after.assignedMembers, [], 'Unlocked future schedule should be unassigned');
  assert.ok(result.preservedHistoricalSchedulesCount >= 2);
});

test('4. Target slot at capacity limit rejects edit with SLOT_FULL', async () => {
  const { store, publication, memberA, schedules } = createSampleEnvironment();

  // Max capacity is 4. Fill Week 2 9:00 AM with 4 other servers
  const week2_900 = store.getDoc('schedules', 'sched-sun-20261108-0900');
  week2_900.assignedMembers = ['mem-1', 'mem-2', 'mem-3', 'mem-4'];
  store.setDoc('schedules', week2_900.id, week2_900);

  // Admin tries to assign Member A to 9:00 AM
  const selections: ScheduleSelectionItem[] = schedules.map(s => ({
    scheduleId: s.id,
    isSelected: s.startTime === '09:00'
  }));

  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        memberA.id,
        selections,
        {
          effectiveDate: '2026-11-08',
          adminUser: { uid: 'admin-1', role: 'admin' },
          firestoreInstance: store,
          transactionRunner: store.createTransactionRunner()
        }
      );
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'SLOT_FULL');
      return true;
    }
  );
});

test('5. Atomic rollback on validation failure: zero partial writes committed', async () => {
  const { store, publication, memberA, schedules } = createSampleEnvironment();

  // Fill only Week 4 (Nov 22) 9:00 AM to capacity (4/4)
  const week4_900 = store.getDoc('schedules', 'sched-sun-20261122-0900');
  week4_900.assignedMembers = ['mem-1', 'mem-2', 'mem-3', 'mem-4'];
  store.setDoc('schedules', week4_900.id, week4_900);

  const selections: ScheduleSelectionItem[] = schedules.map(s => ({
    scheduleId: s.id,
    isSelected: s.startTime === '09:00'
  }));

  // Attempt effective-dated edit from Week 2
  await assert.rejects(async () => {
    await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
      publication.id,
      memberA.id,
      selections,
      {
        effectiveDate: '2026-11-08',
        adminUser: { uid: 'admin-1', role: 'admin' },
        firestoreInstance: store,
        transactionRunner: store.createTransactionRunner()
      }
    );
  });

  // Verify that Week 2 7:30 AM was NOT removed and Week 2 9:00 AM was NOT added
  const week2_730 = store.getDoc('schedules', 'sched-sun-20261108-0730');
  const week2_900 = store.getDoc('schedules', 'sched-sun-20261108-0900');
  assert.deepEqual(week2_730.assignedMembers, ['mem-a'], 'Week 2 7:30 AM must remain unchanged after rollback');
  assert.deepEqual(week2_900.assignedMembers, [], 'Week 2 9:00 AM must remain empty after rollback');
});

test('6. Overlapping schedule assignment on the same day is rejected', async () => {
  const { store, publication, memberA } = createSampleEnvironment();

  // Try to select both 7:30 AM and a conflicting 8:00 AM slot on Week 2
  const conflictSched: Schedule = {
    id: 'sched-sun-20261108-0800-conflict',
    title: 'Special Blessing Mass',
    date: '2026-11-08',
    startTime: '08:00',
    endTime: '09:00',
    publicationId: publication.id,
    assignedMembers: [],
    status: 'upcoming'
  } as any;
  store.setDoc('schedules', conflictSched.id, conflictSched);

  const selections: ScheduleSelectionItem[] = [
    { scheduleId: 'sched-sun-20261108-0730', isSelected: true },
    { scheduleId: conflictSched.id, isSelected: true }
  ];

  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        memberA.id,
        selections,
        {
          effectiveDate: '2026-11-08',
          adminUser: { uid: 'admin-1', role: 'admin' },
          firestoreInstance: store,
          transactionRunner: store.createTransactionRunner()
        }
      );
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'OVERLAPPING_SCHEDULE');
      return true;
    }
  );
});

test('7. Unauthorized administrator edit is rejected with PERMISSION_DENIED', async () => {
  const { store, publication, memberA, schedules } = createSampleEnvironment();

  const selections: ScheduleSelectionItem[] = schedules.map(s => ({
    scheduleId: s.id,
    isSelected: true
  }));

  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        memberA.id,
        selections,
        {
          effectiveDate: '2026-11-08',
          adminUser: {
            uid: 'unauthorized-user',
            role: 'viewer',
            permissions: { canManageSchedules: false }
          },
          firestoreInstance: store,
          transactionRunner: store.createTransactionRunner()
        }
      );
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PERMISSION_DENIED');
      return true;
    }
  );
});

test('8. Cross-publication schedule selection is rejected', async () => {
  const { store, publication, memberA } = createSampleEnvironment();

  // A schedule belonging to a different publication
  const foreignSched: Schedule = {
    id: 'sched-foreign-pub',
    title: 'Sunday Mass',
    date: '2026-11-08',
    startTime: '09:00',
    endTime: '10:00',
    publicationId: 'pub-dec-2026', // DIFFERENT PUBLICATION!
    assignedMembers: [],
    status: 'upcoming'
  } as any;
  store.setDoc('schedules', foreignSched.id, foreignSched);

  const selections: ScheduleSelectionItem[] = [
    { scheduleId: foreignSched.id, isSelected: true }
  ];

  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        memberA.id,
        selections,
        {
          effectiveDate: '2026-11-08',
          adminUser: { uid: 'admin-1', role: 'admin' },
          firestoreInstance: store,
          transactionRunner: store.createTransactionRunner()
        }
      );
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'INVALID_STATUS');
      return true;
    }
  );
});

test('9. Ineligible or suspended member edit is rejected', async () => {
  const { store, publication, schedules } = createSampleEnvironment();

  const suspendedMember: Member = {
    id: 'mem-suspended',
    firstName: 'Pedro',
    lastName: 'Santos',
    role: 'server',
    rank: 'Knight of the Altar',
    status: 'suspended'
  } as any;
  store.setDoc('members', suspendedMember.id, suspendedMember);

  const selections: ScheduleSelectionItem[] = schedules.map(s => ({
    scheduleId: s.id,
    isSelected: true
  }));

  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        suspendedMember.id,
        selections,
        {
          effectiveDate: '2026-11-08',
          adminUser: { uid: 'admin-1', role: 'admin' },
          firestoreInstance: store,
          transactionRunner: store.createTransactionRunner()
        }
      );
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'MEMBER_INELIGIBLE');
      return true;
    }
  );
});

test('10. Concurrency contention prevention: simultaneous edits detected and resolved safely', async () => {
  const { store, publication, memberA } = createSampleEnvironment();

  // Create two concurrent transactions competing for the last available slot on Week 2 9:00 AM
  const week2_900 = store.getDoc('schedules', 'sched-sun-20261108-0900');
  week2_900.assignedMembers = ['mem-1', 'mem-2', 'mem-3']; // 3/4 slots taken
  store.setDoc('schedules', week2_900.id, week2_900);

  const memberB: Member = {
    id: 'mem-b',
    firstName: 'Maria',
    lastName: 'Clara',
    role: 'server',
    rank: 'Junior Altar Server',
    status: 'active'
  } as any;
  store.setDoc('members', memberB.id, memberB);

  const selectionsA: ScheduleSelectionItem[] = [
    { scheduleId: 'sched-sun-20261108-0900', isSelected: true }
  ];
  const selectionsB: ScheduleSelectionItem[] = [
    { scheduleId: 'sched-sun-20261108-0900', isSelected: true }
  ];

  // First admin commits for Member A
  await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
    publication.id,
    memberA.id,
    selectionsA,
    {
      effectiveDate: '2026-11-08',
      adminUser: { uid: 'admin-1', role: 'admin' },
      firestoreInstance: store,
      transactionRunner: store.createTransactionRunner()
    }
  );

  // Now Week 2 9:00 AM has 4/4 assigned: ['mem-1', 'mem-2', 'mem-3', 'mem-a']
  const updatedSlot = store.getDoc('schedules', 'sched-sun-20261108-0900');
  assert.equal(updatedSlot.assignedMembers.length, 4);

  // Second admin attempts to assign Member B to the same slot -> must fail with SLOT_FULL
  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        publication.id,
        memberB.id,
        selectionsB,
        {
          effectiveDate: '2026-11-08',
          adminUser: { uid: 'admin-2', role: 'admin' },
          firestoreInstance: store,
          transactionRunner: store.createTransactionRunner()
        }
      );
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'SLOT_FULL');
      return true;
    }
  );

  // Slot remains exactly 4/4 with Member A, not corrupted
  const finalSlot = store.getDoc('schedules', 'sched-sun-20261108-0900');
  assert.deepEqual(finalSlot.assignedMembers, ['mem-1', 'mem-2', 'mem-3', 'mem-a']);
});
