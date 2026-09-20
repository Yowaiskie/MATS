# MATS UI Design System & Component Guidelines

> **Target Audience:** All developers and AI agents building new pages, sub-tabs, forms, or modals in MATS.  
> **Location:** `docs/MATS_UI_DESIGN_SYSTEM.md`  
> **Source of Components:** Import all reusable components directly from `@/components`.

---

## 1. Core Design Principles

Every new page, sub-tab, modal, or form in MATS **MUST** adhere to these 6 golden rules:

1. **Zero Browser-Native Selects:** Never use raw HTML `<select>` elements that open blue OS dropdown menus. Always use `<CustomSelect>` or `<FilterDropdown>` from `@/components`.
2. **Toast Over Success Modal:** Never show blocking alert dialogs for successful CRUD operations. Always use `toast.success('Title', 'Description')` via `const { toast } = useToast()`.
3. **No Raw Monetary or Phone Inputs:** 
   - All amounts (PHP) must use `<CurrencyInput />`.
   - All Philippine contact numbers must use `<ContactInput />` (11-digit `09xxxxxxxxx` validation).
4. **Zero Emojis:** Never use emojis in code, logs, labels, or UI text. Always use clean inline SVG icons (Heroicons style).
5. **Standardized Cards & Radii:**
   - **Main Page / Section Containers:** `rounded-3xl border border-slate-200/80 bg-white shadow-2xs p-5`
   - **Inner Cards & Modals:** `rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4`
   - **Inputs & Buttons:** `rounded-xl`
6. **Clean Pill Tabs:** Single-line horizontal pill tabs with `whitespace-nowrap`, active indicator dot, and hidden native scrollbars (`[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`).

---

## 2. Reusable Component Directory (`@/components`)

All standard UI primitives are centrally exported from `@/components`. Always import from `@/components` (never duplicate or write raw unstyled HTML).

### 2.1 `<CustomSelect />` — Floating Popover Dropdown
Replaces native HTML `<select>`. Renders a custom floating popover card with hover states, active indicators, checkmark icons, built-in search filter (when > 8 options), click-outside closing, and `Escape` key handling.

```tsx
import { CustomSelect } from '@/components'

<CustomSelect
  label="Signatory Role"
  value={selectedRole}
  onChange={(e) => setSelectedRole(e.target.value)}
  options={[
    { value: 'Parish Priest', label: 'Parish Priest', description: 'Head signatory' },
    { value: 'Coordinator', label: 'Coordinator' },
    { value: 'Treasurer', label: 'Treasurer' },
    { value: 'custom', label: 'Other / Custom Role...' }
  ]}
  placeholder="Select role..."
  searchable // Optional: enables live search
/>
```

---

### 2.2 `<FilterDropdown />` — Toolbar Filter Menu
For page-level filter bars (Status, Role, Rank, Attendance, Category) with colored dot indicators and optional count badges.

```tsx
import { FilterDropdown } from '@/components'

<FilterDropdown
  label="Filter Status"
  value={statusFilter}
  onChange={(val) => setStatusFilter(val)}
  allLabel="All Statuses"
  options={[
    { key: 'all', label: 'All Statuses', dot: 'bg-slate-400' },
    { key: 'active', label: 'Active Members', dot: 'bg-emerald-500', count: 42 },
    { key: 'probationary', label: 'Probationary', dot: 'bg-amber-500', count: 6 },
    { key: 'archived', label: 'Archived', dot: 'bg-rose-500', count: 3 }
  ]}
/>
```

---

### 2.3 `<QuickFilterPills />` — Horizontal Filter Bar
For fast 1-click status or category filtering above tables.

```tsx
import { QuickFilterPills } from '@/components'

<QuickFilterPills
  activeKey={activeTab}
  onChange={(key) => setActiveTab(key)}
  options={[
    { key: 'all', label: 'All Requests', count: totalCount },
    { key: 'pending', label: 'Pending', count: pendingCount, variant: 'warning' },
    { key: 'approved', label: 'Approved', count: approvedCount, variant: 'success' },
    { key: 'rejected', label: 'Rejected', count: rejectedCount, variant: 'danger' }
  ]}
/>
```

---

### 2.4 `<Button />` — Standard Buttons with Loading Spinners
Handles all button variants and automatic disabled loading spinners.

```tsx
import { Button } from '@/components'

// Primary Action
<Button
  variant="primary"
  size="default" // "dense" | "default" | "public"
  loading={isSubmitting}
  onClick={handleSubmit}
  icon={<PlusIcon className="w-4 h-4" />}
>
  Add Entry
</Button>

// Secondary / Cancel
<Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
  Cancel
</Button>

// Danger / Delete
<Button variant="danger" loading={isDeleting} onClick={handleDelete}>
  Delete Item
</Button>
```

---

### 2.5 `<CurrencyInput />` — Philippine Peso Amount Formatter
Standardized currency input with live peso formatting, numeric parsing, and clean label/error handling.

```tsx
import { CurrencyInput } from '@/components'

<CurrencyInput
  label="Allocated Budget"
  required
  value={amount}
  onChange={(val) => setAmount(val)} // val is parsed number
  placeholder="0.00"
  error={errors.amount}
/>
```

---

### 2.6 `<ContactInput />` — Mobile Contact Number
Enforces valid 11-digit Philippine mobile format (`09xxxxxxxxx`).

```tsx
import { ContactInput } from '@/components'

<ContactInput
  label="Mobile Number"
  required
  value={contactNumber}
  onChange={(val) => setContactNumber(val)}
  error={errors.contactNumber}
/>
```

---

### 2.7 `<MemberSearchDropdown />` — Member Selector & Autofill
Unified search dropdown for selecting members or entering custom names.

```tsx
import { MemberSearchDropdown } from '@/components'

<MemberSearchDropdown
  members={membersList}
  value={selectedName}
  mode="name" // "name" | "id"
  title="Select Officer or Member"
  placeholder="Search roster or type name..."
  formatDisplayName={(m) => `Bro. ${m.firstName} ${m.lastName}`.toUpperCase()}
  onChange={(val, item) => {
    if (item?.rawMember) {
      handleAutoFillFromMember(item.rawMember)
    } else {
      setSelectedName(val)
    }
  }}
/>
```

---

### 2.8 `<StatusBadge />` — Status & Category Pills
Standardized status tags.

```tsx
import { StatusBadge } from '@/components'

<StatusBadge status="active" />
<StatusBadge status="pending" label="Pending Approval" />
<StatusBadge status="completed" variant="success" />
<StatusBadge status="cancelled" variant="danger" />
```

---

### 2.9 `<EmptyState />` — Empty Table / List Placeholder
Consistent empty state when lists or search filters have 0 records.

```tsx
import { EmptyState } from '@/components'

<EmptyState
  title="No Records Found"
  description="No income entries match the selected filters or date range."
  actionLabel="+ Create First Entry"
  onAction={() => setShowCreateModal(true)}
/>
```

---

### 2.10 `<MetricCard />` — KPI Summary Cards
Stat cards at top of dashboard or domain pages.

```tsx
import { MetricCard } from '@/components'

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <MetricCard
    title="Total Balance"
    value={`PHP ${balance.toLocaleString()}`}
    trend="+12% from last month"
    trendType="positive"
    icon={<WalletIcon className="w-5 h-5 text-indigo-600" />}
  />
</div>
```

---

### 2.11 `<BulkProgressBar />` — Progressive Action Progress Bar
Use progressive progress bars instead of blocking loading spinners during multi-item bulk operations (Archive, Restore, Delete, Rank Changes).

```tsx
import { BulkProgressBar } from '@/components'

{bulkProgress.active && (
  <BulkProgressBar
    current={bulkProgress.current}
    total={bulkProgress.total}
    label="Processing bulk items..."
  />
)}
```

---

### 2.12 `<useToast />` — User Feedback
Standard notification feedback.

```tsx
import { useToast } from '@/components'

const { toast } = useToast()

// Success Feedback
toast.success('Successfully Created', 'New expense voucher has been recorded.')

// Error Feedback
toast.error('Operation Failed', error.message || 'Please check your input.')
```

---

## 3. Standard Page Layout Template

When creating a new feature page (e.g. `src/features/<feature>/pages/<Feature>Page.tsx`), use this canonical template:

```tsx
import React, { useState, useMemo } from 'react'
import {
  Card,
  Button,
  CustomSelect,
  FilterDropdown,
  QuickFilterPills,
  StatusBadge,
  EmptyState,
  MetricCard,
  Pagination,
  useToast
} from '@/components'

export const ExampleFeaturePage: React.FC = () => {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header Card */}
      <Card className="p-6 border border-slate-200/80 bg-white rounded-3xl shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Module Name
              </span>
              <span className="text-xs font-bold text-slate-400">•</span>
              <span className="text-xs font-bold text-slate-500">Live Management</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Page Title Here
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Manage transactions, records, and schedules with ease.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="primary"
              size="dense"
              onClick={() => setShowModal(true)}
              icon={<PlusIcon className="w-4 h-4" />}
            >
              New Item
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. KPI Stat Cards (Optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Total Items" value="128" />
        <MetricCard title="Active" value="112" />
        <MetricCard title="Pending" value="16" />
      </div>

      {/* 3. Toolbar: Search + Custom Filter Dropdowns */}
      <Card className="p-4 border border-slate-200/80 bg-white rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records..."
              className="w-full h-10 pl-10 pr-4 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
            />
            <SearchIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          </div>

          {/* Filter Popovers */}
          <div className="w-full sm:w-56 shrink-0">
            <FilterDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { key: 'all', label: 'All Statuses' },
                { key: 'active', label: 'Active', dot: 'bg-emerald-500' },
                { key: 'pending', label: 'Pending', dot: 'bg-amber-500' }
              ]}
            />
          </div>
        </div>

        {/* Quick Filter Pills */}
        <QuickFilterPills
          activeKey={activeTab}
          onChange={setActiveTab}
          options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'archived', label: 'Archived' }
          ]}
        />
      </Card>

      {/* 4. Table / Content Container */}
      <Card className="border border-slate-200/80 bg-white rounded-3xl shadow-2xs overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="No Items Found"
            description="No items match your current filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="secondary" size="dense">Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-100">
          <Pagination
            currentPage={currentPage}
            totalCount={items.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </Card>
    </div>
  )
}
```

---

## 4. Modal Creation Template

When creating a new modal (e.g. `src/features/<feature>/components/<Feature>Modal.tsx`):

```tsx
import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button, CustomSelect, CurrencyInput, ContactInput, useToast } from '@/components'

interface ExampleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const ExampleModal: React.FC<ExampleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Execute service call
      toast.success('Record Saved', 'The entry has been successfully recorded.')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Failed to Save', err.message || 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Record" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Item Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="e.g. Altar Wine Supplies"
          />
        </div>

        <CustomSelect
          label="Category"
          required
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: 'liturgical', label: 'Liturgical Supplies' },
            { value: 'maintenance', label: 'Maintenance & Repairs' },
            { value: 'utilities', label: 'Utilities & Bills' }
          ]}
        />

        <CurrencyInput
          label="Estimated Cost (PHP)"
          required
          value={amount}
          onChange={(val) => setAmount(val)}
        />

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Save Record
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

---

## 5. Summary Checklist Before Submitting Code

- [ ] All dropdowns use `<CustomSelect>` or `<FilterDropdown>` (NO raw `<select>`).
- [ ] Successful actions trigger `toast.success()` (NO blocking success dialogs).
- [ ] Monetary amounts use `<CurrencyInput>`.
- [ ] Philippine phone numbers use `<ContactInput>`.
- [ ] Action buttons use `<Button loading={...}>`.
- [ ] Empty lists render `<EmptyState>`.
- [ ] No emojis in UI text or code.
- [ ] `npm run build` passes with 0 errors.
