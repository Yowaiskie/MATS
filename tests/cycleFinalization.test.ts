import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionService } from '../src/services/submissionService.ts';
import { groupSchedulesIntoPatterns, checkMemberQuotaStatus } from '../src/utils/scheduleUtils.ts';
import { SubmissionError } from '../src/types/submission.ts';
import type { ScheduleSubmission } from '../src/types/submission.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Member } from '../src/types/member.ts';
import type { Schedule } from '../src/types/schedule.ts';

// In-memory document store to simulate Firestore with transaction rollback semantics
class MockFirestoreStore {
  collections: Map<string, Map<string, any>> = new Map();
  versionMap: Map<string, number> = new Map();

  constructor() {
    this.collections.set('scheduleSubmissions', new Map());
    this.collections.set('schedulePublications', new Map());
    this.collections.set('members', new Map());
    this.collections.set('schedules', new Map());
    this.collections.set('auditLogs', new Map());
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

  deleteDoc(collectionName: string, id: string) {
    const col = this.collections.get(collectionName);
    if (col) {
      col.delete(id);
      const key = `${collectionName}/${id}`;
      this.versionMap.set(key, (this.versionMap.get(key) || 0) + 1);
    }
  }

  updateDoc(collectionName: string, id: string, data: any) {
    const existing = this.getDoc(collectionName, id) || {};
    const merged = { ...existing, ...data };
    this.setDoc(collectionName, id, merged);
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

      // Commit buffered writes
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

  queryDocs(collectionName: string, field: string, value: any): any[] {
    const col = this.collections.get(collectionName);
    if (!col) return [];
    const results: any[] = [];
    for (const [id, doc] of col.entries()) {
      if (doc[field] === value) {
        results.push({ id, ...JSON.parse(JSON.stringify(doc)) });
      }
    }
    return results;
  }
}

function createTestEnvironment() {
  const store = new MockFirestoreStore();

  const publication: SchedulePublication = {
    id: 'pub-cycle-2026',
    name: 'December 2026 Advent & Christmas Schedule',
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    status: 'published',
    publicationType: 'regular',
    submissionDeadline: '2026-12-25T23:59',
    maxServersPerSundaySlot: 2,
    maxServersPerWeekdaySlot: 2,
    allowedRanks: ['Chevaliers', 'Paladins', 'Squires'],
    submittedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const memberA: Member = {
    id: 'mem-a',
    firstName: 'Peter',
    lastName: 'Parker',
    rank: 'Chevaliers',
    order: 'Order of St. John',
    status: 'active',
    role: 'member',
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const memberB: Member = {
    id: 'mem-b',
    firstName: 'Miles',
    lastName: 'Morales',
    rank: 'Paladins',
    order: 'Order of St. John',
    status: 'active',
    role: 'member',
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const scheduleSundayPast: Schedule = {
    id: 'sched-sun-past',
    templateId: 'tmpl-sun',
    publicationId: 'pub-cycle-2026',
    title: 'Sunday Mass',
    date: '2026-12-06',
    startTime: '09:00',
    endTime: '10:00',
    status: 'completed',
    assignedMembers: ['mem-legacy'],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const scheduleSundayFuture: Schedule = {
    id: 'sched-sun-future',
    templateId: 'tmpl-sun',
    publicationId: 'pub-cycle-2026',
    title: 'Sunday Mass',
    date: '2026-12-20',
    startTime: '09:00',
    endTime: '10:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  store.setDoc('schedulePublications', publication.id, publication);
  store.setDoc('members', memberA.id, memberA);
  store.setDoc('members', memberB.id, memberB);
  store.setDoc('schedules', scheduleSundayPast.id, scheduleSundayPast);
  store.setDoc('schedules', scheduleSundayFuture.id, scheduleSundayFuture);

  return {
    store,
    publication,
    memberA,
    memberB,
    scheduleSundayPast,
    scheduleSundayFuture,
    adminUser: {
      email: 'admin@mats.org',
      uid: 'admin-01',
      role: 'admin',
      permissions: {
        canManageSchedules: true
      }
    }
  };
}

test('1. Provisional submissions immediately populate pattern roster and preserve exact slot index', () => {
  const { publication, scheduleSundayFuture } = createTestEnvironment();

  // Member selects slotIndex: 1 (Server 2)
  const provisionalSubmissions = [
    {
      memberId: 'mem-b',
      status: 'pending' as const,
      requestedScheduleIds: [scheduleSundayFuture.id],
      slotSummaries: [
        {
          scheduleIds: [scheduleSundayFuture.id],
          slotIndex: 1,
          startTime: '09:00',
          title: 'Sunday Mass'
        }
      ]
    }
  ];

  const grouped = groupSchedulesIntoPatterns([scheduleSundayFuture], publication, {
    submissions: provisionalSubmissions
  });

  assert.equal(grouped.sundayPatterns.length, 1);
  const pattern = grouped.sundayPatterns[0];

  // Slot 0 (Server 1) is open (''), Slot 1 (Server 2) holds mem-b
  assert.equal(pattern.assignedMembers[0], '');
  assert.equal(pattern.assignedMembers[1], 'mem-b');
});

test('2. Atomic cycle finalization commits provisional roster to future schedules and updates publication', async () => {
  const { store, publication, scheduleSundayFuture, adminUser } = createTestEnvironment();

  const submission: ScheduleSubmission = {
    id: 'sub-mem-a',
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    memberRank: 'Chevaliers',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        dayOfWeek: 0,
        dayName: 'Sunday',
        startTime: '08:00',
        title: 'Sunday Mass',
        datesCount: 1
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  const result = await submissionService.finalizePublicationCycle(publication.id, {
    effectiveDate: '2026-12-15',
    adminUser,
    firestoreInstance: store,
    transactionRunner: store.createTransactionRunner()
  });

  assert.equal(result.approvedSubmissionsCount, 1);
  assert.equal(result.updatedSchedulesCount, 1);
  assert.equal(result.preservedHistoricalSchedulesCount, 1);

  // Future schedule received assignment
  const updatedFutureSched = store.getDoc('schedules', scheduleSundayFuture.id);
  assert.deepEqual(updatedFutureSched.assignedMembers, ['mem-a']);

  // Submission marked approved
  const updatedSub = store.getDoc('scheduleSubmissions', submission.id);
  assert.equal(updatedSub.status, 'approved');
  assert.equal(updatedSub.reviewedBy, 'admin@mats.org');

  // Publication marked isCycleFinalized: true and submittedMembers updated
  const updatedPub = store.getDoc('schedulePublications', publication.id);
  assert.equal(updatedPub.isCycleFinalized, true);
  assert.ok(updatedPub.submittedMembers.includes('mem-a'));
});

test('3. Historical and completed schedule occurrences prior to effectiveDate are strictly preserved', async () => {
  const { store, publication, scheduleSundayPast, scheduleSundayFuture, adminUser } = createTestEnvironment();

  const submission: ScheduleSubmission = {
    id: 'sub-mem-a',
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayPast.id, scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayPast.id, scheduleSundayFuture.id],
        slotIndex: 0,
        startTime: '08:00',
        title: 'Sunday Mass'
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  await submissionService.finalizePublicationCycle(publication.id, {
    effectiveDate: '2026-12-15',
    adminUser,
    firestoreInstance: store,
    transactionRunner: store.createTransactionRunner()
  });

  // Past schedule (2026-12-06) retains legacy assignment
  const pastDoc = store.getDoc('schedules', scheduleSundayPast.id);
  assert.deepEqual(pastDoc.assignedMembers, ['mem-legacy']);

  // Future schedule received assignment
  const futureDoc = store.getDoc('schedules', scheduleSundayFuture.id);
  assert.deepEqual(futureDoc.assignedMembers, ['mem-a']);
});

test('4. Conflict detection: Aborts finalization with zero partial writes when slot is already occupied', async () => {
  const { store, publication, scheduleSundayFuture, adminUser } = createTestEnvironment();

  // Future schedule already has Server 1 (index 0) filled
  store.setDoc('schedules', scheduleSundayFuture.id, {
    ...scheduleSundayFuture,
    assignedMembers: ['mem-b']
  });

  // Member A requests Server 1 (slotIndex: 0) which conflicts with Member B
  const submission: ScheduleSubmission = {
    id: 'sub-conflict',
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        startTime: '08:00',
        title: 'Sunday Mass'
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  await assert.rejects(
    async () => {
      await submissionService.finalizePublicationCycle(publication.id, {
        effectiveDate: '2026-12-15',
        adminUser,
        firestoreInstance: store,
        transactionRunner: store.createTransactionRunner()
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'CONFLICT_DETECTED');
      assert.ok(err.details?.conflicts?.length > 0);
      assert.equal(err.details.conflicts[0].type, 'CAPACITY_EXCEEDED');
      return true;
    }
  );

  // Verification of ZERO partial writes:
  // 1. Future schedule still only has ['mem-b']
  const schedAfterAbort = store.getDoc('schedules', scheduleSundayFuture.id);
  assert.deepEqual(schedAfterAbort.assignedMembers, ['mem-b']);

  // 2. Submission remains pending
  const subAfterAbort = store.getDoc('scheduleSubmissions', submission.id);
  assert.equal(subAfterAbort.status, 'pending');

  // 3. Publication is NOT finalized
  const pubAfterAbort = store.getDoc('schedulePublications', publication.id);
  assert.equal(pubAfterAbort.isCycleFinalized, undefined);
});

test('5. Conflict detection: Aborts finalization when server is suspended on regular Mass', async () => {
  const { store, publication, scheduleSundayFuture, adminUser } = createTestEnvironment();

  // Member A is suspended
  store.setDoc('members', 'mem-a', {
    id: 'mem-a',
    firstName: 'Peter',
    lastName: 'Parker',
    rank: 'Chevaliers',
    status: 'suspended',
    role: 'member'
  });

  const submission: ScheduleSubmission = {
    id: 'sub-suspended',
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        startTime: '08:00',
        title: 'Sunday Mass'
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  await assert.rejects(
    async () => {
      await submissionService.finalizePublicationCycle(publication.id, {
        effectiveDate: '2026-12-15',
        adminUser,
        firestoreInstance: store,
        transactionRunner: store.createTransactionRunner()
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'CONFLICT_DETECTED');
      const conflict = err.details?.conflicts?.find((c: any) => c.type === 'MEMBER_SUSPENDED');
      assert.ok(conflict);
      assert.match(conflict.message, /suspended/);
      return true;
    }
  );

  // Check zero partial writes
  const schedDoc = store.getDoc('schedules', scheduleSundayFuture.id);
  assert.deepEqual(schedDoc.assignedMembers, []);
});

test('6. Conflict detection: Aborts finalization when server has same-day overlapping Masses', async () => {
  const { store, publication, scheduleSundayFuture, adminUser } = createTestEnvironment();

  // Create overlapping Mass on the same date (2026-12-20 from 08:30 to 09:30)
  const overlappingMass: Schedule = {
    id: 'sched-sun-overlap',
    publicationId: publication.id,
    title: 'Youth Mass',
    date: '2026-12-20',
    startTime: '08:30',
    endTime: '09:30',
    status: 'upcoming',
    assignedMembers: ['mem-a'], // Already assigned to Member A
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', overlappingMass.id, overlappingMass);

  // Member A also selected Sunday Mass 09:00-10:00 on 2026-12-20
  const submission: ScheduleSubmission = {
    id: 'sub-overlap',
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        startTime: '09:00',
        title: 'Sunday Mass'
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  await assert.rejects(
    async () => {
      await submissionService.finalizePublicationCycle(publication.id, {
        effectiveDate: '2026-12-15',
        adminUser,
        firestoreInstance: store,
        transactionRunner: store.createTransactionRunner()
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'CONFLICT_DETECTED');
      const conflict = err.details?.conflicts?.find((c: any) => c.type === 'TIME_OVERLAP');
      assert.ok(conflict);
      assert.match(conflict.message, /Time overlap/);
      return true;
    }
  );

  // Schedule assignments for scheduleSundayFuture were rolled back
  const futureSched = store.getDoc('schedules', scheduleSundayFuture.id);
  assert.deepEqual(futureSched.assignedMembers, []);
});

test('7. Concurrency contention triggers transaction rollback without corrupting state', async () => {
  const { store, publication, scheduleSundayFuture, adminUser } = createTestEnvironment();

  const submission: ScheduleSubmission = {
    id: 'sub-concurrency',
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        startTime: '08:00',
        title: 'Sunday Mass'
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  // Simulate concurrent update before commit
  let hasInterfered = false;
  const runner = async <T>(fn: (transaction: any) => Promise<T>): Promise<T> => {
    return store.createTransactionRunner()(async (tx) => {
      const res = await fn(tx);
      if (!hasInterfered) {
        hasInterfered = true;
        // Concurrent write updates publication version
        store.setDoc('schedulePublications', publication.id, {
          ...publication,
          name: 'Concurrent Update'
        });
      }
      return res;
    });
  };

  await assert.rejects(
    async () => {
      await submissionService.finalizePublicationCycle(publication.id, {
        effectiveDate: '2026-12-15',
        adminUser,
        firestoreInstance: store,
        transactionRunner: runner
      });
    },
    /Transaction contention/
  );

  // Submission was not marked approved
  const subAfter = store.getDoc('scheduleSubmissions', submission.id);
  assert.equal(subAfter.status, 'pending');

  // Schedule was not updated
  const schedAfter = store.getDoc('schedules', scheduleSundayFuture.id);
  assert.deepEqual(schedAfter.assignedMembers, []);
});

test('8. Resetting member schedule with scope all removes submission completely from scheduleSubmissions', async () => {
  const { store, publication, scheduleSundayFuture } = createTestEnvironment();

  const submission: ScheduleSubmission = {
    id: `${publication.id}_mem-a`,
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    memberRank: 'Chevaliers',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        dayOfWeek: 0,
        dayName: 'Sunday',
        startTime: '08:00',
        title: 'Sunday Mass',
        datesCount: 1
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  // Before reset, submission exists
  const existingSub = await submissionService.getSubmission(publication.id, 'mem-a', store as any);
  assert.ok(existingSub !== null);
  assert.equal(existingSub?.memberId, 'mem-a');

  // Execute reset for mem-a
  await submissionService.resetSubmissionsForMembers(publication.id, ['mem-a'], 'all', store as any);

  // After reset, submission document is deleted
  const resetSub = await submissionService.getSubmission(publication.id, 'mem-a', store as any);
  assert.equal(resetSub, null);
  const hasSub = await submissionService.hasMemberSubmitted(publication.id, 'mem-a', store as any);
  assert.equal(hasSub, false);
});

test('9. Resetting member schedule with scope sunday removes Sunday slots and keeps weekday slots', async () => {
  const { store, publication, scheduleSundayFuture } = createTestEnvironment();

  const scheduleWeekdayFuture: Schedule = {
    id: 'sched-wk-future',
    templateId: 'tmpl-wk',
    publicationId: publication.id,
    title: 'Weekday Mass',
    date: '2026-12-16',
    startTime: '06:00',
    endTime: '07:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', scheduleWeekdayFuture.id, scheduleWeekdayFuture);

  const submission: ScheduleSubmission = {
    id: `${publication.id}_mem-a`,
    publicationId: publication.id,
    memberId: 'mem-a',
    memberName: 'Peter Parker',
    memberRank: 'Chevaliers',
    status: 'pending',
    requestedScheduleIds: [scheduleSundayFuture.id, scheduleWeekdayFuture.id],
    slotSummaries: [
      {
        scheduleIds: [scheduleSundayFuture.id],
        slotIndex: 0,
        dayOfWeek: 0,
        dayName: 'Sunday',
        startTime: '08:00',
        title: 'Sunday Mass',
        datesCount: 1
      },
      {
        scheduleIds: [scheduleWeekdayFuture.id],
        slotIndex: 0,
        dayOfWeek: 3,
        dayName: 'Wednesday',
        startTime: '06:00',
        title: 'Weekday Mass',
        datesCount: 1
      }
    ],
    submittedAt: '2026-12-10T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', submission.id, submission);

  // Reset only Sunday slots
  await submissionService.resetSubmissionsForMembers(publication.id, ['mem-a'], 'sunday', store as any);

  // Submission should still exist with only weekday slots
  const remainingSub = await submissionService.getSubmission(publication.id, 'mem-a', store as any);
  assert.ok(remainingSub !== null);
  assert.equal(remainingSub?.slotSummaries.length, 1);
  assert.equal(remainingSub?.slotSummaries[0].dayName, 'Wednesday');
  assert.deepEqual(remainingSub?.requestedScheduleIds, [scheduleWeekdayFuture.id]);
});

test('10. Incremental submission: member submits an initial slot then submits an additional slot up to quota', async () => {
  const { store, publication, memberA, scheduleSundayFuture } = createTestEnvironment();

  const scheduleSundayFuture2: Schedule = {
    id: 'sched-sun-future-2',
    templateId: 'tmpl-sun-2',
    publicationId: publication.id,
    title: 'Sunday Mass',
    date: '2026-12-27',
    startTime: '08:00',
    endTime: '09:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', scheduleSundayFuture2.id, scheduleSundayFuture2);

  // 1. Initial submission: 1 slot
  const firstSubmission = await submissionService.createPendingSubmission(
    {
      publicationId: publication.id,
      memberId: memberA.id,
      memberName: `${memberA.lastName}, ${memberA.firstName}`,
      memberRank: memberA.rank,
      requestedScheduleIds: [scheduleSundayFuture.id],
      slotSummaries: [
        {
          scheduleIds: [scheduleSundayFuture.id],
          slotIndex: 0,
          startTime: '08:00',
          title: 'Sunday Mass'
        }
      ]
    },
    {
      member: memberA,
      publication,
      publicationSchedules: [scheduleSundayFuture, scheduleSundayFuture2],
      firestoreInstance: store as any
    }
  );

  assert.equal(firstSubmission.requestedScheduleIds.length, 1);
  assert.deepEqual(firstSubmission.requestedScheduleIds, [scheduleSundayFuture.id]);

  // 2. Incremental submission: adding second slot
  const secondSubmission = await submissionService.createPendingSubmission(
    {
      publicationId: publication.id,
      memberId: memberA.id,
      memberName: `${memberA.lastName}, ${memberA.firstName}`,
      memberRank: memberA.rank,
      requestedScheduleIds: [scheduleSundayFuture.id, scheduleSundayFuture2.id],
      slotSummaries: [
        {
          scheduleIds: [scheduleSundayFuture.id],
          slotIndex: 0,
          startTime: '08:00',
          title: 'Sunday Mass'
        },
        {
          scheduleIds: [scheduleSundayFuture2.id],
          slotIndex: 0,
          startTime: '08:00',
          title: 'Sunday Mass'
        }
      ]
    },
    {
      member: memberA,
      publication,
      publicationSchedules: [scheduleSundayFuture, scheduleSundayFuture2],
      firestoreInstance: store as any
    }
  );

  assert.equal(secondSubmission.requestedScheduleIds.length, 2);
  assert.deepEqual(secondSubmission.requestedScheduleIds, [scheduleSundayFuture.id, scheduleSundayFuture2.id]);
});

test('11. Duplicate rejection: Submitting with zero new schedule slots is strictly rejected', async () => {
  const { store, publication, memberA, scheduleSundayFuture } = createTestEnvironment();

  // Initial submission
  await submissionService.createPendingSubmission(
    {
      publicationId: publication.id,
      memberId: memberA.id,
      memberName: `${memberA.lastName}, ${memberA.firstName}`,
      memberRank: memberA.rank,
      requestedScheduleIds: [scheduleSundayFuture.id],
      slotSummaries: [
        {
          scheduleIds: [scheduleSundayFuture.id],
          slotIndex: 0,
          startTime: '08:00',
          title: 'Sunday Mass'
        }
      ]
    },
    {
      member: memberA,
      publication,
      publicationSchedules: [scheduleSundayFuture],
      firestoreInstance: store as any
    }
  );

  // Attempting to submit the exact same slots without adding anything new
  await assert.rejects(
    async () => {
      await submissionService.createPendingSubmission(
        {
          publicationId: publication.id,
          memberId: memberA.id,
          memberName: `${memberA.lastName}, ${memberA.firstName}`,
          memberRank: memberA.rank,
          requestedScheduleIds: [scheduleSundayFuture.id],
          slotSummaries: [
            {
              scheduleIds: [scheduleSundayFuture.id],
              slotIndex: 0,
              startTime: '08:00',
              title: 'Sunday Mass'
            }
          ]
        },
        {
          member: memberA,
          publication,
          publicationSchedules: [scheduleSundayFuture],
          firestoreInstance: store as any
        }
      );
    },
    /already been received/
  );
});

test('12. Dropping saved slots rejection: Omitting a previously saved slot throws an error', async () => {
  const { store, publication, memberA, scheduleSundayFuture } = createTestEnvironment();

  const scheduleSundayFuture2: Schedule = {
    id: 'sched-sun-future-2',
    templateId: 'tmpl-sun-2',
    publicationId: publication.id,
    title: 'Sunday Mass',
    date: '2026-12-27',
    startTime: '08:00',
    endTime: '09:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', scheduleSundayFuture2.id, scheduleSundayFuture2);

  // Initial submission has scheduleSundayFuture
  await submissionService.createPendingSubmission(
    {
      publicationId: publication.id,
      memberId: memberA.id,
      memberName: `${memberA.lastName}, ${memberA.firstName}`,
      memberRank: memberA.rank,
      requestedScheduleIds: [scheduleSundayFuture.id],
      slotSummaries: [
        {
          scheduleIds: [scheduleSundayFuture.id],
          slotIndex: 0,
          startTime: '08:00',
          title: 'Sunday Mass'
        }
      ]
    },
    {
      member: memberA,
      publication,
      publicationSchedules: [scheduleSundayFuture, scheduleSundayFuture2],
      firestoreInstance: store as any
    }
  );

  // Attempting to replace scheduleSundayFuture with scheduleSundayFuture2 (dropping previous)
  await assert.rejects(
    async () => {
      await submissionService.createPendingSubmission(
        {
          publicationId: publication.id,
          memberId: memberA.id,
          memberName: `${memberA.lastName}, ${memberA.firstName}`,
          memberRank: memberA.rank,
          requestedScheduleIds: [scheduleSundayFuture2.id],
          slotSummaries: [
            {
              scheduleIds: [scheduleSundayFuture2.id],
              slotIndex: 0,
              startTime: '08:00',
              title: 'Sunday Mass'
            }
          ]
        },
        {
          member: memberA,
          publication,
          publicationSchedules: [scheduleSundayFuture, scheduleSundayFuture2],
          firestoreInstance: store as any
        }
      );
    },
    /cannot be removed or modified/
  );
});

test('13. Quota helper accurately detects partial vs fully maxed members', () => {
  const publication: Partial<SchedulePublication> = {
    publicationType: 'regular',
    maxSundaysPerServer: 2,
    maxWeekdaysPerServer: 4
  };

  const sundayPattern1: any = { id: 'sun-1', assignedMembers: ['mem-a', 'mem-b'] };
  const sundayPattern2: any = { id: 'sun-2', assignedMembers: ['mem-a'] };
  const weekdayPattern1: any = { id: 'wk-1', assignedMembers: ['mem-b'] };

  // mem-a has 2 Sundays (maxed for Sundays) and 0 Weekdays (not maxed for Weekdays)
  const statusA = checkMemberQuotaStatus('mem-a', publication, {
    sundayPatterns: [sundayPattern1, sundayPattern2],
    weekdayPatterns: [weekdayPattern1]
  });
  assert.equal(statusA.sundayCount, 2);
  assert.equal(statusA.isSundayMaxed, true);
  assert.equal(statusA.weekdayCount, 0);
  assert.equal(statusA.isWeekdayMaxed, false);
  assert.equal(statusA.isFullyMaxed, false); // Still has weekdays available!

  // If a publication only has Sunday Masses:
  const statusASundayOnly = checkMemberQuotaStatus('mem-a', publication, {
    sundayPatterns: [sundayPattern1, sundayPattern2],
    weekdayPatterns: []
  });
  assert.equal(statusASundayOnly.isFullyMaxed, true); // No weekdays exist, so 2/2 Sundays is fully maxed!
});
