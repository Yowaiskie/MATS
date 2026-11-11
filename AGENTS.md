# Repository Guidelines

## Project Structure & Module Organization

MATS uses React, TypeScript, Vite, Tailwind CSS, and Firebase. Feature pages and components live in `src/features/`; reusable UI lives in `src/components/`. Keep Firestore operations in `src/services/`, including treasury logic in `src/services/finance/`. Shared models, hooks, contexts, and helpers belong in `src/types/`, `src/hooks/`, `src/context/`, and `src/utils/`.

Static assets and service workers live in `public/`; imported assets live in `src/assets/`. `android/` contains the Capacitor native project. `docs/` contains architecture and business rules. Firebase configuration, rules, and indexes are at the repository root; `dist/` is generated output.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from the committed lockfile.
- `npm run dev`: start the local Vite server.
- `npm run build`: run TypeScript project checks and generate `dist/`.
- `npm run lint`: run Oxlint static analysis.
- `npm run preview`: serve the production build locally.
- `npm run cap:sync`: build and synchronize the Android project.
- `npm run cap:open`: open the Android project in Android Studio.

## Coding Style & Naming Conventions

Match existing files: two-space indentation, single quotes, and generally omitted semicolons. Use functional React components, typed props, and Tailwind utilities. Avoid `any`. Use PascalCase for components and types, camelCase for services and utilities, `use` prefixes for hooks, and UPPER_SNAKE_CASE for constants. Prefer `@/` imports for `src/` modules.

Reuse shared components and existing services. Preserve TanStack Query for server state and React hooks/context for client state. Oxlint is configured through the npm script; no dedicated formatter is configured.

## Testing & Quality Gates

MATS follows quality gates before changes are approved:
1. **Planning Document Review**: Requirements, spec, and task plan are reviewed and approved before coding.
2. **Pre-Test / Lint Review**: Run `npm run lint` (`oxlint`) and TypeScript verification (`tsc -b`).
3. **Security Review**: Check Firestore security rules, authentication guards, and input sanitization (OWASP / LLM security checklist).
4. **Verification**: Manually exercise affected workflows, permissions, loading/error states, and mobile layouts. If automated tests are added, verify via test suite. For Android changes, verify native flow via `npm run cap:sync`.
5. **Code Review Sign-off**: Independent review before merge or handoff.

## Spec-Driven Development & Harness Workflow

When implementing significant features or complex architectural changes:
- **Spec-First Pipeline**: Requirements (`docs/`) -> Technical Specification (`specs/*.md`) -> Task Plan (`docs/task-plan.md` or `.agent/main-plan/`) -> Implementation -> Verification.
- **Decision Logging**: Record architectural choices, trade-offs, and data structure decisions in [DECISIONS.md](file:///C:/Users/kyle/Desktop/MATS/DECISIONS.md).
- **Branch Isolation**: Always work in dedicated feature branches (`feature/*` or `fix/*`). Never run generation or code modifications directly on `main`.
- **Clarification Before Assumptions**: Clarify ambiguities with explicit choices and recommendations before proceeding with code changes.

## Commit & Pull Request Guidelines

Recent history favors `feat(scope): description` and `fix:` conventions, with some plain-language refactor messages. Use concise, descriptive commits. Follow `docs/10_GIT_WORKFLOW.md`: work on `feature/*`, `fix/*`, or `hotfix/*` branches rather than directly on `main`.

PRs should explain behavior changes, link relevant issues, list verification results, and include screenshots for UI changes. Document schema, rule, or index changes.

## Security & Configuration

Copy `.env.example` to `.env` and configure Firebase locally. Keep credentials and native Firebase configuration out of commits. Preserve authorization guards, Firestore security boundaries, attendance locks, and financial period restrictions. Consult `AI_DEVELOPMENT_RULES.md` before implementation changes.
