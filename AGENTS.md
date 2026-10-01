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

## Testing Guidelines

There is no configured automated test framework, test script, or coverage threshold. Run build and lint checks before submitting code changes. Manually exercise affected workflows, permissions, loading/error states, and mobile layouts. For Android changes, verify the native flow after synchronization. Record checks and results in the pull request.

## Commit & Pull Request Guidelines

Recent history favors `feat(scope): description` and `fix:` conventions, with some plain-language refactor messages. Use concise, descriptive commits. Follow `docs/10_GIT_WORKFLOW.md`: work on `feature/*`, `fix/*`, or `hotfix/*` branches rather than directly on `main`.

PRs should explain behavior changes, link relevant issues, list verification results, and include screenshots for UI changes. Document schema, rule, or index changes.

## Security & Configuration

Copy `.env.example` to `.env` and configure Firebase locally. Keep credentials and native Firebase configuration out of commits. Preserve authorization guards, Firestore security boundaries, attendance locks, and financial period restrictions. Consult `AI_DEVELOPMENT_RULES.md` before implementation changes.
