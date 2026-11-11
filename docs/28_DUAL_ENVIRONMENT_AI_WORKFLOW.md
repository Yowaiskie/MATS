# Dual-Environment AI Workflow & Repository Standards

This document establishes the mandatory workflow rules for any AI agent or developer working on the Ministry Attendance Tracking System (MATS). All instructions here are binding and take precedence during feature implementation, refactoring, and releases.

---

## 1. Single Repository & Dual Environment Policy

### Single Repository Rule
- MATS operates under a **Single Repository Model**.
- Do NOT create separate repositories for new features, major redesigns, or database experiments. All work lives in this repository under structured branching.

### Two Isolated Firebase Environments
| Environment | Firebase Project ID | Git Branch | Target URL / Purpose |
| :--- | :--- | :--- | :--- |
| **Production** | `mats-c10da` | `main` | `mats-c10da.web.app`<br>Live parish ministry data, real coordinators, and altar servers. |
| **Development / Staging** | `mats-dev` | `develop`, `feature/*` | `mats-dev.web.app` (or local)<br>Isolated testing environment with cloned dummy data. |

> [!CAUTION]
> **Zero Production Direct Access During Development:**
> Local development (`npm run dev`) MUST connect exclusively to the Development/Staging Firebase project (`mats-dev`). Never run experimental scripts, test deletions, or schema changes directly against `mats-c10da`.

---

## 2. Git Branching & Release Pipeline

```
main (Production) ───────────────────────────────────▲ (Only via verified PR)
  │                                                  │
  └─► develop (Staging & Improvements) ──────────────┘
        │                               ▲
        └─► feature/<name> ─────────────┘ (PR & Staging Verification)
```

1. **`main` (Production Branch):**
   - Strictly reserved for stable, tested production code.
   - Direct commits or unauthorized merges to `main` are strictly forbidden.
   - Deploys to Production Firebase (`mats-c10da`).

2. **`develop` (Integration Branch):**
   - The default working branch for ongoing major improvements, UI redesigns, and refactorings.
   - Tested against the Staging Firebase project (`mats-dev`).

3. **`feature/<feature-name>` (Working Branches):**
   - Branched off `develop`.
   - Used for developing specific features, optimizations, or fixes.
   - Must be merged back into `develop` via PR or clean fast-forward after passing quality gates.

4. **`hotfix/<issue-name>` (Emergency Fixes):**
   - Branched off `main` only for critical production bug fixes.
   - Once verified, merged to `main` and immediately back-ported into `develop`.

---

## 3. Environment Configuration Standards

### Vite Environment Files
- `.env.development`: Loaded automatically during `npm run dev`. Points to `mats-dev`.
- `.env.production`: Loaded during `npm run build` and production deployments. Points to `mats-c10da`.
- `.env.example`: Committed template for required environment variables. Keep real API keys out of git commits.

### Multi-Project Firebase Deployment
In `.firebaserc`:
```json
{
  "projects": {
    "default": "mats-c10da",
    "production": "mats-c10da",
    "staging": "mats-dev"
  }
}
```

NPM scripts for deployment:
- `npm run deploy:staging`: Builds with development mode and deploys to `mats-dev`.
- `npm run deploy:prod`: Builds with production mode and deploys to `mats-c10da`.

---

## 4. Mandatory Quality Gates Before Merging

Before any PR or merge is accepted, the AI agent MUST execute and verify all 4 quality gates:

1. **Unit Test Suite:**
   ```bash
   npm test
   ```
   All test cases in `tests/` must pass with 0 failures.

2. **Static Analysis & Linting:**
   ```bash
   npm run lint
   ```
   Must pass with 0 errors via Oxlint across all files.

3. **TypeScript & Production Build:**
   ```bash
   npm run build
   ```
   `tsc -b` and `vite build` must compile cleanly without type errors.

4. **Capacitor Mobile Sync:**
   ```bash
   npm run cap:sync
   ```
   Must synchronize the native Android project without breaking asset paths or plugins.

---

## 5. Clean Code & Repository Hygiene

- **Root Directory Cleanliness:**
  - Keep the repository root minimal: only configuration files, build manifests, and root agent rules belong in root.
  - Put documentation in `docs/`.
  - Put audit reports in `docs/audits/`.
  - Put feature specifications in `specs/`.
  - Put mock CSV/PDF imports in `sample-data/`.
- **Database Backward Compatibility:**
  - When modifying Firestore document schemas, ensure fallback handling for older documents that may have missing fields.
- **No AI Attribution:**
  - Never add `Co-Authored-By` AI tags, promotional lines, or chat session links to commit messages, PR descriptions, or tags.
