import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleService } from '../src/services/scheduleService.ts';
import { validateSubmission } from '../src/services/submissionService.ts';
import { SubmissionError } from '../src/types/submission.ts';
import type { SchedulePublication } from '../src/types/publication.ts';
import type { Member } from '../src/types/member.ts';
import type { Schedule, ScheduleSelectionItem } from '../src/types/schedule.ts';
import { 
  groupSchedulesIntoPatterns, 
  isScheduleIncludedInPublication, 
  OFFICIAL_REGULAR_MASS_SLOTS
} from '../src/utils/scheduleUtils.ts';

// In-memory document store simulating Firestore
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

      for (const [key, readVer] of readVersions.entries()) {
        const currentVer = this.versionMap.get(key) || 0;
        if (currentVer !== readVer) {
          throw new Error(`Transaction contention: document ${key} was modified concurrently.`);
        }
      }

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

test('Regression 1: Configuration guarantees exactly 7 Sunday/Anticipated and 7 Weekday recurring patterns (14 total)', () => {
  const sundayAnticipatedSlots = OFFICIAL_REGULAR_MASS_SLOTS.filter(s => s.isSundayOrAnticipated);
  const weekdaySlots = OFFICIAL_REGULAR_MASS_SLOTS.filter(s => !s.isSundayOrAnticipated);

  assert.equal(OFFICIAL_REGULAR_MASS_SLOTS.length, 14, 'Total official slots must be 14');
  assert.equal(sundayAnticipatedSlots.length, 7, 'Sunday/Anticipated patterns must be exactly 7');
  assert.equal(weekdaySlots.length, 7, 'Weekday patterns must be exactly 7');

  // Verify specific slots
  assert.ok(sundayAnticipatedSlots.some(s => s.dayOfWeek === 6 && s.startTime === '18:00'), 'Saturday 6:00 PM Anticipated must be present');
  assert.ok(sundayAnticipatedSlots.some(s => s.dayOfWeek === 0 && s.startTime === '07:30'), 'Sunday 7:30 AM must be present');
  assert.ok(sundayAnticipatedSlots.some(s => s.dayOfWeek === 0 && s.startTime === '09:00'), 'Sunday 9:00 AM must be present');
  assert.ok(weekdaySlots.some(s => s.dayOfWeek === 3 && s.startTime === '18:00'), 'Wednesday 6:00 PM must be present');
  assert.ok(weekdaySlots.some(s => s.dayOfWeek === 5 && s.startTime === '18:00'), 'Friday 6:00 PM must be present');
});

test('Regression 2: Public Schedule Selection groups multiple calendar weeks into single recurring columns without duplicated columns', () => {
  // Simulate 4 weeks of Sunday Masses in November 2026 (Nov 1, 8, 15, 22, 29)
  const novemberSundays = ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'];
  const publication: SchedulePublication = {
    id: 'pub-nov-2026',
    name: 'November 2026 Regular Mass Schedule',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    publicationType: 'regular',
    status: 'published'
  } as any;

  const schedules: Schedule[] = [];
  novemberSundays.forEach((date, weekIdx) => {
    schedules.push({
      id: `sched-sun-0730-w${weekIdx + 1}`,
      title: 'Sunday Mass',
      date,
      startTime: '07:30',
      endTime: '08:30',
      publicationId: publication.id,
      assignedMembers: []
    } as any);

    schedules.push({
      id: `sched-sun-0900-w${weekIdx + 1}`,
      title: 'Sunday Mass',
      date,
      startTime: '09:00',
      endTime: '10:00',
      publicationId: publication.id,
      assignedMembers: []
    } as any);
  });

  const { sundayPatterns, weekdayPatterns, specialPatterns } = groupSchedulesIntoPatterns(schedules, publication);

  // Must collapse 10 individual schedule records across 5 weeks into exactly 2 recurring pattern columns
  assert.equal(sundayPatterns.length, 2, 'Must have exactly 2 recurring Sunday pattern columns (07:30 and 09:00)');
  assert.equal(weekdayPatterns.length, 0);
  assert.equal(specialPatterns.length, 0);

  const p0730 = sundayPatterns.find(p => p.startTime === '07:30')!;
  const p0900 = sundayPatterns.find(p => p.startTime === '09:00')!;

  assert.equal(p0730.scheduleIds.length, 5, '07:30 column must group all 5 Sunday occurrences');
  assert.equal(p0900.scheduleIds.length, 5, '09:00 column must group all 5 Sunday occurrences');
});

test('Regression 3: Overlapping September-October Regular and October Rosary Month publications are strictly isolated', () => {
  const regularPublication: SchedulePublication = {
    id: 'pub-regular-sep-oct',
    name: 'September - October 2026 Regular Mass',
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    publicationType: 'regular',
    status: 'published'
  } as any;

  const rosaryPublication: SchedulePublication = {
    id: 'pub-special-rosary-oct',
    name: 'October 2026 Rosary Month Special Events',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    publicationType: 'special_event',
    enableStreetLocation: true,
    status: 'published'
  } as any;

  // Regular schedules in October
  const regularSundayOct04: Schedule = {
    id: 'sched-regular-sun-oct04',
    title: 'Sunday Mass',
    date: '2026-10-04',
    startTime: '07:30',
    endTime: '08:30',
    publicationId: 'pub-regular-sep-oct'
  } as any;

  // Special Rosary schedule on the same day in October
  const rosaryOct04: Schedule = {
    id: 'sched-rosary-sun-oct04',
    title: 'Holy Rosary & Street Mass',
    date: '2026-10-04',
    startTime: '17:30',
    endTime: '19:00',
    location: 'Zone 4 Chapel',
    publicationId: 'pub-special-rosary-oct'
  } as any;

  // 1. Check schedule inclusion
  assert.ok(isScheduleIncludedInPublication(regularSundayOct04, regularPublication), 'Regular schedule is included in Regular publication');
  assert.equal(isScheduleIncludedInPublication(regularSundayOct04, rosaryPublication), false, 'Regular schedule CANNOT leak into Rosary publication');

  assert.ok(isScheduleIncludedInPublication(rosaryOct04, rosaryPublication), 'Rosary schedule is included in Rosary publication');
  assert.equal(isScheduleIncludedInPublication(rosaryOct04, regularPublication), false, 'Rosary schedule CANNOT leak into Regular publication');

  // 2. Check pattern grouping isolation
  const allOctSchedules = [regularSundayOct04, rosaryOct04];

  const regularPatterns = groupSchedulesIntoPatterns(
    allOctSchedules.filter(s => isScheduleIncludedInPublication(s, regularPublication)),
    regularPublication
  );
  assert.equal(regularPatterns.sundayPatterns.length, 1);
  assert.equal(regularPatterns.sundayPatterns[0].id, '0-07:30');
  assert.equal(regularPatterns.specialPatterns.length, 0, 'No special patterns in regular publication');

  const rosaryPatterns = groupSchedulesIntoPatterns(
    allOctSchedules.filter(s => isScheduleIncludedInPublication(s, rosaryPublication)),
    rosaryPublication
  );
  assert.equal(rosaryPatterns.sundayPatterns.length, 0);
  assert.equal(rosaryPatterns.weekdayPatterns.length, 0);
  assert.equal(rosaryPatterns.specialPatterns.length, 1, 'Rosary publication groups into specialPatterns');
  assert.equal(rosaryPatterns.specialPatterns[0].id, 'sched-rosary-sun-oct04');
});

test('Regression 4: Cross-publication assignment injection in public intake is strictly rejected', () => {
  const regularPublication: SchedulePublication = {
    id: 'pub-regular-sep-oct',
    name: 'September - October 2026 Regular Mass',
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    publicationType: 'regular',
    status: 'published'
  } as any;

  const member: Member = {
    id: 'mem-1',
    firstName: 'Jose',
    lastName: 'Rizal',
    rank: 'Knight of the Altar',
    status: 'active'
  } as any;

  const validSched: Schedule = {
    id: 'sched-reg-1',
    title: 'Sunday Mass',
    date: '2026-10-04',
    startTime: '07:30',
    publicationId: 'pub-regular-sep-oct'
  } as any;

  const foreignSched: Schedule = {
    id: 'sched-foreign-rosary',
    title: 'Holy Rosary',
    date: '2026-10-04',
    startTime: '17:30',
    publicationId: 'pub-special-rosary-oct' // BELONGS TO ANOTHER PUBLICATION!
  } as any;

  // Member attempts to submit valid schedule + foreign schedule to regular publication
  assert.throws(
    () => {
      validateSubmission(
        {
          publicationId: regularPublication.id,
          memberId: member.id,
          requestedScheduleIds: [validSched.id, foreignSched.id]
        },
        {
          publication: regularPublication,
          member,
          publicationSchedules: [validSched, foreignSched]
        }
      );
    },
    /does not belong to this publication/
  );
});

test('Regression 5: All 61 TEST daily schedules are completely excluded from recurring Mass grids', () => {
  const publication: SchedulePublication = {
    id: 'pub-regular-nov-2026',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    publicationType: 'regular',
    status: 'published'
  } as any;

  // Generate 61 daily TEST schedules (simulating the defect)
  const testSchedules: Schedule[] = [];
  for (let d = 1; d <= 30; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    testSchedules.push({
      id: `sched-test-slot-1800-${dayStr}`,
      title: 'TEST',
      date: `2026-11-${dayStr}`,
      startTime: '18:00',
      endTime: '19:00',
      publicationId: publication.id,
      assignedMembers: []
    } as any);

    if (d <= 31) {
      testSchedules.push({
        id: `sched-test-slot-0600-${dayStr}`,
        title: 'TEST - Daily Practice',
        date: `2026-11-${dayStr}`,
        startTime: '06:00',
        endTime: '07:00',
        publicationId: publication.id,
        assignedMembers: []
      } as any);
    }
  }

  // Also include genuine Sunday Mass and Wednesday 18:00 Mass
  const genuineSunday730: Schedule = {
    id: 'sched-genuine-sun-0730',
    title: 'Sunday Mass',
    date: '2026-11-01',
    startTime: '07:30',
    endTime: '08:30',
    publicationId: publication.id,
    assignedMembers: []
  } as any;

  const genuineWed1800: Schedule = {
    id: 'sched-genuine-wed-1800',
    title: 'Wednesday Mass',
    category: 'mass_weekday',
    date: '2026-11-04',
    startTime: '18:00',
    endTime: '19:00',
    publicationId: publication.id,
    assignedMembers: []
  } as any;

  const combined = [...testSchedules, genuineSunday730, genuineWed1800];

  const { sundayPatterns, weekdayPatterns, specialPatterns } = groupSchedulesIntoPatterns(combined, publication);

  // Exactly two genuine patterns should appear; ZERO test schedules
  assert.equal(sundayPatterns.length, 1, 'Only genuine Sunday 7:30 should be in sundayPatterns');
  assert.equal(sundayPatterns[0].startTime, '07:30');

  assert.equal(weekdayPatterns.length, 1, 'Only genuine Wednesday 18:00 should be in weekdayPatterns');
  assert.equal(weekdayPatterns[0].startTime, '18:00');
  assert.equal(weekdayPatterns[0].dayOfWeek, 3);

  assert.equal(specialPatterns.length, 0, 'No test schedules leaked into specialPatterns');
});

test('Regression 6: Admin approval and Effective-Dated edit cannot modify foreign publication schedules', async () => {
  const store = new MockFirestoreStore();

  const pubA: SchedulePublication = {
    id: 'pub-a',
    name: 'Publication A',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    publicationType: 'regular',
    status: 'published'
  } as any;
  store.setDoc('schedulePublications', pubA.id, pubA);

  const member: Member = {
    id: 'mem-1',
    firstName: 'Juan',
    lastName: 'Luna',
    rank: 'Knight of the Altar',
    status: 'active'
  } as any;
  store.setDoc('members', member.id, member);

  const foreignSchedule: Schedule = {
    id: 'sched-pub-b',
    title: 'Sunday Mass',
    date: '2026-11-08',
    startTime: '09:00',
    endTime: '10:00',
    publicationId: 'pub-b', // Belongs to Publication B!
    assignedMembers: ['mem-original']
  } as any;
  store.setDoc('schedules', foreignSchedule.id, foreignSchedule);

  const selections: ScheduleSelectionItem[] = [
    { scheduleId: foreignSchedule.id, isSelected: true }
  ];

  // Admin tries to update Member in Publication A targeting foreign schedule
  await assert.rejects(
    async () => {
      await scheduleService.adminUpdateMemberPublicationSchedulesEffectiveDated(
        pubA.id,
        member.id,
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

  // Foreign schedule remains completely untouched
  const untouchedSched = store.getDoc('schedules', foreignSchedule.id);
  assert.deepEqual(untouchedSched.assignedMembers, ['mem-original']);
});
