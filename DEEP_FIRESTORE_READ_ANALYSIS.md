# MATS Deep Firestore Read Analysis & Codebase Audit

## 1. Public Schedule Deep-Flow Analysis

### Flow Trace & Operation Breakdown

```
[Public Schedule Link: /public/schedule/:id]
  │
  ├── 1. Maintenance & Auth Initialization
  │      ├─ AuthContext: onAuthStateChanged → returns null for public visitors (0 user doc reads)
  │      ├─ MaintenanceProvider: maintenanceService.getMaintenanceSettings() → getDoc('settings/maintenanceMode') (1 read, in-memory cached for 60s)
  │      └─ MaintenanceProvider: subscribeToMaintenanceSettings() → onSnapshot('settings/maintenanceMode') (1 read initial listener)
  │
  ├── 2. Publication Configuration Lookup
  │      └─ PublicSchedulePage: queryClient.fetchQuery(['publication', publicationId])
  │            └─ publicationService.getPublication(id) → getDoc('schedulePublications/:id') (1 read)
  │
  ├── 3. Data Loading (Executed in parallel via Promise.all)
  │      ├─ Public Schedules Query:
  │      │     └─ queryClient.fetchQuery(['public-schedules', pub.id, pub.startDate, pub.endDate])
  │      │           └─ scheduleService.getSchedulesByDateRange(startDate, endDate)
  │      │                 └─ getDocs(query('schedules', where('date', '>=', start), where('date', '<=', end)))
  │      │                 └─ Read count: Scoped to date range (typically 20–60 docs for 1–2 months)
  │      └─ Member Dropdown Lookup:
  │            └─ queryClient.fetchQuery(['public-active-members-non-squire'])
  │                  └─ memberService.getMembers()
  │                        └─ getDocs(collection(db, 'members'))
  │                        └─ Read count: ALL documents in members collection (typically 80–150 docs)
  │
  ├── 4. Matrix Grouping & Validation (Client-Side)
  │      ├─ publicationSchedules: filtered in-memory via useMemo (0 reads)
  │      ├─ sundayPatterns / weekdayPatterns: grouped in-memory via useMemo (0 reads)
  │      └─ memberMap / limit computations: computed in-memory (0 reads)
  │
  ├── 5. Member Selection & Slot Click Interactions
  │      ├─ Selecting name from picker dropdown: updates local selectedMemberId state (0 reads)
  │      └─ Clicking cells (+ / server slot): updates local selectedScheduleIds state (0 reads)
  │
  ├── 6. Submission Execution (handleConfirmedSave)
  │      ├─ scheduleService.submitPublicScheduleSelections(memberId, selections):
  │      │     └─ scheduleService.getSchedulesByIds(targetScheduleIds)
  │      │           └─ getDocs(query('schedules', where(documentId(), 'in', chunk30)))
  │      │           └─ Read count: Exactly N target schedules in publication (e.g., 20–60 docs)
  │      ├─ updateDoc('schedules/:id', { assignedMembers }) → Writes only (0 reads)
  │      ├─ publicationService.markMemberSubmitted(pubId, memberId) → Writes only (0 reads)
  │      └─ auditService.logAction(...) → Writes only (0 reads)
  │
  └── 7. Post-Submission Data Refresh
         ├─ Invalidate & fetch publication: getDoc('schedulePublications/:id') (1 read)
         └─ Invalidate & fetch schedules: getDocs(query('schedules', where date range)) (20–60 reads)
```

### Critical Findings on Public Schedule

1. **`staleTime: 0` Nullifies React Query Caching on Public Schedule**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L56), lines 56, 76, 90, 351, and 361 pass `staleTime: 0` to `queryClient.fetchQuery`.
   - **Impact**: Because `staleTime: 0` is hardcoded, React Query marks the data stale instantly. Whenever a visitor refreshes the page, switches browser tabs, or opens the link again, React Query executes the network fetch and reads Firestore anew.
2. **Full `members` Collection Read on Every Public Page Load**:
   - Line 81 calls [`memberService.getMembers()`](file:///C:/Users/kyle/Desktop/MATS/src/services/memberService.ts#L23) which runs `getDocs(collection(db, 'members'))`.
   - **Impact**: Even though `schedules` is date-scoped (~30 docs), fetching the full `members` list adds **80–150 reads** per visitor page open.
3. **Double Fetch on Submission**:
   - During submit, [`submitPublicScheduleSelections`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L379) fetches target schedules via `getSchedulesByIds` (~30 reads), and immediately afterwards the post-submit refresh re-fetches them via `getSchedulesByDateRange` (~30 reads).
4. **Multiple Tabs / Multi-Device Scaling**:
   - Firestore Web SDK in this app runs in standard in-memory client mode without multi-tab IndexedDB sync (`enableIndexedDbPersistence` is not configured). Each open tab/window is completely isolated and performs its own independent Firestore reads.

---

## 2. Hidden Reads Investigation (Across the Entire Codebase)

A comprehensive codebase audit reveals several **major hidden read loops** outside the Public Schedule page that generate substantial Firestore read traffic during everyday operations:

| Surface | Function / Operations | Reads per Invocation |
|---|---|---|
| **Internal Dashboard** (Landing page for admins, coordinators, & officers) | `dashboardService.getDashboardData()` + `reportService.loadReportData()` | **2x full schedules read**<br>**2x full members read**<br>**1x full attendanceSessions**<br>**1x attendance query**<br>**Total: ~1,500 - 3,000 reads** |
| **Internal Attendance Page** | `AttendancePage.loadData()` | **1x full schedules read**<br>**1x full members read**<br>**1x full attendanceSessions** |
| **Internal Schedules Page** | `SchedulesPage.loadData()` | **1x full schedules read**<br>**1x full members read**<br>**1x full attendanceSessions** |
| **Public Event Forms** | `PublicEventFormPage` (with `member_selector` question) | **1x full members read**<br>**1x full responses read**<br>(with `staleTime: 0`) |

### Key Source: `dashboardService.getDashboardData()`
In [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L51-L80):
1. When any authenticated user lands on the dashboard, [`DashboardOverview.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/dashboard/components/DashboardOverview.tsx#L156) runs `dashboardService.getDashboardData()`.
2. It executes:
   - `getDocs(collection(db, 'attendanceSessions'))`
   - `memberService.getMembers(true)` (**all members**)
   - `scheduleService.getSchedules()` (**all schedules in Firestore across all time**)
   - `reportService.loadReportData(startDate, endDate)` (to count suspended members), which **again** calls:
     - `getDocs(membersRef)` in [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L134) (**all members a second time**)
     - `getDocs(schedulesRef)` in [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135) (**all schedules a second time — without date filtering at the Firestore level!**)
     - `getDocs(attendanceQuery)`
3. **Total Reads per Single Dashboard Page Visit**: **$\approx 1,500\text{ to }3,000+\text{ document reads}$** depending on total schedule history.

---

## 3. PWA & Service Worker Behavior

Inspecting [`public/sw.js`](file:///C:/Users/kyle/Desktop/MATS/public/sw.js), [`src/registerSW.ts`](file:///C:/Users/kyle/Desktop/MATS/src/registerSW.ts), and [`src/context/PWAContext.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/context/PWAContext.tsx):

1. **Does the Service Worker intercept Firestore?**
   - In [`public/sw.js`](file:///C:/Users/kyle/Desktop/MATS/public/sw.js#L20-L31), `isFirebaseOrApiRequest(url)` checks for `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, etc.
   - Lines 66–69 explicitly forward matching URLs directly to native `fetch(request)` without caching.
   - **Conclusion**: The Service Worker does **not** duplicate or double-proxy Firestore network requests.
2. **Can Service Worker updates cause re-mounts?**
   - In [`public/sw.js`](file:///C:/Users/kyle/Desktop/MATS/public/sw.js#L34-L53), `self.skipWaiting()` and `self.clients.claim()` are called during installation/activation.
   - If an updated service worker activates while a user is on the page, or if a user clicks update on the PWA prompt, the browser reloads the app shell `/index.html`, causing a full page remount and triggering all page load queries once again.
3. **PWA Standalone Window vs. Browser Tab**:
   - If a user has the app installed as a PWA and also opens a public link in Mobile Safari/Chrome, both run as completely separate instances.

---

## 4. React Query Configuration & Behavior Analysis

Inspecting [`src/main.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/main.tsx#L9-L16):
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default
      retry: 1,
    },
  },
})
```

### Analysis of Query Behavior in Features:
1. **Public Schedule Page**:
   - Overrides `staleTime` with `staleTime: 0`.
   - Uses `queryClient.fetchQuery()` imperatively inside `loadData()` within `useEffect`.
   - **Result**: Data is never cached across mounts or re-renders. Every navigation or reload triggers a fresh Firestore read.
2. **Public Event Form Page**:
   - Overrides `staleTime` with `staleTime: 0` for questions, members, and responses.
   - **Result**: Every form view executes fresh Firestore reads.
3. **Internal Event Forms Management**:
   - Correctly uses `staleTime: 1000 * 60 * 2` for forms and `1000 * 30` for response counts via aggregate queries.
4. **Internal Dashboard, Schedules, Attendance, Members, Reports**:
   - Do **not** use React Query at all. They use raw `useEffect` and component state, executing raw Firestore queries on every tab click or route transition.

---

## 5. Maintenance Mode Firestore Read Profile

Inspecting [`src/services/maintenanceService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts) and [`src/context/MaintenanceContext.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/context/MaintenanceContext.tsx):

| User Category | Route Accessed | Maintenance Mode State | Reads Triggered by Maintenance Check | Are Expensive Modules Blocked? |
|---|---|---|:---:|:---:|
| **A. Unauthenticated User** | `/login` or `/` | Enabled | **1** (`onSnapshot` on `settings/maintenanceMode`) | **Yes** — Redirected to login / maintenance screen. Dashboard is not mounted. |
| **B. Normal Authenticated Member** | `/` (Dashboard) | Enabled | **1** (`onSnapshot` on `settings/maintenanceMode`) + 1 `users/:uid` listener | **Yes** — Blocked by `MaintenanceGuard`, auto-logged out. Dashboard queries never execute. |
| **C. Coordinator** | `/` (Dashboard) | Enabled | **1** (`onSnapshot` on `settings/maintenanceMode`) + 1 `users/:uid` listener | **No** — Allowed full access. Standard dashboard queries execute. |
| **D. Public Visitor** | `/public/schedule/:id` | Enabled or Disabled | **1** (`onSnapshot` on `settings/maintenanceMode`) | **Allowed** — `PublicMaintenanceGuard` allows access unless maintenance is specifically configured to block public routes. |
| **E. Public Visitor** | `/public/events/.../forms/:id` | Enabled or Disabled | **1** (`onSnapshot` on `settings/maintenanceMode`) | **Allowed** — `PublicMaintenanceGuard` allows public form access. |

---

## 6. Comprehensive Query Inventory & Risk Classification

Classification of every Firestore collection query across the entire MATS project:

| Collection | Location & Method | Query Characteristics | Risk Rating | Rationale |
|---|---|---|:---:|---|
| `schedules` | [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L75) `getSchedulesByDateRange` | `where('date', '>=', start)` & `where('date', '<=', end)` | **SAFE** | Scoped strictly to publication date window (20–60 docs). |
| `schedules` | [`src/services/scheduleService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L385) `submitPublicScheduleSelections` | `where(documentId(), 'in', chunk)` | **SAFE** | Scoped strictly to target schedule IDs. |
| `members` | [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81) `memberService.getMembers()` | `getDocs(collection(db, 'members'))` | **POTENTIALLY EXPENSIVE** | Reads all member docs (~80–150 docs) on every public schedule visit. |
| `schedulePublications` | [`src/services/publicationService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/publicationService.ts#L38) `getPublication(id)` | `getDoc(doc(db, 'schedulePublications', id))` | **SAFE** | Single document read. |
| `settings` | [`src/services/maintenanceService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L96) `subscribeToMaintenanceSettings` | `onSnapshot(doc(db, 'settings', 'maintenanceMode'))` | **SAFE** | Single document realtime listener (1 read on load). |
| `schedules` | [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L64) `scheduleService.getSchedules()` | `getDocs(collection(db, 'schedules'))` | **HIGH RISK** | Reads entire `schedules` collection on every admin dashboard visit. |
| `schedules` | [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135) `loadReportData` | `getDocs(schedulesRef)` (client-side filtered) | **HIGH RISK** | Reads entire `schedules` collection without Firestore date query. Called by Dashboard & Reports. |
| `members` | [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L63) `memberService.getMembers(true)` | `getDocs(collection(db, 'members'))` | **POTENTIALLY EXPENSIVE** | Reads all members on dashboard visit. |
| `members` | [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L134) `loadReportData` | `getDocs(membersRef)` | **POTENTIALLY EXPENSIVE** | Reads all members on report/dashboard load. |
| `attendanceSessions` | [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L53) | `getDocs(collection(db, 'attendanceSessions'))` | **POTENTIALLY EXPENSIVE** | Reads all session records on dashboard load. |
| `attendance` | [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L107) `attendanceQuery` | `where('attendanceDate', '>=', start)` | **SAFE** | Date-filtered query. |
| `schedules` | [`src/features/schedules/pages/SchedulesPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74) `getSchedules()` | `getDocs(collection(db, 'schedules'))` | **HIGH RISK** | Reads entire `schedules` collection when viewing internal Schedules tab. |
| `schedules` | [`src/features/attendance/pages/AttendancePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151) `getSchedules()` | `getDocs(collection(db, 'schedules'))` | **HIGH RISK** | Reads all schedules just to find one `scheduleId` in attendance session. |
| `eventForms` | [`src/services/eventFormService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/eventFormService.ts#L25) `getFormsByEventId` | `where('eventId', '==', eventId)` | **SAFE** | Scoped to event ID. |
| `eventFormResponses` | [`src/services/eventFormResponseService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/eventFormResponseService.ts#L185) `getResponseCountByFormId` | `getCountFromServer(where formId==)` | **SAFE** | Server aggregate count (1 read per 1,000 index entries). |
| `eventFormQuestions` | [`src/services/eventFormQuestionService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/eventFormQuestionService.ts#L22) `getQuestionsByFormId` | `where('formId', '==', formId)` | **SAFE** | Scoped to form ID. |
| `eventTasks` | [`src/services/eventTaskService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/eventTaskService.ts#L23) `getTasksByEventId` | `where('eventId', '==', eventId)` | **SAFE** | Scoped to event ID. |
| `eventIncome` / `eventExpenses` | [`src/services/eventFinanceService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/eventFinanceService.ts#L41) | `where('eventId', '==', eventId)` | **SAFE** | Scoped to event ID. |
| `excuseRequests` | [`src/services/excuseService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/excuseService.ts#L100) `getExcuseRequests` | `orderBy('submittedAt', 'desc')` | **POTENTIALLY EXPENSIVE** | Reads all excuse requests when admin opens Excuse management. |

---

## 7. Realistic Read Scenarios & Calculations

*Baseline assumed collection sizes: `members` = 80 docs, `schedules` in active publication range = 30 docs, full `schedules` history = 500 docs, `attendanceSessions` = 60 docs.*

### Scenario A: One person opens the Public Schedule once
- Maintenance check (`getDoc` + `onSnapshot`): $1 + 1 = 2\text{ reads}$
- Publication lookup (`getDoc`): $1\text{ read}$
- Publication schedules (`getDocs` date-range): $30\text{ reads}$
- Member list (`getDocs` full members collection): $80\text{ reads}$
- **Total: $\approx \mathbf{113\text{ reads}}$**

### Scenario B: One person opens → refreshes 5 times
- Initial load: $113\text{ reads}$
- 5 refreshes $\times (1\text{ publication} + 30\text{ schedules} + 80\text{ members} + 1\text{ maintenance})$: $5 \times 112 = 560\text{ reads}$
- **Total: $\approx \mathbf{673\text{ reads}}$**

### Scenario C: 10 people open the Public Schedule once
- $10 \times 113\text{ reads}$
- **Total: $\approx \mathbf{1,130\text{ reads}}$**

### Scenario D: 25 people open the Public Schedule
- $25 \times 113\text{ reads}$
- **Total: $\approx \mathbf{2,825\text{ reads}}$**

### Scenario E: 25 people submit a schedule selection
- 25 initial page loads: $25 \times 113 = 2,825\text{ reads}$
- 25 submissions $\times (30\text{ target schedules via getSchedulesByIds})$: $25 \times 30 = 750\text{ reads}$
- 25 post-submit refreshes $\times (1\text{ publication} + 30\text{ schedules})$: $25 \times 31 = 775\text{ reads}$
- **Total: $\approx \mathbf{4,350\text{ reads}}$**

### Scenario F: 25 form responses + public schedule traffic + internal admin activity
- 25 Public Schedule submissions: $\approx 4,350\text{ reads}$
- 25 Public Event Form submissions ($\approx 85\text{ reads per form submission}$): $25 \times 85 \approx 2,125\text{ reads}$
- 10 Admin/Coordinator internal visits (Dashboard + Attendance + Schedules $\approx 2,500\text{ reads/session}$): $10 \times 2,500 \approx 25,000\text{ reads}$
- **Total: $\approx \mathbf{31,475\text{ reads}}$**

---

## 8. Root Cause Analysis: Top 3 Contributors to Read Usage

### TOP 1: Internal Dashboard & Report Dual Full-Collection Reads
- **Exact Files**: [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L62-L80) and [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L133-L137)
- **Exact Functions**: `dashboardService.getDashboardData()` and `reportService.loadReportData()`
- **Exact Operations**: `getDocs(collection(db, 'schedules'))` and `getDocs(collection(db, 'members'))`
- **Why It Produces High Reads**:
  Every time any coordinator or officer opens or refreshes the application dashboard, it executes **two unconstrained full-collection reads of `schedules`** and **two unconstrained full-collection reads of `members`** in parallel without React Query caching. In [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L144), date filtering is performed in JavaScript memory *after* downloading the entire historical schedule collection from Firestore.
- **Estimated Impact**: **1,500 to 3,000 reads per dashboard view**. Just 20 dashboard opens generate 30,000–60,000 reads.
- **Confidence Level**: **99%**

### TOP 2: Full `members` Collection Download on Public Schedule & Forms with `staleTime: 0`
- **Exact Files**: [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L78-L91) and [`src/features/events/pages/PublicEventFormPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L78-L82)
- **Exact Functions**: `loadData()` calling `memberService.getMembers()`
- **Exact Operations**: `getDocs(collection(db, 'members'))`
- **Why It Produces High Reads**:
  To populate the member name selector, both public pages download every member record in the church database on every single page load. Because `staleTime: 0` is hardcoded, React Query bypasses cache on every page open, multiplying reads across mobile devices and page reloads.
- **Estimated Impact**: **80–150 reads per public visitor visit**.
- **Confidence Level**: **95%**

### TOP 3: Full-Collection Reads in Internal Schedules & Attendance Pages
- **Exact Files**: [`src/features/schedules/pages/SchedulesPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74) and [`src/features/attendance/pages/AttendancePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151)
- **Exact Functions**: `loadData()` in both pages
- **Exact Operations**: `getDocs(collection(db, 'schedules'))`
- **Why It Produces High Reads**:
  When managing schedules or marking attendance for a specific session, both pages download the entire historical `schedules` collection rather than querying by date range or single document ID (`scheduleService.getScheduleById(scheduleId)`).
- **Estimated Impact**: **500–1,000+ reads per tab open**.
- **Confidence Level**: **95%**

---

## RECOMMENDED FIXES — NOT IMPLEMENTED

*(The following potential solutions are provided for architectural review only. No code has been modified.)*

1. **Optimize Internal Dashboard & Report Schedule Queries**:
   - In [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L108-L124), apply Firestore `where('date', '>=', startDate)` and `where('date', '<=', endDate)` filters directly in the Firestore query instead of downloading all schedules and filtering client-side.
   - In [`dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L64), scope today's schedules query to current date/month or reuse the data loaded by `reportService` rather than calling `scheduleService.getSchedules()` twice.
2. **Apply Server-Side Filtering or Caching for Public Member Selection**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx), increase React Query `staleTime` for member queries (e.g., 10–30 minutes) so repeated navigation or tab switching within a session uses cached member data.
   - Alternatively, query only active non-squire members using server-side query filters (`where('status', '==', 'active')`).
3. **Remove Redundant `getSchedulesByIds` in Public Schedule Submit**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx), the component already holds the loaded publication schedules in state. If conflict checks are verified or updated via single document transaction/batch updates, duplicate batch reads prior to write can be minimized.
4. **Scope Internal Attendance & Schedule Management Reads**:
   - In [`AttendancePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151), replace `scheduleService.getSchedules()` with a single document fetch `scheduleService.getScheduleById(scheduleId)`.
   - In [`SchedulesPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74), load schedules scoped to the currently viewed month or date range rather than the entire collection.
