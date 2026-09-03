import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { Member } from '@/types/member'
import { memberService } from '@/services/memberService'
import { getFullName, isOfficerMember } from '@/utils/member'

export interface MemberComboboxProps {
  value: string
  onChange: (name: string, memberUid?: string) => void
  label?: React.ReactNode
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  members?: Member[]
  officersOnly?: boolean
  helperText?: string
  sublabel?: React.ReactNode
  allowCustom?: boolean
}

export const MemberCombobox: React.FC<MemberComboboxProps> = ({
  value,
  onChange,
  label,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  members: providedMembers,
  officersOnly = false,
  helperText,
  sublabel,
  allowCustom = true
}) => {
  const defaultPlaceholder = officersOnly 
    ? 'Search officer or type custom name...' 
    : 'Search masterlist or type custom name...'
  const resolvedPlaceholder = placeholder || defaultPlaceholder

  const [internalMembers, setInternalMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value
  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  // Load members if not provided
  useEffect(() => {
    if (providedMembers && providedMembers.length > 0) {
      setInternalMembers(providedMembers)
      return
    }

    let isMounted = true
    const fetchMasterlist = async () => {
      try {
        setLoading(true)
        const activeList = await memberService.getMembers(false)
        if (isMounted) {
          setInternalMembers(activeList)
        }
      } catch (err) {
        console.error('Failed to load masterlist members in combobox:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchMasterlist()
    return () => {
      isMounted = false
    }
  }, [providedMembers])

  // Candidate members (filtered by officersOnly if enabled)
  const availableMembers = useMemo(() => {
    if (officersOnly) {
      return internalMembers.filter(isOfficerMember)
    }
    return internalMembers
  }, [internalMembers, officersOnly])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtered members
  const filteredMembers = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) {
      return availableMembers.slice(0, 15) // Show top 15 by default
    }

    return availableMembers.filter(m => {
      const firstLast = `${m.firstName} ${m.lastName}`.toLowerCase()
      const lastFirst = `${m.lastName}, ${m.firstName}`.toLowerCase()
      const nickname = (m.nickname || '').toLowerCase()
      const rank = (m.rank || '').toLowerCase()
      const order = (m.order || '').toLowerCase()
      const position = (m.position || '').toLowerCase()

      return (
        firstLast.includes(query) ||
        lastFirst.includes(query) ||
        nickname.includes(query) ||
        rank.includes(query) ||
        order.includes(query) ||
        position.includes(query)
      )
    }).slice(0, 15)
  }, [availableMembers, inputValue])

  const isExactMasterlistMatch = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) return false
    return availableMembers.some(m => {
      const firstLast = `${m.firstName} ${m.lastName}`.toLowerCase()
      const formal = getFullName(m, false).toLowerCase()
      return firstLast === query || formal === query
    })
  }, [availableMembers, inputValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setInputValue(text)
    onChange(text, undefined)
    setIsOpen(true)
    setSelectedIndex(-1)
  }

  const handleSelectMember = (m: Member) => {
    const name = `${m.firstName} ${m.lastName}`
    setInputValue(name)
    onChange(name, m.id)
    setIsOpen(false)
  }

  const handleSelectCustom = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim(), undefined)
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setInputValue('')
    onChange('', undefined)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    const totalOptions = filteredMembers.length + (allowCustom && inputValue.trim() && !isExactMasterlistMatch ? 1 : 0)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1 < totalOptions ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : totalOptions - 1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredMembers.length) {
        e.preventDefault()
        handleSelectMember(filteredMembers[selectedIndex])
      } else if (selectedIndex === filteredMembers.length && allowCustom && inputValue.trim()) {
        e.preventDefault()
        handleSelectCustom()
      } else if (isOpen) {
        // If typing and hit Enter without arrow selection, keep typed text
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {sublabel && <div>{sublabel}</div>}
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          required={required}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        />

        {/* Left User Icon */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        {/* Right Action Icons (Clear / Dropdown Arrow) */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Clear text"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(v => !v)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            tabIndex={-1}
          >
            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-400 mt-1 font-medium">{helperText}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {loading ? (
            <div className="p-4 text-center text-xs font-bold text-slate-400">
              {officersOnly ? 'Loading active officers...' : 'Loading active masterlist...'}
            </div>
          ) : (
            <>
              {/* Header Info */}
              <div className="px-3.5 py-2 bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-100 flex items-center justify-between z-10">
                <span>
                  {inputValue.trim()
                    ? (officersOnly ? 'Search Results (Officers)' : 'Search Results (Masterlist)')
                    : (officersOnly ? 'Active Officers (Masterlist)' : 'Active Members (Masterlist)')}
                </span>
                <span className="font-extrabold text-indigo-600 lowercase">{filteredMembers.length} available</span>
              </div>

              {/* Masterlist items */}
              {filteredMembers.length > 0 ? (
                <div className="p-1 space-y-0.5">
                  {filteredMembers.map((m, idx) => {
                    const isSelected = selectedIndex === idx
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectMember(m)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50 text-indigo-950 font-bold' : 'hover:bg-slate-50 text-slate-800 font-medium'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-extrabold text-slate-900 truncate">
                            {m.firstName} {m.lastName} {m.nickname && <span className="text-slate-400 font-semibold">({m.nickname})</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {m.position ? `${m.position} • ` : ''}{m.order || 'Altar Server'} {m.rank ? `• ${m.rank}` : ''}
                          </div>
                        </div>
                        {m.rank && (
                          <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-100/80">
                            {m.rank}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 font-medium italic">
                  {officersOnly ? 'No matching officers in masterlist.' : 'No matching members in masterlist.'}
                </div>
              )}

              {/* Option to use custom entered name if not exact match */}
              {allowCustom && inputValue.trim() && !isExactMasterlistMatch && (
                <div className="p-1 bg-slate-50/50 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleSelectCustom}
                    onMouseEnter={() => setSelectedIndex(filteredMembers.length)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      selectedIndex === filteredMembers.length ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200' : 'hover:bg-amber-50/60 text-slate-700 font-semibold'
                    }`}
                  >
                    <div className="h-6 w-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                      +
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <div className="text-xs font-black text-slate-900 truncate">
                        Use: "{inputValue.trim()}"
                      </div>
                      <div className="text-[10px] text-amber-700 font-bold">
                        External / Non-masterlist person
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
