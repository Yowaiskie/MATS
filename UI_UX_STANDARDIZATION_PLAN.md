# UI/UX Standardization Plan

## 1. Objective

Make the MATS frontend behave as one system without changing business rules, data contracts, permissions, or workflow outcomes. The target system uses one administrative visual language, one implementation for each repeated interaction, and explicit variants only where the UX is intentionally different:

- **Administrative application:** slate/indigo v2 language.
- **Public self-service:** the same tokens with a calmer, centered public shell and larger touch targets.
- **Dense data workflows:** shared table/dialog foundations with a documented dense variant.
- **Full-screen workspaces and document previews:** shared overlay/accessibility foundations with full-screen or print-specific layout variants.

This document is implementation planning only. No application code is changed by this phase.

## 2. Verified Audit Findings

### Verification method

`UI_UX_AUDIT.md` was checked against the current `src/` tree, `src/App.tsx`, shared components, imports, fixed overlay patterns, table/input/select usage, and exported page/modal/component symbols. The audit’s conclusions remain directionally correct.

### Corrections to the audit inventory

| Audit statement | Current verification | Correction |
| --- | --- | --- |
| 98 feature `.tsx` files | Current source inventory contains 100 feature `.tsx` files | Use 100 in planning estimates |
| 12 shared components | `src/components/` also contains `OfflineBanner`, `ErrorBoundary`, `FormattedText`, PWA/tutorial/signature support, and other primitives | Treat the shared area as 15 top-level component files plus the nested signatures component; only the UI primitives listed below are in this standardization scope |
| 20 production route entries | `App.tsx` has 19 application route paths before the wildcard fallback: 5 public/auth paths, 13 protected paths including `/`, and one parameterized protected event path counted within those protected paths | Plan against the actual route list in the page matrix; do not use the aggregate count as a migration requirement |
| “All dialogs have no focus trap” | Source confirms shared dialogs have Escape handling and dialog semantics, but no focus trap/return-focus implementation is visible; custom overlays vary further | Finding confirmed, with the more precise distinction that shared semantics exist but focus management is incomplete |
| “Table standard is Events/Members/Excuses” | These remain the strongest administrative table examples; finance/report tables contain legitimate dense use cases | Finding confirmed; define `standard`, `dense`, and `public` table variants rather than flattening all density |

### Confirmed findings

1. **Dialog duplication is the highest-risk consistency and accessibility problem.** `src/components/Modal.tsx` and `src/components/Dialog.tsx` coexist with feature-local overlays in attendance, members, schedules, events, reports, users, audit, finance, login, maintenance, and signature configuration.
2. **The strongest visual baseline is the slate/indigo v2 implementation.** The clearest examples are `src/features/events/components/EventFormModal.tsx`, `src/features/events/components/TaskFormModal.tsx`, `src/features/dashboard/components/DashboardOverview.tsx`, `src/features/inventory/pages/InventoryPage.tsx`, `src/features/members/pages/MembersPreviewPage.tsx`, and `src/features/settings/pages/SettingsPage.tsx`.
3. **The strongest existing shared primitives are `Card`, `Modal`, `Dialog`, `Loading`, and `Pagination`.** They should be improved and reused rather than replaced wholesale.
4. **The strongest searchable selection behavior is `src/components/MemberCombobox.tsx`.** It already supports arrows, Enter, Escape, loading, filtering, and custom values. `src/components/MemberSearchDropdown.tsx` is visually useful but has weaker semantic option/keyboard behavior.
5. **Legacy gray/blue controls remain in high-traffic pages.** Confirmed locations include Login, Members table controls, Users, Audit, Reports/FilterBar, Attendance, Change Password, Events page header action, and parts of Finance.
6. **Tables are duplicated extensively.** There are standard v2 tables, legacy gray tables, dense finance/report tables, public tables, and import/export tables, with inconsistent headers, row density, actions, and empty states.
7. **Routine feedback is often modal/blocking.** `AlertModal` is widely used, but inline modal messages and page-local success/error panels remain. There is no shared Toast component.
8. **Loading is duplicated.** `src/components/Loading.tsx` coexists with raw spinner markup and text-only loading states. Its simulated bar variant should not be used as a substitute for real progress.
9. **Preview pages are not production routes.** Preview pages are useful references but duplicate production markup and must not become a second source of truth.
10. **Navigation is mostly centralized.** `src/layouts/DashboardLayout.tsx` owns authenticated desktop/mobile navigation, title/breadcrumb, maintenance banner, and account actions. It should be preserved and incrementally extracted, not replaced by separate page navigation.

### Baseline decision

The audit’s selected winners remain the correct starting points:

- **Button:** v2 indigo actions in `DashboardOverview`/`InventoryPage`.
- **Input:** v2 slate/indigo fields in `EventFormModal` and `TaskFormModal`.
- **Filter composition:** `reports/components/FilterBar.tsx` label/group structure.
- **Combobox:** `src/components/MemberCombobox.tsx` behavior.
- **Modal:** `src/components/Modal.tsx`.
- **Alert/confirm/password dialog:** `src/components/Dialog.tsx`.
- **Card:** `src/components/Card.tsx`.
- **Table:** v2 tables in `EventsPage` and `MemberTable`, with dense variants.
- **Pagination:** `src/components/Pagination.tsx`.
- **Tabs:** segmented tabs in Reports and Settings.
- **Empty state:** actionable empty state in `AttendancePage`.

## 3. Final Design Language

### Administrative foundation

| Token | Standard |
| --- | --- |
| Font | Existing system sans stack; `font-sans` for application UI |
| Page background | `#f8fafc` / slate-50 family |
| Surface | White with `border-slate-200/80` |
| Primary | Indigo 600 default, Indigo 700 hover |
| Text | Slate 900 primary, Slate 700 secondary, Slate 500 metadata, Slate 400 muted |
| Success | Emerald 600/700 with emerald-50/200 surface |
| Warning | Amber 500/700 with amber-50/200 surface |
| Danger | Rose 600/700 with rose-50/200 surface |
| Info | Blue/indigo semantic treatment; do not introduce new arbitrary purple meanings |
| Control radius | `rounded-xl` |
| Card radius | `rounded-2xl` |
| Dialog radius | `rounded-3xl` except full-screen/mobile edge-to-edge variants |
| Surface shadow | `shadow-2xs` or `shadow-sm` |
| Dialog shadow | `shadow-2xl` |
| Page spacing | `space-y-6`, `p-4 sm:p-8` from `DashboardLayout` |
| Form spacing | `space-y-4`; field groups `gap-3/4` |
| Motion | 100–200ms fade/scale/slide; motion never conveys the only state |

### Intentional variants

1. **Public:** centered page shell, 44px touch controls, clear progress/error hierarchy, no authenticated sidebar.
2. **Dense:** `text-xs` table content, compact rows, horizontal overflow, sticky headers where justified.
3. **Full-screen:** complex response/import/export workflows use the shared dialog root but may fill the viewport and use sticky header/footer.
4. **Document/print:** PDF/export preview typography may use document-specific fonts and spacing, but controls around it use the application standard.

## 4. UI Component Standards

Each standard below includes the intended component, source baseline, visual behavior, states, mobile behavior, and accessibility requirements.

### 4.1 Button

**Base:** improve and extract the v2 indigo button pattern from `DashboardOverview` and `InventoryPage`.

- **Sizes:** `sm` 36px for dense table actions; `md` 40px default; `lg` 44px for public/touch-critical actions.
- **Typography:** `text-xs` dense, `text-sm` normal; `font-bold`; sentence case.
- **Colors:** primary indigo; secondary white/slate; tertiary transparent; danger rose; success emerald only for positive completion actions.
- **Border/radius/shadow:** `rounded-xl`; secondary has `border-slate-200`; primary uses `shadow-sm` or restrained colored shadow.
- **Spacing:** horizontal `px-3.5–5`, vertical padding aligned to size; icon gap `gap-1.5/2`.
- **Hover:** darken primary; slate-50 secondary; semantic tinted background for danger/success.
- **Focus:** `focus-visible:ring-2` with indigo/semantic color and visible outline.
- **Active:** optional `active:scale-[0.98]`, never required to understand state.
- **Disabled:** preserve readable text, lower contrast only moderately, block pointer, no hover.
- **Loading:** retain button width; show spinner and action-specific “Saving…”/“Processing…” label.
- **Mobile:** action groups wrap or stack; primary actions become full width when the context is a form footer.
- **Accessibility:** real `<button>`, correct `type`, accessible name for icon-only controls, minimum 36–40px hit area.

### 4.2 Field, Input, Textarea, Select, DateField, and TimeField

**Base:** v2 fields in `EventFormModal` and `TaskFormModal`, with group/label structure from `reports/components/FilterBar.tsx`.

- **Size:** 40px default, 44px public/touch variant, compact 36px only for dense table filters.
- **Typography:** `text-sm` normal entry; `text-xs` dense filters; `font-medium`/`font-bold` only where existing v2 hierarchy requires it.
- **Colors:** `bg-slate-50`, white on focus, `border-slate-200`, slate-900 text, slate-400 placeholder.
- **Border/radius:** 1px slate border, `rounded-xl`.
- **Spacing:** label-to-control `mt-1.5`; field groups `gap-3/4`; helper/error `mt-1`.
- **Hover/focus:** border indigo-500 and indigo ring; focus must not depend on color alone.
- **Active:** native controls retain browser behavior; custom controls expose selected/open state.
- **Disabled:** slate-100 background, readable slate-500 text, no misleading placeholder.
- **Loading:** field can show an inline spinner or disabled state while options load; never silently display empty options.
- **Error:** rose border/ring plus text error connected with `aria-describedby`; preserve the entered value.
- **Mobile:** full width by default; two-column groups collapse at `sm`; public fields use 44px height.
- **Accessibility:** explicit labels, `id`/`htmlFor`, required state, `aria-invalid`, helper/error IDs, keyboard-visible focus.
- **Date/time:** retain native `date`, `time`, `month`, and `datetime-local` controls; standardize their wrapper and validation rather than introducing a custom picker prematurely.

### 4.3 Dropdown and Combobox

**Base:** native select for fixed short lists; `src/components/MemberCombobox.tsx` interaction model for searchable lists.

- **Native Select:** standard field tokens, native keyboard and screen-reader behavior.
- **Combobox size:** same as Input; dropdown max-height 16rem; minimum option hit area 36px.
- **Visuals:** white panel, `border-slate-200`, `rounded-2xl`, `shadow-xl`; selected option indigo-50/indigo text; hover slate-50.
- **Open/close:** click/focus trigger opens, Escape closes and restores focus, outside click closes, selection closes unless multi-select.
- **States:** loading, no results, selected, disabled, error, and custom-value option are explicit.
- **Mobile:** panel follows field width; avoid off-screen placement; use a bottom-sheet/full-width variant only if the viewport requires it.
- **Accessibility:** `role="combobox"`, `aria-expanded`, `aria-controls`, listbox/options, active descendant or roving focus, Enter/Arrow/Escape support, focus return.
- **Migration rule:** clickable option `div`s are not allowed for production searchable lists.

### 4.4 Modal and Dialog

**Base:** improve `src/components/Modal.tsx` and `src/components/Dialog.tsx` into one dialog foundation without changing consumer business logic.

- **Variants:** `alert/confirm sm`, `form md/lg/xl`, `dense`, and `full`.
- **Overlay:** slate-900 at 50–60% with backdrop blur; one documented z-index scale.
- **Container:** white, slate border, `rounded-3xl`, `shadow-2xl`, max-height 90vh for standard dialogs.
- **Header:** title, optional subtitle/icon/badge, consistent close button; sticky for long content.
- **Body/footer:** scrollable body; sticky footer for actions in long forms; actions align consistently.
- **Dismissal:** explicit `closeOnBackdrop` and `closeOnEscape`; destructive/loading states may disable dismissal.
- **Mobile:** `p-3/4`, full width, max-height based on viewport, footer actions stack when needed.
- **Accessibility:** portal, `role="dialog"`, `aria-modal`, unique title/description IDs, initial focus, focus trap, return focus, Escape, inert background.
- **Nested dialogs:** documented layer increments; no ad hoc z-index values.

### 4.5 AlertDialog, ConfirmDialog, PasswordConfirmDialog, and Toast

**Base:** alert/confirm/password variants in `src/components/Dialog.tsx`; Toast is a justified new shared component because no equivalent exists.

- **Alert:** blocking only for critical/error/information that requires acknowledgement.
- **Confirm:** explicit Cancel and Confirm; destructive action uses rose; loading disables both.
- **Password confirm:** retains entered password on validation failure only if safe; shows field error; never changes verification/business logic.
- **Toast:** non-blocking, short-lived, dismissible, aria-live region; success/info default timeout, errors longer or persistent.
- **Mobile:** toast spans available width with safe-area padding; dialogs use standard mobile dialog behavior.
- **Accessibility:** alertdialog semantics where appropriate, live-region politeness for toast, focus rules for blocking dialogs.

### 4.6 Card and Surface

**Base:** `src/components/Card.tsx`.

- **Variants:** default surface, flat section, metric, interactive.
- **Visuals:** white, slate border, `rounded-2xl`, low shadow, `p-6` default; metric may use `p-4`.
- **States:** interactive cards get hover/focus; static cards do not simulate clickability.
- **Mobile:** cards remain full width; metric grids collapse from 4→2→1 as content requires.
- **Accessibility:** if clickable, use a real link/button rather than a clickable generic div.

### 4.7 DataTable and Pagination

**Base:** v2 table markup in `EventsPage` and `MemberTable`; pagination from `src/components/Pagination.tsx`.

- **Standard table:** slate-50/80 header, uppercase 10–11px metadata, slate borders, 12px body text, hover row.
- **Dense table:** reduced padding and `text-xs`, used for finance/reports only.
- **Public table:** readable touch spacing and horizontal overflow.
- **Structure:** shared container, overflow wrapper, header/cell/action slots, loading/error/empty rows, optional selection/sort.
- **States:** hover, selected, sorted, disabled action, loading, no records, no filter results, error.
- **Mobile:** horizontal scroll with visible affordance; define priority columns or card fallback for tables where scrolling is not enough.
- **Accessibility:** semantic table, caption/label, `aria-sort`, keyboard sort controls, accessible row selection, action labels.
- **Pagination:** shared count text, Previous/Next, page buttons, disabled states, `aria-label`, current page semantics; hide only when one page.

### 4.8 Badge and Status

**Base:** status styles in dashboard/inventory/member preview, centralized into a new `Badge` only because no shared equivalent exists.

- **Variants:** success, warning, danger, info, neutral, accent.
- **Visuals:** compact pill with semantic light background, readable dark text, subtle border; `rounded-full` for statuses.
- **Typography:** `text-[10px]`/`text-xs`, bold; uppercase only for machine/status labels.
- **States:** status is not interactive; interactive filters use button/tab styling instead.
- **Accessibility:** status text remains present; icon is decorative unless it adds information.
- **Mobile:** allow wrapping; never truncate the only status meaning.

### 4.9 Tabs

**Base:** segmented tabs in Reports and Settings; public Excuse underline tabs remain an intentional variant.

- **Variants:** segmented administrative, underline public/simple, scrollable.
- **Visuals:** slate-100/90 container, 1.5 spacing/padding, active indigo/blue surface, inactive slate text.
- **States:** active, hover, focus, disabled; active must be clear without color alone.
- **Mobile:** horizontal scrolling with hidden scrollbar only when focus/scroll remains discoverable.
- **Accessibility:** tablist/tab/tabpanel roles, `aria-selected`, `aria-controls`, arrow-key navigation, focus management.

### 4.10 SearchInput, FilterBar, PageHeader, Navigation, Menu, EmptyState, LoadingState, ErrorState

**SearchInput base:** MemberTable/Attendance icon-and-clear pattern, using v2 field tokens. Standardize clear labeling, debouncing only where needed, and empty query behavior.

**FilterBar base:** `reports/components/FilterBar.tsx` layout. It should accept field slots and responsive wrapping; it should not own business filtering.

**PageHeader base:** v2 dashboard/inventory header composition. Title, description, optional breadcrumb/context, and action slot; mobile actions wrap below the title.

**Navigation base:** preserve `src/layouts/DashboardLayout.tsx`. Extract shared nav data only after behavior is covered; retain sidebar collapse, mobile drawer, active state, maintenance banner, and user actions.

**Menu base:** new shared primitive is justified because finance, schedule cards, member imports, and user actions have independent outside-click menus. It must support keyboard navigation, Escape, outside click, focus return, collision-safe placement, and disabled items.

**EmptyState base:** actionable Attendance empty state. Standard title, explanation, icon, optional action, and distinct no-results mode.

**LoadingState base:** improve `src/components/Loading.tsx`; use indeterminate spinner/skeleton by default. Real progress is allowed only when passed from a measured operation. Remove random progress loops.

**ErrorState base:** new shared page-level state is justified; `Field` owns field errors, `AlertDialog` owns blocking errors, and `ErrorState` owns load failures with retry.

## 5. Source-of-Truth Components

| Standard | Exact source of truth | Status | Planned action |
| --- | --- | --- | --- |
| Button | `src/features/dashboard/components/DashboardOverview.tsx` and `src/features/inventory/pages/InventoryPage.tsx` v2 actions | Existing markup, not reusable | Extract one shared Button API |
| Input | `src/features/events/components/EventFormModal.tsx` and `src/features/events/components/TaskFormModal.tsx` | Existing v2 markup | Extract Input/Textarea/Select and preserve field behavior |
| Field layout | `src/features/reports/components/FilterBar.tsx` | Existing layout | Reuse label/group/responsive composition |
| Combobox | `src/components/MemberCombobox.tsx` | Existing reusable behavior | Improve ARIA and align visuals; migrate MemberSearchDropdown |
| Modal | `src/components/Modal.tsx` | Existing reusable shell | Add focus management/slots and use as visual base |
| Dialog | `src/components/Dialog.tsx` | Existing alert/confirm/password family | Unify on modal foundation; fix IDs/focus |
| Card | `src/components/Card.tsx` | Existing shared primitive | Add variants without breaking current default |
| Table | `src/features/events/pages/EventsPage.tsx` and `src/features/members/components/MemberTable.tsx` | Existing v2 patterns | Extract shared table primitives; preserve dense/public variants |
| Pagination | `src/components/Pagination.tsx` | Existing shared primitive | Add accessible labels/current-page semantics |
| Badge | `src/features/dashboard/components/DashboardOverview.tsx`, `src/features/inventory/pages/InventoryPage.tsx`, `src/features/members/pages/MembersPreviewPage.tsx` | Repeated local markup | Create one shared semantic Badge |
| Tabs | `src/features/reports/pages/ReportsPage.tsx`, `src/features/settings/pages/SettingsPage.tsx` | Repeated v2 markup | Extract accessible Tabs with variants |
| Loading | `src/components/Loading.tsx` | Existing shared primitive | Correct progress semantics and add skeleton option only if needed |
| EmptyState | `src/features/attendance/pages/AttendancePage.tsx` | Existing best local pattern | Extract shared EmptyState |
| Navigation | `src/layouts/DashboardLayout.tsx` | Existing centralized layout | Preserve behavior; selectively extract internals |
| Toast | None | Missing | Create only after defining provider/placement/lifecycle |
| Menu | None complete | Missing | Create only to replace multiple local action menus |

## 6. Shared Component Consolidation

### Existing component improvements

1. **`Card.tsx`:** add explicit variants and preserve current default output.
2. **`Modal.tsx`:** become the shared structural root with header/body/footer and focus lifecycle.
3. **`Dialog.tsx`:** render alert/confirm/password variants through the modal root; generate unique IDs; preserve public props where practical.
4. **`Loading.tsx`:** make spinner indeterminate; keep bar only for real progress.
5. **`Pagination.tsx`:** add labels and current-page semantics without changing page calculations.
6. **`MemberCombobox.tsx`:** add combobox/listbox semantics and align field styling.
7. **`DashboardLayout.tsx`:** keep as the source of authenticated navigation; remove duplication only after tests/route smoke checks.

### New components justified by duplication

Create only these new shared components, in dependency order:

1. `Button`
2. `Field`, `Input`, `Textarea`, `Select`, and date/time wrappers
3. `SearchInput`
4. `PageHeader`
5. `DataTable` primitives
6. `Badge`
7. `Tabs`
8. `EmptyState`
9. `ErrorState`
10. `Toast` provider/viewport
11. `Menu`

These are not a framework build-out: each should solve a demonstrated duplicated pattern and expose only props already required by current consumers.

### Components to merge or retire

- Merge `MemberSearchDropdown` behavior into `MemberCombobox`; retain a compatibility wrapper temporarily if migration scope requires it.
- Merge custom modal roots into `Modal`/`Dialog`; feature components retain their business-specific body/forms.
- Do not create separate `FormModal`, `AlertModal`, and `ConfirmModal` roots; use variants over one dialog foundation.
- Do not create separate `FinanceButton`, `ReportsInput`, or feature-specific table primitives.

## 7. Migration Targets

### Button

Migrate all page and feature-local buttons, prioritizing:

- `src/features/authentication/components/LoginPage.tsx`
- `src/features/authentication/pages/ChangePasswordPage.tsx`
- `src/features/users/pages/UsersPage.tsx`
- `src/features/audit/pages/AuditPage.tsx`
- `src/features/reports/pages/ReportsPage.tsx`
- `src/features/members/pages/MembersPage.tsx`
- `src/features/members/components/MemberTable.tsx`
- `src/features/events/pages/EventsPage.tsx`
- `src/features/events/pages/EventDetailsPage.tsx`
- all `src/features/events/components/*`
- `src/features/schedules/pages/SchedulesPage.tsx`
- all `src/features/schedules/components/*`
- `src/features/attendance/pages/AttendancePage.tsx`
- `src/features/attendance/components/*`
- `src/features/finance/pages/FinancePage.tsx`
- `src/features/finance/components/*`
- `src/features/inventory/pages/InventoryPage.tsx`
- `src/features/inventory/components/*`
- `src/features/settings/pages/SettingsPage.tsx`
- all `src/features/settings/components/*`
- `src/features/excuse/AdminExcusePage.tsx`, `PublicExcusePage.tsx`, `ReviewExcuseModal.tsx`
- `src/features/maintenance/components/MaintenanceScreen.tsx`
- `src/components/InstallPWAButton.tsx`, `PWAUpdatePrompt.tsx`, `TutorialTooltip.tsx` where they render application actions

### Field/Input/Select/SearchInput

Migrate every native field in the source, with these major owners:

- Login and Change Password
- Members page/table and all member form/import/export modals
- Users page and user modal
- Audit filters/detail view
- Reports `FilterBar`, report tabs, export/history modals
- Schedules page and all schedule/template/publication/import/submission/assignment/PDF modals
- Attendance page/header/rows and attendance modals
- Events page/details and all event/task/team/finance/form/contribution modals
- Finance page and finance export/modals
- Inventory page and inventory/category modals
- Settings cards and report template editor
- Admin/Public Excuse and Review modal
- Public Schedule and Public Event Form
- Maintenance screen
- `MemberCombobox` and `MemberSearchDropdown`

### Modal/Dialog/Confirm/Alert

Migrate every fixed-overlay implementation in:

- Authentication: `LoginPage`, `MaintenanceScreen`
- Shared: all `Modal.tsx`/`Dialog.tsx` consumers
- Attendance: `AddOtherServerModal`, `CommunityReportModal`, `UnlockSessionModal`, local `AttendancePage` confirmation
- Members: `MemberFormModal`, `MemberImportModal`, `MemberPDFImportModal`, `MemberExportModal`, `BulkRankEditModal`, `BulkOrderEditModal`, local page confirms
- Users: local add/edit and preset dialogs
- Audit: local audit detail dialog
- Reports: `AbsenceBreakdownModal`, `HolyHourServiceHistoryModal`, `MemberReportExportModal`, `QualificationsExportModal`, `QualificationsTab` local dialogs
- Schedules: `ScheduleFormModal`, `AssignmentModal`, `ScheduleDetailsModal`, `TemplateManagerModal`, `ManageSubmissionsModal`, `CSVImporterModal`, `PublicationFormModal`, `BulkDeleteMonthModal`, `AdminEditMemberScheduleModal`, `SchedulePdfExportModal`, local confirms
- Events: every `*Modal.tsx` under `events/components`, including form builder/responses and nested dialogs
- Finance: all local overlays in `FinancePage` and finance export modals
- Inventory: `InventoryItemModal`, `ManageInventoryCategoriesModal`, password confirms
- Settings: confirm/alert usage and any editor-local overlays
- Excuse: `ReviewExcuseModal`, public/admin alert/confirm flows
- Signatures: `src/components/signatures/DynamicSignatureConfig.tsx`

### DataTable/Pagination

Migrate every table usage in:

- Members `MemberTable`
- Users
- Events and Event Details boards
- Schedules/Publications/Public Schedule and schedule export/import previews
- Attendance preview and attendance workflow lists
- Reports and all report tabs/modals
- Finance page and finance export modals
- Inventory
- Audit
- Admin/Public Excuse and preview
- Member import/PDF import
- Team/contribution/finance event boards

Use standard variant for administrative lists, dense for finance/reports, public for self-service, and document layout for PDF previews.

### Badge/Status

Centralize status mappings and migrate:

- Inventory stock/condition statuses
- Member active/inactive/suspended/archived states
- User roles/presets/access states
- Schedule status
- Event stage/priority/status
- Excuse pending/approved/rejected states
- Finance request/payment/archived states
- Attendance status
- Publication/submission status
- Task priority/status
- Maintenance enabled/disabled state

### Tabs/PageHeader/Card/Loading/Empty/Error/Menu/Toast

- **Tabs:** Reports, Settings, Inventory, Finance, Public Excuse, Publications/Event tabs, and any event workspace tab controls.
- **PageHeader:** Dashboard-adjacent page headers for Members, Schedules, Attendance, Reports, Finance, Events, Inventory, Users, Settings, Audit, Change Password, Excuses, and public page title blocks where applicable.
- **Card:** raw surface divs in dashboard, members, users, audit, reports, finance, schedules, attendance, events, inventory, settings, and maintenance.
- **Loading:** all raw spinners/text states found in Users, Settings, Attendance, Reports, Finance, Schedules, Events, Inventory, Members, and preview pages.
- **Empty/Error:** all list/table no-data and load-error branches in every production page.
- **Menu:** finance row menus, `ScheduleCard` menu, Members import menu, Users action/preset menus, event board action menus, and any click-away absolute menu.
- **Toast:** routine copy, save, import, update, archive/restore, and export completion messages currently using `AlertModal` or inline success panels.

## 8. Page Migration Matrix

| Page/route | Current state | Target standard | Priority | Complexity |
| --- | --- | --- | --- | --- |
| `/login` | Public legacy gray/blue fields and custom error modal | Public shell + shared fields/dialog/Button | P1 | Medium |
| `/` | Strongest v2 dashboard with local metrics/surfaces | Shared PageHeader/Card/Badge/Loading where applicable | P3 | Medium |
| `/members` | Mixed header/actions and legacy table/search | v2 PageHeader, Button, SearchInput, DataTable, Badge, Dialog | P1 | High |
| `/schedules` | Feature-rich v2 with many local workflow overlays | Shared dialog, fields, DataTable, Menu, Tabs, states | P1 | Very high |
| `/attendance` | Mixed legacy shell and v2 actions/status controls | PageHeader, fields, Button, status controls, EmptyState/Dialog | P1 | High |
| `/reports` | Mixed legacy filters/tables and v2 tabs | PageHeader, Field/FilterBar, DataTable dense, Tabs, Toast | P1 | High |
| `/finance` | Mixed/legacy, largest local overlay/table surface | V2 + dense DataTable, shared fields/dialogs/Menu/Toast | P1 | Very high |
| `/events` | Mostly v2 table/card but legacy header/create button | PageHeader/Button/Badge/DataTable | P2 | Low |
| `/events/:id` | Mostly v2 event workspace with many local child components | Shared modal/fields/tables/boards/states | P1 | Very high |
| `/inventory` | Strong v2 metrics/cards; blue focus/local badges | Shared fields/Badge/Card/DataTable/PageHeader | P2 | Medium |
| `/users` | Legacy table/header and local large modal | V2 PageHeader/DataTable/Badge/Dialog/Combobox | P1 | High |
| `/settings` | Mixed header/tabs/cards and blocking feedback | PageHeader/Card/Field/Tabs/Toast | P2 | Medium |
| `/audit` | Legacy gray/blue filters/table/detail modal | PageHeader/FilterBar/DataTable dense/Dialog | P1 | Medium |
| `/change-password` | Legacy fields inside v2 card; blocking success alert | shared Field/password control/Button/Toast | P2 | Low |
| `/excuses` | Mostly v2 table/dialog/badges | DataTable/Badge/Toast/PageHeader | P2 | Medium |
| `/public/excuse` | Intentional public card/underline variant | Public Field/Combobox/Tabs/Alert/Empty standards | P2 | Medium |
| `/public/schedule/:id` | Intentional public dense table and selection | Public shell/DataTable/Combobox/Dialog/fields | P2 | High |
| `/public/events/:eventId/forms/:formId` | Intentional public form, local controls/states | Public fields, validation, Loading/Error/Toast | P2 | High |
| `/public/forms/:formId` | Same component as public event form | Same public standard; no separate implementation | P2 | Low |
| Maintenance block/screen | Login-like legacy surface and custom modal | Public/auth shell + shared AlertDialog/ErrorState | P1 | Medium |
| Preview pages | Parallel v2 examples, not production routes | Use as reference only; keep synchronized or retire duplicate markup | P3 | Medium |

## 9. Implementation Order

### Phase 0 — Inventory and guardrails

1. Freeze this plan as the source of truth.
2. Add no new page-local visual primitives.
3. Create a migration checklist based on the target lists above.
4. Establish a small visual regression/smoke route set: login, dashboard, members, schedules, attendance, reports, finance, events, inventory, users, settings, audit, change password, excuses, and all public routes.

### Phase 1 — Accessibility-critical foundations

1. Improve `Modal.tsx`/`Dialog.tsx` with focus trap, focus return, unique IDs, semantics, and layer policy.
2. Improve `MemberCombobox.tsx` semantics and keyboard behavior.
3. Define accessible `Button` focus/disabled/loading behavior.
4. Improve `Pagination` labels/current-page semantics.
5. Add shared `Field` error/description wiring.

### Phase 2 — High-fanout visual primitives

1. Extract Button.
2. Extract Field/Input/Textarea/Select/date-time wrappers.
3. Extract PageHeader and SearchInput.
4. Add semantic Badge and Tabs.
5. Add EmptyState and ErrorState.

### Phase 3 — Dialog and data migration

1. Migrate Users, Audit, Events, Members, and Change Password.
2. Migrate Reports and Attendance.
3. Migrate Schedules and event subcomponents.
4. Migrate Finance last among administrative pages because of its size and dense workflow count.

### Phase 4 — Tables, menus, and feedback

1. Extract DataTable around Events/Members.
2. Add standard/dense/public variants.
3. Migrate table pages and export/import tables.
4. Add Menu and migrate action menus.
5. Add Toast and replace routine blocking alerts.

### Phase 5 — Public and responsive polish

1. Apply public field/dialog/error standards to public Excuse, Schedule, and Event Form.
2. Define narrow viewport behavior for each dense table.
3. Standardize action wrapping, sticky modal footers, tab overflow, and safe-area spacing.
4. Reconcile preview pages with production primitives.

## 10. Accessibility Requirements

- Every production dialog has correct dialog/alertdialog semantics, an accessible name, optional description, focus trap, initial focus, focus return, Escape policy, and inert background.
- Every icon-only button has an accessible name and at least a 36px hit area.
- Every input has a programmatic label; helper/error text is connected with `aria-describedby`.
- Invalid fields expose `aria-invalid`; disabled fields remain understandable and do not rely on opacity alone.
- Native selects remain the default for short fixed lists.
- Every custom combobox/listbox/menu supports keyboard operation, active/selected semantics, Escape, and focus return.
- Tabs use tablist/tab/tabpanel semantics and arrow-key navigation.
- Tables use semantic headers, captions/labels where needed, sort semantics, selection semantics, and accessible action names.
- Status is never communicated by color alone.
- Toasts use an appropriate live region and do not steal focus.
- Loading states expose a meaningful status to assistive technology without repeatedly announcing progress.
- Reduced-motion preferences are respected for transitions and animation.
- Keyboard focus is visible across all variants, including public and modal contexts.

## 11. Responsive Requirements

- Authenticated pages retain `p-4 sm:p-8` shell gutters unless the content is a documented full-width table/workspace.
- Header actions wrap below page titles on narrow screens; primary form actions become full width where appropriate.
- Controls use 40px minimum height, 44px for public/touch-critical controls.
- Two-column forms collapse predictably at `sm`; no critical field or action is clipped.
- Standard dialogs fit within the viewport, scroll only the body, and keep actions reachable; full-screen dialogs are explicit variants.
- Tables either scroll with clear affordance, prioritize columns, or switch to cards; no essential data is silently hidden.
- Tabs remain usable when horizontally scrolled and preserve keyboard focus visibility.
- Dropdowns/menus remain within the viewport and do not depend on hover.
- Toasts respect safe-area insets and do not cover primary actions.
- Empty/error/loading states remain centered and readable at mobile widths.
- Test at minimum 320px, 375px, 768px, 1024px, and wide desktop widths.

## 12. Acceptance Criteria

### Global

- No new production page-local Button, Field, Modal, Dialog, Badge, Table, Tabs, Menu, Loading, or EmptyState markup is introduced after the corresponding shared primitive exists.
- All documented exceptions are limited to public, dense, full-screen, or document variants.
- Visual tokens match the final design language: slate neutrals, indigo primary, documented semantic colors, control/card/dialog radius scale, and spacing scale.

### Button

- Primary actions use shared Button.
- Focus, hover, active, disabled, and loading states are consistent.
- Icon-only actions have accessible names and hit areas.
- No legacy blue/gray primary construction remains outside documented public/document exceptions.

### Fields and dropdowns

- All production fields use shared Field/Input/Textarea/Select wrappers.
- Native selects are used for simple fixed options.
- Searchable lists use shared Combobox.
- No production clickable `div` option remains.
- Error/helper/required semantics are consistent and measurable in markup.

### Modal/dialog

- All production modals use the shared dialog foundation.
- No feature page contains duplicated overlay root markup unless explicitly documented as a full-screen/document variant.
- All dialogs have semantics, unique labels, consistent Escape/backdrop policy, focus trap, and focus restoration.
- Standard size variants and mobile behavior are used.

### Tables/pagination

- Every paginated administrative list uses shared Pagination.
- Every table uses standard, dense, or public DataTable variant.
- Sort, selection, action, loading, error, and empty semantics are accessible.
- Mobile behavior is documented per dense table.

### Badge/tabs/navigation

- Status mappings use centralized semantic Badge variants.
- Tabs use shared accessible variants.
- Authenticated navigation remains behaviorally equivalent while sharing active/focus/responsive rules.

### Feedback/loading/empty/error

- Routine success/copy/save feedback uses Toast, not a blocking modal.
- Blocking errors and decisions use AlertDialog/ConfirmDialog.
- Page load failures use ErrorState with retry where retry is meaningful.
- Empty states distinguish no data from no search results.
- Loading indicators do not simulate unknown progress.

### Functional safety

- No business logic, permissions, service calls, data shape, validation rule, or workflow outcome changes as part of visual standardization.
- Existing route behavior, query parameters, persistence, and destructive-action safeguards remain unchanged.

## 13. Risks and Special Cases

1. **Finance complexity:** `FinancePage.tsx` is very large and contains many dense tables and overlays. Migrate primitives first; do not combine UI refactoring with finance domain decomposition or data changes.
2. **Nested dialogs:** Event forms/responses and schedule submissions can open secondary dialogs. Establish layering and focus behavior before migration.
3. **Public UX:** Public routes should share tokens and accessibility requirements but should not inherit the authenticated sidebar, dense admin typography, or permission-specific actions.
4. **Native date/time controls:** Browser-rendered controls differ by platform. Standardize wrappers first; do not replace them with a custom picker unless a tested UX need emerges.
5. **Preview drift:** Preview pages can falsely appear to be production standards because they contain polished examples. They must either consume shared primitives or be explicitly labelled as non-production reference material.
6. **Compatibility:** Existing consumers of `Modal`, `Dialog`, `Card`, `Loading`, `Pagination`, and `MemberCombobox` should retain compatible props during migration to avoid a broad simultaneous rewrite.
7. **Feedback timing:** Moving alerts to Toast changes interaction timing. Preserve blocking behavior for critical errors, destructive outcomes, authentication, and permission failures.
8. **Table semantics:** Some finance/export tables are document-like rather than interactive data grids. Do not add unnecessary sorting or selection behavior.
9. **Status semantics:** Similar colors do not always mean identical domain states. Centralize visual semantics without merging business status values.
10. **Responsive overflow:** Horizontal scrolling is acceptable for truly dense data, but must not be used to hide actions or make primary workflows inaccessible.
11. **Unrelated worktree changes:** Existing source changes must not be reverted while implementing this plan; each future migration should be reviewed against the current working tree.

## 14. Final Definition of Done

The standardization is complete when:

1. The shared component set is implemented from the exact sources of truth listed in Section 5.
2. All production routes in Section 8 use the correct administrative, public, dense, full-screen, or document variant.
3. All repeated UI patterns have one shared implementation or one explicitly documented variant.
4. All production dialogs, comboboxes, menus, tabs, tables, buttons, and fields satisfy the accessibility requirements.
5. All pages satisfy the responsive requirements at the defined viewport sizes.
6. Routine notifications use Toast; blocking decisions/errors use dialogs; page failures use ErrorState; empty and loading states are standardized.
7. No duplicated overlay roots, legacy primary controls, unclassified badge mappings, or page-local shared-pattern implementations remain except documented exceptions.
8. Business logic, permissions, API behavior, validation rules, route behavior, and workflow outcomes are unchanged.
9. The preview/design-reference surfaces consume the same shared primitives or are clearly excluded from production acceptance.
10. A final source search confirms that every migration target has been addressed and every exception is documented.
