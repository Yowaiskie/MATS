# Event task notifications and bulk attendance finalization

## Behavior

Event-task assignments/reassignments and deadline changes create targeted
notices in the existing Notification Center. The target is the assignee's
member ID or account UID, matched to the user's linked member/account.
These notices are in-app only: no device/browser notification or recipient
toast is dispatched. Existing attendance, excuse, and broadcast delivery is
preserved. Clicking View Task opens the specific task in its event workspace.

Reminder checks run on login, once per minute while visible, and on foreground
or reconnection. Deadlines are calendar dates in Asia/Manila. The latest
applicable stage is emitted: within three days, one day before, due today,
or one overdue notice. Missed earlier stages are not sent together on login.
Inactive/archived/deleted tasks/events, completed/cancelled tasks/events,
unassigned tasks, and missing/invalid deadlines do not generate reminders.
Existing tasks receive eligible reminders without retroactive assignment notices.

Legacy name-only assignments resolve only through a unique team-member match.
New selections persist `assignedMemberUid` as a member ID (or account UID for
an unlinked self-assignment), retaining the display name. Ambiguous names
must be reassigned to enable targeted reminders.

## Persistence and compatibility

- `AppNotification.type` adds `event_task_assignment`, `event_task_deadline`,
  and `event_task_reminder`. Optional fields include `eventId`, `taskId`,
  `dueDate`, `reminderStage`, `taskNotificationVersion`, and
  `deliveryMode: 'in_app_only'`.
- Tasks add optional `notificationDeliveryKeys` and `notificationVersion`.
  Assignment/deadline changes increment the version and reset delivery keys;
  old tasks default to version 0 and an empty delivery list.
- Task mutations and assignment/deadline notices commit atomically. Reminder
  creation and its delivery key commit atomically. Deleting a notice does not
  cause the same stage/version to be sent again. Duplicate checks survive
  refresh, multiple tabs, and devices. Obsolete reminders are hidden from the
  feed/unread count after state, deadline, or assignment changes.
- The feed merges the existing latest-30 global query with the latest-100
  targeted query and deduplicates by document ID. The index on notifications
  (`targetMemberIds` CONTAINS, `createdAt` DESCENDING) was deployed to
  `mats-c10da` on October 14, 2026. Existing remote indexes were checked before
  deployment and preserved.
  The new index was subsequently verified as READY.
- No collections, packages, backend scheduler, rule changes, or migrations
  were added for these features. Existing task/event access guards remain.
  Account/member ID matching is used for own-task and event-membership checks.

## Bulk finalization

Only users with the existing finalization permission/admin access see the
Bulk Finalize Attendance button in the Schedules header. Opening it loads all
ended, non-cancelled schedules that are not finalized, independent of the page's
date filters or current page. Ready sessions appear first; incomplete or untaken
attendance shows the reason it needs review. Select individual ready sessions
or Select All inside the dialog, then confirm finalization. Already locked and
future schedules are excluded. Schedule deletion retains its separate manager
gate and existing list selection.

The preview identifies eligible and skipped sessions and links to attendance
for corrections. Eligible sessions must exist, remain unlocked, belong to an
ended/non-cancelled schedule, and have exactly one valid saved status for each
assigned member and recorded Other Server. Archived member profiles and Alumni
attendance remain valid. Empty/missing/duplicate sessions, incomplete/invalid
records, and missing member profiles are skipped. No blanks are filled and no
missing sessions are created by bulk finalization.

After confirmation, sessions are processed sequentially with current roster,
records, session revision, permission, and lock revalidation. Each successful
lock sets the same finalization fields and appends an ATTENDANCE_LOCK audit
entry. Results list finalized/skipped/failed rows; failed rows can be retried.
Attendance states and untaken notifications refresh afterward. The separate
schedule roster lock is not changed; password verification for unlock is
preserved. Production sessions are not finalized automatically by deployment.

Attendance saves now use transactions with at most 499 records plus the
parent session per chunk. Every chunk checks the session lock and updates its
revision atomically. Record deletion also checks the lock and advances the
revision. This prevents in-flight edits from bypassing a bulk-finalized lock
and allows finalization to detect changes/new Other Server records.

## Verification

- TypeScript/Vite build and Oxlint; existing repository warnings remain.
- Firestore emulator using repository rules: assignment/deadline atomicity,
  recipient isolation, ordinary/read-only edits, reminder windows/timezone,
  invalid dates, concurrent deduplication, deleted-notice deduplication,
  overdue-once, deadline versions, completed suppression, ambiguous names,
  targeted feed beyond 30 unrelated notices, and zero task popups.
- Bulk emulator checks: complete/Other Server/Alumni/archived-member records,
  incomplete/cancelled/future/empty/missing/already-locked sessions,
  denied finalization permission, concurrent record deletion, audit entries,
  unchanged roster/member data, 501-record saves, locked record deletion,
  and lock changes between initial read and save.
- Browser checks with isolated fixtures: bell category, specific task
  navigation, assignee selection, eligibility preview, attendance links,
  confirmation, partial-failure retry, and desktop/mobile dialogs.
- Updated bulk dialog checks: selection starts empty, Select All selects only
  ready rows, individual deselection changes the count, incomplete rows stay
  disabled, and failed selected sessions can be retried without repeating
  successful finalizations. Build/lint passed after the selection changes.
- The actual NotificationProvider was exercised against the emulator: one
  silent due-day reminder appeared in the feed and disappeared immediately
  after completion, with no device-notification calls.

Live authenticated walkthroughs and Android/native verification remain to be
performed against the deployed application. Hosting has not been deployed.
No production member, task, or attendance documents were modified by tests.

## Changed files and reuse

- Notifications: `src/types/notification.ts`,
  `src/services/notificationService.ts`, `src/context/NotificationContext.tsx`,
  `src/components/NotificationBell.tsx`, and `firestore.indexes.json`.
- Event tasks: `src/types/event.ts`, `src/services/eventTaskService.ts`,
  `src/services/eventTaskNotificationService.ts`,
  `src/utils/eventTaskNotifications.ts`, the task form/board, event details,
  and the existing dashboard assignment service.
- Attendance: `src/services/bulkAttendanceService.ts`,
  `src/services/attendanceService.ts`, Schedules page, and
  `src/features/schedules/components/BulkFinalizeAttendanceModal.tsx`.
- Reused the existing Notification Center/read tracking, authentication and
  permission helpers, member search dropdown, shared Modal/ConfirmModal,
  Button/Loading, schedule selection/pagination, and immutable audit service.
- No changes to financial periods, attendance-status enums, absence/suspension
  formulas, unlock password checks, or Firestore security rules for this work.
