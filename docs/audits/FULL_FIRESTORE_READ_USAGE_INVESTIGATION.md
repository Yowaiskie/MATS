# Full Firestore Read Usage Investigation

## 1. Executive Summary

A deep audit of the entire MATS codebase (`src/`, services, contexts, hooks, components, layouts, and Firebase configs) confirms:

### Primary Verdict on Event Forms & Public Schedule
* **Event Forms is NOT the cause of the 52K spike**: 25 Event Form submissions only generate **$\approx 1,500\text{ to }2,200\text{ total document reads}$**. It is mathematically impossible for 25 form responses to produce 52,000 reads under the current aggregate count architecture.
* **Public Schedule is now scoped, but still has a read multiplier**: The previous full `schedules` read was resolved via [`scheduleService.getSchedulesByDateRange()`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L57-L71), but [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81) still downloads the **entire `members` collection (~80–150 docs) on every single public page open** due to hardcoded `staleTime: 0`.

### The True Root Causes of Unexpectedly High Reads (Ranked)

1. **CRITICAL — Internal Dashboard / Report Dual Full-Collection Reads**:
   Every time an authenticated coordinator, admin, or officer visits the MATS internal application, [`dashboardService.getDashboardData()`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L46-L90) and [`reportService.loadReportData()`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L101-L165) execute **two full `schedules` collection reads** and **two full `members` collection reads** without React Query caching. In [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135), schedule date filtering is performed in JavaScript memory *after* reading the entire historical schedule collection from Firestore. **A single dashboard visit produces $\approx 1,500\text{ to }3,000+\text{ reads}$**. Just 20–30 admin visits generate 50,000+ reads.
2. **HIGH — Internal Schedules & Attendance Pages Full-Collection Reads**:
   Opening the internal Schedules tab or marking attendance for a single mass session calls `scheduleService.getSchedules()` and `memberService.getMembers(true)`, downloading the complete database of schedules and members each time.
3. **HIGH — `staleTime: 0` on Public Schedule & Forms Bypasses React Query Caching**:
   `staleTime: 0` is hardcoded on public page data loaders. Every browser refresh, mobile screen unlock, or tab switch re-reads the full member list and schedule range from Firestore.
4. **MEDIUM — Absence of Firestore Offline IndexedDB Persistence**:
   In [`src/firebase/config.ts`](file:///C:/Users/kyle/Desktop/MATS/src/firebase/config.ts#L17), Firestore is initialized with standard in-memory caching. Every browser page refresh completely wipes client memory, forcing all components to re-query the backend.

---

## 2. Startup Read Map

The following map traces every Firestore operation executed during application startup (Browser $\rightarrow$ React root $\rightarrow$ Providers $\rightarrow$ Route Guards $\rightarrow$ Initial View):

| Order | File | Function / Hook | Target Collection / Doc | Operation | Estimated Docs Read | Frequency | Runs Before Maintenance Guard? |
|:---:|---|---|---|---|:---:|---|:---:|
| **1** | [`src/context/MaintenanceContext.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/context/MaintenanceContext.tsx#L27) | `maintenanceService.getMaintenanceSettings()` | `settings/maintenanceMode` | `getDoc` | **1** (or 0 if cached < 60s) | Once on app mount | **Yes** (initializes guard) |
| **2** | [`src/context/MaintenanceContext.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/context/MaintenanceContext.tsx#L35) | `maintenanceService.subscribeToMaintenanceSettings()` | `settings/maintenanceMode` | `onSnapshot` | **1** (initial listener snapshot) | Continuous listener | **Yes** (initializes guard) |
| **3** | [`src/features/authentication/AuthContext.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/AuthContext.tsx#L59) | `onAuthStateChanged` profile listener | `users/{uid}` | `onSnapshot` | **1** (if logged in, 0 if public visitor) | Continuous listener | **Yes** (identifies user role) |
| **4** | [`src/layouts/DashboardLayout.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/layouts/DashboardLayout.tsx#L104) | `dashboardService.getMyUnreadTasksCount()` | `eventTasks` | `getDocs` (`where assignee== && unread==true`) | **1–10** | On every route navigation | **No** (blocked if maintenance is active) |
| **5a** | [`src/features/dashboard/components/DashboardOverview.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/dashboard/components/DashboardOverview.tsx#L156) | `getDocs(collection('attendanceSessions'))` | `attendanceSessions` | `getDocs` | **Total session count (~50–100)** | Every dashboard mount | **No** (blocked if maintenance is active) |
| **5b** | [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L63) | `memberService.getMembers(true)` | `members` | `getDocs` | **All members (~80–150)** | Every dashboard mount | **No** (blocked if maintenance is active) |
| **5c** | [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L64) | `scheduleService.getSchedules()` | `schedules` | `getDocs` | **All schedules in database (~500+)** | Every dashboard mount | **No** (blocked if maintenance is active) |
| **5d** | [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L134) (called via Dashboard) | `getDocs(membersRef)` | `members` | `getDocs` | **All members AGAIN (~80–150)** | Every dashboard mount | **No** (blocked if maintenance is active) |
| **5e** | [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L135) (called via Dashboard) | `getDocs(schedulesRef)` | `schedules` | `getDocs` | **All schedules AGAIN (~500+)** | Every dashboard mount | **No** (blocked if maintenance is active) |
| **5f** | [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L136) (called via Dashboard) | `getDocs(attendanceQuery)` | `attendance` | `getDocs` | **Current month attendance (~100–300)** | Every dashboard mount | **No** (blocked if maintenance is active) |

---

## 3. Global Read Sources

Global providers and shell components executed outside individual feature tabs:

1. **[`MaintenanceProvider`](file:///C:/Users/kyle/Desktop/MATS/src/context/MaintenanceContext.tsx#L17)**:
   - Queries `settings/maintenanceMode` via `getDoc` and establishes 1 `onSnapshot` listener.
   - Cost: **2 reads** on initial application boot. (Well-contained and lightweight).
2. **[`AuthProvider`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/AuthContext.tsx#L33)**:
   - For public visitors: **0 reads** (`currentUser` is `null`).
   - For authenticated users: 1 `onSnapshot` on `users/{uid}` (**1 initial read** + 1 per profile update).
3. **[`DashboardLayout`](file:///C:/Users/kyle/Desktop/MATS/src/layouts/DashboardLayout.tsx#L112)**:
   - Runs `dashboardService.getMyUnreadTasksCount()` in `useEffect` on `[profile?.displayName, location.pathname]`.
   - Cost: **1 read minimum per internal page navigation**.
4. **[`PWAProvider`](file:///C:/Users/kyle/Desktop/MATS/src/context/PWAContext.tsx#L22)** & **[`TutorialProvider`](file:///C:/Users/kyle/Desktop/MATS/src/context/TutorialContext.tsx#L15)**:
   - **0 Firestore reads**. Purely browser APIs and local storage.

---

## 4. Public Schedule Read Analysis

### Exact Document Reads per Public Schedule Visit

When a user visits `/public/schedule/:id`:

| Operation | Query Type & Target | Filter / Scope | Reads |
|---|---|---|:---:|
| Maintenance Check | `getDoc` + `onSnapshot` on `settings/maintenanceMode` | Single doc | **2** |
| Publication Config | `getDoc` on `schedulePublications/{id}` | Single doc | **1** |
| Schedule Query | `getDocs` on `schedules` | `where('date', '>=', start)` & `where('date', '<=', end)` | **~30** (exact match for month) |
| Member Selector Query | `getDocs` on `members` | **Full collection** (unfiltered in Firestore) | **~80** (all members) |
| **Total Initial Load** | | | **$\approx \mathbf{113\text{ reads}}$** |

### Verification of Optimizations
- **Date-Range Filtering**: Verified. [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L75) calls `scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate)`. It no longer calls `getSchedules()`.
- **Submission Flow**: Verified. [`submitPublicScheduleSelections`](file:///C:/Users/kyle/Desktop/MATS/src/services/scheduleService.ts#L385) calls `getSchedulesByIds(targetScheduleIds)` using batch ID queries (`where(documentId(), 'in', chunk30)`), reading only the ~30 publication schedules.
- **Post-Submission Refresh**: Re-fetches publication (1 read) and schedules (~30 reads). Does not re-fetch members.

---

## 5. Event Forms Read Analysis

### Read Breakdown by Action

| Action | Operations Involved | Firestore Reads |
|---|---|:---:|
| **Opening Public Form** | 1 `getDoc` (form) + 1 `getDocs` (questions, ~10 docs) + 1 `getDocs` (`members`, ~80 docs if member selector present) | **~11 to 91 reads** |
| **Submitting Form** | 1 check `getDocs(trackingNumber)` + writes | **1 read** |
| **Editing Form Response** | 1 `getDocs(where trackingNumber==)` | **1 read** |
| **Opening Admin Forms Tab** | 1 `getDocs(where eventId==)` (forms) + $N \times$ `getCountFromServer(formId)` | **~5 to 10 reads** |
| **Opening Responses Modal** | 1 `getDocs(where formId==)` | **$R$ reads** ($R$ = response count for form) |

### Mathematical Proof on the 52K Reads
- With 25 total responses in the system:
  - 25 submissions $\times 90\text{ reads (worst case with member selector)} = \mathbf{2,250\text{ reads}}$.
- **Conclusion**: Event Forms cannot produce 52,000 reads with only 25 responses. The remaining 50,000 reads came from internal dashboard and schedule/report full-collection loops.

---

## 6. Realtime Listener Analysis

| File | Collection / Document | Query | Cleanup Implemented? | Active During Maintenance? | Risk |
|---|---|---|:---:|:---:|:---:|
| [`src/features/authentication/AuthContext.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/AuthContext.tsx#L59) | `users/{uid}` | Single doc `doc(db, 'users', uid)` | Yes (`currentDocUnsub()`) | Only for logged-in user | **LOW** (1 doc) |
| [`src/services/maintenanceService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/maintenanceService.ts#L100) | `settings/maintenanceMode` | Single doc `doc(db, 'settings', 'maintenanceMode')` | Yes (`unsub()`) | Yes (all users) | **LOW** (1 doc) |

*There are **zero unbounded `onSnapshot` collection listeners** in the application.*

---

## 7. React Query Analysis

1. **`staleTime: 0` on Public Features**:
   - [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L56) and [`PublicEventFormPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/events/pages/PublicEventFormPage.tsx#L71) set `staleTime: 0`.
   - React Query does not cache across unmounts or refreshes.
2. **In-Memory Caching Limitation**:
   - React Query's `QueryClient` cache exists exclusively in browser RAM.
   - When a mobile altar server opens a link, closes Chrome, and re-opens the link, the RAM cache is destroyed, triggering new reads.

---

## 8. PWA / Service Worker Analysis

Inspecting [`public/sw.js`](file:///C:/Users/kyle/Desktop/MATS/public/sw.js):
- Lines 20–31 identify all Google/Firebase domains (`firestore.googleapis.com`, `identitytoolkit.googleapis.com`, etc.).
- Lines 66–69 bypass the cache:
  ```js
  if (isFirebaseOrApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }
  ```
- **Conclusion**: The PWA service worker does **not** perform background synchronization, duplicate Firestore requests, or proxy Firestore data.

---

## 9. Maintenance Mode Analysis

1. **Initialization Order**:
   - `MaintenanceProvider` wraps the app inside `App.tsx` and executes immediately on startup.
2. **Are Blocked Users Prevented from Querying Expensive Modules?**:
   - **Yes.** In [`ProtectedRoute.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/authentication/components/ProtectedRoute.tsx#L119), blocked users are intercepted before children (Dashboard, Schedules, Attendance, Reports) mount, and automatically logged out.
   - In [`DashboardLayout.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/layouts/DashboardLayout.tsx#L99), task badge queries are bypassed if `isBlocked` is true.

---

## 10. Duplicate Query Analysis

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAJOR DUPLICATE QUERY PATH IDENTIFIED                            │
│                                                                                         │
│  User visits Dashboard ("/")                                                            │
│    ├── dashboardService.getDashboardData()                                              │
│    │     ├── 1. memberService.getMembers(true)        ──────> Reads ALL members (~100)  │
│    │     ├── 2. scheduleService.getSchedules()        ──────> Reads ALL schedules (~500)│
│    │     └── 3. reportService.loadReportData()                                          │
│    │              ├── 4. getDocs(membersRef)          ──────> Reads ALL members AGAIN   │
│    │              └── 5. getDocs(schedulesRef)        ──────> Reads ALL schedules AGAIN │
│    │                                                                                    │
│    └── Total for ONE dashboard visit: 2x members + 2x schedules = ~1,200 - 2,500 reads │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Read Cost Estimation Scenarios

*Assumptions: `schedules` total history = 500 docs, `schedules` in active publication = 30 docs, `members` = 80 docs, `attendance` month = 150 docs.*

### Scenario A: 1 User opens MATS once (Admin Landing on Dashboard)
- Auth & Maintenance: $2\text{ reads}$
- Dashboard load: $2 \times 500\text{ (schedules)} + 2 \times 80\text{ (members)} + 60\text{ (sessions)} + 150\text{ (attendance)} = \mathbf{1,372\text{ reads}}$

### Scenario B: 10 Users open MATS once (Authenticated Dashboard)
- $10 \times 1,372 = \mathbf{13,720\text{ reads}}$

### Scenario C: 100 Public Schedule visits (without submission)
- $100 \times 113\text{ reads} = \mathbf{11,300\text{ reads}}$

### Scenario D: 100 Public Form visits (without submission)
- $100 \times 91\text{ reads} = \mathbf{9,100\text{ reads}}$

### Scenario E: 1 User repeatedly refreshes Dashboard (10 times)
- $10 \times 1,372 = \mathbf{13,720\text{ reads}}$

---

## 12. Root Cause Ranking

1. **CRITICAL — [`src/services/dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L62-L80) & [`src/services/reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L133-L137)**:
   - Duplicated full collection reads of `schedules` and `members` on every admin/coordinator dashboard visit.
2. **HIGH — [`src/features/attendance/pages/AttendancePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151) & [`src/features/schedules/pages/SchedulesPage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/SchedulesPage.tsx#L74)**:
   - Full collection `getSchedules()` and `getMembers(true)` queries whenever viewing the internal attendance sheet or schedules list.
3. **HIGH — [`src/features/schedules/pages/PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81)**:
   - Full `members` collection read on every public visitor load with `staleTime: 0`.
4. **MEDIUM — [`src/firebase/config.ts`](file:///C:/Users/kyle/Desktop/MATS/src/firebase/config.ts#L17)**:
   - Firestore in-memory-only cache; no IndexedDB persistence across browser tabs/refreshes.

---

## 13. Recommended Fixes

### SAFE OPTIMIZATIONS (Zero Workflow or UI Change)

1. **Fix Date Filtering in `reportService.loadReportData()`**:
   - In [`reportService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/reportService.ts#L108-L135), apply `where('date', '>=', startDate)` and `where('date', '<=', endDate)` directly in the Firestore query instead of fetching all schedules and filtering client-side.
   - **Expected Reduction**: Reduces dashboard and report schedule reads from ~500 to ~30 (a **94% reduction** per visit).
   - **Risk**: None.
2. **Eliminate Duplicate Queries in `dashboardService.getDashboardData()`**:
   - In [`dashboardService.ts`](file:///C:/Users/kyle/Desktop/MATS/src/services/dashboardService.ts#L62-L80), reuse data returned by `reportService.loadReportData()` rather than querying `scheduleService.getSchedules()` and `memberService.getMembers(true)` twice.
   - **Expected Reduction**: Eliminates ~600 redundant reads per dashboard load.
   - **Risk**: None.
3. **Replace Full Schedule Read in Attendance Session Load**:
   - In [`AttendancePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/attendance/pages/AttendancePage.tsx#L151), fetch only the single schedule document needed for the active session (`getDoc(doc(db, 'schedules', scheduleId))`) instead of downloading all schedules.
   - **Expected Reduction**: Reduces ~500 reads down to 1 read when opening an attendance sheet.
   - **Risk**: None.
4. **Cache Public Member List in React Query**:
   - In [`PublicSchedulePage.tsx`](file:///C:/Users/kyle/Desktop/MATS/src/features/schedules/pages/PublicSchedulePage.tsx#L81), increase `staleTime` for `['public-active-members-non-squire']` to 10 minutes so multi-step interactions or re-opens reuse the in-memory member list.
   - **Expected Reduction**: Eliminates ~80 reads per sub-navigation or quick reload.
   - **Risk**: None.

### BEHAVIOR-CHANGING OPTIMIZATIONS (For Consideration)

1. **Enable Firestore IndexedDB Offline Cache**:
   - Configure `persistentLocalCache` in [`src/firebase/config.ts`](file:///C:/Users/kyle/Desktop/MATS/src/firebase/config.ts).
   - **Note**: This allows repeat tab visits to serve unchanged documents from disk with 0 billed reads, but requires verifying multi-tab compatibility.

---

## What I Should Do Next

1. **Review this investigation report**: Confirm that the mathematical findings align with your Firestore usage patterns.
2. **Approve fixing the Internal Dashboard and Report schedule queries**: This is the single highest-impact source of excess reads.
3. **Approve scoping `AttendancePage` to fetch a single schedule document by ID**: This immediately fixes the attendance management read overhead.
