# 11_DEVELOPMENT_RULES.md

# Development Rules

## Before Writing Code

Always:

* Read the related documentation.
* Analyze the existing codebase.
* Reuse existing components.
* Reuse existing hooks.
* Reuse existing utilities.
* Follow the established architecture.

Never create duplicate functionality.

---

# During Development

Keep functions small.

Keep components focused.

Write readable code.

Avoid unnecessary abstraction.

Avoid premature optimization.

Do not over-engineer.

Keep business logic outside UI components whenever possible.

---

# Before Every Commit

Verify:

* Project builds successfully.
* No TypeScript errors.
* No ESLint errors.
* No unused imports.
* No unused variables.
* No console.log statements left in production code.
* No commented-out code.
* No TODOs unless intentionally tracked.

---

# Before Every Merge

Confirm:

* Feature is complete.
* Code has been manually tested.
* Existing features still work.
* UI works on desktop.
* UI works on mobile.
* Firebase reads and writes are functioning.
* No Firestore permission issues.
* No performance regressions.

---

# Code Review Checklist

Every pull request should be reviewed against the following:

* Is the solution simple?
* Is the code readable?
* Can existing code be reused?
* Is there duplicated logic?
* Are variable names meaningful?
* Are components modular?
* Are error states handled?
* Is loading state handled?
* Is empty state handled?

If any answer is "No", improve the implementation before merging.

---

# Release Checklist

Before deploying:

* Build passes.
* Firebase Hosting configured.
* Firestore rules updated.
* Environment variables verified.
* Authentication tested.
* Attendance module tested.
* Reports generated correctly.
* Export PNG works.
* Copy Report works.
* Responsive layout verified.

Deploy only after all checks pass.

---

# Golden Principle

A working, clean, and maintainable solution is always better than a clever but complicated one.

When in doubt, choose the simpler implementation.

