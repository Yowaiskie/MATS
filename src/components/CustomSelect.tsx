import React from 'react'

export interface CustomSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface CustomSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: CustomSelectOption[]
  label?: string
  required?: boolean
  error?: string
  helperText?: string
  icon?: React.ReactNode
  containerClassName?: string
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  label,
  required = false,
  error,
  helperText,
  icon,
  className = '',
  containerClassName = '',
  id = 'custom-select',
  disabled = false,
  ...props
}) => {
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {icon}
          </span>
        )}

        <select
          id={id}
          disabled={disabled}
          {...props}
          className={`block w-full h-10 ${
            icon ? 'pl-10' : 'pl-3.5'
          } pr-10 rounded-xl border bg-white text-xs font-semibold text-slate-800 appearance-none transition focus:outline-none focus:ring-2 cursor-pointer shadow-2xs ${
            error
              ? 'border-rose-300 text-rose-900 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-600'
              : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
          } disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed ${className}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>
      ) : null}
    </div>
  )
}
