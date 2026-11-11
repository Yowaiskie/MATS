import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_REGULAR_MASS_SLOTS,
  isOfficialRegularMassSlot,
  isSundayOrAnticipatedMass,
  isScheduleIncludedInPublication,
  isHistoricalScheduleOccurrence,
  isCorruptedLegacyTestSchedule,
  isBaptismSchedule,
  groupSchedulesIntoPatterns
} from '../src/utils/scheduleUtils.ts';
import type { Schedule, ScheduleTemplate } from '../src/types/schedule.ts';
import type { SchedulePublication } from '../src/types/publication.ts';

test('1. Official Regular Mass templates configuration contains 14 slots', () => {
  assert.equal(OFFICIAL_REGULAR_MASS_SLOTS.length, 14);
  const sunAnticipated = OFFICIAL_REGULAR_MASS_SLOTS.filter(s => s.isSundayOrAnticipated);
  const weekday = OFFICIAL_REGULAR_MASS_SLOTS.filter(s => !s.isSundayOrAnticipated);
  assert.equal(sunAnticipated.length, 7, 'Must have 7 Sunday/Anticipated slots');
  assert.equal(weekday.length, 7, 'Must have 7 Weekday slots');
});

test('2. Only configured official weekday Mass times are recognized', () => {
  // Monday (1), Tuesday (2), Thursday (4) 18:00 must be rejected
  assert.equal(isOfficialRegularMassSlot(1, '18:00'), false, 'Monday 6pm is not official');
  assert.equal(isOfficialRegularMassSlot(2, '18:00'), false, 'Tuesday 6pm is not official');
  assert.equal(isOfficialRegularMassSlot(4, '18:00'), false, 'Thursday 6pm is not official');

  // Wednesday (3) and Friday (5) 18:00 must be recognized
  assert.equal(isOfficialRegularMassSlot(3, '18:00'), true, 'Wednesday 6pm is official');
  assert.equal(isOfficialRegularMassSlot(5, '18:00'), true, 'Friday 6pm is official');

  // Daily 06:00 Mass for Mon-Fri must be recognized
  for (let d = 1; d <= 5; d++) {
    assert.equal(isOfficialRegularMassSlot(d, '06:00'), true, `Day ${d} 6am is official`);
  }
});

test('3. isScheduleIncludedInPublication enforces strict publicationId ownership', () => {
  const pubA = { id: 'pub-A', startDate: '2026-11-01', endDate: '2026-11-30', publicationType: 'regular' as const };
  const pubB = { id: 'pub-B', startDate: '2026-11-01', endDate: '2026-11-30', publicationType: 'regular' as const };

  const schedA = { id: 's-A', publicationId: 'pub-A', date: '2026-11-15', startTime: '06:00', title: 'Sunday Mass', status: 'upcoming' as const };
  const schedB = { id: 's-B', publicationId: 'pub-B', date: '2026-11-15', startTime: '06:00', title: 'Sunday Mass', status: 'upcoming' as const };

  assert.equal(isScheduleIncludedInPublication(schedA, pubA), true);
  assert.equal(isScheduleIncludedInPublication(schedA, pubB), false, 'Pub B must NOT include sched A');
  assert.equal(isScheduleIncludedInPublication(schedB, pubA), false, 'Pub A must NOT include sched B');
  assert.equal(isScheduleIncludedInPublication(schedB, pubB), true);
});

test('4. isScheduleIncludedInPublication isolates Regular and Special Event publications with overlapping dates', () => {
  const pubRegular = { id: 'pub-reg', startDate: '2026-11-01', endDate: '2026-11-30', publicationType: 'regular' as const };
  const pubSpecial = { id: 'pub-spec', startDate: '2026-11-01', endDate: '2026-11-30', publicationType: 'special_event' as const };

  const schedRegular = { id: 's-reg', publicationId: 'pub-reg', date: '2026-11-15', startTime: '06:00', title: 'Daily Mass', status: 'upcoming' as const };
  const schedSpecial = { id: 's-spec', publicationId: 'pub-spec', date: '2026-11-15', startTime: '17:00', title: 'Block Rosary', location: 'San Jose St.', status: 'upcoming' as const };

  assert.equal(isScheduleIncludedInPublication(schedRegular, pubRegular), true);
  assert.equal(isScheduleIncludedInPublication(schedSpecial, pubRegular), false, 'Regular pub must exclude special event');
  assert.equal(isScheduleIncludedInPublication(schedRegular, pubSpecial), false, 'Special pub must exclude regular mass');
  assert.equal(isScheduleIncludedInPublication(schedSpecial, pubSpecial), true);
});

test('5. isHistoricalScheduleOccurrence protects past occurrences based on effectiveDate boundary', () => {
  // Use dates in future relative to current date (e.g. late November 2026)
  const occurrenceWeek1 = { date: '2026-11-15', startTime: '07:30', status: 'upcoming' };
  const occurrenceWeek2 = { date: '2026-11-22', startTime: '07:30', status: 'upcoming' };
  const effectiveDate = '2026-11-22';

  assert.equal(isHistoricalScheduleOccurrence(occurrenceWeek1, effectiveDate), true, 'Occurrence before effectiveDate must be historical');
  assert.equal(isHistoricalScheduleOccurrence(occurrenceWeek2, effectiveDate), false, 'Occurrence on effectiveDate must be future eligible');
});

test('6. isHistoricalScheduleOccurrence protects occurrences when status is stale', () => {
  // Mass was in 2020, but status field was left stale as 'upcoming'
  const staleOccurrence = { date: '2020-01-01', startTime: '06:00', status: 'upcoming' };
  assert.equal(isHistoricalScheduleOccurrence(staleOccurrence), true, 'Stale upcoming past mass must be historical');
});

test('7. isHistoricalScheduleOccurrence treats locked schedules as immutable historical', () => {
  const lockedFuture = { date: '2099-12-31', startTime: '06:00', isLocked: true, status: 'upcoming' };
  assert.equal(isHistoricalScheduleOccurrence(lockedFuture), true, 'Locked schedule must be protected');
});

test('8. isSundayOrAnticipatedMass accurately classifies Sunday & Anticipated masses and rejects TEST slots', () => {
  // Saturday Anticipated Mass (18:00)
  assert.equal(isSundayOrAnticipatedMass('Anticipated Mass', '2026-11-07', '18:00'), true);
  assert.equal(isSundayOrAnticipatedMass('Misa sa Sabado ng Gabi', '2026-11-07', '18:00'), true);

  // Official Sunday Regular Masses
  assert.equal(isSundayOrAnticipatedMass('Sunday Mass', '2026-11-01', '06:00'), true);
  assert.equal(isSundayOrAnticipatedMass('Sunday Mass', '2026-11-01', '07:30'), true);
  assert.equal(isSundayOrAnticipatedMass('Sunday Mass', '2026-11-01', '09:00'), true);
  assert.equal(isSundayOrAnticipatedMass('Sunday Mass', '2026-11-01', '16:00'), true);
  assert.equal(isSundayOrAnticipatedMass('Sunday Mass', '2026-11-01', '17:30'), true);
  assert.equal(isSundayOrAnticipatedMass('Sunday Mass', '2026-11-01', '19:00'), true);

  // Sunday 18:00 TEST slot must be rejected
  assert.equal(isSundayOrAnticipatedMass('TEST', '2026-11-01', '18:00'), false, 'Sunday 18:00 TEST must NOT be Sunday mass');

  // Weekday TEST slots must be rejected
  assert.equal(isSundayOrAnticipatedMass('TEST', '2026-11-02', '18:00'), false);

  // Saturday TEST at 18:00 must also be rejected
  assert.equal(isSundayOrAnticipatedMass('TEST', '2026-11-07', '18:00'), false, 'Saturday 18:00 TEST must NOT be Anticipated mass');
});

test('9. groupSchedulesIntoPatterns excludes all 61 TEST schedules from publication pattern grid', () => {
  const pub: Partial<SchedulePublication> = {
    id: 'Eqz1KU9cPfYKhT5jhQVH',
    name: 'TESTING LANG BOSS',
    startDate: '2026-11-01',
    endDate: '2026-12-31',
    publicationType: 'regular',
    includeSundays: true,
    includeWeekdays: true,
    includeSpecialEvents: false
  };

  // Generate 61 daily TEST schedules (all at 18:00, including 9 Sundays)
  const testSchedules: Schedule[] = [];
  const start = new Date(2026, 10, 1); // Nov 1, 2026 (Sunday)
  for (let i = 0; i < 61; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    testSchedules.push({
      id: `test-sched-${i}`,
      publicationId: 'Eqz1KU9cPfYKhT5jhQVH',
      date: dateStr,
      startTime: '18:00',
      endTime: '19:00',
      title: 'TEST',
      category: 'mass_weekday',
      status: 'upcoming',
      assignedMembers: []
    } as Schedule);
  }

  // Also include official Sunday and weekday mass schedules
  const officialSchedules: Schedule[] = [
    {
      id: 'official-sat-1800',
      publicationId: 'Eqz1KU9cPfYKhT5jhQVH',
      date: '2026-11-07', // Saturday
      startTime: '18:00',
      endTime: '19:00',
      title: 'Anticipated Mass',
      category: 'mass_sunday',
      status: 'upcoming',
      assignedMembers: []
    } as Schedule,
    {
      id: 'official-sun-0730',
      publicationId: 'Eqz1KU9cPfYKhT5jhQVH',
      date: '2026-11-01', // Sunday
      startTime: '07:30',
      endTime: '08:30',
      title: 'Sunday Mass',
      category: 'mass_sunday',
      status: 'upcoming',
      assignedMembers: []
    } as Schedule,
    {
      id: 'official-wed-1800',
      publicationId: 'Eqz1KU9cPfYKhT5jhQVH',
      date: '2026-11-04', // Wednesday
      startTime: '18:00',
      endTime: '19:00',
      title: 'Wednesday Novena & Mass',
      category: 'mass_weekday',
      status: 'upcoming',
      assignedMembers: []
    } as Schedule
  ];

  const allSchedules = [...testSchedules, ...officialSchedules];
  const { sundayPatterns, weekdayPatterns, specialPatterns } = groupSchedulesIntoPatterns(allSchedules, pub);

  // Sunday patterns must NOT have Sunday 18:00 TEST slot
  const hasSunday1800Test = sundayPatterns.some(p => p.dayOfWeek === 0 && p.startTime === '18:00');
  assert.equal(hasSunday1800Test, false, 'Sunday 18:00 TEST slot must be completely absent from Sunday patterns');

  // Sunday patterns must contain Saturday 18:00 Anticipated and Sunday 07:30
  const hasSaturdayAnticipated = sundayPatterns.some(p => p.dayOfWeek === 6 && p.startTime === '18:00');
  const hasSunday0730 = sundayPatterns.some(p => p.dayOfWeek === 0 && p.startTime === '07:30');
  assert.equal(hasSaturdayAnticipated, true, 'Saturday 18:00 Anticipated Mass must be preserved');
  assert.equal(hasSunday0730, true, 'Sunday 07:30 Mass must be preserved');

  // Weekday patterns must preserve Wednesday 18:00, but reject Monday/Tuesday/Thursday 18:00 TEST slots
  const hasWed1800 = weekdayPatterns.some(p => p.dayOfWeek === 3 && p.startTime === '18:00');
  const hasMon1800Test = weekdayPatterns.some(p => p.dayOfWeek === 1 && p.startTime === '18:00');
  assert.equal(hasWed1800, true, 'Wednesday 18:00 Mass must be preserved in weekday patterns');
  assert.equal(hasMon1800Test, false, 'Monday 18:00 TEST slot must be absent from weekday patterns');

  // Special patterns must be empty when includeSpecialEvents is false
  assert.equal(specialPatterns.length, 0);
});

test('10. groupSchedulesIntoPatterns preserves all 14 official recurring slots and correctly sorts them', () => {
  const pub: Partial<SchedulePublication> = {
    id: 'pub-official-14',
    name: 'Official 14 Slots Publication',
    publicationType: 'regular',
    includeSundays: true,
    includeWeekdays: true
  };

  // Mock 14 official schedules
  const schedules: Schedule[] = [
    { id: 'sat-1800', date: '2026-11-07', startTime: '18:00', title: 'Anticipated Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'sun-0600', date: '2026-11-01', startTime: '06:00', title: 'Sunday Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'sun-0730', date: '2026-11-01', startTime: '07:30', title: 'Sunday Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'sun-0900', date: '2026-11-01', startTime: '09:00', title: 'Sunday Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'sun-1600', date: '2026-11-01', startTime: '16:00', title: 'Sunday Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'sun-1730', date: '2026-11-01', startTime: '17:30', title: 'Sunday Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'sun-1900', date: '2026-11-01', startTime: '19:00', title: 'Sunday Mass', category: 'mass_sunday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'mon-0600', date: '2026-11-02', startTime: '06:00', title: 'Daily Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'tue-0600', date: '2026-11-03', startTime: '06:00', title: 'Daily Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'wed-0600', date: '2026-11-04', startTime: '06:00', title: 'Daily Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'wed-1800', date: '2026-11-04', startTime: '18:00', title: 'Wednesday Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'thu-0600', date: '2026-11-05', startTime: '06:00', title: 'Daily Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'fri-0600', date: '2026-11-06', startTime: '06:00', title: 'Daily Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule,
    { id: 'fri-1800', date: '2026-11-06', startTime: '18:00', title: 'Friday Mass', category: 'mass_weekday', status: 'upcoming', assignedMembers: [] } as Schedule
  ];

  const { sundayPatterns, weekdayPatterns } = groupSchedulesIntoPatterns(schedules, pub);

  assert.equal(sundayPatterns.length, 7, 'Sunday patterns must have exactly 7 slots');
  assert.equal(weekdayPatterns.length, 7, 'Weekday patterns must have exactly 7 slots');

  // Verify Saturday Anticipated Mass is sorted first in sundayPatterns
  assert.equal(sundayPatterns[0].dayOfWeek, 6);
  assert.equal(sundayPatterns[0].startTime, '18:00');

  // Verify Sunday masses follow sequentially
  assert.equal(sundayPatterns[1].startTime, '06:00');
  assert.equal(sundayPatterns[2].startTime, '07:30');
  assert.equal(sundayPatterns[6].startTime, '19:00');
});

test('11. groupSchedulesIntoPatterns isolates custom & special events into specialPatterns only when enabled', () => {
  const pubDisabled: Partial<SchedulePublication> = {
    id: 'pub-no-special',
    publicationType: 'regular',
    includeSpecialEvents: false
  };

  const pubEnabled: Partial<SchedulePublication> = {
    id: 'pub-with-special',
    publicationType: 'regular',
    includeSpecialEvents: true
  };

  const specialSchedule: Schedule = {
    id: 'spec-fiesta-1',
    date: '2026-11-15',
    startTime: '10:00',
    endTime: '11:30',
    title: 'Parish Fiesta Pontifical Mass',
    category: 'special_event',
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  const resultDisabled = groupSchedulesIntoPatterns([specialSchedule], pubDisabled);
  assert.equal(resultDisabled.specialPatterns.length, 0, 'Must omit special event when disabled');
  assert.equal(resultDisabled.sundayPatterns.length, 0, 'Special event must never leak into Sunday pattern');

  const resultEnabled = groupSchedulesIntoPatterns([specialSchedule], pubEnabled);
  assert.equal(resultEnabled.specialPatterns.length, 1, 'Must include special event when enabled');
  assert.equal(resultEnabled.specialPatterns[0].title, 'Parish Fiesta Pontifical Mass');
  assert.equal(resultEnabled.sundayPatterns.length, 0, 'Special event must never leak into Sunday pattern even when enabled');
});

test('12. groupSchedulesIntoPatterns respects activeTemplates dynamic hook', () => {
  const activeTemplates: ScheduleTemplate[] = [
    {
      id: 'template-custom-thurs-1900',
      name: 'Thursday Special Mass',
      title: 'Thursday Community Mass',
      dayOfWeek: 'Thursday',
      startTime: '19:00',
      endTime: '20:00',
      active: true,
      assignedMembers: []
    } as ScheduleTemplate
  ];

  const customSchedule: Schedule = {
    id: 'sched-custom-thurs',
    templateId: 'template-custom-thurs-1900',
    date: '2026-11-05', // Thursday
    startTime: '19:00',
    endTime: '20:00',
    title: 'Thursday Community Mass',
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  const pub: Partial<SchedulePublication> = {
    id: 'pub-tmpl',
    publicationType: 'regular',
    includeWeekdays: true
  };

  const result = groupSchedulesIntoPatterns([customSchedule], pub, { activeTemplates });
  assert.equal(result.weekdayPatterns.length, 1);
  assert.equal(result.weekdayPatterns[0].startTime, '19:00');
  assert.equal(result.weekdayPatterns[0].templateId, 'template-custom-thurs-1900');
});

test('13. isCorruptedLegacyTestSchedule excludes dummy records while preserving legitimate titles like Testimony Mass', () => {
  // Corrupted dummy records (must be flagged as test)
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'TEST' }), true);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'test' }), true);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'TEST - 6:00 PM' }), true);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'TEST (Slot 1)' }), true);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'TEST: slot' }), true);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'TEST #2' }), true);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'Sunday Mass', metadata: { isTestGenerated: true } }), true);

  // Legitimate Mass titles containing "test" substrings or words (must NOT be flagged)
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'Testimony Mass' }), false);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'Testimonial Service' }), false);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'New Testament Reflection' }), false);
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'Test of Faith Vigil' }), false);

  // Templated Masses are never flagged as rogue un-templated test records
  assert.equal(isCorruptedLegacyTestSchedule({ title: 'TEST', templateId: 'template-valid-01' }), false);
});

test('14. groupSchedulesIntoPatterns includes legitimate Testimony Mass in recurring grid', () => {
  const pub: Partial<SchedulePublication> = {
    id: 'pub-testimony',
    publicationType: 'regular',
    includeSundays: true,
    includeWeekdays: true
  };

  const legitimateTestimonyMass: Schedule = {
    id: 'sched-testimony-0900',
    publicationId: 'pub-testimony',
    date: '2026-11-01', // Sunday
    startTime: '09:00',
    endTime: '10:00',
    title: 'Testimony Mass & Healing Service',
    category: 'mass_sunday',
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  const dummyTestMass: Schedule = {
    id: 'sched-dummy-1800',
    publicationId: 'pub-testimony',
    date: '2026-11-01', // Sunday
    startTime: '18:00',
    endTime: '19:00',
    title: 'TEST',
    category: 'mass_weekday',
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  const result = groupSchedulesIntoPatterns([legitimateTestimonyMass, dummyTestMass], pub);
  // Testimony Mass at 9:00 AM on Sunday is recognized as Sunday pattern
  assert.equal(result.sundayPatterns.length, 1);
  assert.equal(result.sundayPatterns[0].startTime, '09:00');
  assert.equal(result.sundayPatterns[0].title, 'Testimony Mass & Healing Service');
  // Dummy TEST Mass at 18:00 is completely excluded
  assert.equal(result.sundayPatterns.some(p => p.startTime === '18:00'), false);
  assert.equal(result.weekdayPatterns.length, 0);
});

test('15. isBaptismSchedule identifies baptism / binyag schedules by title and category variants', () => {
  assert.equal(isBaptismSchedule({ title: 'Binyag' }), true);
  assert.equal(isBaptismSchedule({ title: '10:30 AM Binyag' }), true);
  assert.equal(isBaptismSchedule({ title: 'Sunday Binyagan' }), true);
  assert.equal(isBaptismSchedule({ title: 'Holy Baptism Rite' }), true);
  assert.equal(isBaptismSchedule({ title: 'Bautismo sa Parokya' }), true);
  assert.equal(isBaptismSchedule({ category: 'binyag', title: 'Special Service' }), true);
  assert.equal(isBaptismSchedule({ category: 'baptism', title: 'Community Rite' }), true);

  // Non-baptism schedules
  assert.equal(isBaptismSchedule({ title: 'Sunday Morning Mass' }), false);
  assert.equal(isBaptismSchedule({ title: 'Weekday Daily Mass' }), false);
  assert.equal(isBaptismSchedule({ title: 'Holy Hour & Adoration' }), false);
  assert.equal(isBaptismSchedule(null), false);
});

test('16. isScheduleIncludedInPublication excludes Baptism schedules from regular publications', () => {
  const pub: Partial<SchedulePublication> = {
    id: 'pub-nov-2026',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    publicationType: 'regular',
    includeSundays: true,
    includeWeekdays: true,
    includeSpecialEvents: true
  };

  const baptismSchedule: Schedule = {
    id: 'sched-binyag-01',
    publicationId: 'pub-nov-2026',
    templateId: 'temp-binyag',
    date: '2026-11-15', // Sunday
    startTime: '10:30',
    endTime: '11:30',
    title: '10:30 AM Binyag',
    category: 'mass_sunday', // Even if mistakenly stamped as mass_sunday
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  assert.equal(
    isScheduleIncludedInPublication(baptismSchedule, pub),
    false,
    'Baptism schedule must NEVER be included in regular Mass publications'
  );
});

test('17. groupSchedulesIntoPatterns excludes Baptism schedules from both sunday and weekday patterns', () => {
  const pub: Partial<SchedulePublication> = {
    id: 'pub-nov-2026',
    publicationType: 'regular',
    includeSundays: true,
    includeWeekdays: true
  };

  const sundayMass: Schedule = {
    id: 'sched-sun-0900',
    date: '2026-11-15',
    startTime: '09:00',
    endTime: '10:00',
    title: 'Sunday Morning Mass',
    category: 'mass_sunday',
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  const sundayBaptism: Schedule = {
    id: 'sched-binyag-1030',
    date: '2026-11-15',
    startTime: '10:30',
    endTime: '11:30',
    title: '10:30 AM Binyag',
    templateId: 'template-binyag-sun',
    category: 'mass_sunday',
    status: 'upcoming',
    assignedMembers: []
  } as Schedule;

  const result = groupSchedulesIntoPatterns([sundayMass, sundayBaptism], pub);

  assert.equal(result.sundayPatterns.length, 1, 'Only Sunday Mass should be in sundayPatterns');
  assert.equal(result.sundayPatterns[0].startTime, '09:00');

  // CRITICAL: Sunday Baptism must NOT be placed in weekdayPatterns!
  assert.equal(result.weekdayPatterns.length, 0, 'Baptism must NEVER leak into weekdayPatterns');
  assert.equal(result.specialPatterns.length, 0, 'Baptism must not appear in regular specialPatterns');
});

test('18. isSundayOrAnticipatedMass rejects Baptism so it cannot masquerade as Sunday Mass or bypass into Weekday logic', () => {
  assert.equal(isSundayOrAnticipatedMass('Binyag', '2026-11-15', '10:30'), false);
  assert.equal(isSundayOrAnticipatedMass('10:30 AM Binyag', '2026-11-15', '10:30'), false);
  assert.equal(isSundayOrAnticipatedMass('Sunday Baptism', '2026-11-15', '11:00'), false);
});
