import React from 'react'

export interface StatusBadgeProps {
  status: string
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const norm = (status || '').toLowerCase().trim()

  const config: { bg: string; text: string; border: string; dot: string; label?: string } = (() => {
    switch (norm) {
      case 'active':
      case 'approved':
      case 'success':
      case 'present':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200/80',
          dot: 'bg-emerald-500',
        }
      case 'pending':
      case 'in_progress':
      case 'warning':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200/80',
          dot: 'bg-amber-500',
        }
      case 'released':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200/80',
          dot: 'bg-blue-500',
        }
      case 'liquidated':
      case 'officer':
        return {
          bg: 'bg-indigo-50',
          text: 'text-indigo-700',
          border: 'border-indigo-200/80',
          dot: 'bg-indigo-500',
        }
      case 'closed':
      case 'completed':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          dot: 'bg-slate-500',
        }
      case 'rejected':
      case 'voided':
      case 'cancelled':
      case 'absent':
      case 'suspended':
      case 'error':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200/80',
          dot: 'bg-rose-500',
        }
      case 'archived':
      case 'inactive':
      default:
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-600',
          border: 'border-slate-200',
          dot: 'bg-slate-400',
        }
    }
  })()

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-bold uppercase tracking-wider border select-none ${config.bg} ${config.text} ${config.border} ${sizeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="capitalize">{label || status}</span>
    </span>
  )
}
