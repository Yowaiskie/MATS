import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Security Rules Invariant Audit: Zero Public Write to Schedules', () => {
  const rulesPath = path.resolve('firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  // Find match /schedules/{scheduleId} block
  const schedulesMatch = rulesText.match(/match \/schedules\/\{scheduleId\} \{([^}]+)\}/);
  assert.ok(schedulesMatch, 'schedules block must exist in firestore.rules');

  const schedulesBody = schedulesMatch[1];
  
  // Assert: Public cannot write
  assert.match(schedulesBody, /allow read: if true;/);
  assert.match(schedulesBody, /allow create, update, delete: if hasPermission\('canManageSchedules'\);/);
  assert.doesNotMatch(schedulesBody, /allow update: if true;/);
  assert.doesNotMatch(schedulesBody, /allow write: if true;/);
});

test('Security Rules Invariant Audit: Zero Public Write to Schedule Publications', () => {
  const rulesPath = path.resolve('firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  const pubMatch = rulesText.match(/match \/schedulePublications\/\{pubId\} \{([^}]+)\}/);
  assert.ok(pubMatch, 'schedulePublications block must exist in firestore.rules');

  const pubBody = pubMatch[1];
  assert.match(pubBody, /allow read: if true;/);
  assert.match(pubBody, /allow create, update, delete: if hasPermission\('canManageSchedules'\);/);
  assert.doesNotMatch(pubBody, /allow update: if true;/);
});

test('Security Rules Invariant Audit: Strict Intake on scheduleSubmissions', () => {
  const rulesPath = path.resolve('firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  const subMatch = rulesText.match(/match \/scheduleSubmissions\/\{submissionId\} \{([\s\S]+?)\n    \}/);
  assert.ok(subMatch, 'scheduleSubmissions block must exist in firestore.rules');

  const subBody = subMatch[1];
  
  // Assert: Public read allowed
  assert.match(subBody, /allow read: if true;/);

  // Assert: Create requires deterministic document ID: publicationId + '_' + memberId
  assert.match(subBody, /submissionId == request\.resource\.data\.publicationId \+ '_' \+ request\.resource\.data\.memberId/);

  // Assert: Create requires status == 'pending'
  assert.match(subBody, /request\.resource\.data\.status == 'pending'/);

  // Assert: Create delegates publication status and fail-closed deadline verification to isPublicationOpenForSubmission helper
  assert.match(subBody, /isPublicationOpenForSubmission\(get\(\/databases\/\$\(database\)\/documents\/schedulePublications\/\$\(request\.resource\.data\.publicationId\)\)\.data\)/);

  // Assert: Update and Delete are Admin ONLY
  assert.match(subBody, /allow update, delete: if hasPermission\('canManageSchedules'\);/);
});

test('Security Rules Invariant Audit: Remediated Fail-Closed Helper Function', () => {
  const rulesPath = path.resolve('firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  // Find isPublicationOpenForSubmission function
  const helperMatch = rulesText.match(/function isPublicationOpenForSubmission\(pubData\) \{([\s\S]+?)\n    \}/);
  assert.ok(helperMatch, 'isPublicationOpenForSubmission function must exist in firestore.rules');
  const helperBody = helperMatch[1];

  // 1. Must check published status
  assert.match(helperBody, /pubData\.status == 'published'/);

  // 2. Strict < boundary (at or after deadline is rejected)
  assert.match(helperBody, /request\.time\.toMillis\(\) < pubData\.submissionDeadlineMs/);

  // 3. Must require submissionDeadlineMs is int
  assert.match(helperBody, /pubData\.submissionDeadlineMs is int/);

  // 4. Must support explicit no-deadline publications
  assert.match(helperBody, /!\('submissionDeadline' in pubData\) \|\| pubData\.submissionDeadline == null \|\| pubData\.submissionDeadline == ''/);

  // 5. The legacy fail-open fallback (!('submissionDeadlineMs' in ...)) in subBody is eliminated
  const subMatch = rulesText.match(/match \/scheduleSubmissions\/\{submissionId\} \{([\s\S]+?)\n    \}/);
  assert.ok(subMatch);
  assert.equal(subMatch[1].includes("!('submissionDeadlineMs' in get"), false, 'Direct fail-open fallback must be eliminated from match body');
});
