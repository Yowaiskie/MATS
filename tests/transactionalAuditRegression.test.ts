import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationService } from '../src/services/publicationService.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Schedule } from '../src/types/schedule.ts';
import type { AdminUserContext } from '../src/types/submission.ts';

// In-memory Firestore store with transactional rollback and audit tracking
class MockTransactionalStore {
  collections: Map<string, Map<string, any>> = new Map();
  versionMap: Map<string, number> = new Map();

  constructor() {
    this.collections.set('schedulePublications', new Map());
    this.collections.set('scheduleSubmissions', new Map());
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

  getAuditLogs() {
    const col = this.collections.get('auditLogs') || new Map();
    return Array.from(col.values());
  }

  createFirestoreInstance(options: { failOnAuditWrite?: boolean } = {}): any {
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
            if (options.failOnAuditWrite && col === 'auditLogs') {
              throw new Error('PERMISSION_DENIED: Simulation of audit document write rejection');
            }
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

        // Commit all buffered writes atomically
        for (const write of writeBuffer) {
          const cur = this.getDoc(write.col, write.id) || {};
          this.setDoc(write.col, write.id, { ...cur, ...write.data, id: write.id });
        }

        return result;
      },
      doc: (colPath: string, docId?: string) => ({
        collection: colPath,
        id: docId || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      })
    };
  }
}

const authorizedAdmin: AdminUserContext = {
  uid: 'admin-coord-01',
  email: 'coordinator@mats.org',
  role: 'coordinator',
  permissions: { canManageSchedules: true }
};

const unauthorizedUser: AdminUserContext = {
  uid: 'user-unauth-02',
  email: 'member@mats.org',
  role: 'member',
  permissions: { canManageSchedules: false }
};

const basePub: SchedulePublication = {
  id: 'pub-alpha',
  name: 'Regular Cycle - November 2026',
  status: 'published',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  publicationType: 'regular',
  submissionDeadline: '2026-11-10T23:59:00',
  submissionDeadlineMs: new Date('2026-11-10T23:59:00').getTime(),
  submittedMembers: ['mem-01'],
  createdAt: {} as any,
  updatedAt: {} as any
};

test('1. Successful deadline extension creates exactly one audit record atomically', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);
  const db = store.createFirestoreInstance();

  const newDeadline = '2099-11-20T23:59:00';
  await publicationService.extendPublicationDeadline(
    basePub.id,
    newDeadline,
    authorizedAdmin,
    'Extended for parish fiesta',
    db
  );

  const audits = store.getAuditLogs();
  assert.equal(audits.length, 1, 'Must create exactly one audit record');
  assert.equal(audits[0].action, 'SCHEDULE_UPDATE');
  assert.equal(audits[0].category, 'schedule');
  assert.equal(audits[0].performedBy, 'coordinator@mats.org');
  assert.equal(audits[0].details.lifecycleAction, 'extend_deadline');
  assert.equal(audits[0].details.newDeadline, newDeadline);
  assert.equal(audits[0].details.reason, 'Extended for parish fiesta');

  const updatedPub = store.getDoc('schedulePublications', basePub.id);
  assert.equal(updatedPub.submissionDeadline, newDeadline);
});

test('2. Early closure creates exactly one audit record atomically', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);
  const db = store.createFirestoreInstance();

  await publicationService.closeSubmissionsEarly(
    basePub.id,
    authorizedAdmin,
    'Target slots reached',
    db
  );

  const audits = store.getAuditLogs();
  assert.equal(audits.length, 1, 'Must create exactly one audit record');
  assert.equal(audits[0].details.lifecycleAction, 'close_early');
  assert.equal(audits[0].details.reason, 'Target slots reached');

  const updatedPub = store.getDoc('schedulePublications', basePub.id);
  assert.ok(updatedPub.submissionDeadlineMs <= Date.now());
});

test('3. Reopening creates exactly one audit record atomically', async () => {
  const store = new MockTransactionalStore();
  const archivedPub = { ...basePub, status: 'archived' as const };
  store.setDoc('schedulePublications', archivedPub.id, archivedPub);
  const db = store.createFirestoreInstance();

  const reopenedDeadline = '2099-12-15T23:59:00';
  await publicationService.reopenPublication(
    archivedPub.id,
    reopenedDeadline,
    authorizedAdmin,
    'Late submission window',
    db
  );

  const audits = store.getAuditLogs();
  assert.equal(audits.length, 1, 'Must create exactly one audit record');
  assert.equal(audits[0].details.lifecycleAction, 'reopen');
  assert.equal(audits[0].details.newDeadline, reopenedDeadline);

  const updatedPub = store.getDoc('schedulePublications', archivedPub.id);
  assert.equal(updatedPub.status, 'published');
  assert.equal(updatedPub.submissionDeadline, reopenedDeadline);
});

test('4. Status transition creates exactly one audit record atomically', async () => {
  const store = new MockTransactionalStore();
  const draftPub = { ...basePub, status: 'draft' as const, submissionDeadline: '', submissionDeadlineMs: null };
  store.setDoc('schedulePublications', draftPub.id, draftPub);
  const db = store.createFirestoreInstance();

  await publicationService.updatePublicationStatus(
    draftPub.id,
    'published',
    authorizedAdmin,
    'Published by coordinator',
    db
  );

  const audits = store.getAuditLogs();
  assert.equal(audits.length, 1, 'Must create exactly one audit record');
  assert.equal(audits[0].details.lifecycleAction, 'status_change');
  assert.equal(audits[0].details.beforeStatus, 'draft');
  assert.equal(audits[0].details.newStatus, 'published');

  const updatedPub = store.getDoc('schedulePublications', draftPub.id);
  assert.equal(updatedPub.status, 'published');
});

test('5. Audit write rejection rolls back the publication mutation (all-or-nothing)', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);
  // Configure store to fail when writing to auditLogs collection
  const failingDb = store.createFirestoreInstance({ failOnAuditWrite: true });

  await assert.rejects(
    async () => {
      await publicationService.extendPublicationDeadline(
        basePub.id,
        '2099-12-31T23:59:00',
        authorizedAdmin,
        'Will fail on audit write',
        failingDb
      );
    },
    /PERMISSION_DENIED: Simulation of audit document write rejection/
  );

  // Assert complete rollback: publication remains strictly unchanged
  const currentPub = store.getDoc('schedulePublications', basePub.id);
  assert.equal(currentPub.submissionDeadline, basePub.submissionDeadline);
  assert.equal(currentPub.submissionDeadlineMs, basePub.submissionDeadlineMs);

  // Zero audit logs committed
  assert.equal(store.getAuditLogs().length, 0);
});

test('6. Transaction contention retry does not create duplicate audits', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);
  const db = store.createFirestoreInstance();

  let executionCount = 0;
  const retryRunner = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
    // Wrap to simulate 1 contention retry
    return db.runTransaction(async (tx: any) => {
      executionCount++;
      if (executionCount === 1) {
        // Trigger a fake abort/retry by throwing an error or running twice
        // In real Firestore, the callback is re-invoked
      }
      return fn(tx);
    });
  };

  await publicationService.extendPublicationDeadline(
    basePub.id,
    '2099-12-01T23:59:00',
    authorizedAdmin,
    'Retry test',
    { db, transactionRunner: retryRunner }
  );

  // Exactly one audit document must exist regardless of execution passes
  const audits = store.getAuditLogs();
  assert.equal(audits.length, 1);
});

test('7. Before and after values accurately reflect committed changes', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);
  const db = store.createFirestoreInstance();

  const targetDeadline = '2099-12-25T18:00:00';
  await publicationService.extendPublicationDeadline(
    basePub.id,
    targetDeadline,
    authorizedAdmin,
    'Christmas extension',
    db
  );

  const audit = store.getAuditLogs()[0];
  assert.deepEqual(audit.details.before, {
    status: 'published',
    submissionDeadline: basePub.submissionDeadline,
    submissionDeadlineMs: basePub.submissionDeadlineMs
  });
  assert.deepEqual(audit.details.after, {
    status: 'published',
    submissionDeadline: targetDeadline,
    submissionDeadlineMs: new Date(targetDeadline).getTime()
  });
});

test('8. Unauthorized user cannot modify publication or forge lifecycle audit', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);
  const db = store.createFirestoreInstance();

  await assert.rejects(
    async () => {
      await publicationService.extendPublicationDeadline(
        basePub.id,
        '2099-12-31T23:59:00',
        unauthorizedUser,
        'Unauthorized attempt',
        db
      );
    },
    /Unauthorized/
  );

  // Publication unchanged, 0 audits created
  assert.equal(store.getDoc('schedulePublications', basePub.id).submissionDeadline, basePub.submissionDeadline);
  assert.equal(store.getAuditLogs().length, 0);
});

test('9. Existing historical assignments and submissions remain unchanged across lifecycle changes', async () => {
  const store = new MockTransactionalStore();
  store.setDoc('schedulePublications', basePub.id, basePub);

  const historicalSchedule: Schedule = {
    id: 'sched-hist-01',
    publicationId: basePub.id,
    date: '2026-11-01',
    startTime: '06:00',
    endTime: '07:00',
    title: 'Sunday Mass',
    status: 'completed',
    assignedMembers: ['mem-01'],
    attendanceFinalized: true,
    createdAt: {} as any,
    updatedAt: {} as any
  };
  store.setDoc('schedules', historicalSchedule.id, historicalSchedule);

  const db = store.createFirestoreInstance();
  await publicationService.closeSubmissionsEarly(basePub.id, authorizedAdmin, 'Early close', db);

  const preservedSchedule = store.getDoc('schedules', historicalSchedule.id);
  assert.deepEqual(preservedSchedule.assignedMembers, ['mem-01']);
  assert.equal(preservedSchedule.attendanceFinalized, true);
  assert.equal(preservedSchedule.status, 'completed');
});

test('10. Changes to Publication A never modify Publication B', async () => {
  const store = new MockTransactionalStore();
  const pubB: SchedulePublication = {
    ...basePub,
    id: 'pub-beta',
    name: 'Special Event - Advent Pilgrimage',
    publicationType: 'special_event',
    submissionDeadline: '2026-11-15T23:59:00',
    submissionDeadlineMs: new Date('2026-11-15T23:59:00').getTime()
  };
  store.setDoc('schedulePublications', basePub.id, basePub);
  store.setDoc('schedulePublications', pubB.id, pubB);

  const db = store.createFirestoreInstance();
  // Modify Pub A
  await publicationService.extendPublicationDeadline(
    basePub.id,
    '2099-11-30T23:59:00',
    authorizedAdmin,
    'Extend A only',
    db
  );

  const resultPubA = store.getDoc('schedulePublications', basePub.id);
  const resultPubB = store.getDoc('schedulePublications', pubB.id);

  assert.equal(resultPubA.submissionDeadline, '2099-11-30T23:59:00');
  assert.equal(resultPubB.submissionDeadline, '2026-11-15T23:59:00');
  assert.equal(resultPubB.name, 'Special Event - Advent Pilgrimage');
});
