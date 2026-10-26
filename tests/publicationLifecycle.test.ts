import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationService } from '../src/services/publicationService.ts';
import { submissionService, validateSubmission } from '../src/services/submissionService.ts';
import {
  isPublicationDeadlinePassed,
  getCountdownTimeRemaining
} from '../src/utils/scheduleUtils.ts';
import { SubmissionError, type CreateSubmissionInput, type AdminUserContext } from '../src/types/submission.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Member } from '../src/types/member.ts';
import type { Schedule } from '../src/types/schedule.ts';

// In-memory Firestore store for publication and submission lifecycle testing
class MockLifecycleStore {
  collections: Map<string, Map<string, any>> = new Map();
  versionMap: Map<string, number> = new Map();

  constructor() {
    this.collections.set('schedulePublications', new Map());
    this.collections.set('scheduleSubmissions', new Map());
    this.collections.set('members', new Map());
    this.collections.set('schedules', new Map());
    this.collections.set('auditLogs', new Map());
  }

  getAuditLogs() {
    const col = this.collections.get('auditLogs') || new Map();
    return Array.from(col.values());
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

  createFirestoreInstance(): any {
    return {
      runTransaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
        const readVersions = new Map<string, number>();
        const writeBuffer: Array<{ col: string; id: string; data: any }> = [];

        const tx = {
          get: async (docRef: any) => {
            const col = docRef.collection || docRef.path?.split('/')[0] || 'schedulePublications';
            const id = docRef.id || docRef.path?.split('/')[1];
            const key = `${col}/${id}`;
            readVersions.set(key, this.versionMap.get(key) || 0);
            const data = this.getDoc(col, id);
            return {
              id,
              exists: () => data !== null,
              data: () => data
            };
          },
          update: (docRef: any, updates: any) => {
            const col = docRef.collection || docRef.path?.split('/')[0] || 'schedulePublications';
            const id = docRef.id || docRef.path?.split('/')[1];
            writeBuffer.push({ col, id, data: updates });
          },
          set: (docRef: any, data: any) => {
            const col = docRef.collection || docRef.path?.split('/')[0] || 'schedulePublications';
            const id = docRef.id || docRef.path?.split('/')[1];
            writeBuffer.push({ col, id, data });
          }
        };

        const result = await fn(tx);

        // Optimistic concurrency check
        for (const [key, initialVersion] of readVersions.entries()) {
          const currentVersion = this.versionMap.get(key) || 0;
          if (currentVersion !== initialVersion) {
            throw new Error(`Transaction conflict: document '${key}' was modified concurrently.`);
          }
        }

        // Commit writes atomically
        for (const write of writeBuffer) {
          const cur = this.getDoc(write.col, write.id) || {};
          this.setDoc(write.col, write.id, { ...cur, ...write.data });
        }

        return result;
      },
      getDoc: async (col: string, id: string) => {
        const data = this.getDoc(col, id);
        return {
          id,
          exists: () => data !== null,
          data: () => data
        };
      },
      setDoc: async (col: string, id: string, data: any) => {
        this.setDoc(col, id, data);
      },
      updateDoc: async (col: string, id: string, updates: any) => {
        const cur = this.getDoc(col, id) || {};
        this.setDoc(col, id, { ...cur, ...updates });
      },
      deleteDoc: async (col: string, id: string) => {
        const c = this.collections.get(col);
        if (c) c.delete(id);
      },
      collection: (colPath: string) => ({
        path: colPath,
        docs: Array.from((this.collections.get(colPath) || new Map()).entries()).map(([id, data]) => ({
          id,
          data: () => JSON.parse(JSON.stringify(data))
        }))
      }),
      doc: (colPath: string, docId?: string) => ({
        collection: colPath,
        id: docId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      })
    };
  }
}

const authorizedAdmin: AdminUserContext = {
  uid: 'admin-sched-01',
  email: 'coordinator@mats.org',
  role: 'coordinator',
  permissions: { canManageSchedules: true }
};

const unauthorizedUser: AdminUserContext = {
  uid: 'user-02',
  email: 'member@mats.org',
  role: 'member',
  permissions: { canManageSchedules: false }
};

const baseMember: Member = {
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

const baseSchedules: Schedule[] = [
  {
    id: 'sched-nov-08-0730',
    publicationId: 'pub-reg-nov2026',
    title: 'Sunday Mass',
    date: '2026-11-08',
    startTime: '07:30',
    endTime: '08:30',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  }
];

const publishedPublication: SchedulePublication = {
  id: 'pub-reg-nov2026',
  name: 'November 2026 Regular Mass Schedule',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  status: 'published',
  publicationType: 'regular',
  submissionDeadline: '2026-11-05T23:59:00',
  submissionDeadlineMs: new Date('2026-11-05T23:59:00').getTime(),
  allowedRanks: ['Chevaliers', 'Paladins'],
  submittedMembers: [],
  createdAt: {} as any,
  updatedAt: {} as any
};

// ----------------------------------------------------------------------------
// Scenario 1: Successful submission before deadline on published publication
// ----------------------------------------------------------------------------
test('Scenario 1: Successful submission before deadline on published publication', async () => {
  const store = new MockLifecycleStore();
  store.setDoc('schedulePublications', publishedPublication.id, publishedPublication);
  store.setDoc('members', baseMember.id, baseMember);
  store.setDoc('schedules', baseSchedules[0].id, baseSchedules[0]);

  const beforeDeadline = new Date('2026-11-03T10:00:00'); // 2 days before deadline

  const input: CreateSubmissionInput = {
    publicationId: publishedPublication.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    memberRank: 'Chevaliers',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  // Pure validation layer verification
  assert.doesNotThrow(() => {
    validateSubmission(input, {
      publication: publishedPublication,
      member: baseMember,
      publicationSchedules: baseSchedules,
      serverTime: beforeDeadline
    });
  });

  // Service intake verification
  const submission = await submissionService.createPendingSubmission(input, {
    member: baseMember,
    publication: publishedPublication,
    publicationSchedules: baseSchedules,
    serverTime: beforeDeadline,
    firestoreInstance: store.createFirestoreInstance()
  });

  assert.equal(submission.status, 'pending');
  assert.equal(submission.id, 'pub-reg-nov2026_mem-101');
  assert.deepEqual(submission.requestedScheduleIds, ['sched-nov-08-0730']);
});

// ----------------------------------------------------------------------------
// Scenario 2: Rejection of submission at or after deadline
// ----------------------------------------------------------------------------
test('Scenario 2: Rejection of submission at or after deadline', async () => {
  const input: CreateSubmissionInput = {
    publicationId: publishedPublication.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  const deadlineTime = new Date('2026-11-05T23:59:00');
  const pastDeadline = new Date('2026-11-06T00:00:01');

  // Exact deadline moment is rejected (inclusive boundary check)
  assert.throws(
    () => {
      validateSubmission(input, {
        publication: publishedPublication,
        member: baseMember,
        publicationSchedules: baseSchedules,
        serverTime: deadlineTime
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PUBLICATION_CLOSED');
      assert.match(err.message, /submission deadline for this publication has passed/i);
      return true;
    }
  );

  // Past deadline is rejected
  assert.throws(
    () => {
      validateSubmission(input, {
        publication: publishedPublication,
        member: baseMember,
        publicationSchedules: baseSchedules,
        serverTime: pastDeadline
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PUBLICATION_CLOSED');
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Scenario 3: Rejection of submission on draft publication
// ----------------------------------------------------------------------------
test('Scenario 3: Rejection of submission on draft publication', () => {
  const draftPub: SchedulePublication = {
    ...publishedPublication,
    status: 'draft'
  };

  const input: CreateSubmissionInput = {
    publicationId: draftPub.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: draftPub,
        member: baseMember,
        publicationSchedules: baseSchedules
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PUBLICATION_CLOSED');
      assert.match(err.message, /not currently published/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Scenario 4: Rejection of submission on archived publication
// ----------------------------------------------------------------------------
test('Scenario 4: Rejection of submission on archived publication', () => {
  const archivedPub: SchedulePublication = {
    ...publishedPublication,
    status: 'archived'
  };

  const input: CreateSubmissionInput = {
    publicationId: archivedPub.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: archivedPub,
        member: baseMember,
        publicationSchedules: baseSchedules
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PUBLICATION_CLOSED');
      assert.match(err.message, /not currently published/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Scenario 5: Admin extends deadline and subsequent submission succeeds
// ----------------------------------------------------------------------------
test('Scenario 5: Admin extends deadline and subsequent submission succeeds', async () => {
  const store = new MockLifecycleStore();
  const pubDoc = { ...publishedPublication, submissionDeadline: '2026-11-05T23:59:00', submissionDeadlineMs: new Date('2026-11-05T23:59:00').getTime() };
  store.setDoc('schedulePublications', pubDoc.id, pubDoc);

  const mockDb = store.createFirestoreInstance();

  // Unauthorized actor is rejected
  await assert.rejects(
    async () => {
      await publicationService.extendPublicationDeadline(
        pubDoc.id,
        '2026-11-10T23:59:00',
        unauthorizedUser,
        'Coordinator decision',
        mockDb
      );
    },
    /Unauthorized/
  );

  // Authorized admin extends deadline
  const newDeadline = '2026-11-10T23:59:00';
  await publicationService.extendPublicationDeadline(
    pubDoc.id,
    newDeadline,
    authorizedAdmin,
    'Extended by Parish Pastoral Council request',
    mockDb
  );

  const updatedPub = store.getDoc('schedulePublications', pubDoc.id);
  assert.equal(updatedPub.submissionDeadline, newDeadline);
  assert.equal(updatedPub.submissionDeadlineMs, new Date(newDeadline).getTime());
  assert.equal(updatedPub.status, 'published');

  // Time that was after old deadline (Nov 07) is now within new deadline (Nov 10)
  const submissionTime = new Date('2026-11-07T14:00:00');
  const input: CreateSubmissionInput = {
    publicationId: pubDoc.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  assert.doesNotThrow(() => {
    validateSubmission(input, {
      publication: updatedPub,
      member: baseMember,
      publicationSchedules: baseSchedules,
      serverTime: submissionTime
    });
  });
});

// ----------------------------------------------------------------------------
// Scenario 6: Admin closes submissions early and subsequent submission is rejected
// ----------------------------------------------------------------------------
test('Scenario 6: Admin closes submissions early and subsequent submission is rejected', async () => {
  const store = new MockLifecycleStore();
  const futurePub = {
    ...publishedPublication,
    submissionDeadline: '2026-12-31T23:59:00',
    submissionDeadlineMs: new Date('2026-12-31T23:59:00').getTime()
  };
  store.setDoc('schedulePublications', futurePub.id, futurePub);

  const mockDb = store.createFirestoreInstance();

  // Admin closes submissions early
  await publicationService.closeSubmissionsEarly(
    futurePub.id,
    authorizedAdmin,
    'All slots filled ahead of schedule',
    mockDb
  );

  const updatedPub = store.getDoc('schedulePublications', futurePub.id);
  assert.ok(updatedPub.submissionDeadlineMs <= Date.now() + 1000);

  // Subsequent submission is rejected
  const input: CreateSubmissionInput = {
    publicationId: futurePub.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: updatedPub,
        member: baseMember,
        publicationSchedules: baseSchedules,
        serverTime: Date.now() + 5000 // 5 seconds later
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PUBLICATION_CLOSED');
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Scenario 7: Admin reopens archived publication with new deadline and submission succeeds
// ----------------------------------------------------------------------------
test('Scenario 7: Admin reopens archived publication with new deadline and submission succeeds', async () => {
  const store = new MockLifecycleStore();
  const archivedPub = {
    ...publishedPublication,
    status: 'archived' as const,
    submissionDeadline: '2026-10-31T23:59:00',
    submissionDeadlineMs: new Date('2026-10-31T23:59:00').getTime()
  };
  store.setDoc('schedulePublications', archivedPub.id, archivedPub);

  const mockDb = store.createFirestoreInstance();

  // Reopen with new deadline
  const reopenedDeadline = '2026-11-15T23:59:00';
  await publicationService.reopenPublication(
    archivedPub.id,
    reopenedDeadline,
    authorizedAdmin,
    'Reopened for late transferees',
    mockDb
  );

  const updatedPub = store.getDoc('schedulePublications', archivedPub.id);
  assert.equal(updatedPub.status, 'published');
  assert.equal(updatedPub.submissionDeadline, reopenedDeadline);

  // Submissions within reopened window succeed
  const input: CreateSubmissionInput = {
    publicationId: archivedPub.id,
    memberId: baseMember.id,
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  assert.doesNotThrow(() => {
    validateSubmission(input, {
      publication: updatedPub,
      member: baseMember,
      publicationSchedules: baseSchedules,
      serverTime: new Date('2026-11-12T10:00:00')
    });
  });
});

// ----------------------------------------------------------------------------
// Scenario 8: Client clock tampering defense test
// ----------------------------------------------------------------------------
test('Scenario 8: Client clock tampering defense test', () => {
  // A publication whose deadline was 2026-11-05 23:59:00
  const deadline = new Date('2026-11-05T23:59:00');
  const pub: SchedulePublication = {
    ...publishedPublication,
    submissionDeadline: deadline.toISOString(),
    submissionDeadlineMs: deadline.getTime()
  };

  const input: CreateSubmissionInput = {
    publicationId: pub.id,
    memberId: baseMember.id,
    memberName: 'Tampering User',
    requestedScheduleIds: ['sched-nov-08-0730']
  };

  // Attacker sets device clock to 2026-11-01 (before deadline)
  // But authoritative server reference time is 2026-11-06 (after deadline)
  const attackerManipulatedClientTime = new Date('2026-11-01T12:00:00');
  const authoritativeServerTime = new Date('2026-11-06T09:30:00');

  // Client-side check with spoofed time would wrongly think it is valid:
  assert.equal(isPublicationDeadlinePassed(pub, attackerManipulatedClientTime), false);

  // BUT authoritative backend validation layer uses server timestamp and blocks submission:
  assert.throws(
    () => {
      validateSubmission(input, {
        publication: pub,
        member: baseMember,
        publicationSchedules: baseSchedules,
        serverTime: authoritativeServerTime
      });
    },
    (err: any) => {
      assert.ok(err instanceof SubmissionError);
      assert.equal(err.code, 'PUBLICATION_CLOSED');
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Scenario 9: Real-time countdown calculation / expiry trigger logic
// ----------------------------------------------------------------------------
test('Scenario 9: Real-time countdown calculation and expiry trigger logic', () => {
  const targetDeadline = new Date('2026-11-10T12:00:00Z');
  const pub: SchedulePublication = {
    ...publishedPublication,
    submissionDeadline: targetDeadline.toISOString(),
    submissionDeadlineMs: targetDeadline.getTime()
  };

  // 1. Exactly 2 days, 3 hours, 15 minutes, 30 seconds before deadline
  // 2 days = 172800s, 3 hours = 10800s, 15 mins = 900s, 30s = 30s -> 184530s = 184530000ms
  const testRefTime = new Date(targetDeadline.getTime() - 184530000);
  const cdActive = getCountdownTimeRemaining(pub, testRefTime);

  assert.equal(cdActive.hasDeadline, true);
  assert.equal(cdActive.isExpired, false);
  assert.equal(cdActive.days, 2);
  assert.equal(cdActive.hours, 3);
  assert.equal(cdActive.minutes, 15);
  assert.equal(cdActive.seconds, 30);
  assert.equal(cdActive.formatted, '2d 3h 15m 30s left');

  // 2. Less than a day left (e.g. 5 hours, 45 minutes, 10 seconds)
  const shortRefTime = new Date(targetDeadline.getTime() - (5 * 3600 + 45 * 60 + 10) * 1000);
  const cdShort = getCountdownTimeRemaining(pub, shortRefTime);
  assert.equal(cdShort.days, 0);
  assert.equal(cdShort.hours, 5);
  assert.equal(cdShort.minutes, 45);
  assert.equal(cdShort.seconds, 10);
  assert.equal(cdShort.formatted, '5h 45m 10s left');

  // 3. Exactly at deadline
  const cdExact = getCountdownTimeRemaining(pub, targetDeadline);
  assert.equal(cdExact.isExpired, true);
  assert.equal(cdExact.totalSecondsRemaining, 0);
  assert.equal(cdExact.formatted, 'Deadline expired');

  // 4. Past deadline
  const cdPast = getCountdownTimeRemaining(pub, new Date(targetDeadline.getTime() + 10000));
  assert.equal(cdPast.isExpired, true);
  assert.equal(cdPast.formatted, 'Deadline expired');

  // 5. No deadline configured
  const cdNone = getCountdownTimeRemaining({ ...pub, submissionDeadline: '', submissionDeadlineMs: undefined });
  assert.equal(cdNone.hasDeadline, false);
  assert.equal(cdNone.isExpired, false);
  assert.equal(cdNone.formatted, 'No deadline');
});

// ----------------------------------------------------------------------------
// Scenario 10: Tab visibilitychange / focus sync behavior
// ----------------------------------------------------------------------------
test('Scenario 10: Tab visibilitychange / focus sync behavior simulation', () => {
  const deadline = new Date('2026-11-05T12:00:00Z');
  const pub: SchedulePublication = {
    ...publishedPublication,
    submissionDeadline: deadline.toISOString(),
    submissionDeadlineMs: deadline.getTime()
  };

  // Simulating user state
  let pageCurrentTime = new Date('2026-11-05T11:00:00Z').getTime(); // 1 hour before deadline

  const isClosedAtCurrentTime = () => isPublicationDeadlinePassed(pub, pageCurrentTime);
  const getCountdown = () => getCountdownTimeRemaining(pub, pageCurrentTime);

  // Initial state: active
  assert.equal(isClosedAtCurrentTime(), false);
  assert.equal(getCountdown().isExpired, false);
  assert.equal(getCountdown().formatted, '1h 0m 0s left');

  // Device backgrounding occurs: user minimizes tab for 2 hours
  // When user returns, visibilitychange / focus event fires and resets currentTime to wall-clock time:
  const wallClockAfterResume = new Date('2026-11-05T13:00:00Z').getTime(); // 1 hour past deadline
  pageCurrentTime = wallClockAfterResume; // Handler executed: setCurrentTime(Date.now())

  // Reactive state immediately reflects closure
  assert.equal(isClosedAtCurrentTime(), true);
  assert.equal(getCountdown().isExpired, true);
  assert.equal(getCountdown().formatted, 'Deadline expired');
});

// ----------------------------------------------------------------------------
// Scenario 11: Publication isolation
// ----------------------------------------------------------------------------
test('Scenario 11: Publication isolation (Pub A lifecycle does not affect Pub B)', async () => {
  const store = new MockLifecycleStore();

  const pubA: SchedulePublication = {
    ...publishedPublication,
    id: 'pub-A-regular',
    name: 'Pub A Regular',
    status: 'published',
    submissionDeadline: '2026-11-10T23:59:00',
    submissionDeadlineMs: new Date('2026-11-10T23:59:00').getTime()
  };

  const pubB: SchedulePublication = {
    ...publishedPublication,
    id: 'pub-B-special',
    name: 'Pub B Marian Feast',
    publicationType: 'special_event',
    status: 'published',
    submissionDeadline: '2026-11-20T23:59:00',
    submissionDeadlineMs: new Date('2026-11-20T23:59:00').getTime()
  };

  store.setDoc('schedulePublications', pubA.id, pubA);
  store.setDoc('schedulePublications', pubB.id, pubB);

  // Close Pub A early
  await publicationService.closeSubmissionsEarly(pubA.id, authorizedAdmin, 'Pub A quota met', store.createFirestoreInstance());

  const updatedPubA = store.getDoc('schedulePublications', pubA.id);
  const updatedPubB = store.getDoc('schedulePublications', pubB.id);

  // Pub A is closed
  assert.ok(updatedPubA.submissionDeadlineMs <= Date.now() + 1000);

  // Pub B remains completely unchanged
  assert.equal(updatedPubB.status, 'published');
  assert.equal(updatedPubB.submissionDeadline, '2026-11-20T23:59:00');
  assert.equal(updatedPubB.submissionDeadlineMs, new Date('2026-11-20T23:59:00').getTime());
  assert.equal(isPublicationDeadlinePassed(updatedPubB, new Date('2026-11-15T00:00:00')), false);
});

// ----------------------------------------------------------------------------
// Scenario 12: Historical preservation of submissions and assignments
// ----------------------------------------------------------------------------
test('Scenario 12: Historical preservation of submissions and assignments after archival or deadline pass', async () => {
  const store = new MockLifecycleStore();

  const pubDoc: SchedulePublication = {
    ...publishedPublication,
    id: 'pub-nov-completed',
    status: 'published',
    submittedMembers: ['mem-101', 'mem-102']
  };

  const scheduleDoc: Schedule = {
    id: 'sched-nov-08-0730',
    publicationId: 'pub-nov-completed',
    title: 'Sunday Mass',
    date: '2026-11-08',
    startTime: '07:30',
    endTime: '08:30',
    status: 'completed',
    assignedMembers: ['mem-101'],
    attendanceFinalized: true,
    attendanceSessionFinalized: true,
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const approvedSubmission = {
    id: 'pub-nov-completed_mem-101',
    publicationId: 'pub-nov-completed',
    memberId: 'mem-101',
    status: 'approved',
    requestedScheduleIds: ['sched-nov-08-0730'],
    reviewedBy: 'coordinator@mats.org'
  };

  store.setDoc('schedulePublications', pubDoc.id, pubDoc);
  store.setDoc('schedules', scheduleDoc.id, scheduleDoc);
  store.setDoc('scheduleSubmissions', approvedSubmission.id, approvedSubmission);

  // Publication transitions to archived
  await publicationService.updatePublicationStatus(pubDoc.id, 'archived', authorizedAdmin, store.createFirestoreInstance());

  const archivedPub = store.getDoc('schedulePublications', pubDoc.id);
  const preservedSchedule = store.getDoc('schedules', scheduleDoc.id);
  const preservedSubmission = store.getDoc('scheduleSubmissions', approvedSubmission.id);

  // Status is archived
  assert.equal(archivedPub.status, 'archived');
  // Schedule assignments and attendance remain strictly preserved
  assert.deepEqual(preservedSchedule.assignedMembers, ['mem-101']);
  assert.equal(preservedSchedule.attendanceFinalized, true);
  // Submission record remains preserved with approved status
  assert.equal(preservedSubmission.status, 'approved');
  assert.equal(preservedSubmission.memberId, 'mem-101');
});

// ----------------------------------------------------------------------------
// Scenario 13: Transactional status precondition validation and field preservation
// ----------------------------------------------------------------------------
test('Scenario 13: Transactional status preconditions and field preservation', async () => {
  const store = new MockLifecycleStore();
  const db = store.createFirestoreInstance();

  const basePub: SchedulePublication = {
    ...publishedPublication,
    id: 'pub-lifecycle-preconditions',
    status: 'archived',
    description: 'Special preservation test description',
    maxSundaysPerServer: 3,
    allowedRanks: ['Chevaliers'],
    submissionDeadline: '2026-10-15T23:59:00',
    submissionDeadlineMs: new Date('2026-10-15T23:59:00').getTime()
  };
  store.setDoc('schedulePublications', basePub.id, basePub);

  // 1. Cannot extend deadline on an archived publication without reopening first
  await assert.rejects(
    async () => {
      await publicationService.extendPublicationDeadline(
        basePub.id,
        '2026-11-30T23:59:00',
        authorizedAdmin,
        'Try extend archived',
        db
      );
    },
    /Cannot extend deadline on an archived publication without reopening first/
  );

  // 2. Cannot close submissions on an archived publication
  await assert.rejects(
    async () => {
      await publicationService.closeSubmissionsEarly(
        basePub.id,
        authorizedAdmin,
        'Try close archived',
        db
      );
    },
    /Cannot close submissions on an archived publication/
  );

  // 3. Reopening with past date is rejected
  await assert.rejects(
    async () => {
      await publicationService.reopenPublication(
        basePub.id,
        '2020-01-01T00:00:00',
        authorizedAdmin,
        'Past date',
        db
      );
    },
    /Reopened deadline must be in the future/
  );

  // 4. Reopening with valid future date succeeds and strictly preserves all unrelated fields
  const validFutureDeadline = '2099-12-31T23:59:00';
  await publicationService.reopenPublication(
    basePub.id,
    validFutureDeadline,
    authorizedAdmin,
    'Reopened cleanly',
    db
  );

  const reopenedPub = store.getDoc('schedulePublications', basePub.id);
  assert.equal(reopenedPub.status, 'published');
  assert.equal(reopenedPub.submissionDeadline, validFutureDeadline);
  // Preserved fields
  assert.equal(reopenedPub.description, 'Special preservation test description');
  assert.equal(reopenedPub.maxSundaysPerServer, 3);
  assert.deepEqual(reopenedPub.allowedRanks, ['Chevaliers']);

  // 5. Cannot close submissions on a draft publication
  const draftPub: SchedulePublication = {
    ...basePub,
    id: 'pub-draft-test',
    status: 'draft'
  };
  store.setDoc('schedulePublications', draftPub.id, draftPub);

  await assert.rejects(
    async () => {
      await publicationService.closeSubmissionsEarly(
        draftPub.id,
        authorizedAdmin,
        'Try close draft',
        db
      );
    },
    /Cannot close submissions on non-published publication/
  );
});

// ----------------------------------------------------------------------------
// Scenario 14: Concurrent administrative status/deadline updates conflict resolution
// ----------------------------------------------------------------------------
test('Scenario 14: Concurrent administration deadline updates do not silently overwrite', async () => {
  const store = new MockLifecycleStore();
  const db = store.createFirestoreInstance();

  const pub: SchedulePublication = {
    ...publishedPublication,
    id: 'pub-concurrency-test',
    status: 'published',
    submissionDeadline: '2026-11-10T23:59:00',
    submissionDeadlineMs: new Date('2026-11-10T23:59:00').getTime()
  };
  store.setDoc('schedulePublications', pub.id, pub);

  // Simulate two concurrent admins reading at the same version:
  // Admin 1 extends to Nov 20
  // Admin 2 extends to Nov 25
  const deadline1 = '2099-11-20T23:59:00';
  const deadline2 = '2099-11-25T23:59:00';


  // Custom runner simulating race where Admin 2 starts first, Admin 1 commits in the middle
  const p1 = publicationService.extendPublicationDeadline(
    pub.id,
    deadline1,
    authorizedAdmin,
    'Admin 1 extend',
    db
  );

  // Wait for p1 to commit
  await p1;

  // Now an operation that captured the stale pre-p1 version attempts to commit
  const staleRunner = async <T>(_fn: (tx: any) => Promise<T>): Promise<T> => {
    // Simulate stale read version = 1 (before p1 incremented it to 2)
    return db.runTransaction(async (tx: any) => {
      await tx.get({ collection: 'schedulePublications', id: pub.id });
      // Mutate backing version map behind the scenes to simulate concurrent commit
      store.versionMap.set(`schedulePublications/${pub.id}`, 999);
      tx.update({ collection: 'schedulePublications', id: pub.id }, {
        submissionDeadline: deadline2,
        submissionDeadlineMs: new Date(deadline2).getTime()
      });
    });
  };

  await assert.rejects(
    async () => {
      await publicationService.extendPublicationDeadline(
        pub.id,
        deadline2,
        authorizedAdmin,
        'Admin 2 stale update',
        { db, transactionRunner: staleRunner }
      );
    },
    /Transaction conflict/
  );

  // Verify Admin 1's value is preserved and not corrupted
  const finalPub = store.getDoc('schedulePublications', pub.id);
  assert.equal(finalPub.submissionDeadline, deadline1);
});
