# Publication schedule prevention

Approved scope: the user's October 27, 2026 approval, seven clarifications, and subsequent final-verification request authorizing one local commit after successful checks.

## Requirements and decisions

- Reject overlapping non-archived regular publication ranges on create, range/type change, and archived reactivation. Archived records do not reserve future ranges. Special publications remain independent contexts.
- Serialize these service mutations using a revision-only coordination document in `schedulePublications`. It has no dates, is excluded by the existing ordered publication query, and uses existing schedule-management permissions. No security rules are changed.
- Bound overlap queries by intersecting dates. Never scan the schedule collection for generation. Add the required range-query index as an undeployed configuration change.
- Give generated occurrences stable IDs based on publication, Mass context, date, time, and location; create with a transaction, never overwrite existing schedules. Read the parent publication to reject archived/deleted parents. Preserve legacy records; report ambiguous ownership rather than adopt it.
- Regular Mass identity ignores cosmetic template labels; category/venue and publication ownership distinguish contexts. Special publication ownership is respected even when legacy schedule categories are missing.
- A standalone generator defers to an active regular publication covering the range. Otherwise it obtains a revision token and serializes occurrence creation against concurrent publication creation without querying publications for each occurrence. A changed context stops the run; retry from the appropriate publication.
- Keep published/archived/history-bearing publications. Only future empty drafts may be deleted after bounded reference checks and a transaction recheck. Prefer archive in the UI.
- Audit references also prevent deletion, so an audited empty draft may require archiving. Publication mutations and their existing-format audits commit atomically. Metadata saves and generation retries do not implicitly unlock schedules.
- Remove implicit cleanup on Special publication save. Existing records are never merged, deleted, or reassigned by generation/reporting.
- Offer an explicit bounded, read-only duplicate preview with IDs, owners, assignments and lock/status indicators; suspected matches require manual review.

## Task plan

1. Add shared identity/report helpers and transactional persistence guards.
2. Wire publication create/update/reactivation, generation and safe deletion.
3. Replace the Special slot creation/cleanup path with guarded creation and preservation.
4. Add an on-demand preview using shared UI primitives.
5. Test overlapping/archived/Special contexts, retries and transaction contention, legacy assignments/history, deletion protection, and bounded reads.
6. Run focused tests, lint and TypeScript checks; inspect security and final diff. The final-verification request permits one local commit after checks pass. No production execution, cleanup, push, merge or deployment.

## Verification boundary

Client-service transactions protect cooperating updated clients. Existing Firestore rules still permit authorized direct writes; this change is not a server-enforced uniqueness constraint. Emulator/in-memory tests use isolated fixtures only. Production duplicate reporting is not run as part of implementation.

## Local schema and operational notes

- New generated schedule IDs use `generated_` plus a SHA-256 identity digest. Existing schedule IDs are never rewritten.
- `schedulePublications/coordination_regular_publication_revision` is a revision-only coordination document with no publication dates. Parent publication `scheduleRevision` is incremented on new linked occurrences/detail edits to serialize against deletion and range changes. The original double-underscore ID was rejected by the real emulator because Firestore reserves `__.*__` IDs; final verification corrected it before any production use.
- The new composite index is `schedulePublications(endDate ASC, startDate ASC)`. Its definition is local only; deployment and index readiness must be reviewed before enabling these queries in production. Missing indexes fail closed with the existing form error handling.
- The generator caps its range query at 1,001 documents (rejecting results over 1,000). The preview uses explicit `orderBy(date)`, `orderBy(documentId())`, `startAfter(date, id)` and `limit(100)`. Pages accumulate locally so duplicates split across cursors remain visible. Users explicitly load each next page; no previous page is reread. At 1,000 records the preview stops and labels itself incomplete. Date spans are limited to 366 days. Deletion checks use `limit(1)` reference queries. There are no new listeners or polling.
- Saving a publication's details does not unlock schedules. Explicit lifecycle actions retain their existing lock controls; reactivation validation precedes unlocking.

## Verification results — 2026-10-27

- 110 regression tests passed across generation safety, publication lifecycle, transactional auditing, schedule utilities, admin Mass assignment, effective-dated edits, quota behavior, submissions, security rule invariants and existing regression scenarios. This includes 22 new prevention/reporting cases using actual service code with an isolated in-memory Firebase module boundary and optimistic transaction retries.
- `npm run build` passed (TypeScript project checks and Vite production bundling). Existing large-chunk/dynamic-import warnings remain.
- `npm run lint` passed with no errors; existing repository warnings remain. `git diff --check` passed.
- Firestore rules, route/auth permission implementations, attendance services and existing unrelated user edits were preserved.
- Browser/mobile interaction, deployed-index readiness, live/emulator transaction validation and independent review remain pending. No production records were read for cleanup, changed, merged, deleted or reassigned. No deployment, commit, push or merge was performed.

## Final verification — 2026-10-27

### Confirmed defects fixed

- Replaced the Firestore-reserved double-underscore guard ID with a valid revision document ID.
- Replaced client-only report pagination with explicit 100-document Firestore cursor pages, retaining cross-page matches and a hard review cap.
- Reused the existing snapshot-existence helper for compat transaction snapshots in publication update/delete paths.
- Reset the existing security-rules suite's isolated demo project before seeding. Repeated emulator runs previously attempted public submission updates and immutable-audit overwrites instead of fresh creates.

### Results

- Full `npm test` with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`: **158 passed, 0 failed, 0 skipped**. Both real emulator suites ran successfully. Simultaneous generation, retries, overlapping regular publication creation, standalone/publication races, independent Special contexts (including missing legacy categories), authorization, assignments, attendance, legacy IDs and historical/publication isolation were checked.
- Real report query instrumentation: **100 then 5 documents** across two pages; cross-page duplicate detected, no reread of earlier records, and no further query after completion. Mock regression also checks the 1,000-record cap.
- Playwright Chromium checks passed at **1280×900** and **390×844**: actual Publications tab and form, cross-page preview, no automatic reads, offline/error recovery, invalid dates and overlap validation. No page errors or horizontal overflow. Four simultaneous real browser generator calls created one future occurrence; a retry created none.
- Browser fixture snapshots before/after confirmed existing assignments, attendance sessions/records, submissions, historical schedules and Regular/Special ownership were byte-for-byte unchanged. Screenshots are local ignored artifacts under `.firebase/publication-verification/`.
- `npm run build`, `npm run lint` and `git diff --check` passed. Existing lint and bundle warnings remain. Unrelated pre-existing user edits are excluded from the local commit.

### Index review and limits

- `schedulePublications(endDate ASC, startDate ASC)` matches the overlapping-range query's implicit lexicographic inequality ordering. It is required for active regular publication creation, changing regular coverage/type, archived regular reactivation, and regular/standalone generation preflight. Metadata-only edits, archiving and Special creation do not issue that overlap query.
- The duplicate preview uses the built-in schedule date/document-name ordering and does **not** depend on the new publication index. Existing single-field reference checks likewise do not depend on it.
- The emulator [does not enforce compound indexes or all production transaction/billing behavior](https://firebase.google.com/docs/emulator-suite/connect_firestore). Index existence/readiness and production index-entry billing were not tested; deployment was explicitly prohibited. The [documented implicit ordering](https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery) was checked against the local definition.
- Client transaction protection requires updated cooperating clients. Existing rules continue to allow authorized direct writes; server-enforced uniqueness and independent pre-merge sign-off remain outside this verification. No production Firestore data was read or changed, and no cleanup, deployment, push or merge occurred.

### Reproduce locally

1. Start the cached Firestore emulator JAR with Java 21, `--host 127.0.0.1 --port 8080 --project_id demo-mats-publication-verify --rules firestore.rules`.
2. Set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and run `npm test`.
3. Run `node tests/browser/seedPublicationFixture.mjs` (reseed before each browser run), then start `node node_modules/vite/bin/vite.js --config tests/browser/publication.vite.config.mjs`.
4. Run `python tests/publicationPreventionBrowser.py`. The test server injects only an emulator Firebase config; the browser blocks all non-localhost requests. Its root config and production Firebase configuration are unchanged.
