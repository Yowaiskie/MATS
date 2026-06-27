# Firestore Conventions

Collections must use lowercase plural names.

Example:

users
members
attendance
schedules

Document IDs

Use Firestore auto-generated IDs unless there is a business requirement.

Never use array fields to represent relationships when a reference document is more appropriate.

Always include:

createdAt
updatedAt

using Firestore server timestamps.

Soft delete should use:

archivedAt

instead of deleting records permanently.

Never physically delete attendance records.