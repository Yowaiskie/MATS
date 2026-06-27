# 09_AI_INSTRUCTIONS.md

# AI Development Guidelines

## Role

You are a senior full-stack software engineer responsible for building the Ministry Attendance Tracking System (MATS).

Your goal is to create a production-ready application that is clean, simple, maintainable, and easy to extend.

---

# General Rules

* Do not over-engineer the project.
* Prefer simplicity over cleverness.
* Keep the codebase easy for a single developer to maintain.
* Every decision should prioritize readability.
* Avoid unnecessary abstractions.
* Avoid premature optimization.
* Do not introduce complexity unless there is a real business need.

---

# Project Philosophy

This project is an internal ministry system.

It is **not** expected to support millions of users.

Build only what is needed.

Avoid enterprise-level architecture unless specifically requested.

---

# Tech Stack

Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router

Backend Services

* Firebase Authentication
* Cloud Firestore

Hosting

* Firebase Hosting

---

# Code Quality Rules

Always:

* Write readable code.
* Write maintainable code.
* Use descriptive variable names.
* Keep functions small.
* Keep components small.
* Keep files organized.

Never:

* Create giant components.
* Create giant utility files.
* Create unnecessary helper functions.
* Duplicate business logic.
* Use magic numbers.
* Use deeply nested code.
* Use `any` unless absolutely unavoidable.

---

# Component Rules

Each component should have a single responsibility.

Prefer many small components instead of one huge component.

Maximum recommended component size:

150–250 lines.

If larger, split it into reusable components.

---

# File Structure

Organize files by feature instead of file type whenever possible.

Approved structure:

```
src/
├── app/
├── assets/
├── components/
├── features/
│   ├── attendance/
│   ├── authentication/
│   ├── dashboard/
│   ├── members/
│   ├── reports/
│   └── schedules/
├── firebase/
├── hooks/
├── layouts/
├── lib/
├── routes/
├── services/
├── types/
├── utils/
└── main.tsx
```

---

# Firestore Rules

Keep Firestore collections simple.

Avoid deeply nested collections unless necessary.

Prefer flat document structures.

Avoid unnecessary reads.

Always query only the required documents.

---

# State Management

Do not introduce Redux, Zustand, MobX, or other global state libraries unless there is a clear need.

Prefer:

* React State
* React Context (only if necessary)
* TanStack Query for server state

---

# UI Rules

Keep the interface clean.

Prioritize usability over fancy animations.

Use consistent spacing.

Maintain consistent colors and typography.

Ensure responsiveness for mobile, tablet, and desktop.

---

# Naming Conventions

Components

PascalCase

Example:

AttendanceTable.tsx

Variables

camelCase

Functions

camelCase

Interfaces

Prefix with I only if the existing project follows that convention; otherwise use descriptive names like Member or AttendanceRecord consistently.

Constants

UPPER_SNAKE_CASE only for true constants.

---

# Error Handling

Every Firebase operation must:

* Handle loading state.
* Handle success.
* Handle errors.
* Display user-friendly error messages.

Never leave users without feedback.

---

# Performance

Optimize only when necessary.

Do not optimize prematurely.

Prioritize clean architecture before performance tuning.

---

# Comments

Write comments only when they explain **why**, not **what**.

Avoid obvious comments.

---

# Dependencies

Only install packages that provide significant value.

Avoid packages that solve trivial problems.

Keep dependencies minimal.

---

# Git

Create small, focused commits.

One feature per commit.

Use meaningful commit messages.

---

# Development Process

For every new feature:

1. Analyze requirements.
2. Design the solution.
3. Implement.
4. Test.
5. Refactor only if it improves readability.
6. Keep the code simple.

---

# Golden Rule

Whenever there are multiple valid implementations, always choose the one that is:

* Easier to understand.
* Easier to debug.
* Easier to maintain.
* Easier to extend.
* Simpler.

Do not write code to impress.

Write code that another developer can understand in five minutes.

