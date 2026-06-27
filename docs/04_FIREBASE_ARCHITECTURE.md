# Firebase Architecture

React App

↓

Firebase Authentication

↓

Cloud Firestore

↓

Firebase Hosting

---

Authentication

Firebase Email & Password

---

Collections

users

members

schedules

scheduleAssignments

attendance

---

Security Rules

Only authenticated admins can:

- Create
- Update
- Delete

Everyone else has no access.

