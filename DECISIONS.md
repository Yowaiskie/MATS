# Architectural Decisions

This file logs architectural and technical decisions made during development planning and execution.
Each decision records the chosen approach, rationale, and traceability to its plan or specification.

---

<!-- Entry format:
## YYYY-MM-DD: <Decision Title>
- Decision: <What was chosen and implemented>
- Context / Rationale: <Why this approach was selected, alternatives rejected>
- Plan / Spec: <Path to .agent/main-plan/ or specs/ document>
-->

## 2026-10-27: Prevent duplicate publication schedules without migrating history
- Decision: Use bounded overlap queries with a transaction revision guard, stable generated occurrence IDs, and read-only duplicate previews. Archived publications do not reserve active ranges; Regular and Special contexts stay separate. Never automatically adopt, merge or remove legacy schedules.
- Rationale: Prevent repeat/concurrent generation while preserving schedule IDs, assignments, submissions, attendance and quota protections. The revision-only guard uses existing publication permissions and has no dates, so it is excluded from ordered/ranged publication lists. Direct authorized database writes remain outside client-service guarantees.
- Plan / Spec: `specs/publication-schedule-prevention.md` (user-approved scope).
- Final verification: Real emulator testing required replacing a reserved `__.*__` guard ID with `coordination_regular_publication_revision`. Duplicate preview now reads explicit 100-document cursor pages and retains cross-page matches, capped at 1,000 reviewed records. The publication index matches implicit `endDate ASC, startDate ASC` ordering; it has not been deployed.

## 2026-11-23: Per-slot atomic counter documents for high-concurrency public event forms
- Decision: Introduce PII-free `eventFormSlotCounts/{slotDocId}` counter documents updated atomically inside Firestore `runTransaction` during form submit, edit, and delete; tighten `eventFormResponses` read access in `firestore.rules` to `isAuthenticated()`; keep Pax Tecum on the single MATS Firebase project (`mats-c10da`) instead of splitting into a second Firebase project.
- Context / Rationale: Scanning all `eventFormResponses` on public load and submit consumed ~94,200 reads for 300 registrants (exceeding the 50,000/day Spark Free Tier limit), risked race-condition overbooking, and exposed registrant PII to public browsers. Per-slot counter docs reduce 300-user load to ~7,500 reads (~15% of daily quota), spread write contention across slots, avoid `O(N^2)` `onSnapshot` fan-out, and preserve single-project Firebase Auth boundaries.
- Plan / Spec: Approved implementation plan (`feature/event-form-slot-counters`).
