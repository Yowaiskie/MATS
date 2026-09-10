import React from 'react'

export interface MetricCardProps {
  title: string
  value: string | number
  subtext?: string
  icon: React.ReactNode
  variant?: 'blue' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate'
  trend?: {
    value: string
    isPositive: boolean
  }
  className?: string
  onClick?: () => void
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon,
  variant = 'slate',
  trend,
  className = '',
  onClick,
}) => {
  const styles = {
    blue: {
      card: 'bg-white border-slate-200/80',
      iconBox: 'bg-blue-50 border-blue-100 text-blue-600',
      valueText: 'text-blue-600',
    },
    emerald: {
      card: 'bg-emerald-50/50 border-emerald-200 text-emerald-950',
      iconBox: 'bg-emerald-100/80 border-emerald-200 text-emerald-700',
      valueText: 'text-emerald-700',
    },
    indigo: {
      card: 'bg-white border-slate-200/80',
      iconBox: 'bg-indigo-50 border-indigo-100 text-indigo-600',
      valueText: 'text-indigo-600',
    },
    amber: {
      card: 'bg-amber-50/50 border-amber-200 text-amber-950',
      iconBox: 'bg-amber-100 border-amber-200 text-amber-700',
      valueText: 'text-amber-700',
    },
    rose: {
      card: 'bg-rose-50/50 border-rose-200 text-rose-950',
      iconBox: 'bg-rose-100 border-rose-200 text-rose-700',
      valueText: 'text-rose-700',
    },
    slate: {
      card: 'bg-white border-slate-200/80',
      iconBox: 'bg-slate-100 border-slate-200 text-slate-700',
      valueText: 'text-slate-900',
    },
  }[variant]

  return (
    <div
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border shadow-2xs flex flex-col justify-between transition-all duration-200 ${styles.card} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-98' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 truncate">
          {title}
        </span>
        <div className={`p-2 rounded-xl border shrink-0 ${styles.iconBox}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <div className={`text-xl sm:text-2xl font-black break-words ${styles.valueText}`}>
          {value}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          {subtext && (
            <span className="text-[10px] font-semibold text-slate-400 block truncate">
              {subtext}
            </span>
          )}

          {trend && (
            <span
              className={`inline-flex items-center text-[10px] font-black shrink-0 ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.isPositive ? '+' : '-'}
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
