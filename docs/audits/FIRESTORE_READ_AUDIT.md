# Firestore Read Audit (Event Forms + Public Schedule)

## Summary

**Most likely source of high reads (52K):**

1. **Public Schedule full-collection reads** (`schedules`) on public traffic/refreshes.
2. **Event Forms management N+1 response reads** (one query per form, each reading all responses for that form).

No major targeted `onSnapshot` realtime listener source was found in these feature services/components; read load appears primarily from repeated `getDocs` calls.

---

## Query Inventory (Focused Scope)

| File | Function/component | Collection | Method | When it executes | Potential docs read | Every page load | Every React render | Realtime | Caching | Duplicated |
|---|---|---|---|---|---:|---|---|---|---|---|
| `src/features/schedules/pages/PublicSchedulePage.tsx` | Public schedule page loader | `schedules` | likely `getDocs` via service | On public page mount/load | **All schedule docs** | **Yes** | No | No | No React Query cache observed | Similar full read pattern exists |
| `src/services/scheduleService.ts` | `getSchedules()` | `schedules` | `getDocs(collection(...))` | Called by schedule UIs/public page | **All schedule docs** | Caller-dependent (public likely yes) | No | No | None | Yes |
| `src/services/scheduleService.ts` | `submitPublicScheduleSelections()` | `schedules` | `getDocs(collection(...))` | Public submission/update action | **All schedule docs** | Per submit | No | No | None | Duplicates schedule data reads |
| `src/features/events/pages/PublicEventFormPage.tsx` | Public form loader flow | `eventForms`, `eventFormQuestions`, optional `eventFormResponses` | service `getDocs/getDoc` chain | On public form mount; submit/edit flow | form: ~1, questions: all for form, optional response lookup: ~1 | Yes | No | No | No React Query cache observed | Overlaps with internal form loads |
| `src/services/eventFormService.ts` | `getFormById(formIdOrSlug)` | `eventForms` | `getDocs(where slug==)` + fallback `getDoc(id)` | Every public form open | ~1 (+fallback doc read path) | Yes | No | No | None | Pattern reused internally |
| `src/services/eventFormQuestionService.ts` | `getQuestionsByFormId(formId)` | `eventFormQuestions` | `getDocs(where formId==)` | Public form load / builder edit | All questions for form | Yes (when used on load) | No | No | None | Used by multiple surfaces |
| `src/services/eventFormResponseService.ts` | `getResponseByTrackingNumber()` | `eventFormResponses` | `getDocs(where trackingNumber==)` | Public revisit/edit via tracking | Usually 1 | Conditional | No | No | None | Not majorly duplicated |
| `src/services/eventFormResponseService.ts` | `submitResponse()` pre-check queries | `eventFormResponses` | `getDocs(...)` | On each submit | Usually 0–1 per check | Per submit | No | No | None | Logical overlap with lookup flows |
| `src/features/events/components/EventFormsTab.tsx` | `fetchForms()` | `eventForms` + `eventFormResponses` | 1 form query + **N** response queries | Tab mount and post-action refresh | Forms for event + all responses for each form | On tab load | No | No | None | **Yes (N+1)** |
| `src/services/eventFormService.ts` | `getFormsByEventId(eventId)` | `eventForms` | `getDocs(where eventId==)` | Event form management load | All forms for event | Yes (when tab opens) | No | No | None | Reused |
| `src/services/eventFormResponseService.ts` | `getResponsesByFormId(formId)` | `eventFormResponses` | `getDocs(where formId==)` | Responses modal open and form count flow | All responses for form | Yes (when called) | No | No | None | Called repeatedly in different UI paths |
| `src/features/events/components/EventFormResponsesModal.tsx` | Responses modal loader | `eventFormResponses` (+ related form/question lookups) | service `getDocs` | On modal open | All responses for selected form | Per open | No | No | No cache observed | Overlaps with tab count reads |
| `src/features/events/components/EventFormBuilderModal.tsx` | Form builder edit loader | `eventFormQuestions` (+ form read) | service `getDocs/getDoc` | On modal open/edit | All questions for form | Per open | No | No | No cache observed | Overlaps with public/internal form reads |

---

## Findings by Requested Checks

### 1) Public Schedule page
- High risk of expensive reads if using `scheduleService.getSchedules()` because it reads the entire `schedules` collection.
- Public, unauthenticated traffic + refreshes can multiply reads quickly.

### 2) Public Event Form page
- Core expected reads: form + questions.
- Additional reads occur on submit/edit paths (existing response checks).
- No evidence these reads alone should hit 52K with only ~25 responses, unless traffic is high or repeated refreshes are frequent.

### 3) Event Forms management
- `EventFormsTab` performs an N+1 pattern: load forms, then load all responses per form for counts.

### 4) Event Form Responses
- `getResponsesByFormId` reads all form responses each call.
- Used in multiple surfaces (tab count and responses modal), causing duplicate cost.

### 5) Event Form Questions
- `getQuestionsByFormId` reads all questions for a form; expected but should be cached.

### 6) Event-related services
- `eventFormService`, `eventFormQuestionService`, `eventFormResponseService` use one-time `getDocs/getDoc`, no realtime listener pressure in scope.

### 7) Schedule services
- `getSchedules()` and `submitPublicScheduleSelections()` both perform full `schedules` collection reads.

### 8) `onSnapshot` listeners in these features
- No significant `onSnapshot` usage was found in the targeted Event Form/Public Schedule feature services/components.

### 9) `getDocs/getDoc` calls
- Multiple `getDocs` calls are present; expensive ones are those reading whole collections or repeated per-form loops.

### 10) `useEffect` hooks triggering queries
- `EventFormsTab` triggers `fetchForms()` in `useEffect([eventId])`.
- Public pages likely query on mount; public mount frequency drives read count.

### 11) React Query configuration/caching
- No clear React Query caching layer observed on these data fetches.

### 12) Duplicate queries/listeners
- Duplicate reads: response data loaded for counts and then loaded again in responses modal.
- Schedule full collection read pattern appears in multiple flows.

### 13) Entire-collection queries
- Confirmed in schedule service (`getSchedules`, `submitPublicScheduleSelections`).

---

## Estimated Reads per Public Page Visit

## Public Schedule visit
- Approx. **`# of docs in schedules`** reads per visit if full collection query is used.
- If visitors refresh frequently, reads scale linearly with traffic.

## Public Event Form visit
- Approx. **`1 form + all its questions`** (plus optional tracking response lookup).
- Typically far lower than full-schedule collection reads.

---

## Expensive Queries

1. `scheduleService.getSchedules()` → full `schedules` collection read.
2. `scheduleService.submitPublicScheduleSelections()` → full `schedules` collection read on submit.
3. `EventFormsTab.fetchForms()` → N+1 response queries via `getResponsesByFormId`.

---

## Duplicated Queries

1. Form response reads duplicated between:
   - counts in `EventFormsTab`
   - full response load in `EventFormResponsesModal`
2. Schedule full reads duplicated across:
   - public load flows
   - public submit/update flows

---

## What Should Use React Query Caching

1. Public form payload (`form + questions`) keyed by slug/id.
2. Public schedule payload keyed by public link scope + month/date range.
3. Internal forms list per event.
4. Response counts (if still read client-side) keyed by form/event.

---

## What Should Stay Realtime

- Only internal admin views that truly require live updates.
- Public schedule/form pages should generally not use realtime listeners.

---

## What Should Become One-Time Reads

1. Public schedule page data fetch.
2. Public form page data fetch (form + questions).
3. Internal form list and count fetches, invalidated only after mutations.

---

## Recommended Fixes (Not Implemented)

1. Constrain public schedule query by public link scope + month/date window (do not fetch all schedules).
2. In `submitPublicScheduleSelections`, fetch only targeted schedules instead of full collection.
3. Remove N+1 response-count loading in `EventFormsTab`:
   - use precomputed `responsesCount` per form, or
   - aggregate counts once per event in a dedicated structure.
4. Add React Query caching/stale times for public pages and form builder/management fetches.
5. Ensure public form page fetches only required entities:
   - required: form + questions
   - conditional: response lookup by tracking only when editing
   - avoid unrelated members/schedules/events/responses reads.
6. Keep response list query primarily in responses modal; avoid preloading full responses for every form card.
