# Event requirements tracker

Each event has a Requirements tab. Select one or more tracker ranks to load
all non-archived members, including inactive and suspended members. Refresh
reloads the current roster without changing member statuses.

Requirements apply to all tracker ranks by default. An optional target-rank
selection limits an individual requirement; other members see N/A. Missing
checks are Pending. A member is Complete when every applicable requirement
is Done; members with no applicable requirements show N/A and are excluded
from completion totals. Filters do not change the overall tracker summary.

Changing ranks or archiving a requirement does not delete saved checks.
Checks follow stable member IDs, so they return when a member becomes eligible
again. Archiving removes a requirement from active calculations and exports.

The manager-only Reset Requirements button and service are enabled. Reset
requires password confirmation and permanently removes this event's active
and archived requirements, checks, and tracker rank settings. The main Members
records are untouched. Deletes use batches of at most 500 documents, preserve
settings until cleanup succeeds, log partial failures, and can be retried.
Delete permissions for the three tracker collections were approved and
deployed to `mats-c10da` on October 12, 2026. Emulator tests verified all five
authorized roles, denied viewer/unauthenticated/cross-event deletes, 501-check
batching, archived-requirement cleanup, and preservation of master members.
An in-memory service test also verified partial-failure auditing and retry.

## Firestore schema and authorization

- `eventRequirementSettings/{eventId}`: `eventId`, `selectedRanks`,
  `updatedByUid`, `updatedAt`.
- `eventRequirements/{autoId}`: `eventId`, `title`, `description`,
  `targetRanks` (empty means all tracker ranks), `isArchived`,
  `createdByUid`, `createdAt`, `updatedAt`.
- `eventRequirementChecks/{requirementId}_{memberId}`: `eventId`,
  `requirementId`, `memberId`, `completed`, `updatedByUid`, `updatedAt`.

All timestamps use server timestamps. Each checkbox has a separate document;
status writes use transactions to recheck member eligibility and requirement
applicability. Settings and requirement changes are administrative writes.
All changes append `EVENT_UPDATE` audit entries with relevant IDs.

The new rules allow authenticated reads, matching the existing Events
collections. The existing frontend event-access guard still applies.
Writes require admin/coordinator, `canManageEvents`, or the event head/creator.
Rules validate fields, references, eligible ranks, updater UID, timestamps,
and immutable identifiers. Deletes require the same manager/head/creator
authorization as writes; the UI offers archive and password-confirmed reset.
No public route or existing authorization helper is changed.

Queries use a single `eventId` equality filter and sort requirements locally;
no new composite indexes are needed. Existing events need no migration.
Deleting an event does not cascade into the tracker collections, matching
the existing event-deletion behavior; missing events cannot receive writes.

## PDF export

All event viewers can export all tracker members or the current filtered list,
including rows across all pagination pages. Exports default to the filtered
list and include member name/rank, each requirement's Done/Pending/N/A,
and overall status. Below the report title, the PDF shows only a right-aligned
uppercase date (e.g. OCTOBER 14, 2026), matching Liquidation/Request reports.
Separate event/filter metadata, generated time, and summary counts are omitted.
Requirement column headers show titles without target-rank annotations.

The export dialog reuses shared signature configuration, with optional
signatories, a custom title, and a Portrait/Landscape selector (Landscape by
default). Reports use A4 and repeat table headers. Landscape groups up to
five requirements per table; Portrait groups up to three, repeating member
identity and overall completion in each group. Requirements and Contributions
share the same official header renderer: parish/ministry logos, ministry and
parish names, address, and divider. Requirements also uses the centered,
underlined report title. Standard PDF footers and signature rendering are
reused.

## Rollout and verification

The updated `firestore.rules` were deployed to `mats-c10da` on October 12,
2026, after user approval while troubleshooting Requirements load failures.
Firebase confirmed successful compilation and release. Hosting was not
deployed.

Verified locally with TypeScript/Vite build, Oxlint, and a Firestore emulator
using the repository rules and demo project `demo-mats-requirements`:

- Allowed settings writes for admin, coordinator, manager, head, and creator.
- Allowed authenticated reads; denied unauthenticated reads and writes.
- Denied viewer writes, invalid ranks, forged identifiers/creator,
  duplicate check IDs, missing/archived members, inapplicable requirements,
  and archived-requirement writes.
- Verified Done/Pending persistence, independent concurrent checkbox writes,
  non-archived roster, suspension-preserving reads, rank changes, retained
  hidden checks, requirement archiving, event separation, and audit logging.
- Exercised the actual PDF renderer with 75 members, 12 long requirement
  titles, multiple pages, Done/Pending/N/A text, and signatures.

The tracker UI uses a dedicated header and rank controls, colored summary
cards, requirement cards with edit/archive menus, and a searchable member
checklist with completion-status filters. Desktop shows a table with a sticky
member column; mobile shows individual member cards. Done/Pending controls
remain native checkboxes with keyboard focus indicators. Reset is visible in
its own section, with its existing password confirmation.

The actual UI components were exercised in headless Chrome with isolated test
services on desktop (1440px) and mobile (390px). Verified page width, filters,
checkbox updates, export/editor/rank/reset dialogs, viewer restrictions,
setup empty state, and permission errors. Desktop, mobile, editor, and export
screenshots were reviewed locally. Production data was not used for these UI
checks.

Portrait and Landscape PDFs were generated with 75 members and 12 requirements
and visually reviewed using PDF.js. Verified page dimensions, both logos,
headers on every page, complete content, signatures, and missing-logo fallback.
The shared-header Contributions export passed a regression check. Browser
checks verified switching both orientation options in the export dialog.

Live authenticated browser/mobile walkthroughs remain to be checked against
the deployed rules. No production member or event documents were changed.
