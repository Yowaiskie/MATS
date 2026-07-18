import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/authentication/AuthContext'
import { OfflineBanner } from '@/components/OfflineBanner'
import { InstallPWAButton } from '@/components/InstallPWAButton'

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
  )
}

export const DashboardLayout: React.FC = () => {
  const { profile, logout } = useAuth()
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

  const navigation = [
    { name: 'Dashboard', href: '/' },
    { name: 'Members', href: '/members' },
    { name: 'Schedules', href: '/schedules' },
    { name: 'Attendance', href: '/attendance' },
    { name: 'Reports', href: '/reports' },
    { name: 'Settings', href: '/settings' },
    { name: 'Audit Trail', href: '/audit' },
  ]

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
    if (path.startsWith('/settings')) return 'System Settings'
    if (path.startsWith('/audit')) return 'System Audit Trail'
    return 'Dashboard'
  }

  return (
    <div className="h-screen bg-[#f8fafc] text-gray-800 flex flex-col font-sans antialiased overflow-hidden">
      {/* Offline Alert Banner */}
      <OfflineBanner />

      {/* Top Navbar */}
      <header className="border-b border-gray-200/80 bg-white sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Hamburger for Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>

            {/* Collapse toggle for Desktop */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden sm:inline-block text-gray-500 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
              aria-label="Toggle sidebar collapse"
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
            <span className="sm:hidden font-bold text-gray-900 text-sm capitalize">{getPageTitle()}</span>
          </div>

          {/* Top Nav Right Actions */}
          <div className="flex items-center space-x-3">
            <InstallPWAButton />
            <span className="text-xs text-gray-500 hidden md:inline-block">
              User: <strong className="text-gray-700 font-semibold">{profile?.email || 'Admin'}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col sm:flex-row relative overflow-hidden">
        {/* Sidebar for Desktop */}
        <aside 
          className={`hidden sm:flex flex-col border-r border-gray-200/80 bg-white p-4 space-y-1.5 transition-all duration-200 ease-in-out shrink-0 overflow-y-auto ${
            collapsed ? 'w-20' : 'w-64'
          }`}
        >
          {/* Logo Brand Header */}
          <div className="flex items-center space-x-3 px-2 pb-4 border-b border-gray-100 mb-4 overflow-hidden">
            <img 
              src="/ministy_logo.jpg" 
              alt="Logo" 
              className="h-9 w-9 rounded-lg border border-gray-200/60 object-cover shrink-0" 
            />
            {!collapsed && (
              <span className="font-extrabold text-base tracking-tight text-gray-900 transition-opacity duration-150">
                MATS Portal
              </span>
            )}
          </div>

          <nav className="space-y-1.5 flex-1">
            {navigation.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 rounded-lg px-3.5 py-2.5 text-sm transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-blue-600'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <span className={`shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                    {icons[item.name]}
                  </span>
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
              onClick={() => setMobileMenuOpen(false)}
            ></div>

            {/* Sidebar drawer */}
            <aside className="relative w-64 max-w-xs bg-white border-r border-gray-200 p-5 space-y-4 flex flex-col z-50 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <img src="/ministy_logo.jpg" alt="Logo" className="h-8 w-8 rounded object-cover" />
                  <span className="font-extrabold text-sm text-gray-900">MATS Portal</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-400 hover:text-gray-900 p-1 rounded-lg"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
                  </svg>
                </button>
              </div>

              <nav className="space-y-1.5 flex-1">
                {navigation.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-blue-600'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className={`shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                        {icons[item.name]}
                      </span>
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Pane */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Outlet renders the matched nested route child */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
