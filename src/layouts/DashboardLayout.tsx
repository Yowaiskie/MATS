import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/authentication/AuthContext'
import type { ModuleKey } from '@/types/auth'
import { OfflineBanner } from '@/components/OfflineBanner'
import { InstallPWAButton } from '@/components/InstallPWAButton'

// Icon mappings
const icons: { [key: string]: React.ReactNode } = {
  Dashboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Members: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Schedules: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Attendance: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  Reports: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'User Management': (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'Audit Trail': (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Change Password': (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 7V5a2 2 0 114 0v2" />
    </svg>
  ),
  Excuses: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Finance: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Events: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

export const DashboardLayout: React.FC = () => {
  const { profile, logout, hasModuleAccess } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setLoggingOut(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  // Get human readable title based on path
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/') return 'Dashboard Overview'
    if (path.startsWith('/members')) return 'Member Directory'
    if (path.startsWith('/schedules')) return 'Schedule Management'
    if (path.startsWith('/attendance')) return 'Attendance Tracking'
    if (path.startsWith('/reports')) return 'Reports & Analytics'
    if (path.startsWith('/events')) return 'Event Workspace'
    if (path.startsWith('/finance')) return 'Finance Management'
    if (path.startsWith('/users')) return 'User Management'
    if (path.startsWith('/settings')) return 'System Settings'
    if (path.startsWith('/audit')) return 'System Audit Trail'
    if (path.startsWith('/change-password')) return 'Change Password'
    return 'Dashboard'
  }

  return (
    <div className="h-screen bg-[#f8fafc] text-gray-800 flex flex-col font-sans antialiased overflow-hidden">
      {/* Offline Alert Banner */}
      <OfflineBanner />

      {/* Top Navbar */}
      <header className="border-b border-gray-200/80 bg-white sticky top-0 z-40 shadow-xs backdrop-blur-md bg-white/95">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden text-gray-600 hover:text-gray-900 focus:outline-none p-2 rounded-xl hover:bg-gray-100 transition-all border border-gray-200/60 bg-gray-50/80 active:scale-95 cursor-pointer shadow-2xs"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>

            {/* Collapse Toggle Button for Desktop */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden sm:inline-flex text-gray-500 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-all focus:outline-none cursor-pointer border border-transparent hover:border-gray-200"
              aria-label="Toggle sidebar collapse"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7M19 19l-7-7 7-7"} />
              </svg>
            </button>

            {/* Breadcrumb / Title display */}
            <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span>MATS</span>
              <span>/</span>
              <span className="text-gray-700 font-bold tracking-normal text-sm capitalize">{getPageTitle()}</span>
            </div>
            <span className="sm:hidden font-bold text-gray-900 text-sm capitalize truncate max-w-[160px]">{getPageTitle()}</span>
          </div>

          {/* Top Nav Right Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <InstallPWAButton />
            <span className="text-xs text-gray-500 hidden md:inline-block">
              User: <strong className="text-gray-700 font-semibold">{profile?.email || 'Admin'}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden">
        {/* Sidebar for Desktop */}
        <aside 
          className={`hidden sm:flex flex-col border-r border-slate-200/80 bg-white p-4 transition-all duration-200 ease-in-out shrink-0 overflow-y-auto ${
            collapsed ? 'w-20' : 'w-64'
          }`}
        >
          {/* Logo Brand Header */}
          <div className="flex items-center space-x-3 px-2 pb-4 border-b border-slate-100 mb-3 overflow-hidden shrink-0">
            <div className="relative shrink-0">
              <img 
                src="/favicon/favicon.png" 
                alt="MATS Logo" 
                className="h-9 w-9 rounded-2xl border border-slate-200/80 object-cover shadow-2xs" 
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white"></span>
            </div>
            {!collapsed && (
              <div className="flex items-center gap-2 truncate">
                <span className="font-extrabold text-base tracking-tight text-slate-900 truncate">
                  MATS Portal
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
                  v2.0
                </span>
              </div>
            )}
          </div>

          <nav className="space-y-4 flex-1">
            {[
              {
                section: 'CORE MENU',
                items: [
                  { name: 'Dashboard', href: '/', moduleKey: 'dashboard' },
                  { name: 'Schedules', href: '/schedules', moduleKey: 'schedules' },
                  { name: 'Attendance', href: '/attendance', moduleKey: 'attendance' },
                  { name: 'Members', href: '/members', moduleKey: 'members' },
                ]
              },
              {
                section: 'OPERATIONS',
                items: [
                  { name: 'Events', href: '/events', moduleKey: 'events' as ModuleKey },
                  { name: 'Finance', href: '/finance', moduleKey: 'finance' },
                  { name: 'Reports', href: '/reports', moduleKey: 'reports' },
                  { name: 'Excuses', href: '/excuses', moduleKey: 'excuses' as ModuleKey },
                ]
              },
              {
                section: 'ADMINISTRATIVE',
                items: [
                  { name: 'User Management', href: '/users', moduleKey: 'users' },
                  { name: 'Settings', href: '/settings', moduleKey: 'settings' },
                  { name: 'Audit Trail', href: '/audit', moduleKey: 'audit' },
                  { name: 'Change Password', href: '/change-password', moduleKey: 'changePassword' },
                ]
              }
            ].map((group) => {
              const allowedItems = group.items.filter(item => hasModuleAccess(item.moduleKey as ModuleKey))
              if (allowedItems.length === 0) return null

              return (
                <div key={group.section} className="space-y-1">
                  {!collapsed && (
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3.5 py-1">
                      {group.section}
                    </div>
                  )}
                  {allowedItems.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center space-x-3 rounded-xl px-3.5 py-2.5 text-xs transition-all duration-200 group ${
                          active
                            ? 'bg-indigo-50/90 text-indigo-700 font-extrabold border-r-4 border-indigo-600 shadow-2xs'
                            : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'
                        }`}
                        title={collapsed ? item.name : undefined}
                      >
                        <span className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                          {icons[item.name]}
                        </span>
                        {!collapsed && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          {!collapsed && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-2.5 truncate">
                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                  {profile?.displayName?.[0] || profile?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="truncate">
                  <div className="font-extrabold text-slate-900 truncate text-xs">
                    {profile?.displayName && !profile.displayName.toLowerCase().startsWith('order of') 
                      ? profile.displayName 
                      : (profile?.assignedOrder ? `Order Leader of ${profile.assignedOrder.replace(/^Order of\s*/i, '')}` : profile?.email?.split('@')[0] || 'User')}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 truncate">{profile?.email || 'Admin'}</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity" 
              onClick={() => setMobileMenuOpen(false)}
            ></div>

            {/* Sidebar drawer */}
            <aside className="relative w-64 max-w-xs bg-white border-r border-slate-200/90 p-4 space-y-4 flex flex-col z-50 shadow-2xl animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <img src="/favicon/favicon.png" alt="Logo" className="h-8 w-8 rounded-xl border border-slate-200/60 object-cover shrink-0" />
                  <span className="font-extrabold text-sm text-slate-900 tracking-tight truncate">MATS Portal</span>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all border border-slate-200/80 cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center"
                  aria-label="Close navigation menu"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-4 flex-1 overflow-y-auto">
                {[
                  {
                    section: 'CORE MENU',
                    items: [
                      { name: 'Dashboard', href: '/', moduleKey: 'dashboard' },
                      { name: 'Schedules', href: '/schedules', moduleKey: 'schedules' },
                      { name: 'Attendance', href: '/attendance', moduleKey: 'attendance' },
                      { name: 'Members', href: '/members', moduleKey: 'members' },
                    ]
                  },
                  {
                    section: 'OPERATIONS',
                    items: [
                      { name: 'Events', href: '/events', moduleKey: 'events' as ModuleKey },
                      { name: 'Finance', href: '/finance', moduleKey: 'finance' },
                      { name: 'Reports', href: '/reports', moduleKey: 'reports' },
                      { name: 'Excuses', href: '/excuses', moduleKey: 'excuses' as ModuleKey },
                    ]
                  },
                  {
                    section: 'ADMINISTRATIVE',
                    items: [
                      { name: 'User Management', href: '/users', moduleKey: 'users' },
                      { name: 'Settings', href: '/settings', moduleKey: 'settings' },
                      { name: 'Audit Trail', href: '/audit', moduleKey: 'audit' },
                      { name: 'Change Password', href: '/change-password', moduleKey: 'changePassword' },
                    ]
                  }
                ].map((group) => {
                  const allowedItems = group.items.filter(item => hasModuleAccess(item.moduleKey as ModuleKey))
                  if (allowedItems.length === 0) return null

                  return (
                    <div key={group.section} className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3.5 py-1">
                        {group.section}
                      </div>
                      {allowedItems.map((item) => {
                        const active = isActive(item.href)
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center space-x-3 rounded-xl px-3.5 py-2.5 text-xs transition-all ${
                              active
                                ? 'bg-indigo-50/90 text-indigo-700 font-extrabold border-r-4 border-indigo-600 shadow-2xs'
                                : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span className={`shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {icons[item.name]}
                            </span>
                            <span className="truncate">{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </nav>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
                <div className="truncate">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Signed in as</div>
                  <div className="font-semibold text-slate-800 truncate">{profile?.email || 'Admin'}</div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Pane */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Outlet renders the matched nested route child */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
