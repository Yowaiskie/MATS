import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline' | 'purple'
  size?: 'xs' | 'sm' | 'md' | 'dense' | 'default' | 'public'
  loading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  loading = false,
  loadingText,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    xs: 'h-8 px-2.5 text-[10px] rounded-lg font-bold',
    sm: 'h-9 px-3 text-[11px] rounded-xl font-bold',
    dense: 'h-9 px-3 text-[11px] rounded-xl font-bold',
    md: 'h-10 px-4 text-xs rounded-xl font-bold',
    default: 'h-10 px-4 text-xs rounded-xl font-bold',
    public: 'h-11 px-5 text-xs sm:text-sm rounded-xl font-bold',
  }[size]

  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20 active:scale-98',
    secondary:
      'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs active:scale-98',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/25 ring-1 ring-rose-700/20 active:scale-98',
    success:
      'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-700/20 active:scale-98',
    purple:
      'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/25 ring-1 ring-purple-700/20 active:scale-98',
    outline:
      'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-300 active:scale-98',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 active:scale-98',
  }[variant]

  const isDisabled = disabled || loading

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed disabled:active:scale-100 ${sizeClasses} ${variantClasses} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5 text-current shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{loadingText || 'Processing...'}</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  )
}
