import React from 'react'

export interface BulkProgressBarProps {
  active: boolean
  label?: string
  itemCount?: number
  progress?: number // 0 - 100 (if provided, renders determinate progress)
  variant?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose'
  size?: 'sm' | 'md'
  className?: string
}

const variantStyles = {
  blue: {
    bgTrack: 'bg-blue-100',
    barGradient: 'from-blue-600 via-indigo-500 to-blue-600',
    dotPing: 'bg-blue-400',
    dotSolid: 'bg-blue-600',
    textAccent: 'text-blue-700',
  },
  indigo: {
    bgTrack: 'bg-indigo-100',
    barGradient: 'from-indigo-600 via-purple-500 to-indigo-600',
    dotPing: 'bg-indigo-400',
    dotSolid: 'bg-indigo-600',
    textAccent: 'text-indigo-700',
  },
  emerald: {
    bgTrack: 'bg-emerald-100',
    barGradient: 'from-emerald-600 via-teal-500 to-emerald-600',
    dotPing: 'bg-emerald-400',
    dotSolid: 'bg-emerald-600',
    textAccent: 'text-emerald-700',
  },
  amber: {
    bgTrack: 'bg-amber-100',
    barGradient: 'from-amber-500 via-orange-500 to-amber-500',
    dotPing: 'bg-amber-400',
    dotSolid: 'bg-amber-600',
    textAccent: 'text-amber-800',
  },
  rose: {
    bgTrack: 'bg-rose-100',
    barGradient: 'from-rose-600 via-red-500 to-rose-600',
    dotPing: 'bg-rose-400',
    dotSolid: 'bg-rose-600',
    textAccent: 'text-rose-700',
  },
}

export const BulkProgressBar: React.FC<BulkProgressBarProps> = ({
  active,
  label = 'Processing bulk action...',
  itemCount,
  progress,
  variant = 'blue',
  size = 'md',
  className = '',
}) => {
  if (!active) return null

  const style = variantStyles[variant] || variantStyles.blue
  const isDeterminate = typeof progress === 'number' && progress >= 0 && progress <= 100

  return (
    <div
      className={`w-full bg-white/95 rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-sm select-none transition-all duration-300 animate-in fade-in slide-in-from-top-1 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isDeterminate ? progress : undefined}
    >
      {/* Label and Status */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dotPing}`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${style.dotSolid}`}
            />
          </span>
          <span className="text-xs font-bold text-slate-800 truncate">
            {label}
          </span>
          {typeof itemCount === 'number' && itemCount > 0 && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <div className="shrink-0 text-[11px] font-mono font-black">
          {isDeterminate ? (
            <span className={style.textAccent}>{Math.round(progress)}%</span>
          ) : (
            <span className={`${style.textAccent} uppercase tracking-wider text-[10px]`}>
              In Progress
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div
        className={`w-full overflow-hidden rounded-full ${style.bgTrack} ${
          size === 'sm' ? 'h-1.5' : 'h-2.5'
        } relative`}
      >
        {isDeterminate ? (
          <div
            className={`h-full rounded-full bg-gradient-to-r ${style.barGradient} transition-all duration-300 ease-out shadow-xs`}
            style={{ width: `${progress}%` }}
          />
        ) : (
          <div className="h-full w-full relative overflow-hidden">
            <div
              className={`h-full w-full rounded-full bg-gradient-to-r ${style.barGradient} animate-indeterminate origin-left`}
            />
          </div>
        )}
      </div>
    </div>
  )
}
