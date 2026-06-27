# 10_GIT_WORKFLOW.md

# Git Workflow

## Branch Strategy

Never develop directly on the `main` branch.

The `main` branch must always remain stable and deployable.

Use the following branch structure:

* main
* develop
* feature/<feature-name>
* fix/<bug-name>
* hotfix/<critical-fix>

Examples:

feature/member-crud

feature/attendance-module

feature/export-report

fix/login-validation

---

# Workflow

main

↓

develop

↓

feature branch

↓

Merge to develop

↓

Testing

↓

Merge to main

---

# Rules

Never commit directly to `main`.

Never merge unfinished work into `main`.

Every feature must be developed in its own branch.

Delete feature branches after merging.

---

# Commit Message Format

feat: add attendance module

feat: implement weekly report

fix: resolve login issue

refactor: simplify attendance logic

style: improve dashboard layout

docs: update project documentation

---

# Pull Request Checklist

Before merging into develop:

* Code compiles successfully.
* No TypeScript errors.
* No ESLint errors.
* No console errors.
* Feature works correctly.
* No duplicate code.
* UI is responsive.
* Existing functionality is not broken.

Before merging develop into main:

* All features tested.
* Documentation updated.
* Firebase rules verified.
* Build successful.
* Ready for deployment.

