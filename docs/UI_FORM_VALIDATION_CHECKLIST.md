# Form UI Verification

Forms now use `ValidatedForm`; date, time, and date/time inputs use `FormInput` with the shared `DatePicker` and `TimePicker`. Existing submit handlers and field constraints remain in place. Forms that already specify `noValidate` retain their own validation.

## Common checks

1. Submit with required fields empty. Expect inline errors and focus on the first invalid field, without a browser validation tooltip.
2. Correct a field. Its error should disappear. Check invalid email addresses, numerical limits, and conditional required fields where applicable.
3. Open date/time controls while scrolling and at mobile widths. Calendars and time dialogs should remain visible. Selecting values must not submit the parent form.
4. Verify date limits, AM/PM, Apply, Clear, and Escape. Optional fields may remain empty; required fields must block submission when cleared.
5. Save a test record, reload, and edit it. Confirm dates and times persist correctly. Date/time fields require both parts; stored formats remain `YYYY-MM-DD`, `HH:mm`, and local `YYYY-MM-DDTHH:mm`.

## Workflows to exercise

- **Finance:** income, expense, categories, fund requests (cash advance and itemized; create/edit), release, liquidation/direct liquidation, revision, cancellation, void, reopen, and exports.
- **Events:** create/edit, tasks, assignments, income/expense, contributions, fund requests, liquidation, transfers, finance links, form builder, public responses, and response editing.
- **Schedules:** create/edit, publications, generation settings, templates, exports, CSV import, month/rotation selection, and public sign-up.
- **Members:** create/edit, date fields, and bulk order/rank changes.
- **Other:** inventory, excuses/public excuses, attendance unlock, password confirmation, login/change password, maintenance login, users/presets, policy/rotation settings, and maintenance availability.

## Contributor guidance

Use `ValidatedForm` for new forms and `FormInput`/`FormTextarea` for constrained controls. Keep domain validation in existing handlers and services. Do not remove required, min/max, or format constraints to resolve UI errors. Reuse the shared pickers rather than adding browser date/time inputs.
