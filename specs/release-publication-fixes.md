# Combined publication fixes release candidate

Branch: `fix/prevent-duplicate-publication-schedules`.

## Included changes

- Duplicate publication schedule prevention is retained from commit `3f6d920`: active regular coverage checks, transaction-safe generated occurrences, independent Regular/Special contexts, safe publication deletion, and bounded read-only duplicate previews.
- Public submission serialization omits undefined optional slot-summary fields before `setDoc()`. Required names, start times and schedule IDs are validated without empty defaults. Deadlines, eligibility, capacity/approval checks, permissions and duplicate/publication-isolation protections remain intact. No global `ignoreUndefinedProperties` setting or extra Firestore reads were added.
- The newly authorized local commit records the approved submission fix, its regression/emulator/browser tests, and this release note on top of the existing duplicate-prevention commit. Existing history is not rewritten.

## Release verification

- Verification used an isolated snapshot of committed source plus only the approved submission-fix files. The three unrelated working-tree edits were excluded and their snapshot versions were checked against their committed Git blobs.
- Full regression and Firestore Emulator run: **166 passed, 0 failed, 0 skipped**. All three real emulator suites ran against local `demo-*` projects.
- Lint passed with existing repository warnings and no errors.
- TypeScript/Vite production build passed using the existing local production environment; emulator mode was confirmed disabled. Environment files and generated artifacts remain in the ignored verification workspace, outside the commit.
- Both browser scripts passed again against the isolated release snapshot: duplicate-prevention/reporting checks at desktop and mobile sizes, plus anonymous public submissions at desktop and mobile Chromium with a Messenger-style user agent. There were no page errors; tracked historical records, assignments and publication ownership remained unchanged. Repeated submissions were blocked and missing optional location metadata was omitted from persisted pending submissions.
- Firestore rules, production Firebase configuration, attendance services and existing duplicate-prevention code were not changed by this release preparation.

## Required index and activation order

`firestore.indexes.json` defines the required collection-scope index:

| Collection | First field | Second field |
| --- | --- | --- |
| `schedulePublications` | `endDate ASC` | `startDate ASC` |

The installed Firebase SDK normalized the actual overlapping-range query to `endDate ASC, startDate ASC, __name__ ASC`; the local index definition matches its required fields. `firebase.json` references this index file. This review executed no remote queries.

The index is required for active regular publication creation, regular coverage/type changes, archived regular reactivation, and regular/standalone generation preflight. The undefined-field submission fix and duplicate-preview date/document-ID pagination do not require it.

Before activating the combined application release, deploy the index and wait for its production state to become `READY`. The emulator does not enforce compound index availability, and no production index readiness check or deployment was performed in this task.

## Deployment readiness and boundaries

- Release source is verified, subject to index readiness and explicit deployment approval. A future deployment must use a clean checkout of the release commit or the isolated release build, not a build containing the unrelated dirty working-tree files.
- Client concurrency guards require updated cooperating clients; authorized direct Firestore writes remain outside these client-service guarantees.
- Mobile browser emulation includes a Messenger-style user agent; testing inside the actual Messenger application remains a device-level follow-up.
- No production Firestore records were read, changed, merged, deleted or reassigned. No push, merge or deployment was performed. The task authorizes one new local commit only.
