# AGENTS.md

# Ministry Attendance Tracking System (MATS)

## AI Agent Instructions

Welcome to the Ministry Attendance Tracking System project.

This project follows a documentation-first and phase-based development workflow.

Before making any changes, you **must** read and understand all project documentation.

The `/docs` directory is the **single source of truth**.

If documentation conflicts with assumptions, always follow the documentation.

---

# Before Writing Code

You MUST complete these steps before generating any code.

1. Read every Markdown file inside `/docs`.
2. Understand the project requirements.
3. Understand the database design.
4. Understand the development roadmap.
5. Understand the coding standards.
6. Understand the Git workflow.
7. Understand the Definition of Done.
8. Create an implementation plan.
9. Wait for user approval.

Do NOT skip these steps.

---

# Development Philosophy

This is a small internal ministry application.

Do NOT build enterprise architecture.

Do NOT over-engineer.

Do NOT introduce unnecessary complexity.

Favor simplicity over cleverness.

The project should remain easy for a single developer to maintain.

---

# Development Rules

Always:

* Keep the code simple.
* Keep the project maintainable.
* Write readable code.
* Reuse existing components.
* Reuse existing utilities.
* Reuse existing hooks.
* Keep components focused.
* Keep functions short.
* Use descriptive names.
* Follow the existing project structure.
* Use TypeScript correctly.

Never:

* Rewrite working code without reason.
* Duplicate functionality.
* Create unnecessary abstractions.
* Add dependencies without justification.
* Leave dead code.
* Leave unused imports.
* Leave unused variables.
* Leave console.log statements in production code.

---

# Project Architecture

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

# Folder Structure

Follow the established feature-based architecture.

Do not reorganize folders without approval.

---

# Firebase Rules

Use Firebase Authentication.

Use Cloud Firestore.

Use Firebase best practices.

Minimize Firestore reads and writes.

Keep document structures simple.

---

# UI Rules

The interface should be:

* Clean
* Responsive
* Modern
* Consistent

Avoid unnecessary animations.

Focus on usability.

---

# Git Rules

Never commit directly to the `main` branch.

Workflow:

main

↓

develop

↓

feature/<feature-name>

Every feature must be developed in its own branch.

---

# Development Phases

Always follow the phase breakdown inside:

docs/13_PHASE_BREAKDOWN.md

Do not skip phases.

Do not implement future phases.

Finish only the current phase.

Wait for approval before continuing.

---

# Before Completing Any Phase

Verify:

* Build passes.
* TypeScript has no errors.
* Lint passes.
* No duplicate code.
* No unused imports.
* No unused variables.
* Responsive layout works.
* Feature works correctly.

---

# Code Review Checklist

Before considering any task complete, ask yourself:

* Is this solution the simplest possible?
* Is the code readable?
* Can another developer understand it quickly?
* Can existing code be reused?
* Is there duplicated logic?
* Is the feature maintainable?

If not, improve it before marking the task complete.

---

# Definition of Done

A feature is complete only if:

* Requirements are fully implemented.
* UI is responsive.
* Error handling is implemented.
* Loading states are implemented.
* Empty states are implemented.
* Build succeeds.
* No TypeScript errors.
* No lint errors.
* Documentation updated if necessary.

---

# Communication Rules

Before making major architectural changes:

* Explain the reasoning.
* Wait for approval.

When finishing a phase:

Always provide:

## Summary

What was implemented.

## Files Changed

List all modified files.

## Notes

Important implementation details.

## Potential Improvements

Suggestions only.

Do NOT implement improvements unless requested.

---

# Final Principle

Write code for humans first.

The best solution is not the most complex.

The best solution is the one that is:

* Simple
* Readable
* Maintainable
* Consistent
* Easy to debug
* Easy to extend

If multiple valid solutions exist, always choose the simplest one.

Project documentation is the source of truth.


## AI Execution Policy

If a task is unclear:

- Stop.
- Ask questions.
- Do not guess requirements.

If documentation is missing:

- Inform the user.
- Suggest additions.
- Wait for approval.

Never invent business logic.

Never silently change project architecture.

When uncertain, always ask instead of assuming.

