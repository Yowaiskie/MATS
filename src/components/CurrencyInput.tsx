import React from 'react'

export interface CurrencyInputProps {
  value: string | number
  onChange: (formattedValue: string, numericValue: number) => void
  label?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  error?: string
  helperText?: string
  className?: string
  id?: string
  autoFocus?: boolean
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  label,
  required = false,
  placeholder = '0.00',
  disabled = false,
  error,
  helperText,
  className = '',
  id = 'currency-input',
  autoFocus = false,
}) => {
  // Format formatted string with commas
  const formatCommaString = (val: string | number): string => {
    if (val === '' || val === undefined || val === null) return ''
    const clean = String(val).replace(/,/g, '').replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    if (parts.length > 2) return ''
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  }

  const parseNumericValue = (formatted: string): number => {
    if (!formatted) return 0
    const raw = formatted.replace(/,/g, '')
    const num = parseFloat(raw)
    return isNaN(num) ? 0 : num
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    // Allow digits and only one decimal point
    const clean = rawVal.replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    if (parts.length > 2) return

    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const formatted = parts.join('.')
    const numeric = parseNumericValue(formatted)
    onChange(formatted, numeric)
  }

  const displayValue = typeof value === 'number' ? formatCommaString(value.toString()) : value

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
            PHP Currency
          </span>
        </div>
      )}

      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold font-mono text-xs select-none">
          PHP
        </span>
        <input
          id={id}
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full h-10 pl-14 pr-4 rounded-xl border bg-white text-slate-900 font-mono font-bold text-xs transition focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-300 text-rose-900 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-600'
              : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
          } disabled:opacity-50 disabled:bg-slate-50`}
        />
      </div>

      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>
      ) : null}
    </div>
  )
}
