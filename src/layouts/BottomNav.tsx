import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/authentication/AuthContext'
import type { ModuleKey } from '@/types/auth'

// ─── Icons ────────────────────────────────────────────────────────────────────

const NavIcon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const s = { width: size, height: size }
  switch (name) {
    case 'Dashboard':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    case 'Schedules':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'Attendance':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    case 'Members':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'Events':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )
    case 'Finance':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'Reports':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'Inventory':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    case 'Excuses':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'User Management':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    case 'Settings':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'Audit Trail':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    case 'Change Password':
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    default:
      return (
        <svg style={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      )
  }
}

// ─── Color themes per module ──────────────────────────────────────────────────
// Each entry: [icon bg, icon text, active ring color]
const MODULE_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
  Dashboard:        { bg: 'bg-indigo-100',  text: 'text-indigo-600',  activeBg: 'bg-indigo-600',  activeText: 'text-white' },
  Schedules:        { bg: 'bg-sky-100',     text: 'text-sky-600',     activeBg: 'bg-sky-500',     activeText: 'text-white' },
  Attendance:       { bg: 'bg-emerald-100', text: 'text-emerald-600', activeBg: 'bg-emerald-600', activeText: 'text-white' },
  Members:          { bg: 'bg-violet-100',  text: 'text-violet-600',  activeBg: 'bg-violet-600',  activeText: 'text-white' },
  Events:           { bg: 'bg-amber-100',   text: 'text-amber-600',   activeBg: 'bg-amber-500',   activeText: 'text-white' },
  Finance:          { bg: 'bg-green-100',   text: 'text-green-600',   activeBg: 'bg-green-600',   activeText: 'text-white' },
  Reports:          { bg: 'bg-blue-100',    text: 'text-blue-600',    activeBg: 'bg-blue-600',    activeText: 'text-white' },
  Inventory:        { bg: 'bg-orange-100',  text: 'text-orange-600',  activeBg: 'bg-orange-500',  activeText: 'text-white' },
  Excuses:          { bg: 'bg-rose-100',    text: 'text-rose-600',    activeBg: 'bg-rose-600',    activeText: 'text-white' },
  'User Management':{ bg: 'bg-purple-100',  text: 'text-purple-600',  activeBg: 'bg-purple-600',  activeText: 'text-white' },
  Settings:         { bg: 'bg-slate-100',   text: 'text-slate-600',   activeBg: 'bg-slate-700',   activeText: 'text-white' },
  'Audit Trail':    { bg: 'bg-teal-100',    text: 'text-teal-600',    activeBg: 'bg-teal-600',    activeText: 'text-white' },
  'Change Password':{ bg: 'bg-pink-100',    text: 'text-pink-600',    activeBg: 'bg-pink-600',    activeText: 'text-white' },
}

const getColor = (name: string) =>
  MODULE_COLORS[name] ?? { bg: 'bg-gray-100', text: 'text-gray-500', activeBg: 'bg-gray-600', activeText: 'text-white' }

// ─── Nav Item Definitions ─────────────────────────────────────────────────────

const ALL_PRIMARY_TABS: { name: string; href: string; moduleKey: ModuleKey; label: string }[] = [
  { name: 'Dashboard',  href: '/',           moduleKey: 'dashboard',  label: 'Home'     },
  { name: 'Schedules',  href: '/schedules',  moduleKey: 'schedules',  label: 'Schedule' },
  { name: 'Attendance', href: '/attendance', moduleKey: 'attendance', label: 'Attend'   },
  { name: 'Members',    href: '/members',    moduleKey: 'members',    label: 'Members'  },
]

const ALL_SECONDARY_ITEMS: { name: string; href: string; moduleKey: ModuleKey; label: string }[] = [
  { name: 'Events',           href: '/events',           moduleKey: 'events',         label: 'Events'    },
  { name: 'Finance',          href: '/finance',          moduleKey: 'finance',         label: 'Finance'   },
  { name: 'Reports',          href: '/reports',          moduleKey: 'reports',         label: 'Reports'   },
  { name: 'Inventory',        href: '/inventory',        moduleKey: 'inventory',       label: 'Inventory' },
  { name: 'Excuses',          href: '/excuses',          moduleKey: 'excuses',         label: 'Excuses'   },
  { name: 'User Management',  href: '/users',            moduleKey: 'users',           label: 'Users'     },
  { name: 'Settings',         href: '/settings',         moduleKey: 'settings',        label: 'Settings'  },
  { name: 'Audit Trail',      href: '/audit',            moduleKey: 'audit',           label: 'Audit'     },
  { name: 'Change Password',  href: '/change-password',  moduleKey: 'changePassword',  label: 'Password'  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface BottomNavProps {
  activeTasksCount: number
  onLogout: () => void
  loggingOut: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BottomNav: React.FC<BottomNavProps> = ({ activeTasksCount, onLogout, loggingOut }) => {
  const { profile, hasModuleAccess } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  // Permission filtering
  const primaryTabs = ALL_PRIMARY_TABS.filter(t => hasModuleAccess(t.moduleKey))
  const primaryHrefs = new Set(primaryTabs.map(t => t.href))
  const secondaryItems = ALL_SECONDARY_ITEMS.filter(
    t => hasModuleAccess(t.moduleKey) && !primaryHrefs.has(t.href)
  )

  // Backfill if fewer than 4 primary tabs
  const displayedPrimary = [...primaryTabs]
  let backfillSecondary = [...secondaryItems]
  while (displayedPrimary.length < 4 && backfillSecondary.length > 0) {
    displayedPrimary.push(backfillSecondary.shift()!)
  }
  const displayedSecondary = backfillSecondary
  const hasMoreItems = displayedSecondary.length > 0
  const isMoreActive = displayedSecondary.some(item => isActive(item.href))

  // User display name
  const displayName =
    profile?.displayName && !profile.displayName.toLowerCase().startsWith('order of')
      ? profile.displayName
      : profile?.assignedOrder
        ? `Leader · ${profile.assignedOrder.replace(/^Order of\s*/i, '')}`
        : profile?.email?.split('@')[0] || 'User'



  const avatarLetter = (profile?.displayName?.[0] || profile?.email?.[0] || 'A').toUpperCase()

  return (
    <>
      {/* ── Bottom Tab Bar ───────────────────────────────────────────────────── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.07)',
        }}
      >
        <div className="flex items-stretch" style={{ height: 62 }}>
          {displayedPrimary.map((tab) => {
            const active = isActive(tab.href)
            const color = getColor(tab.name)
            return (
              <Link
                key={tab.href}
                to={tab.href}
                onClick={() => setMoreOpen(false)}
                className="relative flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-90 select-none"
              >
                {/* Active pill bg behind icon */}
                <span
                  className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 ${
                    active
                      ? `${color.activeBg} shadow-sm`
                      : 'bg-transparent'
                  }`}
                  style={{ width: 40, height: 28 }}
                >
                  <span className={active ? color.activeText : 'text-gray-400'}>
                    <NavIcon name={tab.name} size={18} />
                  </span>
                  {/* Event badge */}
                  {tab.name === 'Events' && activeTasksCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white">
                      {activeTasksCount > 9 ? '9+' : activeTasksCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-none transition-colors duration-150 ${
                    active ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          {hasMoreItems && (
            <button
              onClick={() => setMoreOpen(prev => !prev)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-90 select-none"
            >
              <span
                className={`flex items-center justify-center rounded-2xl transition-all duration-200 ${
                  moreOpen || isMoreActive ? 'bg-indigo-600 shadow-sm' : 'bg-transparent'
                }`}
                style={{ width: 40, height: 28 }}
              >
                {/* Animated dots icon */}
                <svg
                  width={18} height={18}
                  viewBox="0 0 24 24"
                  fill={moreOpen || isMoreActive ? 'white' : 'none'}
                  stroke={moreOpen || isMoreActive ? 'white' : '#9ca3af'}
                  strokeWidth={2}
                >
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </span>
              <span
                className={`text-[10px] font-semibold leading-none transition-colors duration-150 ${
                  moreOpen || isMoreActive ? 'text-gray-800' : 'text-gray-400'
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* ── More Bottom Sheet ─────────────────────────────────────────────────── */}
      {hasMoreItems && moreOpen && (
        <div className="sm:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-[5px] rounded-full bg-gray-200" />
            </div>

            {/* ── User Profile Card ── */}
            <div className="mx-4 mt-3 mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              {/* Avatar */}
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-xl font-black text-indigo-600 text-base bg-indigo-50 border border-indigo-100"
                style={{ width: 42, height: 42 }}
              >
                {avatarLetter}
              </div>
              {/* User info */}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800 text-sm truncate leading-tight">
                  {displayName}
                </div>
                <div className="text-slate-500 text-xs truncate mt-0.5">
                  {profile?.email || ''}
                </div>
              </div>
              {/* Close */}
              <button
                onClick={() => setMoreOpen(false)}
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-slate-200/60 text-slate-600 active:bg-slate-200 transition-colors"
              >
                <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Section label ── */}
            <div className="px-5 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                More Modules
              </span>
            </div>

            {/* ── Secondary nav — simple list rows ── */}
            <div className="px-4 pb-2">
              {displayedSecondary.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`relative flex items-center gap-4 px-3 py-3 rounded-2xl mb-1 transition-all active:scale-[0.98] ${
                      active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Icon */}
                    <span className={`shrink-0 ${active ? 'text-indigo-600' : 'text-slate-500'}`}>
                      <NavIcon name={item.name} size={20} />
                    </span>
                    {/* Label */}
                    <span className={`flex-1 text-sm font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {item.name}
                    </span>
                    {/* Events badge */}
                    {item.name === 'Events' && activeTasksCount > 0 && (
                      <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                        {activeTasksCount > 9 ? '9+' : activeTasksCount}
                      </span>
                    )}
                    {/* Chevron */}
                    <svg className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>

            {/* ── Sign Out ── */}
            <div className="mx-4 mb-4 mt-1">
              <button
                onClick={() => { setMoreOpen(false); onLogout() }}
                disabled={loggingOut}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-red-50 border border-red-100 py-3.5 px-4 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm font-bold text-red-600">
                  {loggingOut ? 'Signing out…' : 'Sign Out'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
