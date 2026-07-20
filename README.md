# MATS - Ministry Attendance Tracking System

A web-based attendance management system designed for church ministries. MATS replaces manual attendance tracking with a digital workflow that enables administrators to manage members, create schedules, record attendance, and generate shareable reports.

---

## 1. Features
- **Authentication** — Secure login via Firebase Authentication (admin profile restrictions).
- **Member Management** — CRUD operations, CSV import/export templates, alpha-sorted tables, and duplicate checks.
- **Schedule Management** — Chronological service scheduling, duration limits, dynamic status badges, and server double-booking validations.
- **Attendance Tracking** — Checklists with live status counters (Present, Late, Absent, Excused), bulk selections, navigation warnings, and session locking.
- **Reports & Analytics** — Four reporting tab views (Overall Summary, Member Reports, Schedule Reports, Monthly Analytics) and BOM-prefixed Excel-compatible CSV exports.

---

## 2. Tech Stack
- **Framework:** React + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router
- **State Management:** React local state (client state) + TanStack Query (server state)
- **Firebase Services:** Authentication, Cloud Firestore, Firebase Hosting

---

## 3. Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm (v9 or later)
- A Firebase Project

### Installation
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd MATS
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
4. Fill in your Firebase Web App credentials in `.env` (these are safe to commit locally, but do not push secrets to public git repos):
   ```ini
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

---

## 4. Firebase Project Setup

### A. Authentication
1. Go to the **Firebase Console** > **Authentication** > **Sign-in method**.
2. Enable **Email/Password** provider (keep passwordless link disabled) and save.

### B. Cloud Firestore
1. Create a Firestore Database in **Production mode** (which blocks public access).
2. Deploy the following security rules under the **Rules** tab:
   ```javascript
   rules_version = '2';

   service cloud.firestore {
     match /databases/{database}/documents {
       function isAuthenticated() {
         return request.auth != null && 
                exists(/databases/$(database)/documents/users/$(request.auth.uid));
       }

       function isAdmin() {
         return isAuthenticated() && 
                get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }

       match /users/{userId} {
         allow read: if request.auth != null;
         allow write: if isAdmin();
       }

       match /members/{memberId} {
         allow read: if isAuthenticated();
         allow write: if isAdmin();
       }
       
       match /schedules/{scheduleId} {
         allow read: if isAuthenticated();
         allow write: if isAdmin();
       }
       
       match /attendanceSessions/{sessionId} {
         allow read, create, update: if isAuthenticated();
         allow delete: if isAdmin();
       }
       
       match /attendance/{attendanceId} {
         allow read, write: if isAuthenticated();
       }

       match /settings/{settingsId} {
         allow read: if isAuthenticated();
         allow write: if isAdmin();
       }

       match /scheduleTemplates/{templateId} {
         allow read: if isAuthenticated();
         allow write: if isAdmin();
       }

       match /auditLogs/{logId} {
         allow read, write: if isAuthenticated();
       }
     }
   }
   ```

### C. Required Firestore Composite Indexes
Create these composite indexes in the **Firestore Database** > **Indexes** tab to support alphanumeric sorting and filters:
1. **Collection:** `members` | **Fields:** `lastName` (Asc), `firstName` (Asc)
2. **Collection:** `members` | **Fields:** `status` (Asc), `lastName` (Asc), `firstName` (Asc)
3. **Collection:** `schedules` | **Fields:** `date` (Asc), `startTime` (Asc)

### D. Seed the Initial Admin Account
1. Under **Authentication** > **Users**, click **Add user** and enter your desired admin email and password. Copy the generated User UID.
2. Go to **Firestore Database** > **Data** and start a collection named `users`.
3. Set the Document ID exactly as the **User UID** you copied.
4. Add the following fields:
   - `uid` (string) = `<User UID>`
   - `email` (string) = `<Admin Email>`
   - `role` (string) = `admin`
   - `createdAt` (Server Timestamp)
   - `updatedAt` (Server Timestamp)

---

## 5. Local Development
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 6. Build & Lint Checks
Before deploying, verify code health and type compilation:
```bash
# Run compiler checks and production builds
npm run build

# Run linter checks
npm run lint
```

---

## 7. Production Deployment
To deploy the application to Firebase Hosting:
1. Build the production build folder:
   ```bash
   npm run build
   ```
2. Log in and initialize Hosting via Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   ```
   - **Configuration:** Set build folder to `dist`, select single page app `Yes`, do not overwrite existing files.
3. Deploy assets to live production URL:
   ```bash
   firebase deploy --only hosting
   ```
