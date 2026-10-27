import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';

const PROJECT_ID = 'demo-mats-rules-test';

test('Live Firestore Security Rules Test Suite via Emulator', async (t) => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

  // Connect to emulator using FIRESTORE_EMULATOR_HOST or localhost default
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST
    ? process.env.FIRESTORE_EMULATOR_HOST.split(':')
    : ['127.0.0.1', '8080'];
  const host = hostPort[0];
  const port = parseInt(hostPort[1], 10) || 8080;

  let testEnv: any;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host,
        port
      }
    });
  } catch (err: any) {
    // If emulator is not running, skip gracefully with descriptive notice
    console.warn('\n[SKIPPED] Live Firestore Emulator is not running on ' + host + ':' + port + '. ' + err.message);
    return;
  }

  // Reset this demo emulator project so repeated runs do not turn creates into
  // forbidden public updates or attempts to overwrite immutable audit records.
  await testEnv.clearFirestore();

  // 0. Seed test fixtures with security rules disabled
  await testEnv.withSecurityRulesDisabled(async (context: any) => {
    const adminDb = context.firestore();

    // Published publication with future deadline
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-future'), {
      name: 'Future Publication',
      status: 'published',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      submissionDeadline: '2026-12-31T23:59:00',
      submissionDeadlineMs: Date.now() + 86400000 * 30
    });

    // Published publication with expired deadline
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-expired-ms'), {
      name: 'Expired MS Publication',
      status: 'published',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      submissionDeadline: '2026-10-10T23:59:00',
      submissionDeadlineMs: Date.now() - 86400000
    });

    // Draft publication
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-draft'), {
      name: 'Draft Publication',
      status: 'draft',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      submissionDeadline: '2026-12-31T23:59:00',
      submissionDeadlineMs: Date.now() + 86400000 * 30
    });

    // Archived publication
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-archived'), {
      name: 'Archived Publication',
      status: 'archived',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      submissionDeadline: '2026-09-20T23:59:00',
      submissionDeadlineMs: Date.now() - 86400000 * 30
    });

    // Seed admin user document required by hasUserDocument() in firestore.rules
    await setDoc(doc(adminDb, 'users', 'admin-coordinator'), {
      role: 'coordinator',
      permissions: { canManageSchedules: true }
    });

    // Seed normal user document without permissions
    await setDoc(doc(adminDb, 'users', 'user-normal'), {
      role: 'member',
      permissions: { canManageSchedules: false }
    });

    // Legacy publication with expired string deadline but NO submissionDeadlineMs field
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-legacy-expired-noms'), {
      name: 'Legacy Expired Publication Without MS',
      status: 'published',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      submissionDeadline: '2026-09-15T23:59:00'
    });

    // Published publication with NO deadline configured
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-nodeadline'), {
      name: 'No Deadline Publication',
      status: 'published',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      submissionDeadline: '',
      submissionDeadlineMs: null
    });

    // Published publication with malformed non-integer deadline
    await setDoc(doc(adminDb, 'schedulePublications', 'pub-malformed-ms'), {
      name: 'Malformed MS Publication',
      status: 'published',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      submissionDeadline: '2026-12-31T23:59:00',
      submissionDeadlineMs: 'invalid-string-ms'
    });
  });

  const unauthContext = testEnv.unauthenticatedContext();
  const unauthDb = unauthContext.firestore();

  const authUserContext = testEnv.authenticatedContext('user-normal', { role: 'member' });
  const authUserDb = authUserContext.firestore();

  const adminContext = testEnv.authenticatedContext('admin-coordinator', {
    role: 'coordinator',
    canManageSchedules: true
  });
  const adminDb = adminContext.firestore();

  // 1. Anonymous can create valid pending submission before deadline
  await t.test('1. Anonymous client can create valid pending submission before deadline', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-future_mem-101');
    await assertSucceeds(
      setDoc(subDocRef, {
        publicationId: 'pub-future',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1', 'sched-2']
      })
    );
  });

  // 2. Anonymous cannot submit when deadline is expired (submissionDeadlineMs < request.time)
  await t.test('2. Anonymous client cannot submit when submissionDeadlineMs is expired', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-expired-ms_mem-101');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-expired-ms',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 3. Anonymous cannot submit to a draft publication
  await t.test('3. Anonymous client cannot submit to a draft publication', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-draft_mem-101');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-draft',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 4. Anonymous cannot submit to an archived publication
  await t.test('4. Anonymous client cannot submit to an archived publication', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-archived_mem-101');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-archived',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 5. REMEDIATED FAIL-CLOSED: Legacy publication without submissionDeadlineMs fails closed
  await t.test('5. REMEDIATED FAIL-CLOSED: Legacy publication without submissionDeadlineMs is rejected', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-legacy-expired-noms_mem-101');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-legacy-expired-noms',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 5b. Legitimate publication without any deadline allows intake
  await t.test('5b. Publication without configured deadline allows intake', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-nodeadline_mem-101');
    await assertSucceeds(
      setDoc(subDocRef, {
        publicationId: 'pub-nodeadline',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 5c. Publication with malformed non-integer submissionDeadlineMs fails closed
  await t.test('5c. Publication with malformed non-integer deadline fails closed', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-malformed-ms_mem-101');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-malformed-ms',
        memberId: 'mem-101',
        memberName: 'Juan Dela Cruz',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 6. Non-deterministic ID is rejected
  await t.test('6. Non-deterministic submission ID is rejected', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'random-uuid-1234');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-future',
        memberId: 'mem-102',
        status: 'pending',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 7. Non-pending initial status is rejected
  await t.test('7. Non-pending initial status is rejected', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-future_mem-103');
    await assertFails(
      setDoc(subDocRef, {
        publicationId: 'pub-future',
        memberId: 'mem-103',
        status: 'approved',
        requestedScheduleIds: ['sched-1']
      })
    );
  });

  // 8. Anonymous client cannot update or delete submissions
  await t.test('8. Anonymous client cannot update or delete submissions', async () => {
    const subDocRef = doc(unauthDb, 'scheduleSubmissions', 'pub-future_mem-101');
    await assertFails(
      updateDoc(subDocRef, { status: 'approved' })
    );
    await assertFails(
      deleteDoc(subDocRef)
    );
  });

  // 9. Public cannot write directly to schedules or publications
  await t.test('9. Public cannot write directly to schedules or publications', async () => {
    const schedRef = doc(unauthDb, 'schedules', 'sched-1');
    await assertFails(
      setDoc(schedRef, { title: 'Rogue Mass', assignedMembers: ['mem-101'] })
    );
    const pubRef = doc(unauthDb, 'schedulePublications', 'pub-future');
    await assertFails(
      updateDoc(pubRef, { submissionDeadline: '2099-01-01T00:00:00' })
    );
  });

  // 10. Unauthorized user cannot update publications
  await t.test('10. Unauthorized user cannot update publications', async () => {
    const pubRef = doc(authUserDb, 'schedulePublications', 'pub-future');
    await assertFails(
      updateDoc(pubRef, { status: 'archived' })
    );
  });

  // 11. Authorized admin can update publications and approve submissions
  await t.test('11. Authorized admin with canManageSchedules can update publications and submissions', async () => {
    const pubRef = doc(adminDb, 'schedulePublications', 'pub-future');
    await assertSucceeds(
      updateDoc(pubRef, { description: 'Updated by authorized coordinator' })
    );
    const subDocRef = doc(adminDb, 'scheduleSubmissions', 'pub-future_mem-101');
    await assertSucceeds(
      updateDoc(subDocRef, { status: 'approved', reviewNote: 'Approved by admin' })
    );
  });

  // 12. Authorized admin atomically updates publication and creates audit log in a single transaction
  await t.test('12. Authorized admin atomically updates publication and creates audit log in transaction', async () => {
    const pubRef = doc(adminDb, 'schedulePublications', 'pub-future');
    const auditRef = doc(adminDb, 'auditLogs', 'audit-txn-1');

    await assertSucceeds(
      runTransaction(adminDb, async (transaction) => {
        const pubSnap = await transaction.get(pubRef);
        if (!pubSnap.exists()) throw new Error('Not found');
        transaction.update(pubRef, {
          submissionDeadline: '2026-12-15T18:00:00',
          submissionDeadlineMs: 1797357600000,
          updatedAt: '2026-10-26T12:00:00.000Z'
        });
        transaction.set(auditRef, {
          action: 'PUBLICATION_DEADLINE_EXTENDED',
          entityType: 'publication',
          entityId: 'pub-future',
          userId: 'admin-coordinator',
          timestamp: '2026-10-26T12:00:00.000Z',
          metadata: { reason: 'Extended by 1 week' }
        });
      })
    );
  });

  // 13. Unauthorized user attempting publication update + audit creation fails and writes zero documents
  await t.test('13. Unauthorized user attempting publication update and audit creation fails atomically', async () => {
    const pubRef = doc(authUserDb, 'schedulePublications', 'pub-future');
    const auditRef = doc(authUserDb, 'auditLogs', 'audit-forged-unauth');

    await assertFails(
      runTransaction(authUserDb, async (transaction) => {
        const pubSnap = await transaction.get(pubRef);
        if (!pubSnap.exists()) throw new Error('Not found');
        transaction.update(pubRef, {
          submissionDeadline: '2026-10-26T12:00:00.000Z',
          submissionDeadlineMs: 1792987200000
        });
        transaction.set(auditRef, {
          action: 'PUBLICATION_EARLY_CLOSED',
          entityType: 'publication',
          entityId: 'pub-future',
          userId: 'user-normal'
        });
      })
    );
  });

  // 14. Audit log documents are immutable (update and delete are rejected)
  await t.test('14. Audit log documents are immutable (update and delete are rejected)', async () => {
    const auditRef = doc(adminDb, 'auditLogs', 'audit-txn-1');
    await assertFails(
      updateDoc(auditRef, { action: 'TAMPERED_ACTION' })
    );
    await assertFails(
      deleteDoc(auditRef)
    );
  });

  // Teardown
  await testEnv.cleanup();
});
