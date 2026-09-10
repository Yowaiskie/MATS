import React, { useState } from 'react'

export interface ContactInputProps {
  value: string
  onChange: (cleanDigits: string, isValid: boolean, mode: 'mobile' | 'landline') => void
  label?: string
  required?: boolean
  initialMode?: 'mobile' | 'landline'
  disabled?: boolean
  error?: string
  helperText?: string
  className?: string
  id?: string
}

export const ContactInput: React.FC<ContactInputProps> = ({
  value,
  onChange,
  label = 'Contact Number',
  required = false,
  initialMode = 'mobile',
  disabled = false,
  error,
  helperText,
  className = '',
  id = 'contact-input',
}) => {
  const [mode, setMode] = useState<'mobile' | 'landline'>(() => {
    const raw = (value || '').replace(/\D/g, '')
    if (raw.length >= 7 && raw.length <= 10 && !raw.startsWith('09')) {
      return 'landline'
    }
    return initialMode
  })

  const rawDigits = (value || '').replace(/\D/g, '')
  const maxDigits = mode === 'mobile' ? 11 : 10

  const isMobileValid = mode === 'mobile' && rawDigits.length === 11 && rawDigits.startsWith('09')
  const isLandlineValid = mode === 'landline' && rawDigits.length >= 7 && rawDigits.length <= 10
  const isValid = !rawDigits ? !required : mode === 'mobile' ? isMobileValid : isLandlineValid

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, maxDigits)
    const valid = mode === 'mobile' 
      ? (digits.length === 11 && digits.startsWith('09'))
      : (digits.length >= 7 && digits.length <= 10)
    onChange(digits, digits ? valid : !required, mode)
  }

  const handleModeSwitch = (newMode: 'mobile' | 'landline') => {
    setMode(newMode)
    const newMax = newMode === 'mobile' ? 11 : 10
    const truncated = rawDigits.slice(0, newMax)
    const valid = newMode === 'mobile' 
      ? (truncated.length === 11 && truncated.startsWith('09'))
      : (truncated.length >= 7 && truncated.length <= 10)
    onChange(truncated, truncated ? valid : !required, newMode)
  }

  return (
    <div className={`p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/50 text-[10px] font-bold">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleModeSwitch('mobile')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer select-none ${
              mode === 'mobile' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mobile (11 Digits)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleModeSwitch('landline')}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer select-none ${
              mode === 'landline' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Landline (7-10)
          </button>
        </div>
      </div>

      {/* Input with dedicated right padding & status icon */}
      <div className="relative">
        <input
          id={id}
          type="tel"
          maxLength={maxDigits}
          value={rawDigits}
          onChange={handleInputChange}
          placeholder={mode === 'mobile' ? 'e.g. 09171234567' : 'e.g. 81234567'}
          disabled={disabled}
          className={`w-full h-10 pl-3.5 pr-10 rounded-xl border bg-white font-mono text-xs font-bold transition focus:outline-none focus:ring-2 ${
            !rawDigits
              ? 'border-slate-300 text-slate-900 focus:ring-blue-500/20 focus:border-blue-600'
              : isValid
              ? 'border-emerald-300 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600'
              : 'border-rose-300 text-rose-900 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-600'
          } disabled:opacity-50 disabled:bg-slate-50`}
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {rawDigits ? (
            isValid ? (
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )
          ) : null}
        </div>
      </div>

      {/* Helper Text and Live Digit Count */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-medium pt-0.5">
        <span className={!rawDigits || isValid ? 'text-slate-500' : 'text-rose-600 font-semibold'}>
          {mode === 'mobile'
            ? isMobileValid
              ? 'Valid 11-digit mobile format.'
              : 'Mobile must be 11 digits starting with 09.'
            : isLandlineValid
            ? 'Valid landline length.'
            : 'Landline must be 7 to 10 digits.'}
        </span>
        <span
          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
            !rawDigits
              ? 'bg-slate-100 text-slate-500'
              : isValid
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {rawDigits.length}/{mode === 'mobile' ? '11' : '7-10'}
        </span>
      </div>

      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>
      ) : null}
    </div>
  )
}
