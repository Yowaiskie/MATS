export type TransactionFieldErrors = Partial<Record<string, string>>

interface IncomeFormValues {
  amount: string
  categoryId: string
  source: string
  receivedFrom: string
  date: string
}

interface ExpenseFormValues {
  amount: string
  categoryId: string
  spentByName: string
  date: string
  description: string
}

const validateFields = (fields: Record<string, { value: string; label: string }>): TransactionFieldErrors => {
  const errors: TransactionFieldErrors = {}
  for (const [field, { value, label }] of Object.entries(fields)) {
    // Match the existing required-input behavior without introducing new text or amount rules.
    if (!value) errors[field] = `${label} is required.`
  }
  const date = fields.date.value
  if (date) {
    const [year, month, day] = date.split('-').map(Number)
    const parsed = new Date(0)
    parsed.setUTCFullYear(year, month - 1, day)
    if (!/^\d{4,}-\d{2}-\d{2}$/.test(date) || year <= 0 || !Number.isFinite(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      errors.date = 'Select a valid transaction date.'
    }
  }
  return errors
}

export const validateIncomeForm = (values: IncomeFormValues): TransactionFieldErrors => validateFields({
  amount: { value: values.amount, label: 'Amount' },
  categoryId: { value: values.categoryId, label: 'Category' },
  source: { value: values.source, label: 'Source name' },
  receivedFrom: { value: values.receivedFrom, label: 'Received from' },
  date: { value: values.date, label: 'Transaction date' },
})

export const validateExpenseForm = (values: ExpenseFormValues): TransactionFieldErrors => validateFields({
  amount: { value: values.amount, label: 'Amount' },
  categoryId: { value: values.categoryId, label: 'Category' },
  spentByName: { value: values.spentByName, label: 'Spent by' },
  date: { value: values.date, label: 'Transaction date' },
  description: { value: values.description, label: 'Expense purpose description' },
})

export const revalidateTransactionErrors = (
  previous: TransactionFieldErrors,
  current: TransactionFieldErrors
): TransactionFieldErrors => {
  const next: TransactionFieldErrors = {}
  for (const field of Object.keys(previous)) {
    if (current[field]) next[field] = current[field]
  }
  return Object.keys(next).length === Object.keys(previous).length &&
    Object.keys(next).every(field => next[field] === previous[field]) ? previous : next
}
