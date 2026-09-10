import React from 'react'

export interface QuickFilterPill {
  label: string
  active: boolean
  onClick: () => void
  count?: number | string
}

export interface QuickFilterPillsProps {
  title?: string
  pills: QuickFilterPill[]
  className?: string
}

export const QuickFilterPills: React.FC<QuickFilterPillsProps> = ({
  title = 'Quick Filter:',
  pills,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none ${className}`}
    >
      {title && (
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pr-1 shrink-0">
          {title}
        </span>
      )}
      {pills.map((pill, idx) => (
        <button
          key={idx}
          type="button"
          onClick={pill.onClick}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
            pill.active
              ? 'bg-blue-600 text-white shadow-2xs shadow-blue-500/30'
              : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
          }`}
        >
          <span>{pill.label}</span>
          {pill.count !== undefined && (
            <span
              className={`ml-1 text-[10px] font-mono ${
                pill.active ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              ({pill.count})
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
