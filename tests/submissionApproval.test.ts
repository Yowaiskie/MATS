import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionService } from '../src/services/submissionService.ts';
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
      // Snapshot reads and buffer writes
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

      // Execute transaction callback
      // If fn throws, writeBuffer is discarded (ATOMIC ROLLBACK)
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

  // Helper to create document reference object matching Firestore structure
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
    status: 'published',
    publicationType: 'regular',
    submissionDeadline: '2026-12-31T23:59',
    maxServersPerSundaySlot: 2,
    maxServersPerWeekdaySlot: 2,
    allowedRanks: ['Chevaliers', 'Paladins', 'Squires'],
    submittedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const member: Member = {
    id: 'mem-101',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    rank: 'Chevaliers',
    order: 'Order of St. John',
    status: 'active',
    role: 'member',
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const scheduleSundayFuture: Schedule = {
    id: 'sched-sun-future',
    publicationId: 'pub-nov-2026',
    title: 'Sunday Mass',
    date: '2026-11-15',
    startTime: '07:30',
    endTime: '08:30',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const scheduleSundayPast: Schedule = {
    id: 'sched-sun-past',
    publicationId: 'pub-nov-2026',
    title: 'Sunday Mass',
    date: '2026-11-01',
    startTime: '07:30',
    endTime: '08:30',
    status: 'completed',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const scheduleLocked: Schedule = {
    id: 'sched-locked',
    publicationId: 'pub-nov-2026',
    title: 'Sunday Mass',
    date: '2026-11-22',
    startTime: '07:30',
    endTime: '08:30',
    status: 'upcoming',
    isLocked: true,
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const pendingSubmission: ScheduleSubmission = {
    id: 'pub-nov-2026_mem-101',
    publicationId: 'pub-nov-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    memberRank: 'Chevaliers',
    status: 'pending',
    requestedScheduleIds: ['sched-sun-future'],
    submittedAt: '2026-10-26T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };

  store.setDoc('schedulePublications', publication.id, publication);
  store.setDoc('members', member.id, member);
  store.setDoc('schedules', scheduleSundayFuture.id, scheduleSundayFuture);
  store.setDoc('schedules', scheduleSundayPast.id, scheduleSundayPast);
  store.setDoc('schedules', scheduleLocked.id, scheduleLocked);
  store.setDoc('scheduleSubmissions', pendingSubmission.id, pendingSubmission);

  return { store, publication, member, scheduleSundayFuture, scheduleSundayPast, scheduleLocked, pendingSubmission };
}

const authorizedAdmin = {
  uid: 'admin-1',
  email: 'coordinator@parish.org',
  role: 'coordinator',
  permissions: { canManageSchedules: true }
};

const unauthorizedUser = {
  uid: 'user-guest',
  email: 'guest@example.com',
  role: 'member',
  permissions: { canManageSchedules: false }
};

// ============================================================================
// Phase 3 Executable Test Scenarios
// ============================================================================

test('1. Successful Pending -> Approved atomically commits official assignments', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  const result = await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
    effectiveDate: '2026-11-08',
    adminUser: authorizedAdmin,
    firestoreInstance: store as any,
    transactionRunner: runner
  });

  assert.equal(result.success, true);
  assert.equal(result.submissionId, 'pub-nov-2026_mem-101');
  assert.equal(result.memberId, 'mem-101');
  assert.deepEqual(result.assignedScheduleIds, ['sched-sun-future']);

  // Verify submission document state
  const updatedSub = store.getDoc('scheduleSubmissions', 'pub-nov-2026_mem-101');
  assert.equal(updatedSub.status, 'approved');
  assert.equal(updatedSub.reviewedBy, 'coordinator@parish.org');
  assert.equal(updatedSub.effectiveDate, '2026-11-08');

  // Verify official schedule document state (CRITICAL: member added to official roster)
  const updatedSched = store.getDoc('schedules', 'sched-sun-future');
  assert.deepEqual(updatedSched.assignedMembers, ['mem-101']);

  // Verify publication document state (CRITICAL: member added to submittedMembers)
  const updatedPub = store.getDoc('schedulePublications', 'pub-nov-2026');
  assert.deepEqual(updatedPub.submittedMembers, ['mem-101']);
});

test('2. Successful Pending -> Rejected preserves official schedules without modification', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  const result = await submissionService.rejectScheduleSubmission('pub-nov-2026_mem-101', {
    reason: 'Incomplete service uniform qualifications.',
    adminUser: authorizedAdmin,
    firestoreInstance: store as any,
    transactionRunner: runner
  });

  assert.equal(result.success, true);
  assert.equal(result.submissionId, 'pub-nov-2026_mem-101');
  assert.equal(result.reason, 'Incomplete service uniform qualifications.');

  // Verify submission document state
  const updatedSub = store.getDoc('scheduleSubmissions', 'pub-nov-2026_mem-101');
  assert.equal(updatedSub.status, 'rejected');
  assert.equal(updatedSub.reviewNote, 'Incomplete service uniform qualifications.');
  assert.equal(updatedSub.reviewedBy, 'coordinator@parish.org');

  // Verify official schedule document remains UNTOUCHED
  const sched = store.getDoc('schedules', 'sched-sun-future');
  assert.deepEqual(sched.assignedMembers, [], 'Official schedule assignments must NOT be altered on rejection');

  // Verify publication submittedMembers remains UNTOUCHED
  const pub = store.getDoc('schedulePublications', 'pub-nov-2026');
  assert.deepEqual(pub.submittedMembers, [], 'Publication submittedMembers must NOT be altered on rejection');
});

test('3. Unauthorized approval and rejection are rejected with PERMISSION_DENIED', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  // Attempt unauthorized approval
  await assert.rejects(
    async () => {
      await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
        adminUser: unauthorizedUser,
        firestoreInstance: store as any,
        transactionRunner: runner
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PERMISSION_DENIED');
      return true;
    }
  );

  // Attempt unauthorized rejection
  await assert.rejects(
    async () => {
      await submissionService.rejectScheduleSubmission('pub-nov-2026_mem-101', {
        adminUser: unauthorizedUser,
        firestoreInstance: store as any,
        transactionRunner: runner
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PERMISSION_DENIED');
      return true;
    }
  );

  // Assert submission is still pending
  const sub = store.getDoc('scheduleSubmissions', 'pub-nov-2026_mem-101');
  assert.equal(sub.status, 'pending');
});

test('4. Duplicate approval attempts are rejected with INVALID_STATUS', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  // First approval succeeds
  await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
    effectiveDate: '2026-11-08',
    adminUser: authorizedAdmin,
    firestoreInstance: store as any,
    transactionRunner: runner
  });

  // Second approval attempt MUST fail
  await assert.rejects(
    async () => {
      await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
        effectiveDate: '2026-11-08',
        adminUser: authorizedAdmin,
        firestoreInstance: store as any,
        transactionRunner: runner
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'INVALID_STATUS');
      assert.match(err.message, /Only pending submissions can be approved/);
      return true;
    }
  );
});

test('5. Concurrent approvals competing for the last available slot prevent overbooking', async () => {
  const { store } = createSampleEnvironment();

  // Set slot maxServersPerSundaySlot = 1 (only 1 server can be assigned)
  const pub = store.getDoc('schedulePublications', 'pub-nov-2026');
  pub.maxServersPerSundaySlot = 1;
  store.setDoc('schedulePublications', pub.id, pub);

  // Add Member B and pending submission B requesting the same slot
  const memberB: Member = {
    id: 'mem-102',
    firstName: 'Maria',
    lastName: 'Santos',
    rank: 'Chevaliers',
    status: 'active',
    role: 'member',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  const subB: ScheduleSubmission = {
    id: 'pub-nov-2026_mem-102',
    publicationId: 'pub-nov-2026',
    memberId: 'mem-102',
    memberName: 'Maria Santos',
    memberRank: 'Chevaliers',
    status: 'pending',
    requestedScheduleIds: ['sched-sun-future'],
    submittedAt: '2026-10-26T10:01:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('members', memberB.id, memberB);
  store.setDoc('scheduleSubmissions', subB.id, subB);

  const runnerA = store.createTransactionRunner();
  const runnerB = store.createTransactionRunner();

  // First admin approval executes and commits
  await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
    adminUser: authorizedAdmin,
    firestoreInstance: store as any,
    transactionRunner: runnerA
  });

  // Second approval for the same slot MUST fail with SLOT_FULL
  await assert.rejects(
    async () => {
      await submissionService.approveScheduleSubmission('pub-nov-2026_mem-102', {
        adminUser: authorizedAdmin,
        firestoreInstance: store as any,
        transactionRunner: runnerB
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'SLOT_FULL');
      assert.match(err.message, /maximum capacity/);
      return true;
    }
  );

  // Confirm schedule has exactly 1 assigned member and NOT overbooked to 2
  const sched = store.getDoc('schedules', 'sched-sun-future');
  assert.equal(sched.assignedMembers.length, 1);
  assert.deepEqual(sched.assignedMembers, ['mem-101']);
});

test('6. Capacity rejection and same-day schedule time overlap rejection', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  // 1. Capacity rejection: schedule already at max capacity
  const sched = store.getDoc('schedules', 'sched-sun-future');
  sched.assignedMembers = ['other-server-1', 'other-server-2']; // Full at 2
  store.setDoc('schedules', sched.id, sched);

  await assert.rejects(
    async () => {
      await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
        adminUser: authorizedAdmin,
        firestoreInstance: store as any,
        transactionRunner: runner
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'SLOT_FULL');
      return true;
    }
  );

  // 2. Schedule time overlap rejection: 2 requested slots on same day overlapping
  const schedOverlapA: Schedule = {
    id: 'sched-ov-1',
    publicationId: 'pub-nov-2026',
    title: 'Morning Mass',
    date: '2026-11-20',
    startTime: '08:00',
    endTime: '09:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };
  const schedOverlapB: Schedule = {
    id: 'sched-ov-2',
    publicationId: 'pub-nov-2026',
    title: 'Youth Service',
    date: '2026-11-20',
    startTime: '08:30', // Overlaps with 08:00-09:00!
    endTime: '09:30',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', schedOverlapA.id, schedOverlapA);
  store.setDoc('schedules', schedOverlapB.id, schedOverlapB);

  const subOverlap: ScheduleSubmission = {
    id: 'pub-nov-2026_mem-overlap',
    publicationId: 'pub-nov-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    status: 'pending',
    requestedScheduleIds: ['sched-ov-1', 'sched-ov-2'],
    submittedAt: '2026-10-26T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', subOverlap.id, subOverlap);

  await assert.rejects(
    async () => {
      await submissionService.approveScheduleSubmission('pub-nov-2026_mem-overlap', {
        adminUser: authorizedAdmin,
        firestoreInstance: store as any,
        transactionRunner: runner
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'OVERLAPPING_SCHEDULE');
      assert.match(err.message, /Schedule time overlap detected/);
      return true;
    }
  );
});

test('7. Atomic rollback when any validation fails guarantees zero partial writes', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  // Create Slot 1 (valid) and Slot 2 (full)
  const slotValid: Schedule = {
    id: 'sched-valid-1',
    publicationId: 'pub-nov-2026',
    title: 'Mass Slot 1',
    date: '2026-11-16',
    startTime: '06:00',
    endTime: '07:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };
  const slotFull: Schedule = {
    id: 'sched-full-2',
    publicationId: 'pub-nov-2026',
    title: 'Mass Slot 2',
    date: '2026-11-17',
    startTime: '06:00',
    endTime: '07:00',
    status: 'upcoming',
    assignedMembers: ['mem-99', 'mem-98'], // Capacity limit 2 is full
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', slotValid.id, slotValid);
  store.setDoc('schedules', slotFull.id, slotFull);

  const multiSub: ScheduleSubmission = {
    id: 'pub-nov-2026_mem-multi',
    publicationId: 'pub-nov-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    status: 'pending',
    requestedScheduleIds: ['sched-valid-1', 'sched-full-2'],
    submittedAt: '2026-10-26T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', multiSub.id, multiSub);

  // Attempt approval - MUST fail due to slotFull
  await assert.rejects(
    async () => {
      await submissionService.approveScheduleSubmission('pub-nov-2026_mem-multi', {
        adminUser: authorizedAdmin,
        firestoreInstance: store as any,
        transactionRunner: runner
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'SLOT_FULL');
      return true;
    }
  );

  // CRITICAL ATOMIC ROLLBACK VERIFICATION:
  // 1. sched-valid-1 must NOT have member added
  const checkSlotValid = store.getDoc('schedules', 'sched-valid-1');
  assert.deepEqual(checkSlotValid.assignedMembers, [], 'Slot 1 must remain empty; no partial writes');

  // 2. Submission must remain 'pending'
  const checkSub = store.getDoc('scheduleSubmissions', 'pub-nov-2026_mem-multi');
  assert.equal(checkSub.status, 'pending', 'Submission must remain pending on rollback');

  // 3. Publication submittedMembers must NOT have member added
  const checkPub = store.getDoc('schedulePublications', 'pub-nov-2026');
  assert.deepEqual(checkPub.submittedMembers, [], 'Publication submittedMembers must remain empty on rollback');
});

test('8. Historical, locked, and finalized occurrences are preserved and skipped from assignment', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  // Create submission requesting past occurrence, locked occurrence, and future occurrence
  const mixedSub: ScheduleSubmission = {
    id: 'pub-nov-2026_mem-mixed',
    publicationId: 'pub-nov-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    status: 'pending',
    requestedScheduleIds: ['sched-sun-past', 'sched-locked', 'sched-sun-future'],
    submittedAt: '2026-10-26T10:00:00Z',
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('scheduleSubmissions', mixedSub.id, mixedSub);

  // Effective date set to Nov 8, 2026:
  // sched-sun-past (Nov 1) -> historical (prior to effectiveDate)
  // sched-locked (Nov 22) -> historical (isLocked: true)
  // sched-sun-future (Nov 15) -> eligible future!
  const result = await submissionService.approveScheduleSubmission('pub-nov-2026_mem-mixed', {
    effectiveDate: '2026-11-08',
    adminUser: authorizedAdmin,
    firestoreInstance: store as any,
    transactionRunner: runner
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.assignedScheduleIds, ['sched-sun-future']);
  assert.ok(result.skippedHistoricalScheduleIds.includes('sched-sun-past'));
  assert.ok(result.skippedHistoricalScheduleIds.includes('sched-locked'));

  // Historical occurrences must remain 100% UNTOUCHED
  const pastSched = store.getDoc('schedules', 'sched-sun-past');
  assert.deepEqual(pastSched.assignedMembers, [], 'Past schedule must NOT have member added');

  const lockedSched = store.getDoc('schedules', 'sched-locked');
  assert.deepEqual(lockedSched.assignedMembers, [], 'Locked schedule must NOT have member added');

  // Future occurrence must have member assigned
  const futureSched = store.getDoc('schedules', 'sched-sun-future');
  assert.deepEqual(futureSched.assignedMembers, ['mem-101']);
});

test('9. Approved submission status is synchronized with official assignments and publication', async () => {
  const { store } = createSampleEnvironment();
  const runner = store.createTransactionRunner();

  const result = await submissionService.approveScheduleSubmission('pub-nov-2026_mem-101', {
    effectiveDate: '2026-11-08',
    adminUser: authorizedAdmin,
    firestoreInstance: store as any,
    transactionRunner: runner
  });

  // Load from store to verify synchronization
  const sub = store.getDoc('scheduleSubmissions', result.submissionId);
  const sched = store.getDoc('schedules', 'sched-sun-future');
  const pub = store.getDoc('schedulePublications', 'pub-nov-2026');

  // Verify synchronization invariants
  assert.equal(sub.status, 'approved');
  assert.ok(sched.assignedMembers.includes(result.memberId));
  assert.ok(pub.submittedMembers.includes(result.memberId));
  assert.equal(sub.effectiveDate, '2026-11-08');
  assert.equal(sub.reviewedBy, authorizedAdmin.email);
});
