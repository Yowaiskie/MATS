import React, { useState, useEffect, useRef, useMemo } from 'react'

export interface CustomSelectOption {
  value: string | number
  label: string
  disabled?: boolean
  description?: string
  icon?: React.ReactNode
}

export interface CustomSelectProps {
  options: CustomSelectOption[]
  value?: string | number
  defaultValue?: string | number
  onChange?: (e: any) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  helperText?: string
  icon?: React.ReactNode
  className?: string
  containerClassName?: string
  id?: string
  name?: string
  disabled?: boolean
  searchable?: boolean
  menuTitle?: string
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  label,
  placeholder = 'Select an option...',
  required = false,
  error,
  helperText,
  icon,
  className = '',
  containerClassName = '',
  id = 'custom-select',
  name,
  disabled = false,
  searchable,
  menuTitle,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [internalValue, setInternalValue] = useState<string | number>(
    controlledValue !== undefined ? controlledValue : defaultValue !== undefined ? defaultValue : (options[0]?.value ?? '')
  )
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (isOpen && (searchable || options.length > 8)) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('')
    }
  }, [isOpen, searchable, options.length])

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(currentValue))
  }, [options, currentValue])

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const query = searchTerm.toLowerCase()
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(query) || (opt.description && opt.description.toLowerCase().includes(query))
    )
  }, [options, searchTerm])

  const handleSelect = (option: CustomSelectOption) => {
    if (option.disabled || disabled) return
    setInternalValue(option.value)
    setIsOpen(false)

    if (onChange) {
      // Create synthetic event to maintain full backward compatibility with (e) => setVal(e.target.value)
      const syntheticEvent = {
        target: {
          value: option.value,
          name: name || id,
          id: id,
        },
        currentTarget: {
          value: option.value,
          name: name || id,
          id: id,
        },
        stopPropagation: () => {},
        preventDefault: () => {},
      }
      onChange(syntheticEvent as any)
    }
  }

  const showSearch = searchable || options.length > 8

  return (
    <div className={`space-y-1.5 ${containerClassName}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full h-10 ${
            icon ? 'pl-10' : 'pl-3.5'
          } pr-10 rounded-xl border bg-white flex items-center justify-between gap-2 text-xs font-semibold text-slate-800 transition select-none cursor-pointer shadow-2xs text-left ${
            isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 text-blue-950'
              : error
              ? 'border-rose-300 text-rose-900 bg-rose-50/20 hover:border-rose-400'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/40'
          } disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed ${className}`}
        >
          {icon && (
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {icon}
            </span>
          )}

          <div className="flex items-center gap-2 truncate flex-1">
            {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
            <span className={`truncate ${!selectedOption ? 'text-slate-400 font-normal' : ''}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <svg
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-1.5 space-y-1 min-w-full max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            {menuTitle && (
              <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {menuTitle}
              </div>
            )}

            {showSearch && (
              <div className="p-1 pb-1.5 border-b border-slate-100">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search options..."
                    className="w-full h-8 pl-8 pr-3 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-slate-400 font-medium">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(currentValue)
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed text-slate-400'
                          : isSelected
                          ? 'bg-blue-50 text-blue-950 font-bold'
                          : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div className="truncate">
                          <span className="block truncate">{opt.label}</span>
                          {opt.description && (
                            <span className="block text-[10px] text-slate-400 font-normal truncate">
                              {opt.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-blue-600 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>
      ) : null}
    </div>
  )
}
