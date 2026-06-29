# UI Component Guidelines

All reusable UI elements must be created inside:

src/components/

Examples:

Button
Input
Modal
Card
Badge
Table
LoadingSpinner
EmptyState
ConfirmDialog
SearchInput
Pagination

Feature-specific components should remain inside:

src/features/<feature>/components/

Never duplicate UI components.

If a reusable component already exists,
reuse it instead of creating another version.

All forms should have:

- loading state
- error state
- validation state
- disabled submit while processing

All tables should support:

- empty state
- loading state
- responsive layout