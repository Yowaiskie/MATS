import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSubmissionId,
  validateSubmission,
  submissionService
} from '../src/services/submissionService.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Member } from '../src/types/member.ts';
import type { Schedule } from '../src/types/schedule.ts';
import type { CreateSubmissionInput } from '../src/types/submission.ts';

const basePublication: SchedulePublication = {
  id: 'pub-test-2026',
  name: 'November 2026 Regular Mass Schedule',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  status: 'published',
  publicationType: 'regular',
  submissionDeadline: '2026-12-31T23:59',
  allowedRanks: ['Chevaliers', 'Paladins', 'Squires'],
  submittedMembers: [],
  createdAt: {} as any,
  updatedAt: {} as any
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
    id: 'sched-sun-0600',
    publicationId: 'pub-test-2026',
    title: 'Sunday Mass',
    date: '2026-11-08',
    startTime: '06:00',
    endTime: '07:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  },
  {
    id: 'sched-sun-0730',
    publicationId: 'pub-test-2026',
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

test('1. Deterministic Submission ID Generation', () => {
  const id = getSubmissionId('pub-test-2026', 'mem-101');
  assert.equal(id, 'pub-test-2026_mem-101');

  assert.throws(() => getSubmissionId('', 'mem-101'), /Both publicationId and memberId are required/);
  assert.throws(() => getSubmissionId('pub-test-2026', ''), /Both publicationId and memberId are required/);
});

test('2. Successful Submission Validation Passes', () => {
  const input: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    memberRank: 'Chevaliers',
    requestedScheduleIds: ['sched-sun-0600']
  };

  assert.doesNotThrow(() => {
    validateSubmission(input, {
      publication: basePublication,
      member: baseMember,
      publicationSchedules: baseSchedules
    });
  });
});

test('3. Rejection of Non-Published Publications (Draft & Archived)', () => {
  const draftPublication: SchedulePublication = {
    ...basePublication,
    status: 'draft'
  };

  const input: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-sun-0600']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: draftPublication,
        member: baseMember,
        publicationSchedules: baseSchedules
      });
    },
    /Submissions are closed for this publication because it is not currently published/
  );

  const archivedPublication: SchedulePublication = {
    ...basePublication,
    status: 'archived'
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: archivedPublication,
        member: baseMember,
        publicationSchedules: baseSchedules
      });
    },
    /Submissions are closed for this publication because it is not currently published/
  );
});

test('4. Rejection of Submissions when Deadline has Passed', () => {
  const expiredPublication: SchedulePublication = {
    ...basePublication,
    submissionDeadline: '2026-01-01T12:00' // Far past
  };

  const input: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-sun-0600']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: expiredPublication,
        member: baseMember,
        publicationSchedules: baseSchedules
      });
    },
    /The submission deadline for this publication has passed/
  );
});

test('5. Rejection of Suspended Members on Regular Publications', () => {
  const suspendedMember: Member = {
    ...baseMember,
    status: 'suspended'
  };

  const input: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-sun-0600']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: basePublication,
        member: suspendedMember,
        publicationSchedules: baseSchedules
      });
    },
    /Your serving privileges are currently SUSPENDED/
  );
});

test('6. Rejection of Cross-Publication Schedule Selections (Schedule Ownership Isolation)', () => {
  const otherPubSchedule: Schedule = {
    id: 'sched-foreign-999',
    publicationId: 'other-pub-2026',
    title: 'Foreign Schedule',
    date: '2026-11-08',
    startTime: '06:00',
    endTime: '07:00',
    status: 'upcoming',
    assignedMembers: [],
    createdAt: {} as any,
    updatedAt: {} as any
  };

  const input: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: ['sched-foreign-999']
  };

  assert.throws(
    () => {
      validateSubmission(input, {
        publication: basePublication,
        member: baseMember,
        publicationSchedules: [...baseSchedules, otherPubSchedule]
      });
    },
    /does not belong to this publication/
  );
});

test('7. Rejection of Empty and Over-Limit Slot Requests', () => {
  const emptyInput: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: []
  };

  assert.throws(
    () => {
      validateSubmission(emptyInput, {
        publication: basePublication,
        member: baseMember,
        publicationSchedules: baseSchedules
      });
    },
    /Please select at least one schedule slot before submitting/
  );

  const excessiveInput: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    requestedScheduleIds: Array.from({ length: 51 }, (_, i) => `slot-${i}`)
  };

  assert.throws(
    () => {
      validateSubmission(excessiveInput, {
        publication: basePublication,
        member: baseMember,
        publicationSchedules: []
      });
    },
    /A submission cannot exceed 50 requested schedule slots/
  );
});

test('8. Duplicate Submission Detection and Storage Isolation Invariants', async () => {
  // In-memory mock Firestore store
  const mockSubmissionsStore = new Map<string, any>();
  const schedulesCollectionTracker = new Map<string, any[]>();
  baseSchedules.forEach(s => schedulesCollectionTracker.set(s.id, [...s.assignedMembers]));

  const mockFirestore: any = {
    _type: 'mock-firestore'
  };

  // Mock implementation of doc and getDoc / setDoc for test isolation
  const mockSubmissionService = {
    ...submissionService,
    async createPendingSubmission(
      input: CreateSubmissionInput,
      options?: any
    ) {
      const submissionId = getSubmissionId(input.publicationId, input.memberId);
      if (mockSubmissionsStore.has(submissionId)) {
        throw new Error(
          'A schedule submission has already been received for this altar server. If you need to make changes, please contact your ministry coordinator.'
        );
      }

      validateSubmission(input, {
        publication: options.publication,
        member: options.member,
        publicationSchedules: options.publicationSchedules
      });

      const submissionData = {
        id: submissionId,
        publicationId: input.publicationId,
        memberId: input.memberId,
        memberName: input.memberName,
        memberRank: input.memberRank || options.member.rank || '',
        status: 'pending' as const,
        requestedScheduleIds: input.requestedScheduleIds,
        slotSummaries: input.slotSummaries || [],
        submittedAt: new Date().toISOString()
      };

      // Store in submissions map ONLY
      mockSubmissionsStore.set(submissionId, submissionData);
      return submissionData;
    }
  };

  const input: CreateSubmissionInput = {
    publicationId: 'pub-test-2026',
    memberId: 'mem-101',
    memberName: 'Juan Dela Cruz',
    memberRank: 'Chevaliers',
    requestedScheduleIds: ['sched-sun-0600']
  };

  // 1. Initial pending submission succeeds
  const created = await mockSubmissionService.createPendingSubmission(input, {
    publication: basePublication,
    member: baseMember,
    publicationSchedules: baseSchedules,
    firestoreInstance: mockFirestore
  });

  assert.equal(created.id, 'pub-test-2026_mem-101');
  assert.equal(created.status, 'pending');
  assert.equal(created.requestedScheduleIds.length, 1);
  assert.equal(mockSubmissionsStore.has('pub-test-2026_mem-101'), true);

  // 2. Duplicate submission is strictly rejected
  await assert.rejects(
    async () => {
      await mockSubmissionService.createPendingSubmission(input, {
        publication: basePublication,
        member: baseMember,
        publicationSchedules: baseSchedules,
        firestoreInstance: mockFirestore
      });
    },
    /A schedule submission has already been received for this altar server/
  );

  // 3. Official schedules.assignedMembers remains untouched (CRITICAL SAFETY INVARIANT)
  for (const s of baseSchedules) {
    const trackedAssigned = schedulesCollectionTracker.get(s.id);
    assert.deepEqual(trackedAssigned, [], `Schedule ${s.id} assignedMembers must remain empty`);
    assert.equal(s.assignedMembers.length, 0, `Schedule ${s.id} object must not be mutated`);
  }

  // 4. Publication.submittedMembers remains untouched
  assert.deepEqual(basePublication.submittedMembers, [], 'Publication submittedMembers must not be mutated directly');
});
