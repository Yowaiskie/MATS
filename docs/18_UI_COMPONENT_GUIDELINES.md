# UI Component Guidelines & Design System

> **Primary Source of Truth:** Refer to [`docs/MATS_UI_DESIGN_SYSTEM.md`](file:///C:/Users/kyle/Desktop/MATS/docs/MATS_UI_DESIGN_SYSTEM.md) for full component specifications, props, and copy-paste page/modal templates.

All reusable UI elements must be imported directly from `@/components`:

```tsx
import {
  Button,
  CustomSelect,
  FilterDropdown,
  QuickFilterPills,
  CurrencyInput,
  ContactInput,
  MemberSearchDropdown,
  StatusBadge,
  EmptyState,
  MetricCard,
  Card,
  Modal,
  Pagination,
  BulkProgressBar,
  useToast
} from '@/components'
```

### Strict Policies for All Pages & Modals:
1. **Zero Browser-Native Selects:** Always use `<CustomSelect>` or `<FilterDropdown>`. Never use raw `<select>` elements.
2. **Toast Over Success Modal:** Always use `toast.success()` for successful operations. Never show blocking success dialogs.
3. **No Raw Money / Phone Inputs:** Always use `<CurrencyInput>` for PHP currency and `<ContactInput>` for Philippine mobile numbers.
4. **Zero Emojis:** Use Heroicons / Lucide style SVG icons exclusively.
5. **Button Loading State:** Always pass `loading={isSubmitting}` to `<Button>`.
6. **Card Radii:** Main containers use `rounded-3xl`, inner cards/modals use `rounded-2xl`, inputs/buttons use `rounded-xl`.