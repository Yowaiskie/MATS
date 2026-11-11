# UI/UX Consistency Audit

**Scope:** Static audit of the React/Tailwind frontend under `src/`, including the router, authenticated layout, public routes, shared components, feature pages, feature-local components, modal implementations, forms, tables, states, and responsive class usage. The audit intentionally makes no code changes other than this report. Findings are based on implementation evidence in source; visual behavior should be confirmed with a browser/device pass before refactoring.

**Application inventory:** `src/App.tsx` defines 20 production route entries (including public and parameterized routes), with 26 page/preview components present in the repository. The frontend contains 98 feature `.tsx` files, 12 shared components, a single Tailwind entry stylesheet, and no separate token/theme layer.

## 1. Executive Summary

### Overall consistency level

**Moderate, but fragmented.** The application has a recognizable visual language: slate backgrounds, indigo/blue primary actions, rounded cards, compact typography, subtle borders, and responsive Tailwind layouts. The shared `Card`, `Modal`, `Dialog`, `Loading`, and `Pagination` primitives provide a credible foundation. However, those primitives are not enforced across the system. Several high-traffic pages still use a legacy gray/blue/`rounded-lg` language, while newer event, schedule, inventory, and dashboard surfaces use a more polished slate/indigo/`rounded-xl` or `rounded-2xl` language.

### Biggest issues

1. **Duplicated modal/dialog implementations** are the most consequential inconsistency. `src/components/Modal.tsx` and `src/components/Dialog.tsx` are shared, but many feature components and large pages render their own fixed overlays. They vary in width, radius, backdrop opacity, z-index, header structure, close behavior, and accessibility attributes.
2. **Two competing form systems** exist: compact gray/blue inputs (`rounded-lg`, `border-gray-*`, blue focus) and slate/indigo inputs (`rounded-xl`, `bg-slate-50`, indigo focus). The difference is visible within the same workflow, especially finance, users, reports, attendance, and public forms.
3. **Two competing page/header/table systems** exist. Older pages use gray titles, gray table headers, 10–14px body text, and `shadow-sm`; newer pages use slate titles, uppercase 10–11px table headers, indigo actions, and `shadow-2xs`.
4. **Tables are locally implemented rather than systematized.** There are many table structures, header treatments, minimum widths, row densities, action affordances, and empty states. Only some use the shared `Pagination`.
5. **Accessibility is inconsistent.** Some shared dialogs have `role="dialog"` and `aria-modal`, but many custom dialogs do not. Focus trapping, return focus, labelled controls, keyboard support for custom dropdowns, and visible focus treatment are not consistently implemented.
6. **Feedback is modal-heavy and inconsistent.** `AlertModal` is used in many pages, but feature-local inline alerts, page-level errors, success panels, and bespoke confirmation dialogs remain. There is no unified toast/notification primitive.
7. **Preview components duplicate production UI.** `*PreviewPage` and `ComponentPreviewPage` contain parallel versions of dashboards, tables, buttons, and states. They are useful as design references but can drift from production and are not routed from `App.tsx`.

### Recommended direction

Adopt the existing **slate/indigo v2 language** as the single administrative design baseline, using the shared `Card`, `Modal`, `Dialog`, `Loading`, and `Pagination` concepts as the starting point. Consolidate primitives before polishing feature pages. Retain intentional variants for public self-service pages, dense financial/report tables, and full-screen document/export workflows, but express those variants through shared component APIs rather than copied markup.

## 2. Design System Inventory

| UI Pattern | Implementations Found | Consistency | Recommended Standard |
| --- | ---: | --- | --- |
| Page shell/layout | 2 primary shell modes plus public pages | Inconsistent | `DashboardLayout` shell for authenticated pages; shared public shell for self-service routes |
| Page title/header | 4+ class patterns | Inconsistent | Slate/indigo v2 page header: `text-2xl sm:text-3xl`, `font-extrabold`, `text-slate-900`, supporting `text-sm text-slate-500` |
| Button | 5+ recurring constructions | Inconsistent | Shared `Button` with primary indigo, secondary white/slate, danger rose, compact/icon variants |
| Input/textarea | 3 major families | Inconsistent | `bg-slate-50` / white-on-focus, `border-slate-200`, `rounded-xl`, 12–14px text, indigo focus ring |
| Native select | 3+ visual families | Inconsistent | Shared `Select` wrapper with the same height, radius, focus, disabled, and error states |
| Search input | At least 4 implementations | Inconsistent | Shared `SearchInput` with icon, clear action, consistent height, label/placeholder, and keyboard semantics |
| Member picker | `MemberCombobox`, `MemberSearchDropdown`, local selectors | Duplicated implementation | `MemberCombobox` interaction model, redesigned to match shared field tokens |
| Modal | Shared `Modal`, shared `Dialog`, 30+ custom overlays | Highly inconsistent | Shared dialog shell with size, scroll, destructive, form, and full-screen variants |
| Confirmation dialog | `ConfirmModal`, `PasswordConfirmModal`, local confirms, page-local dialog state | Inconsistent | `ConfirmDialog` / `PasswordConfirmDialog` from `Dialog.tsx` |
| Alert/feedback | `AlertModal`, inline banners, local messages, no global toast | Inconsistent | Alert dialog for blocking feedback; shared non-blocking toast for routine success/error |
| Card | Shared `Card` plus many raw `div` cards | Mostly consistent | `Card` as default surface; explicit `variant="flat|interactive|metric"` |
| Table | 20+ table usages | Inconsistent | Shared `DataTable` primitives with dense/standard variants and responsive overflow |
| Pagination | Shared `Pagination` plus page-local handling | Mostly consistent where used | Shared pagination with accessible labels, disabled states, and optional compact mode |
| Tabs | Segmented slate/blue tabs, underline tabs, pills | Acceptable variation but undocumented | Shared tabs with `segmented`, `underline`, and `scrollable` variants |
| Badges/status | Many local color mappings | Inconsistent | Semantic `Badge` with centralized status-to-color mapping |
| Empty states | Local messages, icons, panels, dashed boxes | Inconsistent | Shared `EmptyState` with icon, title, explanation, and optional action |
| Loading states | Shared spinner/bar plus raw spinners and text | Inconsistent | Shared spinner/skeleton; remove simulated progress from real operations |
| Error states | Alert modal, inline red panels, raw page text | Inconsistent | Shared inline `FieldError`, `ErrorState`, and alert/toast policies |
| Navigation | Desktop sidebar, mobile drawer, top breadcrumb/title | Mostly consistent | Keep `DashboardLayout`; extract navigation primitives and make active/focus states shared |
| Action menus | Local absolute menus, buttons, outside-click listeners | Duplicated implementation | Shared `Menu` with keyboard navigation and viewport collision handling |
| Date/time controls | Native date/time/month/datetime-local inputs | Acceptable variation, visually inconsistent | Shared field wrapper; native controls retained unless product needs a custom picker |
| Checkbox/radio/toggle | Native controls with local labels/cards | Inconsistent | Shared accessible checkbox/radio/switch patterns |
| Responsive behavior | Generally Tailwind responsive, but local breakpoints and overflow rules | Inconsistent | Standard page gutters, modal mobile behavior, table overflow, and stacked action rules |

## 3. UI Pattern Audits

### 3.1 Buttons

#### Implementations found

| Implementation | Location | Usage | Assessment |
| --- | --- | --- | --- |
| Legacy blue button | `authentication/components/LoginPage.tsx:204-211`, `users/pages/UsersPage.tsx:1028-1037`, `events/pages/EventsPage.tsx:67-73` | Primary page/form actions | Clear and familiar, but uses `rounded-lg`, blue, and older gray typography |
| V2 indigo button | `dashboard/components/DashboardOverview.tsx:394-399`, `inventory/pages/InventoryPage.tsx:226-238` | Primary actions | Best match to the dominant newer visual language; good hover, shadow, active, and responsive behavior |
| Semantic tinted action | `attendance/pages/AttendancePage.tsx:644-663` | Secondary workflow actions | Useful for action meaning, but multiple purple/blue/green constructions are hand-authored |
| Icon-only table action | `users/pages/UsersPage.tsx:1159-1181` | Edit/delete | Compact and understandable with titles, but inconsistent icon button shape and color treatment |
| Local finance actions | `finance/pages/FinancePage.tsx` | Finance operations | Dense and functional, but many local variants and older gray/blue tokens |

#### Comparison

Primary buttons range from `rounded-lg` to `rounded-xl`, `text-xs` to `text-sm`, blue to indigo, and `shadow-sm` to colored shadows. Some use `active:scale`, some use only color transitions, and some omit a visible focus style. Full-width behavior also varies: login and form actions are full width, while page actions wrap or remain fixed-width.

#### Winning design

**V2 indigo button pattern**, represented by dashboard/inventory/event/schedule actions.

#### Reason

It has the strongest visual hierarchy, consistent relation to the slate/indigo language, clear hover/active/disabled states, and better responsive handling. It is already used across several newer, high-complexity workflows.

#### Standardization recommendation

Create a shared `Button` with:

- `primary`: indigo 600/700, white text, `rounded-xl`, 40px minimum height.
- `secondary`: white/slate border, slate text, slate hover.
- `tertiary`: transparent/slate hover.
- `danger`: rose/red semantic color.
- `success`: emerald semantic color only when the action itself is positive.
- `icon`: minimum 36–40px hit area, accessible label/title.
- Consistent `focus-visible:ring-2`, disabled opacity/cursor, loading content, and `type="button"` default.

Do not use color alone to communicate destructive or status meaning; pair it with text/icon.

### 3.2 Inputs, selects, date/time fields, and validation

#### Implementations found

| Implementation | Location | Usage | Assessment |
| --- | --- | --- | --- |
| Gray/blue compact fields | `features/reports/components/FilterBar.tsx:43-151`, `members/components/MemberTable.tsx:148-173`, `authentication/components/LoginPage.tsx:128-159` | Filters, login, tables | Mature and compact, but visually legacy and lacks consistent error/disabled styling |
| Slate/indigo fields | `features/events/components/EventFormModal.tsx:189-255`, `events/components/TaskFormModal.tsx:171-207` | Newer forms | Best baseline; coherent background/focus/radius and dense form rhythm |
| Larger inventory fields | `features/inventory/components/InventoryItemModal.tsx:191-369` | Inventory forms | Good touch sizing, but uses blue focus and `text-sm`, creating a third family |
| Member picker fields | `components/MemberCombobox.tsx:166-207`, `components/MemberSearchDropdown.tsx:121-189` | Member selection | Strong functionality, but two interaction models and different keyboard/accessibility quality |
| Finance/local fields | `features/finance/pages/FinancePage.tsx` and finance modals | Finance forms | Extensive but locally styled; difficult to maintain consistently |

#### Comparison

The field system varies in height (`py-1.5`, `py-2`, `py-2.5`, `py-3`), radius (`rounded-lg`, `rounded-xl`, `rounded-2xl`), background (`white`, `gray-50`, `slate-50`, `slate-50/40`), text size (`text-xs`, `text-sm`), and focus treatment (blue border/ring, indigo border/ring, or outline-only). Labels vary between sentence case and uppercase tracking, with required markers placed differently. Errors are sometimes inline beneath a field, sometimes a whole modal banner, and sometimes a blocking alert.

Native date, time, month, and datetime controls are appropriate for this application, but their wrappers should be standardized. `FilterBar` demonstrates a clean labeled filter layout; event/schedule forms demonstrate the stronger v2 field tokens.

#### Winning design

**Slate/indigo v2 field pattern** used by `EventFormModal` and `TaskFormModal`, with the `FilterBar` label/spacing structure retained.

#### Standardization recommendation

Create `Field`, `Input`, `Textarea`, `Select`, `DateField`, and `SearchInput` primitives. Standardize:

- 40px desktop/mobile minimum height; 44px for touch-critical public forms.
- `rounded-xl`, `border-slate-200`, `bg-slate-50`, white on focus.
- `text-sm` for user-entered data; `text-xs` only for dense table filters.
- `focus-visible:ring-2 focus-visible:ring-indigo-500/25` and a clear invalid state.
- Label, required marker, helper text, error text, and `aria-describedby` in one wrapper.
- Disabled state that preserves contrast and does not rely only on opacity.

### 3.3 Dropdowns and member selection

#### Implementations found

| Implementation | Location | Usage | Assessment |
| --- | --- | --- | --- |
| Native select | `members/components/MemberTable.tsx`, `reports/components/FilterBar.tsx`, most forms | Filters and enumerated fields | Reliable keyboard behavior, but inconsistent styling and no shared wrapper |
| `MemberCombobox` | `components/MemberCombobox.tsx:166-347` | Typeahead member selection | Strongest keyboard support: arrows, Enter, Escape, custom values, loading state |
| `MemberSearchDropdown` | `components/MemberSearchDropdown.tsx:121-235` | Selection in users and other workflows | Rich visual selection and clear/change actions, but options are clickable `div`s and keyboard semantics are incomplete |
| Finance action menu | `features/finance/pages/FinancePage.tsx` | Row actions | Local outside-click implementation and bespoke menu positioning |
| Schedule card menus | `features/schedules/components/ScheduleCard.tsx:262` | Card actions | Local overlay and click-away behavior |

#### Comparison

There is no single dropdown behavior. Native selects provide the safest keyboard model. `MemberCombobox` is the strongest custom implementation because it handles focus, keyboard navigation, selection, and custom values. `MemberSearchDropdown` has stronger selected-state presentation but uses a button trigger with an expanded panel whose options are non-semantic clickable `div`s and includes a “Change/Close” label treatment that is unlike other selects.

#### Winning design

**`MemberCombobox` interaction model**, with the visual field tokens from v2 forms. Native `select` remains the standard for short fixed option lists.

#### Standardization recommendation

Use native `Select` for short static lists. Use one accessible `Combobox` for searchable member/entity lists. Add `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"`, `role="option"`, active descendant handling, Escape behavior, and focus return. Replace clickable `div` options and local action menus with shared `Menu`/`Combobox`.

### 3.4 Modals and dialogs

#### Implementations found

| Implementation | Location | Usage | Assessment |
| --- | --- | --- | --- |
| Shared form modal | `components/Modal.tsx:48-86` | Many exports/forms/inventory/event workflows | Best reusable shell: size API, max-height, scroll body, backdrop, Escape, header, subtitle/icon/badge |
| Shared alert/confirm/password dialogs | `components/Dialog.tsx:72-345` | Blocking feedback and sensitive actions | Best semantic family, but needs focus trap, unique IDs, and consistent backdrop/close policy |
| Feature modal pattern | `attendance/components/AddOtherServerModal.tsx:71-107`, schedules/events/member modals | Forms | Visually close to shared modal but duplicated markup and behavior |
| Legacy page-local modal | `users/pages/UsersPage.tsx:1197-1260`, `audit/pages/AuditPage.tsx:584-641` | Admin forms/details | Gray/black backdrop, `rounded-2xl`/`rounded-xl`, no dialog semantics in shown shell |
| Finance overlay family | `finance/pages/FinancePage.tsx:3191-4162` | Many finance forms/confirmations | Functionally rich but highly duplicated and locally styled |
| Nested/specialized modal | `events/components/EventFormResponsesModal.tsx:319-963`, `schedules/components/ManageSubmissionsModal.tsx:324-748` | Full-screen/dense workflows | Acceptable as full-screen variants, but must share overlay and accessibility primitives |

#### Comparison

The shared `Modal` and `Dialog` use `bg-slate-900/50-60`, `backdrop-blur-md`, `rounded-3xl`, z-index 60, and animate-in transitions. Custom implementations use z-index 50, 60, 70, 80, or 100; `bg-black/40`, `bg-black/50`, `bg-slate-900/50`, and `bg-slate-900/60`; `backdrop-blur-xs`, `sm`, or `md`; and radius from `rounded-xl` to `rounded-3xl`. Some allow backdrop dismissal, some intentionally prevent it, and some have no `role="dialog"` or `aria-labelledby`. Focus trapping and focus restoration are absent from the shared implementation and generally absent from custom ones.

#### Winning design

**`Modal.tsx` + `Dialog.tsx` shared family**, extended with a true full-screen/dense variant for export and response workflows.

#### Reason

These components have the clearest API, consistent title/body/action structure, Escape support, and widespread adoption. The v2 visual language is more cohesive than the legacy gray/black overlays.

#### Standardization recommendation

Use one dialog foundation with:

- Portal rendering and a documented z-index scale.
- `role="dialog"`, `aria-modal`, unique title/description IDs.
- Focus trap, initial focus, return focus, Escape policy, and optional backdrop-dismiss policy.
- Standard sizes: `sm` alert/confirm, `md` form, `lg`/`xl` complex form, `full` workspace.
- Sticky header/footer and scrollable body for long forms.
- Consistent close button hit area and visible `focus-visible` style.
- Destructive confirmation and password confirmation as variants, not separate page-local markup.

### 3.5 Tables

#### Implementations found

| Implementation | Location | Usage | Assessment |
| --- | --- | --- | --- |
| V2 slate table | `events/pages/EventsPage.tsx:80-123`, `members/components/MemberTable.tsx:328-513`, `excuse/AdminExcusePage.tsx:185-285` | Core list pages | Strong visual hierarchy, uppercase compact headers, hover rows, responsive overflow, shared pagination |
| Legacy gray table | `users/pages/UsersPage.tsx:1041-1187`, `audit/pages/AuditPage.tsx:475-574`, `reports/pages/ReportsPage.tsx:308-553` | Admin/report pages | Functional but less aligned with v2; body/header density and colors differ |
| Finance dense tables | `finance/pages/FinancePage.tsx:1755-3990` | Financial ledgers and workflows | Intentional density, but repeated local table CSS and inconsistent minimum widths |
| Responsive/public tables | `schedules/pages/PublicSchedulePage.tsx:552`, import/export modals | Public and document workflows | Appropriate horizontal overflow, but not a shared table contract |

#### Comparison

Table headers use `text-[10px]`, `text-[11px]`, or gray body text; backgrounds range from `bg-gray-50` to `bg-slate-50/80`; header weight ranges from bold to black; rows use `divide-gray-*` or `divide-slate-*`; action controls range from text links to icon buttons. Pagination is shared in many admin tables, but some dense/finance tables handle their own scrolling or do not expose a consistent count/empty state.

#### Winning design

**V2 slate table pattern** in Events/Members/Excuses, with a dense variant for Finance/Reports.

#### Standardization recommendation

Create `DataTable` primitives for container, header, row, cell, status, action, and responsive overflow. Define `standard` and `dense` variants. Preserve horizontal scrolling for wide data, but provide mobile card/priority-column behavior where a table is not meaningfully usable on a narrow screen. Use accessible sort buttons and `aria-sort`; do not rely on text arrows alone.

### 3.6 Cards and metrics

`components/Card.tsx:12-21` is a good baseline: white surface, subtle slate border, `rounded-2xl`, padding, and low shadow. Dashboard and inventory use metric cards with semantic color accents, while finance, audit, settings, and older pages use raw `div` cards with gray borders and different radius/shadow. The raw cards are not inherently wrong, but they create drift and duplicate surface rules.

**Winning design:** shared `Card`, extended with `surface`, `metric`, `interactive`, and `section` variants.

**Recommendation:** retain the v2 surface tokens; allow dense and full-bleed variants without reimplementing border/radius/shadow. Avoid hover shadows on non-interactive cards unless the card is actually clickable.

### 3.7 Tabs

Reports (`ReportsPage.tsx:218-249`) and Settings (`SettingsPage.tsx:165-187`) use a polished segmented slate container with blue active tab. Inventory uses a similar segmented category bar. Public Excuse uses an underline-style two-tab interaction, and finance has a larger tab system embedded in a very large page. These are acceptable variations by information architecture, but active/focus/overflow behavior should be shared.

**Winning design:** segmented tab pattern for authenticated workspaces; underline tabs only for simple public two-state forms.

**Recommendation:** create `Tabs` with `segmented`, `underline`, and `scrollable` variants, using `role="tablist"`, `role="tab"`, `aria-selected`, keyboard arrow navigation, and visible focus.

### 3.8 Badges and status indicators

Status colors are broadly understandable (emerald success, amber warning/pending, rose danger, indigo active/info, slate neutral). However, the same semantic status changes radius, padding, casing, and color shade between pages. Examples include inventory stock badges (`InventoryPage.tsx:189-197`), member status badges (`MembersPreviewPage.tsx:116-121`), user role badges (`UsersPage.tsx:1088-1145`), schedule statuses (`DashboardOverview.tsx:237-240`), and excuse states (`ExcusePreviewPage.tsx:53-55`).

**Winning design:** v2 compact pill badge with border, uppercase only for machine/status labels, sentence case for user-facing role labels.

**Recommendation:** centralize semantic mappings and use `Badge` variants: `success`, `warning`, `danger`, `info`, `neutral`, `accent`. Never encode status only by color; include text and, where necessary, an icon.

### 3.9 Search and filters

Search is implemented in members, attendance, reports, schedules, event boards, finance boards, and comboboxes. The visual patterns range from gray `rounded-lg` fields with a left icon to slate `rounded-xl` fields and specialized pickers. FilterBar is the clearest compositional pattern, while MemberTable and Attendance use older compact styles.

**Winning design:** shared search/filter field based on `FilterBar` structure and v2 field tokens.

**Recommendation:** provide consistent search icon, clear button, label/placeholder policy, debounce policy where data-backed, and filter reset affordance. Group filters in a `FilterBar` with a consistent responsive collapse/overflow behavior.

### 3.10 Notifications, errors, confirmation, loading, and empty states

- **Notifications:** There is no toast system. Routine actions such as copying links and saving records often open a blocking `AlertModal`, while modal-local operations use inline success/error panels. Introduce a non-blocking toast for routine success and reversible errors; keep dialogs for decisions and critical failures.
- **Errors:** `AlertModal` is the most consistent blocking error surface, but page errors are inconsistently routed into it. `MembersPage` and `SchedulesPage` merge page load errors into alert state, while forms often render local red boxes. Standardize `ErrorState` for page load failures and `FieldError` for validation.
- **Confirmation:** Use `ConfirmModal` for destructive actions and `PasswordConfirmModal` for sensitive permanent deletion. Several local confirms remain, particularly in finance and nested workflows.
- **Loading:** `Loading` is a good shared entry point, but many pages render raw spinners. The `bar` variant simulates random progress and resets to 0 after reaching 100%; this is not appropriate for an operation whose real progress is unknown and can trigger `onComplete` repeatedly. Use indeterminate progress unless real progress exists.
- **Empty states:** Current states include plain centered text, dashed boxes, icon panels, and full cards. The attendance empty state (`AttendancePage.tsx:732-770`) is the strongest explanatory/actionable version. Promote it to a shared `EmptyState`.

## 4. Page-by-Page Audit

| Page/route | Visual/layout/component consistency | Responsive behavior | UX/accessibility findings | Recommendation |
| --- | --- | --- | --- | --- |
| `/login` (`LoginPage`) | Legacy gray/blue card and rounded-lg fields; custom error modal | Good stacking and mobile padding | Error is both inline and modal; custom modal lacks shared dialog semantics; focus styling differs | Keep public branding, migrate fields/dialog/buttons to shared public variants |
| `/` (`DashboardOverview`) | Strongest v2 page: gradient welcome, metric cards, slate surfaces, indigo actions | Good grid collapse and stacked schedule rows | Dense dashboard may need heading/landmark review; many decorative icons | Use as visual reference; extract metric/surface primitives |
| `/members` (`MembersPage`, `MemberTable`) | Mixed: page header/actions v2, table/search legacy gray/blue; shared pagination/dialogs | Table overflow and responsive controls are reasonable | Bulk selection/action semantics need clear announcements; sort indicator is text-only | Migrate table/search/buttons to v2 `DataTable` and `SearchInput` |
| `/schedules` (`SchedulesPage`) | Feature-rich v2 modal/dialog usage, but page is very large and includes list/calendar/publication modes | Good responsive intent; wide controls and tables can overflow | Many custom modals, date filters, action menus; complex focus context | Consolidate modal/menu/table primitives; document list/calendar/publication variants |
| `/attendance` (`AttendancePage`) | Legacy gray page shell mixed with v2 tinted action buttons and shared dialogs | Strong mobile stacking and horizontally scrollable filter pills | Custom status controls and dirty-state confirmations require consistent keyboard/announcement behavior | Standardize page/header/forms; retain workflow-specific status colors |
| `/reports` (`ReportsPage`) | Legacy page header/filter/table style plus strong v2 segmented tabs | Horizontal tab scrolling is good; dense tables need mobile strategy | Several tables and pagination paths; filter labels/fields need shared semantics | Use v2 header, shared filter fields/tables, dense table variant |
| `/finance` (`FinancePage`) | Largest source of local styling and bespoke overlays; older gray/blue and newer slate tokens coexist | Some min-width tables are intentionally dense, but mobile requires horizontal scrolling | Very large page state surface, many local dialogs/action menus, inconsistent feedback | Split into subviews/components; consolidate dialogs, forms, tables, and toast feedback |
| `/events` (`EventsPage`) | Strong v2 table/card/pagination but page header and create button use legacy gray/blue | Good table overflow; actions may need stack at narrow widths | Table action/link treatment differs from other lists | Adopt v2 button/header; use shared table/status/action cells |
| `/events/:id` (`EventDetailsPage`) | Event workspace is feature-rich and mostly v2, with local boards/modals | Board/table content likely needs horizontal/stacked mobile treatment | Multiple nested modal types and sensitive actions | Preserve workspace layout; standardize nested modal shell and board empty/loading states |
| `/inventory` (`InventoryPage`) | Strong v2 card/metric/status treatment; blue focus differs from indigo baseline | Good metric grid collapse and table overflow | Status semantics are duplicated locally; modal forms use larger fields | Make inventory a reference for metric cards; centralize badge/field tokens |
| `/users` (`UsersPage`) | Legacy gray/blue table and page header; local large modal; `MemberSearchDropdown` embedded | Table overflow works; modal body scrolls | Local modal lacks shared dialog semantics; role/preset badges vary | Migrate to shared modal, v2 table, combobox, and badge |
| `/settings` (`SettingsPage`) | Header legacy gray, tabs v2, cards/settings components mixed | Tab scroll and template split layout are good | Success/error are blocking alerts for routine saves; form primitives local | Keep segmented tabs; standardize settings cards/fields and toast feedback |
| `/audit` (`AuditPage`) | Legacy gray/blue header/filter/table and black/gray local detail modal | Table overflow and modal max-height are sensible | Local modal semantics/focus behavior need improvement | Use shared page header/filter/table/dialog; retain audit density |
| `/change-password` (`ChangePasswordPage`) | Legacy gray/blue field style in a v2 `Card`; shared alerts | Good single-column mobile layout | Password visibility buttons and validation need consistent focus/aria; blocking success alert is heavy | Use shared field/password control and toast success |
| `/excuses` (`AdminExcusePage`) | Mostly v2 table/badges/dialogs | Reasonable table overflow and pagination | Public link copy uses modal feedback; local action flows vary | Use shared toast for copy/success; standardize table/status/action cells |
| `/public/excuse` (`PublicExcusePage`) | Intentional public card design, v2 slate/indigo fields and underline tabs | Good centered responsive card | Custom selectable member/schedule controls need keyboard semantics review | Retain public variant; use shared accessible combobox/list and form fields |
| `/public/schedule/:id` (`PublicSchedulePage`) | Intentional public self-service visual language with dense schedule table | Horizontal table behavior is appropriate; confirm narrow interaction | Custom modal/selection flows and date/time presentation need accessibility pass | Create shared public shell and public table/selection variants |
| `/public/events/:eventId/forms/:formId`, `/public/forms/:formId` (`PublicEventFormPage`) | Intentional public form branding but separate from admin form tokens | Long forms need sticky/clear action behavior on mobile | Validation and question controls are locally implemented; loading/error states differ | Keep public shell; standardize fields, errors, progress, and submission feedback |
| `MaintenanceScreen` | Login-like legacy gray/blue surface with custom error modal | Centered responsive layout | Custom modal duplicates login modal and uses high z-index | Reuse public/auth shell and shared alert dialog |
| Preview pages (`*PreviewPage`, `ComponentPreviewPage`) | Strong v2 reference implementations but duplicate production UI | Generally responsive | Not routed in `App.tsx`; drift risk and unclear source of truth | Treat as storybook/design reference or remove duplication after migration |

## 5. Cross-System Inconsistencies

1. **Page title typography:** gray `font-bold` headers in Users, Audit, Reports, Settings, Members, Schedules, and Events versus slate `font-black`/`font-extrabold` headers in newer preview, inventory, and dashboard surfaces.
2. **Primary action color:** blue 600/700 on login, users, events, reports, attendance, and change password versus indigo 600/700 in dashboard and many newer workflows.
3. **Field focus:** blue rings/borders in legacy pages and inventory versus indigo focus in event/schedule/member workflows.
4. **Radius scale:** `rounded-lg` legacy controls, `rounded-xl` standard v2 controls, `rounded-2xl` cards/comboboxes, and `rounded-3xl` dialogs without a documented role.
5. **Modal dismissal:** some backdrops close on click, some do not; some disable close during saving, some do not. Escape behavior is not universal.
6. **Modal accessibility:** shared dialogs expose dialog roles; most custom overlays do not. Focus trapping and restoration are not consistently present anywhere.
7. **Modal layering:** z-index values range from 50 to 100, with nested overlays using ad hoc values.
8. **Table headers:** gray 10px, gray 11px, slate 10px, slate 11px, `font-bold`, and `font-black` variants all coexist.
9. **Status badge shape:** pill, rounded-md, rounded-lg, and rounded-xl badges express similar statuses.
10. **Feedback timing:** routine save/copy actions may block with an alert modal, while some modal-local successes remain inline.
11. **Loading:** shared branded spinner, raw blue spinner, text-only loading, and simulated progress bar all coexist.
12. **Empty states:** plain text, dashed containers, icon panels, and full cards are not standardized.
13. **Search affordances:** some fields have a search icon, some have no icon, some have a clear button, and clear buttons are not always labelled.
14. **Action menus:** finance, schedule cards, members import, and user actions use separate outside-click and positioning logic.
15. **Navigation/profile:** authenticated navigation is centralized and mostly coherent, but top-bar account actions are text-based while sidebar profile is a separate visual treatment.
16. **Responsive gutters:** `p-4 sm:p-8` in the authenticated shell is consistent, but feature-local cards and modals use many unrelated mobile paddings and width rules.
17. **Icon system:** inline SVGs are repeated throughout; some statuses use emoji (`📅`, `✨`) while others use SVG, creating inconsistent tone and screen-reader behavior.
18. **Labels and casing:** uppercase tracking labels are common in admin forms, but some public and legacy forms use sentence case; required markers and helper text vary.

## 6. Duplicated Components and Patterns

| Pattern | Current implementations | Differences | Implementation to survive | Shared component recommendation |
| --- | --- | --- | --- | --- |
| Modal shell | `Modal.tsx`, 30+ feature/page overlays | Radius, backdrop, z-index, header, scrolling, close policy, semantics | `Modal.tsx` visual shell plus `Dialog.tsx` semantics | Consolidate into `DialogRoot` + `DialogHeader/Body/Footer` |
| Alert/confirm | `Dialog.tsx`, finance local dialog, login/maintenance modal, nested confirms | Blocking behavior, wording, colors, focus, backdrop | `Dialog.tsx` | `AlertDialog`, `ConfirmDialog`, `PasswordConfirmDialog` |
| Member selection | `MemberCombobox`, `MemberSearchDropdown`, local member selects | Keyboard model, display, custom value support | `MemberCombobox` behavior | Accessible `Combobox` with display/option slots |
| Search field | MemberTable, Attendance, FilterBar, finance/event boards | Icon, height, clear action, typography | FilterBar composition plus v2 field tokens | `SearchInput` |
| Table | Members, Users, Events, Audit, Reports, Finance, public tables | Header, density, badges, actions, overflow, pagination | V2 slate table | `DataTable` with dense/public variants |
| Page header | Legacy page headers and v2 headers | Font weight/color, action placement, spacing | Dashboard/inventory v2 header | `PageHeader` |
| Card/surface | `Card.tsx` and raw div cards | Border/radius/shadow/padding | `Card.tsx` | `Card` variants |
| Status badge | Inventory, members, users, dashboard, excuse, schedules | Semantic mappings and shapes | V2 compact pill | `Badge` + semantic map |
| Loading | `Loading`, raw spinner divs, text-only states | Branding, progress meaning, layout | Indeterminate `Loading` spinner | `LoadingState`/`Skeleton` |
| Empty state | Attendance, dashboard, users, events, inventory, reports | Message hierarchy and optional actions | Attendance actionable empty state | `EmptyState` |
| Tabs | Reports, Settings, Inventory, Public Excuse, Finance | Segmented/underline, overflow, keyboard behavior | Reports/Settings segmented tabs | `Tabs` variants |
| Action menu | Finance request rows, ScheduleCard, Members import/users | Outside click, z-index, keyboard support | None is complete | Accessible `Menu` |
| Form field wrapper | Event/schedule forms, FilterBar, inventory, legacy admin pages | Labels, helper/error, focus, sizes | Event/schedule v2 + FilterBar labels | `Field` family |

## 7. Recommended Design System

The following standard is based on the strongest existing implementations, not a new visual direction.

### Foundations

| Token | Recommendation |
| --- | --- |
| Font | Keep the existing system sans stack; use one `font-sans` policy and avoid per-page font overrides except document/export previews |
| Body text | `text-sm` for normal form/page content; `text-xs` for dense tables and metadata |
| Page title | `text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900` |
| Section title | `text-base font-extrabold text-slate-900`; supporting text `text-xs/sm text-slate-500` |
| Label | `text-xs font-bold text-slate-600`; uppercase tracking only for compact metadata/filter labels |
| Primary color | Indigo 600/700 |
| Neutral palette | Slate 50/100/200/400/500/700/900 |
| Success | Emerald 600/700 with emerald 50/200 surfaces |
| Warning | Amber 500/700 with amber 50/200 surfaces |
| Danger | Rose 600/700 with rose 50/200 surfaces |
| Info | Blue/indigo, used consistently rather than mixing arbitrary purple |
| Radius | `rounded-xl` controls, `rounded-2xl` cards, `rounded-3xl` dialogs only |
| Border | `border-slate-200` or `/80` for surfaces; avoid gray/slate equivalents in the same surface |
| Shadow | `shadow-2xs` for surfaces, `shadow-sm` for controls, `shadow-2xl` for dialogs |
| Spacing | Page `space-y-6`; section `gap-4/6`; form `space-y-4`; control groups `gap-2/3` |
| Motion | Short fade/scale/slide transitions; never use animation as the only state cue |

### Components and states

- **Button:** shared variants, 40px minimum height, visible focus, loading content, no nested interactive elements.
- **Input/select:** shared field wrapper; 40px minimum height, 44px touch variant; consistent invalid/disabled/read-only states.
- **Dropdown/combobox:** semantic roles, keyboard navigation, focus return, viewport-aware placement, empty/loading states.
- **Modal:** shared dialog foundation, standardized sizes, focus trap, labelled title, optional description, explicit dismiss policy.
- **Card:** shared surface variants; avoid hover effects on non-interactive cards.
- **Table:** standard/dense variants, accessible sort, responsive overflow, consistent empty/loading/error rows, shared pagination.
- **Badge:** semantic mapping with text; consistent pill or compact rounded style.
- **Tabs:** accessible tab roles and arrow navigation; scrollable mobile variant.
- **Errors:** field-level errors near the field; page-level `ErrorState` with retry; alert dialog only for blocking/critical feedback.
- **Loading:** indeterminate spinner/skeleton by default; real progress only when measured. Remove random simulated progress.
- **Empty:** icon/title/explanation/action pattern; distinguish “no data” from “no search results”.
- **Toast:** non-blocking success/info/error notifications with dismissal and timeout policy; do not use modal alerts for routine copy/save.
- **Responsive:** authenticated page gutters remain `p-4 sm:p-8`; action groups stack at `sm`; dialogs use `p-3 sm:p-6`, max-height, sticky footer; tables scroll with priority-column/card fallback where necessary.
- **Icons:** use one SVG icon vocabulary and provide accessible labels for icon-only actions. Avoid emoji as semantic UI icons.

## 8. Standard Components to Create or Consolidate

| Component | Base | Why shared | Migrations |
| --- | --- | --- | --- |
| `Button` | V2 indigo actions | Primary interaction is repeated everywhere | Login, Users, Events, Reports, Attendance, Finance, Settings |
| `Field` | Event/Schedule field pattern + FilterBar labels | Centralizes label/helper/error/aria behavior | All forms and filters |
| `Input` / `Textarea` / `Select` | V2 slate/indigo controls | Removes radius/focus/background drift | All native fields |
| `SearchInput` | Member/FilterBar search composition | Standardizes icon, clear, placeholder, keyboard behavior | Members, Attendance, Reports, Finance, Events |
| `Combobox` | `MemberCombobox` behavior | One accessible searchable selection model | `MemberSearchDropdown`, user/member selectors |
| `Modal` / `DialogRoot` | `Modal.tsx` and `Dialog.tsx` | Eliminates duplicated overlay behavior and accessibility gaps | All custom fixed overlays |
| `ConfirmDialog` | `ConfirmModal` | Consistent destructive decisions | Finance/local confirms/nested confirms |
| `Toast` | New shared feedback primitive | Routine success/errors should not block | Copy/save/import/update flows |
| `Card` | `components/Card.tsx` | Shared surface language | Raw card `div`s in pages/features |
| `DataTable` | V2 Events/Members table | Consistent density, responsive behavior, pagination hooks | Users, Audit, Reports, Finance, public tables |
| `Badge` | V2 status pill | Central semantic colors and shapes | Inventory, Members, Users, Schedule, Excuse |
| `Tabs` | Reports/Settings segmented tabs | Accessible, consistent tab behavior | Reports, Settings, Inventory, Finance, public two-state tabs |
| `PageHeader` | Dashboard/Inventory v2 header | Aligns titles, subtitles, actions | All authenticated pages |
| `EmptyState` | Attendance actionable empty state | Clear hierarchy and optional action | All list/dashboard empty states |
| `LoadingState` / `Skeleton` | Shared `Loading` spinner | Eliminates raw spinner drift | Users, Settings, Attendance, finance and report states |
| `Menu` | New accessible primitive | Replaces local action-menu logic | Finance, ScheduleCard, Members, Users |

## 9. Refactoring Roadmap

### Phase 1 — Critical accessibility and interaction safety

- Consolidate dialog root behavior: roles, labels, focus trap/return, Escape, backdrop policy, and z-index scale.
- Replace custom destructive confirmations with `ConfirmDialog`; keep password confirmation for sensitive permanent actions.
- Make custom combobox/menu options semantic and keyboard-operable.
- Add visible `focus-visible` states and accessible labels to icon-only buttons.
- Fix shared `Dialog` title IDs so multiple instances cannot collide.
- Replace simulated `Loading` bar behavior with explicit indeterminate/real-progress APIs.

### Phase 2 — Major consistency

- Introduce `Button`, `Field`, `Input`, `Select`, `SearchInput`, and `PageHeader`.
- Migrate Users, Audit, Reports, Change Password, Members, Events, and Attendance away from legacy gray/blue controls.
- Consolidate table header/row/action/pagination patterns.
- Centralize badge semantic mappings.
- Add `Toast` and move routine copy/save success feedback out of blocking alerts.

### Phase 3 — Complex feature consolidation

- Break Finance into view-level components and migrate its repeated overlays, forms, tables, and action menus.
- Standardize schedule/publication/attendance nested workflows on the shared modal and table foundations.
- Migrate `MemberSearchDropdown` to the unified combobox.
- Consolidate import/export modal shells and dense table variants.

### Phase 4 — Responsive and content polish

- Define mobile behavior for every dense table: overflow, priority columns, or cards.
- Standardize page gutters, action wrapping, modal footers, and tab scrolling.
- Replace emoji UI icons with the shared SVG vocabulary.
- Review typography/casing, labels, helper/error text, and status wording.
- Convert preview pages into the maintained component reference rather than parallel production implementations.

## 10. Final Standardization Matrix

| UI Element | Current Variants | Winning Implementation | Standard | Priority |
| --- | ---: | --- | --- | --- |
| Button | 5+ | V2 indigo action | Shared `Button`; indigo primary, slate secondary, rose danger, accessible focus/loading | P1 |
| Page header | 4+ | Dashboard/Inventory v2 | Shared `PageHeader` with slate title and consistent action slot | P1 |
| Input | 3 | Event/Schedule v2 field | Shared `Field` + `Input`, `rounded-xl`, slate background, indigo focus | P1 |
| Select | 3+ | Native select inside v2 field | Shared `Select` wrapper; native for short lists | P1 |
| Search | 4+ | FilterBar/member search composition | Shared `SearchInput` with icon and clear action | P1 |
| Combobox | 2+ | `MemberCombobox` behavior | Accessible shared `Combobox`; migrate `MemberSearchDropdown` | P0 |
| Modal | 30+ | `Modal.tsx` shell | One dialog foundation with form/dense/full-screen variants | P0 |
| Confirm dialog | 4+ | `Dialog.tsx` `ConfirmModal` | Shared `ConfirmDialog` for all destructive decisions | P0 |
| Alert | 3+ | `Dialog.tsx` `AlertModal` | Shared alert for blocking feedback; use Toast for routine feedback | P1 |
| Toast | 0 | New component | Non-blocking routine success/info/error notification | P1 |
| Card | 2+ | `Card.tsx` | Shared surface variants | P2 |
| Table | 20+ | V2 Events/Members table | `DataTable` standard/dense/public variants | P1 |
| Pagination | 1 shared plus local paging | `Pagination.tsx` | Shared accessible pagination everywhere list paging is exposed | P2 |
| Tabs | 4+ | Reports/Settings segmented tabs | Shared accessible `Tabs` variants | P2 |
| Badge | Many local mappings | V2 compact status pill | Central semantic `Badge` mapping | P1 |
| Empty state | Many local states | Attendance actionable state | Shared `EmptyState` with action support | P2 |
| Loading | Shared/raw/simulated | Shared indeterminate spinner | `LoadingState`/`Skeleton`; no fake progress | P1 |
| Error state | Modal/inline/raw | Shared field/page error patterns | `FieldError`, `ErrorState`, `AlertDialog` policy | P0 |
| Navigation | Desktop/mobile duplicate markup | `DashboardLayout` | Extract shared nav data/rendering; preserve responsive drawer | P2 |
| Action menu | Several local menus | New accessible `Menu` | Keyboard-aware, outside-click, collision-safe menu | P1 |
| Status color | Local mappings | Dashboard/inventory semantic palette | Central semantic tokens and text labels | P2 |
| Date/time picker | Native controls with local wrappers | `FilterBar`/v2 field | Shared wrappers; retain native controls initially | P3 |
| Checkbox/radio/toggle | Native/local cards | Shared field control patterns | Consistent hit area, label, focus, disabled, error states | P2 |
| Responsive table | Overflow/local variants | V2 overflow with dense variant | Standard overflow plus mobile priority/card strategy | P1 |

**Final standard:** one slate/indigo administrative language, one accessible interaction foundation, one reusable component for each repeated pattern, and explicit documented variants only where the workflow genuinely requires a different density or public-facing shell.
