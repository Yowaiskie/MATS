import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { Member } from '@/types/member'

export interface MemberOptionItem {
  id: string
  name: string
  subtitle?: string
  rawMember?: Member
}

interface MemberSearchDropdownProps {
  members?: Member[]
  options?: MemberOptionItem[]
  value?: string // member id or selected name
  onChange: (value: string, selectedItem?: MemberOptionItem) => void
  placeholder?: string
  title?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
  formatDisplayName?: (m: Member) => string
  mode?: 'id' | 'name' // whether value represents member.id or member full name
}

export const MemberSearchDropdown: React.FC<MemberSearchDropdownProps> = ({
  members = [],
  options,
  value = '',
  onChange,
  placeholder = 'Click to search / select name...',
  title = 'Select Member',
  disabled = false,
  className = '',
  allowClear = true,
  formatDisplayName,
  mode = 'id'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Normalize options
  const normalizedOptions = useMemo<MemberOptionItem[]>(() => {
    if (options && options.length > 0) {
      return options
    }

    return members.map(m => {
      const displayName = formatDisplayName 
        ? formatDisplayName(m)
        : `${m.lastName}, ${m.firstName}`
      
      const sub = [m.order, m.rank, m.position].filter(Boolean).join(' • ')

      return {
        id: m.id,
        name: displayName,
        subtitle: sub || 'Altar Server',
        rawMember: m
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [members, options, formatDisplayName])

  // Find currently selected item
  const selectedItem = useMemo(() => {
    if (!value) return null
    if (mode === 'id') {
      return normalizedOptions.find(o => o.id === value) || null
    } else {
      return normalizedOptions.find(o => o.name.toLowerCase() === value.toLowerCase() || o.id === value) || null
    }
  }, [normalizedOptions, value, mode])

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions
    const q = searchQuery.toLowerCase().trim()
    return normalizedOptions.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(q)
      const subMatch = (item.subtitle || '').toLowerCase().includes(q)
      return nameMatch || subMatch
    })
  }, [normalizedOptions, searchQuery])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (item: MemberOptionItem) => {
    const returnValue = mode === 'id' ? item.id : item.name
    onChange(returnValue, item)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', undefined)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* TRIGGER BUTTON (Always in document flow) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setIsOpen(!isOpen)
          setSearchQuery('')
        }}
        className={`w-full p-2.5 sm:p-3 border rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : ''
        } ${
          isOpen
            ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
            : selectedItem
            ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-xs'
            : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-600'
        }`}
      >
        {selectedItem ? (
          <div className="flex items-center justify-between w-full gap-2 min-w-0">
            <div className="truncate min-w-0">
              <span className="block text-xs font-black text-slate-900 truncate">
                {selectedItem.name}
              </span>
              {selectedItem.subtitle && (
                <span className="text-[10px] text-indigo-700 font-bold block truncate">
                  {selectedItem.subtitle}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {allowClear && (
                <span
                  onClick={handleClear}
                  title="Clear selection"
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 px-1.5 py-0.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                >
                  ✕
                </span>
              )}
              <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shadow-xs">
                {isOpen ? 'Close' : 'Change'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-slate-400 truncate">
              {placeholder}
            </span>
            <span className={`text-xs text-slate-400 font-bold shrink-0 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}>▼</span>
          </div>
        )}
      </button>

      {/* FLOATING EXPANDED SEARCH & PICKER PANEL */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 min-w-[280px] p-3.5 sm:p-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-2xl space-y-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-black text-slate-900">{title}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Type to search name, rank, or order..."
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
          />

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                No matching members found.
              </div>
            ) : (
              filteredOptions.map(item => {
                const isSelected = selectedItem?.id === item.id || (mode === 'name' && selectedItem?.name === item.name)
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {item.name}
                      </div>
                      {item.subtitle && (
                        <div className="text-[10px] text-slate-500 font-medium truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
