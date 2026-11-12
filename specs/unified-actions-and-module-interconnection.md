# Technical Specification: Unified UI Actions & Module Interconnection

## 1. Overview & Business Objectives
This specification unifies public portal actions across all MATS modules, establishes direct cross-module data synchronization, and overhauls UI layouts into friendly, step-by-step Action Cards tailored for non-tech parish coordinators.

---

## 2. Phase 1: Standardized Public Action Bar (`PublicPortalActionBar`)

### Problem
- In `PublicationsTab.tsx`, coordinators have a `Preview` button (opens public schedule portal) and a `Copy Link` button.
- In `EventFormsTab.tsx`, coordinators only have a `Copy Link` button, lacking a direct `Preview` button to test and see the respondent's view before sharing.
- Button styles, icons, and status badges are fragmented across pages.

### Design Solution
Create `src/components/PublicPortalActionBar.tsx`:
- **Props:**
  - `title`: string
  - `publicUrl`: string
  - `status`: 'draft' | 'published' | 'closed' | 'archived'
  - `responsesCount`?: number
  - `onViewResponses`?: () => void
  - `onEdit`?: () => void
  - `onStatusToggle`?: (nextStatus: string) => void
  - `compact`?: boolean
- **Standardized Buttons:**
  1. `[👁 Preview / Silipin]`: Opens public URL in a new browser tab (`target="_blank"`).
  2. `[📋 Kopyahin ang Link / Copy Link]`: Copies URL with immediate visual feedback (`✓ Nakopya na!`).
  3. `[📝 Mga Sagot / Responses (count)]`: Displays submission badge and triggers the review modal.
  4. `[✏️ Baguhin / Edit]`: Triggers the edit modal.
  5. `[Status Badge]`: Clearly colored badge (Green: Bukas/Open, Amber: Sarado/Closed, Gray: Draft).

---

## 3. Phase 2: Module Interconnection Pipeline

### 3.1 Events ↔ Schedules & Publications
- **Feature:** In the Event Workspace (`EventOverviewTab` / `EventRequirementsTab`), coordinators can link an Event directly to a Schedule Publication (e.g. Fiesta Masses, Triduum, Holy Week Services).
- **Behavior:** Altar servers assigned to that Event's linked publication automatically receive credit and are tracked in the Event's attendance log.

### 3.2 Attendance ↔ Excuse Requests
- **Feature:** Live Excuse Integration on the Attendance Sheet (`AttendancePage.tsx`).
- **Behavior:**
  - When marking attendance for a specific mass/service, any member who has an active excuse request for that date displays an **`[Excused / May Paumanhin]`** badge.
  - Clicking the badge opens the excuse reason and documentation inline, preventing coordinators from accidentally marking them Absent.

### 3.3 Publications ↔ Attendance Auto-Sync
- **Feature:** One-click roster generation.
- **Behavior:** When an admin finalizes or approves a Publication's server assignments, the system can automatically pre-populate the attendance session roster for those dates.

### 3.4 Members ↔ 360° Profile Drawer
- **Feature:** Unified Member Profile.
- **Behavior:** Clicking a member's name anywhere in the system opens a unified 360° drawer showing:
  - Attendance rate and active rank.
  - Upcoming and past mass assignments.
  - Event participation and submitted forms.
  - Filed excuses and reasons.

---

## 4. Phase 3: Action Card & Step-by-Step UI Redesign

- **Step Indicator Header:** Major management pages (Schedules, Events, Attendance) feature a simple 3-step progress banner:
  - *Hakbang 1: Gumawa (Create)*
  - *Hakbang 2: Ibahagi at Silipin (Share & Preview)*
  - *Hakbang 3: Aprubahan at Talaan (Review & Roster)*
- **Button Standards:** Every button contains both a high-contrast icon and a descriptive text label. No mystery icon-only buttons.
- **Mobile-Responsive:** Optimized touch targets (minimum 44px height) for coordinators managing the system on smartphones.

---

## 5. Verification & Acceptance Criteria
1. Clicking `Preview` on both Publications and Event Forms opens the correct public URL in a new tab.
2. `Copy Link` provides instant toast and button text change (`Nakopya na!`).
3. Excuses submitted through the excuse portal appear with visual indicators in the active attendance sheet for that date.
4. Unit tests pass with 0 failures (`npm test`).
5. Oxlint passes with 0 errors (`npm run lint`).
6. Production build passes cleanly (`npm run build`).
