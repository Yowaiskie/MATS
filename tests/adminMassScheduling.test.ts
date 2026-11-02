import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleService } from '../src/services/scheduleService.ts';
import { getParishTodayDate } from '../src/utils/scheduleUtils.ts';
import { SubmissionError } from '../src/types/submission.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Member } from '../src/types/member.ts';
import type { Schedule } from '../src/types/schedule.ts';

const addDaysToYmd = (ymd: string, deltaDays: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
};

const nextSundayAtLeastDaysAhead = (ymd: string, minDaysAhead: number): string => {
  const candidate = addDaysToYmd(ymd, minDaysAhead);
  const [y, m, d] = candidate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const offsetToSunday = (7 - dow) % 7;
  return addDaysToYmd(candidate, offsetToSunday);
};

// Dynamic dates relative to current parish date so tests stay deterministic as calendar dates advance
const TODAY_YMD = getParishTodayDate();
const PAST_START = addDaysToYmd(TODAY_YMD, -30);
const PAST_DATE_1 = addDaysToYmd(TODAY_YMD, -15);
const FUTURE_START = nextSundayAtLeastDaysAhead(TODAY_YMD, 7);
const FUTURE_DATE_1 = FUTURE_START;
const FUTURE_DATE_2 = addDaysToYmd(FUTURE_START, 7);
const FUTURE_DATE_3 = addDaysToYmd(FUTURE_START, 14);
const FUTURE_END = addDaysToYmd(FUTURE_START, 60);

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

      const result = await fn(transaction);

      // Verify versions haven't changed
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

  getMockFirestore() {
    return {
      doc: (collectionName: string, id: string) => ({
        collection: collectionName,
        id
      })
    };
  }
}

// Test fixtures
const createFixturePublication = (overrides: Partial<SchedulePublication> = {}): SchedulePublication => ({
  id: 'pub_regular_cycle',
  name: 'Upcoming Bi-Monthly Regular Schedule',
  publicationType: 'regular_cycle',
  startDate: FUTURE_START,
  endDate: FUTURE_END,
  status: 'published',
  maxServersPerSundaySlot: 5,
  maxServersPerWeekdaySlot: 5,
  maxServersPerSpecialSlot: 6,
  allowedRanks: ['Chevaliers', 'Paladins', 'Squires'],
  submittedMembers: [],
  ...overrides
});

const createFixtureMember = (id: string, overrides: Partial<Member> = {}): Member => ({
  id,
  firstName: `Server`,
  lastName: id,
  rank: 'Chevaliers',
  order: 'Knight',
  status: 'active',
  ...overrides
});

const createFixtureSchedule = (id: string, date: string, overrides: Partial<Schedule> = {}): Schedule => ({
  id,
  publicationId: 'pub_regular_cycle',
  title: 'Sunday Mass',
  date,
  startTime: '06:00',
  endTime: '07:00',
  assignedMembers: [],
  targetCapacity: 5,
  ...overrides
});

test('Admin Mass Scheduling Mode Suite', async (t) => {
  await t.test('1. Authorization: Unauthenticated or non-permitted accounts are rejected with PERMISSION_DENIED', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication();
    store.setDoc('schedulePublications', pub.id, pub);

    const sched = createFixtureSchedule('sched_1', FUTURE_DATE_1);
    store.setDoc('schedules', sched.id, sched);

    const mem = createFixtureMember('mem_1');
    store.setDoc('members', mem.id, mem);

    // Call without canManageSchedules permission
    await assert.rejects(
      async () => {
        await scheduleService.adminAssignMembersToMassPattern(
          pub.id,
          [sched.id],
          [mem.id],
          {
            effectiveDate: FUTURE_START,
            adminUser: {
              uid: 'user_anonymous',
              role: 'member',
              permissions: { canManageSchedules: false }
            },
            firestoreInstance: store.getMockFirestore(),
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

  await t.test('2. Successful assignment: Authorized admin assigns Server 1..N to recurring future occurrences', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication();
    store.setDoc('schedulePublications', pub.id, pub);

    // 3 recurring future occurrences
    const sched1 = createFixtureSchedule('sched_1', FUTURE_DATE_1);
    const sched2 = createFixtureSchedule('sched_2', FUTURE_DATE_2);
    const sched3 = createFixtureSchedule('sched_3', FUTURE_DATE_3);
    store.setDoc('schedules', sched1.id, sched1);
    store.setDoc('schedules', sched2.id, sched2);
    store.setDoc('schedules', sched3.id, sched3);

    const m1 = createFixtureMember('mem_1');
    const m2 = createFixtureMember('mem_2');
    const m3 = createFixtureMember('mem_3');
    store.setDoc('members', m1.id, m1);
    store.setDoc('members', m2.id, m2);
    store.setDoc('members', m3.id, m3);

    const result = await scheduleService.adminAssignMembersToMassPattern(
      pub.id,
      [sched1.id, sched2.id, sched3.id],
      [m1.id, m2.id, m3.id],
      {
        effectiveDate: FUTURE_START,
        adminUser: {
          uid: 'admin_1',
          role: 'admin',
          permissions: { canManageSchedules: true }
        },
        firestoreInstance: store.getMockFirestore(),
        transactionRunner: store.createTransactionRunner()
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.updatedFutureSchedulesCount, 3);
    assert.equal(result.preservedHistoricalSchedulesCount, 0);

    // Verify all 3 future occurrences have the assigned members
    const updated1 = store.getDoc('schedules', sched1.id);
    const updated2 = store.getDoc('schedules', sched2.id);
    const updated3 = store.getDoc('schedules', sched3.id);
    assert.deepEqual(updated1.assignedMembers, ['mem_1', 'mem_2', 'mem_3']);
    assert.deepEqual(updated2.assignedMembers, ['mem_1', 'mem_2', 'mem_3']);
    assert.deepEqual(updated3.assignedMembers, ['mem_1', 'mem_2', 'mem_3']);

    // Verify publication submittedMembers was synchronized
    const updatedPub = store.getDoc('schedulePublications', pub.id);
    assert.ok(updatedPub.submittedMembers.includes('mem_1'));
    assert.ok(updatedPub.submittedMembers.includes('mem_2'));
    assert.ok(updatedPub.submittedMembers.includes('mem_3'));
  });

  await t.test('3. Duplicate prevention: Duplicate member in the same Mass slot is rejected with INVALID_STATUS', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication();
    store.setDoc('schedulePublications', pub.id, pub);

    const sched = createFixtureSchedule('sched_1', FUTURE_DATE_1);
    store.setDoc('schedules', sched.id, sched);

    const m1 = createFixtureMember('mem_1');
    store.setDoc('members', m1.id, m1);

    await assert.rejects(
      async () => {
        await scheduleService.adminAssignMembersToMassPattern(
          pub.id,
          [sched.id],
          ['mem_1', 'mem_1'], // Duplicate
          {
            effectiveDate: FUTURE_START,
            adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
            firestoreInstance: store.getMockFirestore(),
            transactionRunner: store.createTransactionRunner()
          }
        );
      },
      (err: any) => {
        assert.ok(err instanceof SubmissionError);
        assert.equal(err.code, 'INVALID_STATUS');
        assert.match(err.message, /Duplicate member detected/);
        return true;
      }
    );
  });

  await t.test('4. Historical and finalized preservation: Past or locked schedules are NOT modified', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication({ startDate: PAST_START, endDate: FUTURE_END });
    store.setDoc('schedulePublications', pub.id, pub);

    // Sched 1 is past with original members
    const pastSched = createFixtureSchedule('sched_past', PAST_DATE_1, {
      assignedMembers: ['mem_original_1', 'mem_original_2']
    });
    // Sched 2 is locked/finalized
    const lockedSched = createFixtureSchedule('sched_locked', FUTURE_DATE_2, {
      assignedMembers: ['mem_original_locked'],
      status: 'finalized'
    });
    // Sched 3 is future
    const futureSched = createFixtureSchedule('sched_future', FUTURE_DATE_3, {
      assignedMembers: ['mem_old']
    });

    store.setDoc('schedules', pastSched.id, pastSched);
    store.setDoc('schedules', lockedSched.id, lockedSched);
    store.setDoc('schedules', futureSched.id, futureSched);

    const mNew1 = createFixtureMember('mem_new_1');
    const mNew2 = createFixtureMember('mem_new_2');
    store.setDoc('members', mNew1.id, mNew1);
    store.setDoc('members', mNew2.id, mNew2);

    const result = await scheduleService.adminAssignMembersToMassPattern(
      pub.id,
      [pastSched.id, lockedSched.id, futureSched.id],
      [mNew1.id, mNew2.id],
      {
        effectiveDate: FUTURE_START,
        adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
        firestoreInstance: store.getMockFirestore(),
        transactionRunner: store.createTransactionRunner()
      }
    );

    assert.equal(result.preservedHistoricalSchedulesCount, 2); // Past & locked preserved!
    assert.equal(result.updatedFutureSchedulesCount, 1); // Only future updated!

    // Past schedule remains 100% untouched
    const storedPast = store.getDoc('schedules', pastSched.id);
    assert.deepEqual(storedPast.assignedMembers, ['mem_original_1', 'mem_original_2']);

    // Locked schedule remains 100% untouched
    const storedLocked = store.getDoc('schedules', lockedSched.id);
    assert.deepEqual(storedLocked.assignedMembers, ['mem_original_locked']);

    // Future schedule received the new roster
    const storedFuture = store.getDoc('schedules', futureSched.id);
    assert.deepEqual(storedFuture.assignedMembers, ['mem_new_1', 'mem_new_2']);
  });

  await t.test('5. Slot capacity limit: Exceeding max servers per slot throws SLOT_FULL', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication({ maxServersPerSundaySlot: 2 });
    store.setDoc('schedulePublications', pub.id, pub);

    const sched = createFixtureSchedule('sched_1', FUTURE_DATE_1);
    store.setDoc('schedules', sched.id, sched);

    const m1 = createFixtureMember('mem_1');
    const m2 = createFixtureMember('mem_2');
    const m3 = createFixtureMember('mem_3');
    store.setDoc('members', m1.id, m1);
    store.setDoc('members', m2.id, m2);
    store.setDoc('members', m3.id, m3);

    await assert.rejects(
      async () => {
        await scheduleService.adminAssignMembersToMassPattern(
          pub.id,
          [sched.id],
          ['mem_1', 'mem_2', 'mem_3'], // 3 members > limit of 2
          {
            effectiveDate: FUTURE_START,
            adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
            firestoreInstance: store.getMockFirestore(),
            transactionRunner: store.createTransactionRunner()
          }
        );
      },
      (err: any) => {
        assert.ok(err instanceof SubmissionError);
        assert.equal(err.code, 'SLOT_FULL');
        assert.match(err.message, /exceed maximum capacity/);
        return true;
      }
    );
  });

  await t.test('6. Rank eligibility: Suspended server on regular publication is rejected with MEMBER_INELIGIBLE', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication({ publicationType: 'regular_cycle' });
    store.setDoc('schedulePublications', pub.id, pub);

    const sched = createFixtureSchedule('sched_1', FUTURE_DATE_1);
    store.setDoc('schedules', sched.id, sched);

    const suspendedMember = createFixtureMember('mem_susp', { status: 'suspended' });
    store.setDoc('members', suspendedMember.id, suspendedMember);

    await assert.rejects(
      async () => {
        await scheduleService.adminAssignMembersToMassPattern(
          pub.id,
          [sched.id],
          ['mem_susp'],
          {
            effectiveDate: FUTURE_START,
            adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
            firestoreInstance: store.getMockFirestore(),
            transactionRunner: store.createTransactionRunner()
          }
        );
      },
      (err: any) => {
        assert.ok(err instanceof SubmissionError);
        assert.equal(err.code, 'MEMBER_INELIGIBLE');
        assert.match(err.message, /currently suspended/);
        return true;
      }
    );
  });

  await t.test('7. Publication isolation: Reject schedule belonging to another publication', async () => {
    const store = new MockFirestoreStore();
    const pubA = createFixturePublication({ id: 'pub_A' });
    store.setDoc('schedulePublications', pubA.id, pubA);

    // Schedule belongs to pub_B
    const foreignSched = createFixtureSchedule('sched_other', FUTURE_DATE_1, { publicationId: 'pub_B' });
    store.setDoc('schedules', foreignSched.id, foreignSched);

    const m1 = createFixtureMember('mem_1');
    store.setDoc('members', m1.id, m1);

    await assert.rejects(
      async () => {
        await scheduleService.adminAssignMembersToMassPattern(
          pubA.id,
          [foreignSched.id],
          ['mem_1'],
          {
            effectiveDate: FUTURE_START,
            adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
            firestoreInstance: store.getMockFirestore(),
            transactionRunner: store.createTransactionRunner()
          }
        );
      },
      (err: any) => {
        assert.ok(err instanceof SubmissionError);
        assert.equal(err.code, 'INVALID_STATUS');
        assert.match(err.message, /belongs to publication/);
        return true;
      }
    );
  });

  await t.test('8. Archived publication rejection: Cannot edit assignments for archived publication', async () => {
    const store = new MockFirestoreStore();
    const archivedPub = createFixturePublication({ status: 'archived' });
    store.setDoc('schedulePublications', archivedPub.id, archivedPub);

    const sched = createFixtureSchedule('sched_1', FUTURE_DATE_1);
    store.setDoc('schedules', sched.id, sched);

    const m1 = createFixtureMember('mem_1');
    store.setDoc('members', m1.id, m1);

    await assert.rejects(
      async () => {
        await scheduleService.adminAssignMembersToMassPattern(
          archivedPub.id,
          [sched.id],
          ['mem_1'],
          {
            effectiveDate: FUTURE_START,
            adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
            firestoreInstance: store.getMockFirestore(),
            transactionRunner: store.createTransactionRunner()
          }
        );
      },
      (err: any) => {
        assert.ok(err instanceof SubmissionError);
        assert.equal(err.code, 'PUBLICATION_CLOSED');
        return true;
      }
    );
  });

  await t.test('9. Clear all slots: Saving empty assignedMemberIds unassigns future occurrences', async () => {
    const store = new MockFirestoreStore();
    const pub = createFixturePublication();
    store.setDoc('schedulePublications', pub.id, pub);

    const sched = createFixtureSchedule('sched_1', FUTURE_DATE_1, {
      assignedMembers: ['mem_1', 'mem_2']
    });
    store.setDoc('schedules', sched.id, sched);

    const result = await scheduleService.adminAssignMembersToMassPattern(
      pub.id,
      [sched.id],
      [], // Empty
      {
        effectiveDate: FUTURE_START,
        adminUser: { uid: 'admin_1', role: 'admin', permissions: { canManageSchedules: true } },
        firestoreInstance: store.getMockFirestore(),
        transactionRunner: store.createTransactionRunner()
      }
    );

    assert.equal(result.success, true);
    assert.deepEqual(result.assignedMemberIds, []);
    const updated = store.getDoc('schedules', sched.id);
    assert.deepEqual(updated.assignedMembers, []);
  });
});
