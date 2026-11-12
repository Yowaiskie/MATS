# Multi-AI Collaboration Guide (Antigravity & Codex)

This document establishes the collaboration protocol, division of labor, and operational rules when two AI assistants (Antigravity and Codex) work together on the Ministry Attendance Tracking System (MATS).

---

## 1. Division of Labor & AI Roles

To avoid conflicting changes, hallucinated architectures, or git collision, the two AIs have distinct, specialized responsibilities:

```
┌────────────────────────────────────────────────────────┐
│             HUMAN REPO OWNER (Kyle)                    │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│     ANTIGRAVITY       │        │        CODEX          │
│   (Lead Architect &   │◄──────►│    (Implementation    │
│       Verifier)       │ Handoff│      Specialist)      │
└───────────────────────┘        └───────────────────────┘
```

### AI 1: Antigravity (Lead Architect, DevOps & Verifier)
- **Architecture & System Design:** Defines Firestore schemas, security rules, composite indexes, and project roadmaps.
- **Spec Writing:** Drafts clear technical specifications (`specs/*.md`) and task breakdown plans.
- **Terminal & Quality Gates:** Executes `npm test`, `npm run lint` (Oxlint), `npm run build`, and `npx cap sync`.
- **Git & Release Management:** Manages branching, fast-forwards, PR generation, and staging/prod deployments.
- **Code Review:** Reviews diffs produced by Codex to ensure full alignment with project rules.

### AI 2: Codex (Implementation Specialist & Code Builder)
- **Component Development:** Builds React components, modals, form controls, and responsive Tailwind layouts.
- **Code Refactoring:** Splits monolithic files into clean, reusable subcomponents and hooks.
- **Business Logic Implementation:** Implements client-side utilities, date helpers, and service functions according to specs.
- **Unit Test Authoring:** Writes test scenarios in `tests/` for new features and edge cases.

---

## 2. Standard Handoff Workflow

When implementing any feature, bug fix, or optimization, follow this 3-step loop:

1. **Phase 1: Planning (Antigravity)**
   - Antigravity analyzes requirements, checks codebase integrity, and writes a technical spec in `specs/`.
   - Antigravity creates or checks out the target feature branch off `develop` (e.g. `feature/new-feature`).

2. **Phase 2: Coding (Codex)**
   - Kyle prompts Codex: *"Read `docs/AI_COLLABORATION_GUIDE.md` and implement the tasks outlined in `specs/<feature-name>.md`."*
   - Codex writes, refactors, and edits the TypeScript/React code on that active branch.

3. **Phase 3: Verification & Gatekeeping (Antigravity)**
   - Kyle returns to Antigravity: *"Codex finished the implementation. Run verification gates and check for issues."*
   - Antigravity runs all 4 gates (tests, lint, build, capacitor sync), fixes any integration gaps, and coordinates the commit/PR.

---

## 3. Universal Non-Negotiables for Both AIs

1. **Single Repository Only:** Never propose or initialize a second repository for MATS.
2. **Dual-Environment Isolation:**
   - Development and testing MUST target the Staging Firebase project (`mats-dev`).
   - Production (`mats-c10da`) is strictly reserved for live parish data via the `main` branch.
3. **Branching Discipline:**
   - Never commit or edit code directly on `main`.
   - All improvements start from `develop` via dedicated `feature/*` branches.
4. **Code Standards:**
   - Strict TypeScript: no `any`. Reuse types from `src/types/`.
   - 2-space indentation, single quotes, Tailwind CSS utilities.
   - Do not add new npm dependencies without explicit user confirmation.
5. **No AI Attribution:**
   - Never insert `Co-Authored-By` AI trailers, session links, or promotional footers into commit messages, tags, or pull requests.

---

## 4. Quick Session Start Prompts for Kyle

### Prompt for Codex at the start of a session:
> "You are the Implementation Specialist for MATS. Read `docs/AI_COLLABORATION_GUIDE.md` and `docs/28_DUAL_ENVIRONMENT_AI_WORKFLOW.md`. Review the codebase conventions before writing any code."

### Prompt for Antigravity at the start of a session:
> "You are the Lead Architect and Verifier for MATS. Read `docs/AI_COLLABORATION_GUIDE.md` and verify our current git status and branch health."
