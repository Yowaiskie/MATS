# MATS - Ministry Attendance Tracking System

A web-based attendance management system designed for church ministries. MATS replaces manual attendance tracking with a digital workflow that enables administrators to manage members, create schedules, record attendance, and generate shareable reports.

## Features

- **Authentication** — Secure login via Firebase Authentication
- **Member Management** — Add, edit, and archive ministry members
- **Schedule Management** — Create weekly service schedules and assign members
- **Attendance Tracking** — Record attendance with statuses: Present, Late, Absent, Excused
- **Reports** — Generate weekly and monthly attendance reports
- **Export** — Export reports as PNG images or copy as Messenger-ready text

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router |
| Server State | TanStack Query |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Hosting | Firebase Hosting |

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm
- A Firebase project with Authentication and Firestore enabled

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd MATS
```

2. Install dependencies:

```bash
npm install
```

3. Create your environment file:

```bash
cp .env.example .env
```

4. Fill in your Firebase configuration in `.env`:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

5. Start the development server:

```bash
npm run dev
```

## Development Workflow

This project follows a phase-based development approach documented in `docs/13_PHASE_BREAKDOWN.md`.

### Branch Strategy

```
main ← develop ← feature/<feature-name>
```

- **main** — Production-ready, always stable
- **develop** — Integration branch for features
- **feature/** — Individual feature branches

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run linter |

### Commit Convention

```
feat: add attendance module
fix: resolve login issue
refactor: simplify attendance logic
style: improve dashboard layout
docs: update project documentation
```

## Folder Structure

```
src/
├── app/              # App-level configuration
├── assets/           # Static assets (images, icons)
├── components/       # Shared/reusable components
├── features/         # Feature modules
│   ├── attendance/
│   ├── authentication/
│   ├── dashboard/
│   ├── members/
│   ├── reports/
│   └── schedules/
├── firebase/         # Firebase configuration
├── hooks/            # Shared custom hooks
├── layouts/          # Layout components
├── lib/              # Third-party library wrappers
├── routes/           # Route definitions
├── services/         # API/service layer
├── types/            # Shared TypeScript types
├── utils/            # Utility functions
└── main.tsx          # Application entry point
```

## Deployment

1. Build the production bundle:

```bash
npm run build
```

2. Deploy to Firebase Hosting:

```bash
npx firebase deploy --only hosting
```

## Documentation

All project documentation is located in the `docs/` directory. See the full list of documents for requirements, database design, coding standards, and development guidelines.

## License

This project is for internal ministry use only.
