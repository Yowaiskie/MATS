# MATS UI hierarchy and consistency audit

Date: 2026-11-13  
Branch: `feature/unified-actions-and-interconnection`  
Scope: login, authenticated shell, dashboard, members, schedules/publications, events/forms, attendance, and shared UI primitives.

## Implementation integrity verdict: fail

MATS has a shared authenticated shell and useful shared components, but its pages do not consistently apply one product-specific visual hierarchy. The login uses a dark glow/glass composition, the dashboard uses a large gradient welcome hero, and management pages independently compose headings, actions, tabs, and cards. Shared components alone have not standardized page composition.

This is a consistency and task-priority problem, not evidence that every page needs the same layout. Login should remain a focused authentication surface; dashboards should prioritize current work; management pages should prioritize their records and primary action. Their visual language and control behavior should be shared.

## Evidence and limits

- Inspected the actual components and route wiring, not just the preview/showroom pages.
- Ran Impeccable's source detector over 12 source targets, including login, shell, dashboard, management pages, shared controls, CSS, and the HTML entry. It returned `[]`, exit code 0. Raw output: `.impeccable/review/mats-ui-audit/detector.json`.
- The empty result is a detector coverage limitation, not an accessibility or design pass. The manually verified issues below include Tailwind composition, missing interaction behavior, and misleading chart data that this run did not flag.
- Attempted local rendering with Vite and an isolated headless Chrome profile. The page did not progress beyond the static splash during the capture window. No usable login screenshot or rendered measurements were obtained. Vite reported repeated CSS HMR updates during the attempt; this is not sufficient evidence of a production performance defect.
- Authenticated pages were source-inspected. No account was used, authentication was not bypassed, and no authenticated workflow was exercised.
- Reviewed existing `design-preview/screenshots/after-desktop.png` and `attendance-mobile.png`. They depict a design-review prototype explicitly marked Preview only / Mock data, not the running application. Their file timestamps are October 20, 2026, and `git ls-files design-preview` returned no tracked files. Compared with current source, they are proposed compositions, not verified current-production goldens; they do not establish browser behavior or contrast compliance.
- No physical-device touch tests, measured contrast ratios, browser accessibility-tree validation, performance trace, or completed 200% zoom test. No tracked current-UI visual golden fixtures were established.
- Existing unrelated working-tree changes were left intact. This audit does not change application code or security behavior.

## Provisional audit health score

These scores describe implementation evidence only. They are not a measured usability score or WCAG certification. Re-score after authenticated desktop/mobile verification.

| Dimension | Score / 4 | Evidence |
|---|---:|---|
| Accessibility | 1 | Zoom is explicitly restricted; login dialogs lack dialog/focus handling. |
| Performance | 2 | Multiple blur layers and eager route imports warrant profiling; actual runtime cost is unmeasured. |
| Theming | 2 | Tailwind palette primitives exist, but primary-action semantics and page treatments drift. |
| Responsive design | 2 | Responsive breakpoints and safe areas exist; many shared controls are below the project's 44px target. |
| Implementation integrity | 1 | Competing composition patterns and fixed chart series presented as operational analytics. |
| **Total** | **8 / 20** | **Poor: systemic alignment needed; provisional source-based rating.** |

10 prioritized findings: 0 P0, 3 P1, 6 P2, 1 P3. No P0 task blocker was established from this inspection.

## Detailed findings

| ID | Priority / category | Verified location and issue | User impact and recommendation | Follow-up |
|---|---|---|---|---|
| 1 | P1 / Integrity | `src/features/dashboard/components/DashboardOverview.tsx:231` and `:241` define fixed participation and attendance series. `:633` presents the latter as a six-month attendance trend; `:674` presents participation analytics. | Coordinators can mistake sample values for ministry evidence. Replace with authorized real aggregates using the established reporting services, or clearly label and remove these charts from operational decision-making until real data is available. Do not invent replacement metrics. | `$impeccable harden` |
| 2 | P1 / Accessibility | `index.html:8` sets `maximum-scale=1.0, user-scalable=no`. | The document requests suppression of user zoom where the browser honors it. Remove the zoom restriction while retaining viewport and safe-area support; verify text resizing/reflow in mobile browsers and the Android WebView. Relevant check: WCAG 1.4.4, Resize Text. Source restriction verified; browser enforcement untested. | `$impeccable adapt` |
| 3 | P1 / Accessibility | Login overlays at `src/features/authentication/components/LoginPage.tsx:274` and `:339` are custom containers without dialog semantics, focus transfer/trapping, Escape handling, or focus restoration. Shared `src/components/Modal.tsx:53` has dialog semantics and Escape handling, but lacks an accessible name binding and explicit focus management. | Keyboard and assistive-technology users may remain in background controls or lose dialog context. First repair the shared dialog foundation, then reuse it for login support/errors while preserving authentication and maintenance behavior. Relevant checks: WCAG 2.1.1, 2.4.3, and 4.1.2; verify behavior before declaring compliance. | `$impeccable harden` |
| 4 | P2 / Integrity | Login at `LoginPage.tsx:89–101` combines dark surfaces, three ambient glow layers, and a glass card. Dashboard at `DashboardOverview.tsx:286` uses a gradient/glow hero. Members/events instead open with plain management headers. | The transition into the system changes visual grammar abruptly. Retain the ministry identity and existing permitted palette, but use consistent surface, typography, and button rules. Login can have a different composition without a separate decorative language. | `$impeccable quieter` |
| 5 | P2 / Integrity | Dashboard greeting hero at `DashboardOverview.tsx:286–357` precedes the duty roster at `:360`; charts and birthday/activity panels add further competing surfaces. Schedules header and toolbar begin at `src/features/schedules/pages/SchedulesPage.tsx:638` and mix tabs with multiple actions. | Greeting, analytics, and tools compete with the coordinator's next job. Promote today's roster and actionable pending work. Move greetings to a compact header and secondary information below operational content. In schedules, separate page title/primary action from tabs and filter tools. | `$impeccable layout` |
| 6 | P2 / Theming | `src/components/Button.tsx:36` defines primary as blue; login submit at `LoginPage.tsx:240` uses a blue/indigo gradient; new public actions use indigo; publication creation at `src/features/schedules/components/PublicationsTab.tsx:515` uses an independent blue rounded-lg treatment. | The same importance level has different colors and treatments. Standardize primary/secondary/tertiary/destructive semantics through existing controls and semantic tokens. Preserve Order colors for group identity and status colors for actual status. Do not introduce another parallel button component. | `$impeccable extract` |
| 7 | P2 / Responsive + Accessibility | `Button.tsx:26–32` offers 32/36/40px heights for most sizes and 44px only for public size. Login's Forgot Password at `LoginPage.tsx:179` is a small text action. `src/components/MetricCard.tsx:68` and `:82` use 10px labels/subtext; sidebar includes 9/10px metadata. | Dense text and small targets make phone operation harder. Use roughly 14–16px for working copy and 12–13px for secondary metadata, reserving tiny text for genuinely optional details. Set ordinary action targets to at least the product's 44px requirement. Small text alone does not establish a WCAG failure; measure contrast and target spacing in-browser. WCAG AA's target-size minimum and exceptions are distinct from the stricter project requirement. | `$impeccable typeset`, then `$impeccable adapt` |
| 8 | P2 / Theming + Integrity | Shell establishes `max-w-7xl` and gutters at `src/layouts/DashboardLayout.tsx:442–443`, but child pages define their own header weights, spacing, table wrappers, and cards. Compare `MembersPage.tsx:490`, `EventsPage.tsx:59`, `EventFormsTab.tsx:159`, `PublicationsTab.tsx:506`, and `AttendanceHeader.tsx:38`. | Users must relearn where to find page context, actions, filters, and status. Establish one page-composition contract and adopt it incrementally using existing primitives. Normalize container padding and card responsibilities; do not force a roster, table, and dashboard into identical content layouts. | `$impeccable layout` |
| 9 | P2 / Accessibility + Performance risk | Login includes several large blurred background layers and repeated pulse/ping effects. `src/index.css` defines an infinite indeterminate animation. No reduced-motion handling was found in the inspected login, shell, shared modal, or stylesheet. | Decorative motion has no explicit reduced-motion alternative, and blur can add rendering cost on low-end devices. Remove unnecessary animation; provide purposeful reduced-motion states while preserving feedback. Profile representative mobile hardware before asserting a performance regression. | `$impeccable animate`, then `$impeccable optimize` |
| 10 | P3 / Guidance | `src/components/CoordinatorWorkflowBanner.tsx:44` stores collapse state only in memory; both forms and publications return loading markup that can unmount their guide during reloads. The guide adds another three-card surface above working content. | Frequent coordinators can repeatedly encounter expanded help. Keep guidance compact and optionally persist per-module collapse state. Do not replace clear page hierarchy with more instructional cards. No preference persistence is promised by the current component, so this is a refinement, not a functional regression. | `$impeccable onboard` |

## Recommended hierarchy

### Login

1. Recognizable ministry logo/name and a short sign-in heading.
2. Username and password fields with readable labels.
3. One primary sign-in action.
4. Visibly secondary account help and public excuse portal link.
5. Parish identity/footer, quiet enough to remain supporting information.

Use the same typographic scale, field/control treatment, and primary-action semantics as the authenticated app. A login layout need not copy the app sidebar or dashboard.

### Authenticated management pages

```text
Shared app shell: navigation, account controls, consistent content gutter
Page header: title + short context                         Primary action
Module tabs, where needed
Compact, collapsible guidance, where useful
Optional summary: only metrics relevant to this task
Toolbar: search + filters                         Secondary actions/menu
Working area: roster / table / calendar / form
Pagination or completion summary
```

- Define shared semantic roles for heading, body, muted copy, surface, border, primary action, and status. Existing Tailwind palette values remain implementation inputs; do not treat every arbitrary page class as a new design rule.
- Keep one visually dominant action in each page/task context. In schedules, creation and finalization are distinct lifecycle tasks; finalization belongs near the roster/submission workflow, not as an equally prominent unrelated header action.
- Use cards for meaningful grouping. Do not add a border, shadow, colored icon tile, and pill to every text fragment. Tables already have structure; individual rows do not also need card-like emphasis.
- Show status through text and semantic color. Reserve Order palettes for their established groups, not arbitrary modules.
- The existing design-preview screenshots already explore a quieter shell, clearer page titles, duty-first dashboard, and a mobile attendance progress summary. Review these as an available starting point instead of inventing another parallel theme. Validate them against current components and business rules before adopting them; do not copy their mock data or assume every preview control meets the custom-control standard.

### Dashboard

Recommended order: today's duty roster and next action; pending operational work; relevant summary counts; secondary activity/birthdays; verified historical reporting. Keep real data, access scopes, and existing permissions intact. Reordering alone does not authorize changing policy calculations or data access.

## Suggested implementation sequence

1. **Truth and accessibility:** address findings 1–3 first. Verify real data provenance, zoom, and dialog keyboard behavior.
2. **Record the incumbent system:** `$impeccable document` should distinguish implemented rules from existing drift; do not blindly certify every current pattern as canonical.
3. **Page composition:** `$impeccable layout` on login, dashboard, and one representative management page. Establish reusable header, toolbar, spacing, and action semantics without changing services or guards.
4. **Control and typography alignment:** `$impeccable extract`, `$impeccable typeset`, and `$impeccable adapt`; update existing shared components and migrate high-traffic pages in small batches.
5. **Remove decoration that does not explain state:** `$impeccable quieter`; preserve official assets and allowed group colors.
6. **Finish:** `$impeccable polish`, then repeat `$impeccable audit` with authenticated desktop/mobile screenshots, keyboard traversal, text scaling, contrast measurements, and real device touch checks.

Each implementation batch should have a reviewed scope/spec, before-and-after screenshots, and the repository's verification gates. No implementation batch, commit, or deployment is part of this audit.

## Positive findings to retain

- Shared `DashboardLayout` already provides navigation, a bounded content width, gutters, safe-area handling, and a persistent shell.
- Shared Card, Button, dialogs, custom selects/date/time controls, empty states, and status primitives provide a useful starting point; avoid parallel replacements.
- Many pages have responsive breakpoints and loading/error handling.
- Login inputs have visible labels and autocomplete attributes; the password visibility control has an accessible label.
- Public preview/copy actions and workflow guidance have recently gained clearer text, status feedback, and 44px targets.
- Ministry terminology, official assets, established Order identities, and protected workflows give MATS product-specific material. Prioritize these over generic dashboard ornament.
