import React, { useState, useEffect, useRef } from 'react'

export interface FilterDropdownOption {
  key: string
  label: string
  dot?: string
  count?: number | string
}

export interface FilterDropdownProps {
  label?: string
  value: string
  onChange: (val: string) => void
  options: FilterDropdownOption[]
  allLabel?: string
  className?: string
  menuTitle?: string
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
  className = '',
  menuTitle,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.key === value)
  const isFiltered = value !== 'all' && value !== ''

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition text-xs shadow-2xs cursor-pointer select-none ${
          isFiltered || isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-950 font-bold'
            : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50/50'
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0 pr-1">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              selectedOption?.dot || (isFiltered ? 'bg-blue-600' : 'bg-slate-400')
            }`}
          />
          <span className="truncate">
            {selectedOption ? selectedOption.label : (label || allLabel)}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 min-w-[200px] max-h-60 overflow-y-auto">
          {menuTitle && (
            <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {menuTitle}
            </div>
          )}
          {options.map((opt) => {
            const isSelected = value === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs'
                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 pr-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot || 'bg-slate-400'}`} />
                  <span className="truncate">{opt.label}</span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  {opt.count !== undefined && (
                    <span className="text-[10px] text-slate-400 font-mono">({opt.count})</span>
                  )}
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
