import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLegacyDeadlineToMs,
  planPublicationDeadlinesMigration,
  executePublicationDeadlinesMigration
} from '../scripts/migratePublicationDeadlines.ts';
import type { SchedulePublication } from '../src/types/publication.ts';

test('Migration Tool: parseLegacyDeadlineToMs accurately handles dates and Manila timezone', () => {
  // 1. Explicit UTC string
  const utcResult = parseLegacyDeadlineToMs('2026-11-30T12:00:00Z');
  assert.equal(utcResult.error, undefined);
  assert.equal(utcResult.iso, '2026-11-30T12:00:00.000Z');
  assert.equal(utcResult.ms, new Date('2026-11-30T12:00:00.000Z').getTime());

  // 2. Explicit Manila (+08:00) string
  const manilaExplicit = parseLegacyDeadlineToMs('2026-11-30T20:00:00+08:00');
  assert.equal(manilaExplicit.error, undefined);
  assert.equal(manilaExplicit.iso, '2026-11-30T12:00:00.000Z');
  assert.equal(manilaExplicit.ms, new Date('2026-11-30T12:00:00.000Z').getTime());

  // 3. String without timezone offset (must default to Asia/Manila UTC+8)
  const noOffsetResult = parseLegacyDeadlineToMs('2026-11-30T20:00:00');
  assert.equal(noOffsetResult.error, undefined);
  // 20:00 in Manila (UTC+8) is 12:00 UTC
  assert.equal(noOffsetResult.iso, '2026-11-30T12:00:00.000Z');
  assert.equal(noOffsetResult.ms, new Date('2026-11-30T12:00:00.000Z').getTime());

  // 4. Date only string (YYYY-MM-DD) defaults to end of day in Manila
  const dateOnlyResult = parseLegacyDeadlineToMs('2026-11-30');
  assert.equal(dateOnlyResult.error, undefined);
  // 23:59:59.999 in Manila is 15:59:59.999 UTC
  assert.equal(dateOnlyResult.iso, '2026-11-30T15:59:59.999Z');

  // 5. Invalid / unparseable string
  const invalidResult = parseLegacyDeadlineToMs('not-a-valid-date');
  assert.equal(invalidResult.ms, null);
  assert.ok(invalidResult.error?.includes('Invalid date format'));
});

test('Migration Tool: planPublicationDeadlinesMigration classifies publications accurately', () => {
  const samplePublications: Array<Partial<SchedulePublication>> = [
    // Candidate 1: Legacy publication with ISO string but no ms
    {
      id: 'pub-legacy-1',
      name: 'Legacy November Mass',
      status: 'published',
      submissionDeadline: '2026-11-15T23:59:00'
    },
    // Candidate 2: Legacy publication with space-separated datetime
    {
      id: 'pub-legacy-2',
      name: 'Legacy December Mass',
      status: 'draft',
      submissionDeadline: '2026-12-15 18:00:00'
    },
    // Skipped 1: Already has submissionDeadlineMs
    {
      id: 'pub-modern-1',
      name: 'Modern Publication',
      status: 'published',
      submissionDeadline: '2026-11-20T23:59:00',
      submissionDeadlineMs: 1795219140000
    },
    // Skipped 2: No deadline configured
    {
      id: 'pub-open-1',
      name: 'Always Open Publication',
      status: 'published',
      submissionDeadline: ''
    },
    // Flagged: Malformed deadline
    {
      id: 'pub-corrupt-1',
      name: 'Corrupted Publication',
      status: 'archived',
      submissionDeadline: 'to-be-announced-soon'
    }
  ];

  const plan = planPublicationDeadlinesMigration(samplePublications);

  assert.equal(plan.totalEvaluated, 5);

  // 2 to be migrated
  assert.equal(plan.toBeMigrated.length, 2);
  assert.equal(plan.toBeMigrated[0].id, 'pub-legacy-1');
  assert.equal(plan.toBeMigrated[1].id, 'pub-legacy-2');
  assert.ok(typeof plan.toBeMigrated[0].proposedDeadlineMs === 'number');
  assert.ok(plan.toBeMigrated[0].manilaTime.length > 0);

  // 1 skipped (already valid ms)
  assert.equal(plan.skippedAlreadyValid.length, 1);
  assert.equal(plan.skippedAlreadyValid[0].id, 'pub-modern-1');

  // 1 skipped (no deadline)
  assert.equal(plan.skippedNoDeadline.length, 1);
  assert.equal(plan.skippedNoDeadline[0].id, 'pub-open-1');

  // 1 flagged for manual review
  assert.equal(plan.flaggedForManualReview.length, 1);
  assert.equal(plan.flaggedForManualReview[0].id, 'pub-corrupt-1');
  assert.ok(plan.flaggedForManualReview[0].reason.includes('Invalid date format'));

  // Backup and rollback procedures are generated
  assert.ok(plan.backupProcedure.includes('gcloud firestore export'));
  assert.ok(plan.rollbackProcedure.includes('ROLLBACK PROCEDURE'));
});

test('Migration Tool: executePublicationDeadlinesMigration dry-run by default vs live execution', async () => {
  const store: Record<string, any> = {
    'pub-1': { submissionDeadline: '2026-11-15T23:59:00' }
  };

  const mockDb = {
    updateDoc: async (col: string, id: string, updates: any) => {
      store[id] = { ...store[id], ...updates };
    }
  };

  const samplePublications = [
    { id: 'pub-1', name: 'Pub 1', status: 'published', submissionDeadline: '2026-11-15T23:59:00' }
  ];

  const plan = planPublicationDeadlinesMigration(samplePublications);

  // 1. Dry run execution (execute: false / omitted)
  const dryRunResult = await executePublicationDeadlinesMigration(mockDb, plan);
  assert.equal(dryRunResult.dryRun, true);
  assert.equal(dryRunResult.executed, false);
  assert.equal(dryRunResult.migratedCount, 1);
  assert.equal(store['pub-1'].submissionDeadlineMs, undefined, 'Dry run must NOT mutate store');

  // 2. Live execution (execute: true)
  const liveResult = await executePublicationDeadlinesMigration(mockDb, plan, { execute: true });
  assert.equal(liveResult.dryRun, false);
  assert.equal(liveResult.executed, true);
  assert.equal(liveResult.migratedCount, 1);
  assert.equal(liveResult.updatedIds[0], 'pub-1');
  assert.ok(typeof store['pub-1'].submissionDeadlineMs === 'number', 'Live run must update submissionDeadlineMs');
});
