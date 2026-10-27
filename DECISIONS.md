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
