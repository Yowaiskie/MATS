# Firebase Project Setup Guide

This guide outlines the steps to set up the Firebase services required for the Ministry Attendance Tracking System (MATS).

---

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and enter `MATS` (or your preferred project name).
3. (Optional) Disable Google Analytics if it is not needed for this internal application, then click **Create project**.
4. Once the project is ready, click **Continue**.

---

## 2. Register Your Web App

1. On the project homepage, click the **Web icon (`</>`)** to register a new web application.
2. Enter an App nickname (e.g., `mats-web`).
3. Check the box **Also set up Firebase Hosting** for this app (this will make setup easier later).
4. Click **Register app**.
5. Copy the contents of the `firebaseConfig` object shown on the screen. You will need these values for your environment variables.
6. Click **Next** through the CLI steps and then **Continue to console**.

---

## 3. Configure Authentication

1. In the left-hand navigation sidebar, click **Build** > **Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, click **Email/Password**.
4. Enable the toggle for **Email/Password** (keep *Email link (passwordless sign-in)* disabled).
5. Click **Save**.

---

## 4. Configure Cloud Firestore

1. In the left navigation, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Select your Database Location (prefer geographical closeness to your users) and click **Next**.
4. Start in **Production mode** (which denies all reads/writes by default) and click **Create**.
5. Go to the **Rules** tab and replace the default rules with the security rules below (enforcing that only authenticated users with an existing admin profile in the `users` collection can modify documents):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if the current user exists in the users collection with 'admin' role
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // users collection: Users can read their own profile, but only admins can create/write/delete
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if isAdmin();
    }

    // members, schedules, attendanceSessions, and attendance collections
    // Only authenticated admins can Read, Create, Update, Delete
    match /members/{memberId} {
      allow read, write: if isAdmin();
    }
    
    match /schedules/{scheduleId} {
      allow read, write: if isAdmin();
    }
    
    match /attendanceSessions/{sessionId} {
      allow read, write: if isAdmin();
    }
    
    match /attendance/{attendanceId} {
      allow read, write: if isAdmin();
    }

    match /settings/{settingsId} {
      allow read, write: if isAdmin();
    }

    match /scheduleTemplates/{templateId} {
      allow read, write: if isAdmin();
    }
  }
}
```

6. Click **Publish** to apply the security rules.

---

## 5. Seed Initial Admin Account

Because our database rules restrict access to authenticated users whose profile already exists in the `/users` collection:
1. Go to the **Authentication** tab in the console.
2. Click **Add user**, enter an email and password (e.g., `admin@example.com` and a secure password), and click **Add user**.
3. Copy the newly created user's **User UID** from the table.
4. Go back to **Firestore Database** > **Data** tab.
5. Click **Start collection**, enter collection ID: `users`.
6. Enter Document ID: **Paste the User UID** you copied in Step 3.
7. Add the following fields to the document:
   - `uid` (string) = **Paste the User UID**
   - `email` (string) = the email you registered (e.g., `admin@example.com`)
   - `role` (string) = `admin`
   - `createdAt` (timestamp) = Current server timestamp
   - `updatedAt` (timestamp) = Current server timestamp
8. Click **Save**. This user can now successfully log in to MATS and perform admin tasks.

---

## 6. Configure Environment Variables

Create a file named `.env` in the root of the project (this file is gitignored) and fill in the values you copied during web app registration:

```ini
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

---

## 7. Set Up Firebase Hosting (Local Setup)

1. Make sure you have the Firebase CLI installed on your machine globally:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to your Firebase account using the CLI:
   ```bash
   firebase login
   ```
3. Initialize hosting in your project root:
   ```bash
   firebase init hosting
   ```
4. Configure the prompt answers as follows:
   - **Project selection:** Choose `Use an existing project` and select the project you created.
   - **Public directory:** Enter `dist` (this matches Vite's build output directory).
   - **Configure as a single-page app:** Enter `y` (Yes) (this routes all URLs to `index.html` for React Router).
   - **Set up automatic builds and deploys with GitHub:** Enter `n` (No) (unless you specifically want to set up CI/CD actions).
5. Build the React project:
   ```bash
   npm run build
   ```
6. Deploy the application to production:
   ```bash
   firebase deploy --only hosting
   ```

---

## 8. Required Firestore Composite Indexes

To support compound filtering and alphabetical/chronological sorting, create the following composite indexes in the **Firestore Database** > **Indexes** tab:

1. **Collection ID:** `members`
   - **Fields:**
     - `lastName` (Ascending)
     - `firstName` (Ascending)
   - **Query Scope:** Single Collection

2. **Collection ID:** `members`
   - **Fields:**
     - `status` (Ascending)
     - `lastName` (Ascending)
     - `firstName` (Ascending)
   - **Query Scope:** Single Collection

3. **Collection ID:** `schedules`
   - **Fields:**
     - `date` (Ascending)
     - `startTime` (Ascending)
   - **Query Scope:** Single Collection
