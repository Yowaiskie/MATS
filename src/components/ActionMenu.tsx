import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

export interface ActionMenuItem {
  id?: string
  key?: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  target?: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  disabled?: boolean
  hidden?: boolean
  title?: string
  description?: string
  dividerAfter?: boolean
}

export interface ActionMenuGroup {
  title?: string
  items: ActionMenuItem[]
}

export interface ActionMenuProps {
  items?: ActionMenuItem[]
  groups?: ActionMenuGroup[]
  trigger?: React.ReactNode
  triggerVariant?: 'meatball' | 'kebab' | 'button' | 'ghost'
  triggerLabel?: string
  ariaLabel?: string
  size?: 'xs' | 'sm' | 'md'
  align?: 'left' | 'right'
  direction?: 'down' | 'up' | 'auto'
  className?: string
  menuWidth?: string
  disabled?: boolean
  tooltip?: string
  onOpenChange?: (open: boolean) => void
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  groups,
  trigger,
  triggerVariant = 'meatball',
  triggerLabel = 'Actions',
  ariaLabel,
  size = 'sm',
  align = 'right',
  direction = 'auto',
  className = '',
  menuWidth = 'w-48',
  disabled = false,
  tooltip,
  onOpenChange
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8

    let openUp = false
    if (direction === 'up') {
      openUp = spaceAbove >= 100 || spaceAbove > spaceBelow
    } else if (direction === 'down') {
      openUp = spaceBelow < 80 && spaceAbove > spaceBelow
    } else {
      // auto: only open upward if bottom viewport is cramped (< 150px) AND above has more space
      openUp = spaceBelow < 150 && spaceAbove > spaceBelow
    }

    const newStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      maxWidth: 'min(calc(100vw - 16px), 340px)',
    }

    if (openUp) {
      newStyle.bottom = `${viewportHeight - rect.top + 6}px`
      newStyle.maxHeight = `${Math.min(460, Math.max(160, spaceAbove - 12))}px`
    } else {
      newStyle.top = `${rect.bottom + 6}px`
      newStyle.maxHeight = `${Math.min(460, Math.max(160, spaceBelow - 12))}px`
    }

    const estimatedWidth = popoverRef.current?.offsetWidth || 210
    const maxLeft = Math.max(8, viewportWidth - estimatedWidth - 8)

    if (align === 'left') {
      const idealLeft = rect.left
      newStyle.left = `${Math.max(8, Math.min(idealLeft, maxLeft))}px`
    } else {
      // align === 'right'
      const idealLeft = rect.right - estimatedWidth
      newStyle.left = `${Math.max(8, Math.min(idealLeft, maxLeft))}px`
    }

    setPositionStyle(newStyle)
  }, [align, direction])

  const toggleMenu = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (disabled) return

    setIsOpen(prev => {
      const next = !prev
      onOpenChange?.(next)
      return next
    })
  }, [disabled, onOpenChange])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    onOpenChange?.(false)
  }, [onOpenChange])

  // Update position when opened and reset scroll
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
      if (popoverRef.current) {
        popoverRef.current.scrollTop = 0
      }
    }
  }, [isOpen, updatePosition])

  // Handle outside click, escape key, scroll, and resize
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        closeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    const handleScrollOrResize = () => {
      updatePosition()
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen, closeMenu, updatePosition])

  // Aggregate items into grouped structure
  const normalizedGroups: ActionMenuGroup[] = groups || (items ? [{ items }] : [])
  const visibleGroups = normalizedGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.hidden)
    }))
    .filter(g => g.items.length > 0)

  if (visibleGroups.length === 0) return null

  // Trigger size styles
  const triggerSizeClasses = {
    xs: 'p-1 text-xs rounded-lg min-w-[24px] min-h-[24px]',
    sm: 'p-1.5 text-xs rounded-xl min-w-[32px] min-h-[32px]',
    md: 'p-2 text-sm rounded-xl min-w-[38px] min-h-[38px]'
  }[size]

  // Item variant styles
  const getItemVariantClass = (variant?: ActionMenuItem['variant'], itemDisabled?: boolean) => {
    if (itemDisabled) {
      return 'text-slate-300 cursor-not-allowed opacity-60'
    }
    switch (variant) {
      case 'primary':
        return 'text-indigo-700 hover:bg-indigo-50/80 hover:text-indigo-900 active:bg-indigo-100/70'
      case 'success':
        return 'text-emerald-700 hover:bg-emerald-50/80 hover:text-emerald-900 active:bg-emerald-100/70'
      case 'warning':
        return 'text-amber-700 hover:bg-amber-50/80 hover:text-amber-900 active:bg-amber-100/70'
      case 'danger':
        return 'text-rose-600 hover:bg-rose-50/90 hover:text-rose-800 active:bg-rose-100/70'
      case 'default':
      default:
        return 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100/80'
    }
  }

  // Position alignment
  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      {trigger ? (
        <div onClick={toggleMenu} className="inline-block cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggleMenu}
          title={tooltip || ariaLabel || triggerLabel}
          aria-label={ariaLabel || triggerLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={`inline-flex items-center justify-center font-bold border transition-all cursor-pointer shadow-2xs select-none ${triggerSizeClasses} ${
            isOpen
              ? 'bg-slate-100 border-slate-300 text-slate-900 ring-2 ring-indigo-500/20'
              : 'bg-white hover:bg-slate-50/90 border-slate-200/90 text-slate-600 hover:text-slate-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {triggerVariant === 'meatball' && (
            <svg
              className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          )}

          {triggerVariant === 'kebab' && (
            <svg
              className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          )}

          {(triggerVariant === 'button' || triggerVariant === 'ghost') && (
            <span className="inline-flex items-center gap-1.5 px-1.5">
              <span>{triggerLabel}</span>
              <svg
                className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </span>
          )}
        </button>
      )}

      {/* Floating Menu Popover via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            role="menu"
            aria-orientation="vertical"
            style={positionStyle}
            className={`${menuWidth} overflow-y-auto bg-white rounded-2xl border border-slate-200/90 shadow-2xl py-1.5 text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100 focus:outline-none`}
            onClick={(e) => e.stopPropagation()}
          >
          {visibleGroups.map((group, gIdx) => (
            <div key={gIdx} className="py-1">
              {group.title && (
                <div className="px-3 py-1 text-[9.5px] font-black uppercase tracking-wider text-slate-400 select-none">
                  {group.title}
                </div>
              )}
              {group.items.map((item, itemIdx) => {
                const itemContent = (
                  <>
                    {item.icon && (
                      <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                        {item.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{item.label}</div>
                      {item.description && (
                        <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5 truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </>
                )

                if (item.href) {
                  return (
                    <React.Fragment key={item.key || itemIdx}>
                      <a
                        href={item.disabled ? undefined : item.href}
                        target={item.target}
                        rel={item.target === '_blank' ? 'noreferrer' : undefined}
                        onClick={(e) => {
                          if (item.disabled) {
                            e.preventDefault()
                            return
                          }
                          closeMenu()
                          item.onClick?.()
                        }}
                        title={item.title}
                        role="menuitem"
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors select-none font-semibold ${getItemVariantClass(item.variant, item.disabled)}`}
                      >
                        {itemContent}
                      </a>
                      {item.dividerAfter && <div className="my-1 border-t border-slate-100" />}
                    </React.Fragment>
                  )
                }

                return (
                  <React.Fragment key={item.key || itemIdx}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (item.disabled) return
                        closeMenu()
                        item.onClick?.()
                      }}
                      title={item.title}
                      role="menuitem"
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors select-none font-semibold cursor-pointer ${getItemVariantClass(item.variant, item.disabled)}`}
                    >
                      {itemContent}
                    </button>
                    {item.dividerAfter && <div className="my-1 border-t border-slate-100" />}
                  </React.Fragment>
                )
              })}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
