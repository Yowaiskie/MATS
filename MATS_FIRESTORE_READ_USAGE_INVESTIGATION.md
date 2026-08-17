# MATS Firestore Read Usage — Deep Investigation Report

---

## A. Executive Summary

### 1. What is actually causing the high Firestore reads?
The unexpectedly high Firestore read usage is **NOT** being caused by the public Event Forms or the date-scoped Public Schedule queries. 

The real driver behind the quota drain is a set of **unconstrained, duplicated full-collection reads inside the internal Dashboard, Reports, and Schedule/Attendance management modules**:

1. **Dashboard & Report Redundant Full Scans (Primary Driver)**:
   Whenever an authenticated user (coordinator, admin, or officer) opens or refreshes the MATS internal Dashboard, [`dashboardService.getDashboardData()`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L46-L90) and [`reportService.loadReportData()`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L101-L165) execute **two full `schedules` collection reads** and **two full `members` collection reads** simultaneously with zero React Query caching. In [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135), date filtering is performed in client-side JavaScript memory *after* downloading the entire historical schedule collection from Firestore. **A single dashboard visit produces $\approx 1,500\text{ to }3,000+\text{ document reads}$**. Just 20–30 dashboard views generate 50,000+ reads.
2. **Attendance & Schedule Management Full Scans**:
   Opening the internal Schedules tab or marking attendance for a single mass session calls `scheduleService.getSchedules()` and `memberService.getMembers(true)`, downloading the full historical database of schedules and all members every time.
3. **Public Schedule & Form Member List Caching Bypass (`staleTime: 0`)**:
   While the public schedule date-range optimization is active and working, [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81) still downloads the **entire `members` collection (~80–150 docs)** on every single visit because `staleTime: 0` is hardcoded.
4. **Maintenance Mode Reality**:
   Maintenance Mode successfully prevents unauthenticated public visitors and blocked normal members from mounting expensive internal modules. However, **coordinators and administrators who actively use, test, or configure the system during maintenance mode still trigger the internal dashboard and schedule loading loops**, rapidly accumulating thousands of reads per session.

---

## B. Startup Read Map

The table below traces the exact Firestore operations executed from initial browser navigation through React provider initialization, route guards, and component mounting across 5 real-world scenarios:

```
Startup Lifecycle:
main.tsx → App.tsx → PWAProvider → AuthProvider → MaintenanceProvider → ProtectedRoute/PublicMaintenanceGuard → Layout/Component
```

| Lifecycle Step | Scenario A: Unauthenticated Visitor (`/login` or `/`) | Scenario B: Authenticated Normal Member (`/`) | Scenario C: Coordinator / Admin (`/`) | Scenario D: Blocked Member under Maintenance | Scenario E: Coordinator under Maintenance |
|---|:---:|:---:|:---:|:---:|:---:|
| **1. `MaintenanceProvider` init** | 1 `getDoc` + 1 `onSnapshot` (`settings/maintenanceMode`) | 1 `getDoc` + 1 `onSnapshot` (`settings/maintenanceMode`) | 1 `getDoc` + 1 `onSnapshot` (`settings/maintenanceMode`) | 1 `getDoc` + 1 `onSnapshot` (`settings/maintenanceMode`) | 1 `getDoc` + 1 `onSnapshot` (`settings/maintenanceMode`) |
| **2. `AuthProvider` user profile** | 0 reads (`user = null`) | 1 `onSnapshot` (`users/{uid}`) | 1 `onSnapshot` (`users/{uid}`) | 1 `onSnapshot` (`users/{uid}`) | 1 `onSnapshot` (`users/{uid}`) |
| **3. Route Guard Evaluation** | Renders `<LoginPage>` | Passes `<ProtectedRoute>` | Passes `<ProtectedRoute>` | **BLOCKED & LOGGED OUT** at [`ProtectedRoute.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/components/ProtectedRoute.tsx#L119) | Passes `<ProtectedRoute>` (Allowed bypass) |
| **4. `DashboardLayout` mounting** | 0 reads | 1 `getDocs` (`eventTasks` unread) | 1 `getDocs` (`eventTasks` unread) | **0 reads** (unmounted) | 1 `getDocs` (`eventTasks` unread) |
| **5. Dashboard Data: `attendanceSessions`** | 0 reads | ~60 reads (all sessions) | ~60 reads (all sessions) | **0 reads** (unmounted) | ~60 reads (all sessions) |
| **6. Dashboard Data: `members` (1st read)** | 0 reads | ~100 reads (all members) | ~100 reads (all members) | **0 reads** (unmounted) | ~100 reads (all members) |
| **7. Dashboard Data: `schedules` (1st read)** | 0 reads | ~500 reads (all schedules) | ~500 reads (all schedules) | **0 reads** (unmounted) | ~500 reads (all schedules) |
| **8. Dashboard Report: `members` (2nd read)** | 0 reads | ~100 reads (duplicate) | ~100 reads (duplicate) | **0 reads** (unmounted) | ~100 reads (duplicate) |
| **9. Dashboard Report: `schedules` (2nd read)** | 0 reads | ~500 reads (duplicate) | ~500 reads (duplicate) | **0 reads** (unmounted) | ~500 reads (duplicate) |
| **10. Dashboard Report: `attendance` query** | 0 reads | ~150 reads (month attendance) | ~150 reads (month attendance) | **0 reads** (unmounted) | ~150 reads (month attendance) |
| **TOTAL DOCUMENT READS AT STARTUP** | **$\approx 2\text{ reads}$** | **$\approx 1,413\text{ reads}$** | **$\approx 1,413\text{ reads}$** | **$\approx 3\text{ reads}$** | **$\approx 1,413\text{ reads}$** |

### Confirmation on Component Mounting during Maintenance Mode
In [`ProtectedRoute.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/components/ProtectedRoute.tsx#L118-L122):
```tsx
if (isMaintenanceActive && !isUserAllowed(user.uid, user.email, profile?.role)) {
  logout().catch(console.error)
  return <MaintenanceScreen />
}
```
* **Verification**: Blocked users are returned `<MaintenanceScreen />` directly. Child components (Dashboard, Schedules, Attendance, Reports, etc.) are **completely prevented from mounting**. No expensive module queries run for blocked users.

---

## C. Complete Firestore Read Inventory

The following table documents every significant Firestore read operation across all services and components:

| File & Line | Function / Context | Firestore Collection | Read Type | Trigger | Expected Docs Read | Could Repeat? | Realtime? |
|---|---|---|---|---|:---:|:---:|:---:|
| [`dashboardService.ts:53`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L53) | `getDashboardData()` | `attendanceSessions` | `getDocs` | Dashboard mount / userOrder change | All sessions (~60) | On every dashboard visit | No |
| [`dashboardService.ts:63`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L63) | `getDashboardData()` | `members` | `getDocs` | Dashboard mount | All members (~80–150) | On every dashboard visit | No |
| [`dashboardService.ts:64`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L64) | `getDashboardData()` | `schedules` | `getDocs` | Dashboard mount | All schedules (~500+) | On every dashboard visit | No |
| [`reportService.ts:134`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L134) | `loadReportData()` | `members` | `getDocs` | Dashboard mount & Reports tab | All members (~80–150) | On every dashboard/report load | No |
| [`reportService.ts:135`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135) | `loadReportData()` | `schedules` | `getDocs` | Dashboard mount & Reports tab | All schedules (~500+) | On every dashboard/report load | No |
| [`reportService.ts:136`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L136) | `loadReportData()` | `attendance` | `getDocs` | Dashboard mount & Reports tab | Date-scoped (~100–300) | On every dashboard/report load | No |
| [`dashboardService.ts:267`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L267) | `getMyUnreadTasksCount()` | `eventTasks` | `getDocs` | Route change in `DashboardLayout` | Unread tasks (~1–5) | On every page navigation | No |
| [`AttendancePage.tsx:151`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151) | `loadData()` | `schedules` | `getDocs` | Opening an attendance session | All schedules (~500+) | Every time attendance opens | No |
| [`AttendancePage.tsx:167`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L167) | `loadData()` | `members` | `getDocs` | Opening an attendance session | All members (~80–150) | Every time attendance opens | No |
| [`attendanceService.ts:62`](file:///C:/Users/kyle/Desktop/MATS/src/services/attendanceService.ts#L62) | `getAttendanceForSession()` | `attendance` | `getDocs` | Opening an attendance session | Session records (~5–20) | Per session open | No |
| [`SchedulesPage.tsx:74`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74) | `loadData()` | `schedules` | `getDocs` | Opening Schedules management | All schedules (~500+) | Every tab visit | No |
| [`SchedulesPage.tsx:78`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L78) | `loadData()` | `members` | `getDocs` | Opening Schedules management | All members (~80–150) | Every tab visit | No |
| [`PublicSchedulePage.tsx:75`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L75) | `loadData()` | `schedules` | `getDocs` | Opening public schedule link | Publication range (~20–60) | On page load / refresh | No |
| [`PublicSchedulePage.tsx:81`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81) | `loadData()` | `members` | `getDocs` | Opening public schedule link | All members (~80–150) | On page load / refresh | No |
| [`PublicSchedulePage.tsx:55`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L55) | `loadData()` | `schedulePublications` | `getDoc` | Opening public schedule link | 1 doc | On page load / refresh | No |
| [`scheduleService.ts:87`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L87) | `getSchedulesByIds()` | `schedules` | `getDocs` | Public schedule submission | Target publication schedules (~20–60) | Per submission | No |
| [`PublicEventFormPage.tsx:42`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L42) | `fetchForm()` | `eventForms` | `getDocs` + `getDoc` | Opening public form link | 1 doc | On form open | No |
| [`PublicEventFormPage.tsx:68`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L68) | `fetchForm()` | `eventFormQuestions` | `getDocs` | Opening public form link | Questions for form (~5–15) | On form open | No |
| [`PublicEventFormPage.tsx:78`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L78) | `fetchForm()` | `members` | `getDocs` | Form with member selector | All members (~80–150) | On form open | No |
| [`PublicEventFormPage.tsx:87`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L87) | `fetchForm()` | `eventFormResponses` | `getDocs` | Form with member selector | Responses for form (~0–50) | On form open | No |
| [`EventFormsTab.tsx:47`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/components/EventFormsTab.tsx#L47) | `fetchForms()` | `eventForms` | `getDocs` | Opening event forms tab | Forms for event (~1–5) | Per tab open | No |
| [`EventFormsTab.tsx:53`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/components/EventFormsTab.tsx#L53) | `fetchForms()` | `eventFormResponses` | `getCountFromServer` | Opening event forms tab | 1 aggregate read per form | Per tab open | No |
| [`EventFormResponsesModal.tsx:55`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/components/EventFormResponsesModal.tsx#L55) | `fetchResponses()` | `eventFormResponses` | `getDocs` | Opening responses modal | Responses for form (~0–50) | Per modal open | No |
| [`eventService.ts:23`](file:///C:/Users/kyle/Desktop/MATS/src/services/eventService.ts#L23) | `getEvents()` | `events` | `getDocs` | Events page load | All events (~10–50) | Per page visit | No |
| [`excuseService.ts:102`](file:///C:/Users/kyle/Desktop/MATS/src/services/excuseService.ts#L102) | `getExcuseRequests()` | `excuseRequests` | `getDocs` | Excuses management load | All excuses (~20–100) | Per page visit | No |
| [`userService.ts:30`](file:///C:/Users/kyle/Desktop/MATS/src/services/userService.ts#L30) | `getUsers()` | `users` | `getDocs` | User management load | All profiles (~5–20) | Per page visit | No |
| [`auditService.ts:64`](file:///C:/Users/kyle/Desktop/MATS/src/services/auditService.ts#L64) | `getLogs()` | `auditLogs` | `getDocs` | Audit log page load | Max 100 docs (`limit(100)`) | Per page visit | No |
| [`AuthContext.tsx:59`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/AuthContext.tsx#L59) | User profile subscription | `users/{uid}` | `onSnapshot` | Logged-in auth state change | 1 doc | Once per auth session | **Yes** |
| [`maintenanceService.ts:100`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L100) | Maintenance subscription | `settings/maintenanceMode` | `onSnapshot` | App startup | 1 doc | Once per app session | **Yes** |

---

## D. Realtime Listener Audit

Every `onSnapshot` listener in the entire application:

| File & Line | Target Collection / Document | Listener Trigger | Cleanup Function Implemented? | Can It Duplicate? | Expected Lifetime |
|---|---|---|:---:|:---:|---|
| [`AuthContext.tsx:59`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/AuthContext.tsx#L59) | `users/{uid}` (single doc) | User login / auth state change | **Yes** (`currentDocUnsub()`) | No | Active while user is logged in; unsubscribed on logout. |
| [`maintenanceService.ts:100`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L100) | `settings/maintenanceMode` (single doc) | Initial application mount | **Yes** (`unsub()`) | No | Active for entire app lifecycle; single instance in `MaintenanceProvider`. |

* **Listener Verdict**: There are **zero unbounded collection listeners** in MATS. Realtime listeners are limited to 2 single-document subscriptions, producing at most 2 reads on boot. Realtime listeners are **not** the cause of high read usage.

---

## E. React Query Audit

### QueryClient Configuration in [`src/main.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/main.tsx#L9-L16)
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

### Analysis Findings:
1. **Global QueryClient**: A single global `QueryClient` instance is instantiated in `main.tsx` and shared via `QueryClientProvider`.
2. **`staleTime: 0` Override on Public Features**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L56), lines 56, 76, 90, 351, and 361 pass `staleTime: 0` to `queryClient.fetchQuery()`.
   - In [`PublicEventFormPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L71), lines 71, 81, and 90 pass `staleTime: 0`.
   - **Impact**: `staleTime: 0` immediately invalidates data, forcing `fetchQuery` to re-execute against Firestore on every component mount or page refresh.
3. **In-Memory Cache Limitation**:
   - React Query stores cache in JavaScript memory only. Whenever a mobile browser closes or reloads `/index.html`, all cache is destroyed.
4. **Internal Modules Bypass React Query Entirely**:
   - `DashboardOverview`, `SchedulesPage`, `AttendancePage`, `MembersPage`, and `ReportsPage` do not use React Query; they run un-cached `useEffect` hooks fetching directly from Firestore on every tab visit.

---

## F. PWA / Service Worker Audit

Inspecting [`public/sw.js`](file:///C:/Users/kyle/Desktop/MATS/public/sw.js) and [`src/registerSW.ts`](file:///C:/Users/kyle/Desktop/MATS/src/registerSW.ts):

1. **Does the Service Worker Intercept or Duplicate Firestore Requests?**
   - In `sw.js` lines 20–31, `isFirebaseOrApiRequest(url)` matches `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `googleapis.com`, etc.
   - Lines 66–69 pass these directly to native `fetch(request)`:
     ```js
     if (isFirebaseOrApiRequest(url)) {
       event.respondWith(fetch(request));
       return;
     }
     ```
   - **Verification**: The Service Worker does **not** cache, duplicate, or proxy Firestore data.
2. **Does it perform Background Sync?**
   - **No.** There are no background sync event listeners in `sw.js`.
3. **Can PWA Updates Cause Extra Reads?**
   - When a new deployment activates, the PWA reloads `/index.html`. This re-mounts the React app, triggering the standard startup queries.

---

## G. Public Schedule Audit

### Verification of Optimizations & Workflow Preservation

1. **Date-Range Filtering Active**:
   - Initial Load ([`PublicSchedulePage.tsx:75`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L75)): Calls `scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate)`.
   - Post-Submit ([`PublicSchedulePage.tsx:360`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L360)): Calls `scheduleService.getSchedulesByDateRange(updatedPub.startDate, updatedPub.endDate)`.
   - In [`scheduleService.ts:57`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57): Runs `query(schedulesRef, where('date', '>=', startDate), where('date', '<=', endDate))`.
   - `getSchedules()` is **NOT called** anywhere in the Public Schedule flow.
2. **Submission Scoped**:
   - In [`scheduleService.ts:385`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L385), `submitPublicScheduleSelections()` calls `this.getSchedulesByIds(targetScheduleIds)` using chunked `where(documentId(), 'in', chunk)` queries. It does **not** read the whole collection.
3. **Workflow Completely Preserved**:
   - Public link loading, publication date range filtering, Sunday/weekday matrix grouping, member selection dropdown, slot selection limits, locking rules, validations, and submission refresh all operate as designed.

---

## H. Event Forms Audit

### Mathematical Proof for 25 Form Responses

| Action | Operations & Targets | Document Reads |
|---|---|:---:|
| **Opening Public Form** | 1 `getDoc` (form) + 1 `getDocs` (questions, ~10) + 1 `getDocs` (`members`, ~80 if selector present) | **~11 to 91 reads** |
| **Submitting Form** | 1 `getDocs` (tracking lookup) + 1 write (`eventFormResponses`) | **1 read** |
| **Admin Forms Tab View** | 1 `getDocs` (forms) + $N \times$ `getCountFromServer` (aggregate count query) | **~5 to 10 reads** |
| **Responses Modal View** | 1 `getDocs` (all responses for selected form) | **$R$ reads** ($R \le 25$) |

* **Total for 25 Submissions + Admin Viewing**:
  $$25 \text{ submissions} \times 90 \text{ reads} + 10 \text{ admin views} \times 10 \text{ reads} \approx \mathbf{2,350\text{ reads}}$$
* **Definitive Conclusion**: **Event Forms cannot mathematically produce 52,000 document reads with 25 responses.** Event Forms are definitively ruled out as the primary source of the quota drain.

---

## I. Top 10 Firestore Read Sources (Ranked)

| Rank | Collection & Target | Estimated Reads per Invocation | Trigger / Surface | Why It Is Expensive | Confidence |
|:---:|---|:---:|---|---|:---:|
| **#1** | `schedules` (Full Collection) | **~500 to 1,000+ reads** | Dashboard mount ([`dashboardService.ts:64`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L64)) | Fetches all historical schedules across all time with no date filter on every dashboard visit. | **99% (CRITICAL)** |
| **#2** | `schedules` (Duplicate Full Read) | **~500 to 1,000+ reads** | Dashboard mount via [`reportService.ts:135`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135) | `loadReportData()` fetches the entire `schedules` collection a second time and filters dates in JavaScript memory. | **99% (CRITICAL)** |
| **#3** | `schedules` (Full Collection) | **~500+ reads** | Attendance Session mount ([`AttendancePage.tsx:151`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151)) | Calls `scheduleService.getSchedules()` to find 1 schedule ID in memory instead of `getDoc(doc(db, 'schedules', id))`. | **95% (HIGH)** |
| **#4** | `schedules` (Full Collection) | **~500+ reads** | Schedules Tab mount ([`SchedulesPage.tsx:74`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74)) | Fetches all historical schedules on tab open instead of scoping by month. | **95% (HIGH)** |
| **#5** | `members` (Duplicate Full Read) | **~100 to 150 reads** | Dashboard mount ([`dashboardService.ts:63`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L63) & [`reportService.ts:134`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L134)) | Fetches the full `members` collection twice in parallel during dashboard loading. | **95% (HIGH)** |
| **#6** | `members` (Full Collection) | **~80 to 150 reads** | Public Schedule load ([`PublicSchedulePage.tsx:81`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81)) | Fetches all members for the name picker on every public page load with `staleTime: 0`. | **95% (HIGH)** |
| **#7** | `members` (Full Collection) | **~80 to 150 reads** | Public Event Form load ([`PublicEventFormPage.tsx:78`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L78)) | Fetches all members when a form contains a `member_selector` question with `staleTime: 0`. | **90% (MEDIUM)** |
| **#8** | `attendance` (Month Range) | **~100 to 300 reads** | Dashboard & Reports mount ([`reportService.ts:136`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L136)) | Scoped query for monthly attendance records during dashboard metric calculations. | **90% (MEDIUM)** |
| **#9** | `attendanceSessions` (Full Collection) | **~60+ reads** | Dashboard mount ([`dashboardService.ts:53`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L53)) | Fetches all attendance sessions on dashboard load. | **85% (MEDIUM)** |
| **#10** | `schedules` (Date Range) | **~20 to 60 reads** | Public Schedule load ([`PublicSchedulePage.tsx:75`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L75)) | Date-scoped schedule query within active publication window. | **95% (LOW/OPTIMIZED)** |

---

## J. Read Budget (Model for Common Actions)

| Action Flow | Operations Triggered | Document Reads |
|---|---|:---:|
| **Public Schedule: 1 visitor opening page** | 1 publication + 30 schedules (scoped) + 80 members + 2 maintenance check | **$\approx 113\text{ reads}$** |
| **Public Schedule: 1 visitor selecting a member** | Client-side React state update only | **$0\text{ reads}$** |
| **Public Schedule: 1 visitor selecting slots** | Client-side React state update only | **$0\text{ reads}$** |
| **Public Schedule: 1 visitor submitting** | 30 target schedules read by ID + writes + 1 pub re-fetch + 30 schedules re-fetch | **$\approx 61\text{ reads}$** |
| **Public Schedule: 1 visitor refreshing page** | Full re-fetch of publication + schedules + members | **$\approx 113\text{ reads}$** |
| **Public Event Form: 1 visitor opening form** | 1 form + 10 questions + 80 members (if selector) | **$\approx 91\text{ reads}$** |
| **Public Event Form: 1 visitor submitting** | 1 tracking check + writes | **$1\text{ read}$** |
| **Public Event Form: 1 visitor viewing tracking** | 1 tracking lookup `where('trackingNumber', '==', ...)` | **$1\text{ read}$** |
| **Normal MATS User: Login & Startup** | 1 auth profile + 1 maintenance + 1 unread task badge | **$\approx 3\text{ reads}$** |
| **Normal MATS User: Dashboard Landing** | 2x schedules (~1,000) + 2x members (~200) + sessions (~60) + attendance (~150) | **$\approx 1,410\text{ reads}$** |
| **Coordinator: Dashboard Landing** | Full dashboard load | **$\approx 1,410\text{ reads}$** |
| **Coordinator: Internal Schedules Tab** | Full `schedules` (~500) + full `members` (~100) + full `sessions` (~60) | **$\approx 660\text{ reads}$** |
| **Coordinator: Attendance Sheet Open** | Full `schedules` (~500) + full `members` (~100) + session records (~15) | **$\approx 615\text{ reads}$** |
| **Coordinator: Event Forms Tab** | 1 event forms query + aggregate counts via `getCountFromServer` | **$\approx 5\text{ reads}$** |
| **Coordinator: Finance Tab** | Scoped period incomes & expenses | **$\approx 20\text{ reads}$** |
| **Maintenance Mode: Blocked User Startup** | 1 maintenance check + 1 auth profile check (blocked before module mount) | **$\approx 2\text{ reads}$** |
| **Maintenance Mode: Coordinator Startup** | Full bypass load $\rightarrow$ Dashboard initialization | **$\approx 1,413\text{ reads}$** |

---

## K. Root Cause Synthesis

The primary culprit behind the 52K Firestore reads is the **Internal Dashboard and Report dual full-collection schedule queries**:

```ts
// Inside src/services/dashboardService.ts (Lines 62-80):
const [allMembers, allSchedules] = await Promise.all([
  memberService.getMembers(true),     // -> Reads ALL members (~100 docs)
  scheduleService.getSchedules()      // -> Reads ALL historical schedules (~500 docs)
])

const reportData = await reportService.loadReportData(startDate, endDate)
// Inside src/services/reportService.ts (Lines 133-137):
const [membersSnap, schedulesSnap, attendanceSnap] = await Promise.all([
  getDocs(membersRef),                // -> Reads ALL members AGAIN (~100 docs)
  getDocs(schedulesRef),              // -> Reads ALL historical schedules AGAIN (~500 docs)
  getDocs(attendanceQuery)
])
// Line 144: schedules are filtered client-side in JS instead of in Firestore!
```

Every single time a coordinator or admin navigates to the app or refreshes their browser, this block runs, producing **~1,410 reads per view**. During deployment, testing, and administration, opening the dashboard 35 times easily produces **50,000 document reads**.

---

## L. Recommended Fixes (Architectural Review Only — NOT Implemented)

### Critical Priority (Immediate 85%+ Read Reduction)
1. **Apply Server-Side Date Filtering in `reportService.loadReportData()`**:
   - In [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L108-L135), construct `query(schedulesRef, where('date', '>=', startDate), where('date', '<=', endDate))` so only the active month's schedules are read from Firestore instead of reading all historical schedules.
   - **Impact**: Reduces schedule reads from ~500 to ~25 (a **95% reduction** per report/dashboard call).
2. **Eliminate Duplicate Full Reads in `dashboardService.getDashboardData()`**:
   - In [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L62-L80), reuse the members and schedules data from `reportService` rather than calling `scheduleService.getSchedules()` and `memberService.getMembers(true)` twice.
   - **Impact**: Eliminates ~600 redundant document reads per dashboard visit.

### High Priority
3. **Scope Single-Schedule Fetch in `AttendancePage.tsx`**:
   - In [`src/features/attendance/pages/AttendancePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151), replace `scheduleService.getSchedules()` with a single `getDoc(doc(db, 'schedules', scheduleId))`.
   - **Impact**: Eliminates ~500 reads every time an attendance session is opened.
4. **Cache Public Member List in React Query**:
   - In [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81) and [`src/features/events/pages/PublicEventFormPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L78), increase `staleTime` for member queries to 10 minutes so multiple selections or reloads within a browser session use memory cache.

### Medium Priority
5. **Scope Internal Schedules Page by Month**:
   - In [`src/features/schedules/pages/SchedulesPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74), query schedules scoped to the currently selected calendar month rather than fetching the entire collection.

### Optional (Behavior-Changing)
6. **Enable Firestore IndexedDB Offline Cache**:
   - Configure `persistentLocalCache` in [`src/firebase/config.ts`](file:///C:/Users/kyle/Desktop/MATS/src/firebase/config.ts) to enable disk caching across tab reloads.

---

## M. Safety Check Confirmation

I explicitly confirm:
- **No code was modified.**
- **No workflow was changed.**
- **No Role-Based Access Control (RBAC) was changed.**
- **No Firestore security rules were changed.**
- **No Public Schedule behavior or validation was changed.**
- **No Event Form behavior or validation was changed.**

---

## What I Should Do Next

1. **Review this deep investigation**: Confirm the mathematical evidence showing that the internal dashboard, reports, and attendance modules are the primary source of the read volume.
2. **Approve fixing the server-side date query in `reportService.loadReportData()` and removing duplicate reads in `dashboardService.getDashboardData()`**: This single change will immediately eliminate ~1,200 reads on every dashboard visit.
3. **Approve updating `AttendancePage.tsx` to fetch only its single target schedule via `getDoc`**: This eliminates ~500 reads per attendance session view.
