# MATS Public Schedule — Firestore Read Investigation Report

## Executive Summary & Optimization Verification

### 1. Has the Previous Issue (Full-Collection Read) Been Resolved?
**Yes.** The previous critical bottleneck—where [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx) and [`submitPublicScheduleSelections()`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L379-L418) performed full-collection `getDocs(collection(db, 'schedules'))` reads—**has been resolved in the current codebase**:

1. **Date-Range Filtering on Page Load**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L74-L77), schedule loading now calls:
     ```ts
     scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate)
     ```
   - In [`scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57-L71), this runs a scoped query:
     ```ts
     query(schedulesRef, where('date', '>=', startDate), where('date', '<=', endDate))
     ```
     It now reads **only schedules within the publication window** (e.g., 20–60 docs for a typical month), rather than the entire historical database of schedules.

2. **Scoped Reads During Submission**:
   - In [`scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L379-L387), [`submitPublicScheduleSelections`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L379) now calls:
     ```ts
     this.getSchedulesByIds(targetScheduleIds)
     ```
     which chunks publication schedule IDs into batches of 30 using `where(documentId(), 'in', chunk)`. It no longer reads the entire `schedules` collection.

3. **No Reads on Member Selection or Time-Slot Selection**:
   - Selecting a member name or clicking schedule cells is **100% in-memory React state management**. Zero Firestore reads occur while interacting with the matrix table.

---

## Complete End-to-End Flow Trace

```
1. Access /public/schedule/:id
   ├─ Maintenance Check: getDoc (settings/maintenanceMode) + onSnapshot listener (1 read cached)
   ├─ Publication Lookup: getDoc (schedulePublications/:id) (1 read)
   ├─ Schedule Loading: getDocs (schedules WHERE date >= start AND date <= end) (e.g., ~30 reads)
   └─ Member List Loading: getDocs (members) (all members, e.g., ~60–100 reads)
2. Member Selection (In-memory, 0 reads)
3. Slot Selection (In-memory, 0 reads)
4. Form Submission
   ├─ getSchedulesByIds: getDocs (schedules WHERE documentId IN [ids]) (target schedules only, ~30 reads)
   ├─ updateDoc: updates assignedMembers for modified schedules (writes)
   ├─ addDoc: auditLogs (write)
   └─ updateDoc: markMemberSubmitted on schedulePublications/:id (write)
5. Post-Submit Refresh
   ├─ Invalidate & Fetch Publication: getDoc (schedulePublications/:id) (1 read)
   └─ Invalidate & Fetch Schedules: getDocs (schedules WHERE date range) (~30 reads)
```

---

## Complete Firestore Operation Inventory

| File & Location | Function / Hook | Target Collection | Firestore Operation | Trigger / When It Executes | Potential Docs Read | Executes Once / Repeatedly | On Page Load | On Full Refresh | On Member Select | On Slot Select | On Submit | Post-Submit |
|---|---|---|---|---|---:|---|:---:|:---:|:---:|:---:|:---:|:---:|
| [`src/services/maintenanceService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L19-L51) | `getMaintenanceSettings` | `settings` (`maintenanceMode`) | `getDoc` | Mount of `MaintenanceProvider` | **1** (or 0 if cached < 60s) | Once on app load | Yes | Yes | No | No | No | No |
| [`src/services/maintenanceService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L96-L126) | `subscribeToMaintenanceSettings` | `settings` (`maintenanceMode`) | `onSnapshot` | Mount of `MaintenanceProvider` | **1** (initial snapshot) | Once listener active | Yes | Yes | No | No | No | No |
| [`src/services/publicationService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/publicationService.ts#L38-L43) | `getPublication` | `schedulePublications` | `getDoc` | `PublicSchedulePage` `loadData()` | **1** | Once per page load | Yes | Yes | No | No | No | No |
| [`src/services/scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57-L71) | `getSchedulesByDateRange` | `schedules` | `getDocs` (`where date >= && date <=`) | `PublicSchedulePage` `loadData()` | **N** (schedules in date range, e.g., 20–60) | Once per page load | Yes | Yes | No | No | No | No |
| [`src/services/memberService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/memberService.ts#L23-L52) | `getMembers` | `members` | `getDocs` (collection) | `PublicSchedulePage` `loadData()` | **M** (all documents in `members` collection, e.g., ~80) | Once per page load | Yes | Yes | No | No | No | No |
| [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L108-L121) | Member select effect | *None (In-memory)* | *None* | User selects name from picker dropdown | **0** | Every time member is selected | No | No | **No reads** | No | No | No |
| [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L232-L306) | `handleCellClick` | *None (In-memory)* | *None* | User clicks table cells to toggle slots | **0** | On every cell click | No | No | No | **No reads** | No | No |
| [`src/services/scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L76-L104) | `getSchedulesByIds` (via `submitPublicScheduleSelections`) | `schedules` | `getDocs` (`where documentId() in chunk`) | User confirms "Save Schedule" | **N** (schedules in publication, e.g., 20–60) | Once per submission | No | No | No | No | **Yes** | No |
| [`src/services/scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L404-L408) | `submitPublicScheduleSelections` | `schedules` | `updateDoc` | Saving updated member list per schedule | **0 reads** (1 write per changed schedule) | Per modified schedule | No | No | No | No | **Yes** (write) | No |
| [`src/services/publicationService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/publicationService.ts#L124-L130) | `markMemberSubmitted` | `schedulePublications` | `updateDoc` (`arrayUnion`) | User confirms "Save Schedule" | **0 reads** (1 write) | Once per submission | No | No | No | No | **Yes** (write) | No |
| [`src/services/auditService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/auditService.ts#L32-L56) | `logAction` | `auditLogs` | `addDoc` | Triggered by submit | **0 reads** (1 write) | Once per submission | No | No | No | No | **Yes** (write) | No |
| [`src/services/publicationService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/publicationService.ts#L38-L43) | `getPublication` | `schedulePublications` | `getDoc` | Post-submit reload | **1** | Once after submission | No | No | No | No | No | **Yes** |
| [`src/services/scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57-L71) | `getSchedulesByDateRange` | `schedules` | `getDocs` (`where date >= && date <=`) | Post-submit reload | **N** (schedules in date range, e.g., 20–60) | Once after submission | No | No | No | No | No | **Yes** |

---

## Detailed Step-by-Step Read Breakdown

### Step 1: Initial Page Load (`/public/schedule/:publicationId`)
When an altar server opens the public link:
1. **Maintenance Guard**:
   - [`maintenanceService.getMaintenanceSettings()`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L19): Reads `settings/maintenanceMode` (`getDoc`) = **1 read** (or 0 if cached in-memory < 60s).
   - [`maintenanceService.subscribeToMaintenanceSettings()`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L96): `onSnapshot` on `settings/maintenanceMode` = **1 read**.
2. **Publication Fetch**:
   - [`publicationService.getPublication(publicationId)`](file:///C:/Users/kyle/Desktop/MATS/src/services/publicationService.ts#L38): Single `getDoc` on `schedulePublications/{publicationId}` = **1 read**.
3. **Date-Scoped Schedules Fetch**:
   - [`scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate)`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57): `getDocs` with `where('date', '>=', startDate)` and `where('date', '<=', endDate)` = **N reads** (where $N$ is the number of schedules in the active publication month, typically **~25–40 docs**).
4. **Member List Fetch**:
   - [`memberService.getMembers()`](file:///C:/Users/kyle/Desktop/MATS/src/services/memberService.ts#L23): `getDocs(collection(db, 'members'))` = **M reads** (where $M$ is total member docs in the system, typically **~50–100 docs**).
* **Total Reads on Page Load**: $\approx 1 + 1 + 1 + 30 + 80 = \mathbf{113\text{ reads}}$.

---

### Step 2: Member Selection & Matrix Interaction
- Selecting a member name from the dropdown updates local React state (`selectedMemberId`).
- Clicking time slots on the matrix table triggers `handleCellClick`, updating local React state (`selectedScheduleIds`).
* **Total Reads during Selection**: $\mathbf{0\text{ reads}}$ (completely client-side).

---

### Step 3: Submitting Selections (`handleConfirmedSave`)
When the member clicks "Yes, Save Schedule":
1. **Pre-submit schedule fetch**:
   - [`scheduleService.getSchedulesByIds(targetScheduleIds)`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L76): Reads publication schedule documents by ID to check lock status and avoid overwriting concurrent assignments = **N reads** (e.g., **~25–40 reads**).
2. **Updates & Logging**:
   - `updateDoc` on modified schedules = **Writes only** (0 reads).
   - `updateDoc` on `schedulePublications/{id}` (`markMemberSubmitted`) = **Writes only** (0 reads).
   - `addDoc` on `auditLogs` = **Writes only** (0 reads).
* **Total Reads during Submission Action**: $\approx \mathbf{30\text{ reads}}$.

---

### Step 4: Post-Submission UI Refresh
After submission finishes successfully:
1. **Re-fetch publication**:
   - [`publicationService.getPublication(publicationId)`](file:///C:/Users/kyle/Desktop/MATS/src/services/publicationService.ts#L38): Single `getDoc` = **1 read**.
2. **Re-fetch publication schedules**:
   - [`scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate)`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57): `getDocs` for date range = **N reads** (e.g., **~30 reads**).
3. Member list is **not re-fetched** (reuses already loaded member state).
* **Total Reads Post-Submission**: $\approx 1 + 30 = \mathbf{31\text{ reads}}$.

---

## Session Cost Comparison

| Scenario | Prior Implementation (Before Optimization) | Current Implementation (Investigated) |
|---|---|---|
| **Page Load (1 visitor)** | Full `schedules` collection read ($\approx 500+$ docs) + Full `members` read | Scoped date range ($\approx 30$ docs) + `members` read ($\approx 80$ docs) $\approx \mathbf{113\text{ reads}}$ |
| **Slot Selections** | 0 reads | **0 reads** |
| **Save Submission** | Full `schedules` collection read ($\approx 500+$ docs) | Scoped ID batching ($\approx 30$ docs) $\approx \mathbf{30\text{ reads}}$ |
| **Post-Submit Refresh** | Full `schedules` collection read ($\approx 500+$ docs) | Scoped date range ($\approx 30$ docs) $\approx \mathbf{31\text{ reads}}$ |
| **Total 1 Complete Submission Session** | **$\approx 1,600+$ reads** | **$\approx 174\text{ reads}$** (~90% reduction) |
| **50 Members Submitting in 1 Day** | **$\approx 80,000+$ reads** (exceeded free tier quota) | **$\approx 8,700\text{ reads}$** (well within normal quota) |

---

## Observations on Remaining Read Overhead (For Future Review)

While the full collection reads on `schedules` have been eliminated, here are the current characteristics of the codebase observed during this investigation:

1. **`memberService.getMembers()` reads the full `members` collection on load**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81), `memberService.getMembers()` fetches all member documents, then filters by status/rank client-side.
2. **`staleTime: 0` on React Query**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L56), React Query calls specify `staleTime: 0`. If a visitor refreshes the browser page, it performs a new fetch rather than serving from memory.
3. **Double fetch during submit flow**:
   - Submission reads target schedules via `getSchedulesByIds` (~30 reads) and immediately afterwards post-submit refresh reads them again via `getSchedulesByDateRange` (~30 reads).
